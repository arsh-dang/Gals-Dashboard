-- STEM Impact Tracker: survey data store.
--
-- Plain, portable SQL. It runs unchanged on SQLite (Python stdlib) today and is
-- written so it can move to PostgreSQL on Deakin infrastructure without a
-- rewrite. Rules followed to keep it that way:
--   * only standard column types (VARCHAR, TEXT, INTEGER, DATE, BOOLEAN);
--   * no AUTOINCREMENT, no WITHOUT ROWID, no SQLite type quirks, no triggers;
--   * row order is kept in an explicit row_seq column, never relied on from the
--     engine's rowid;
--   * column names keep the exact spelling of the CSVs (ResponseId, StartDate).
--     They are unquoted, so PostgreSQL folds them to lower case; export.py
--     writes the CSV header names from its own list, so this is invisible.
--
-- SQLite only enforces foreign keys when "PRAGMA foreign_keys = ON" is issued
-- on each connection. ingest.py and export.py do that; PostgreSQL always does.
--
-- IMPORTANT: this repo is public. Load synthetic (mock) data only. Real student
-- data belongs on Deakin-approved infrastructure, never in a file in this repo.

-- ---------------------------------------------------------------------------
-- Survey versions and the codebook
-- ---------------------------------------------------------------------------

-- One row per version of the survey instrument (v3, v4, ...). A new version is
-- a new row here plus its codebook rows in question_item.
CREATE TABLE survey_version (
    survey_version   VARCHAR(16)  NOT NULL,
    description      TEXT,
    PRIMARY KEY (survey_version)
);

-- Codebook: one row per exported column of the survey. Built from the Qualtrics
-- QSF file when one is supplied (codebook_source = 'qsf'), or worked out from
-- already-reshaped CSVs when it is not (codebook_source = 'tidy', which has no
-- question text or scale). This is the single place labels should live; the
-- dashboard still has its own LABEL_OVERRIDES map, which is a later clean-up.
CREATE TABLE question_item (
    survey_version   VARCHAR(16)  NOT NULL,
    source_column    VARCHAR(64)  NOT NULL,   -- e.g. Q15_3, Q16, Q25_7
    question_id      VARCHAR(16)  NOT NULL,   -- e.g. Q15 (Qualtrics DataExportTag)
    item_id          VARCHAR(16),             -- choice/statement id within the question, if any
    item_label       TEXT,                    -- wording of the statement or option
    question_text    TEXT,
    question_type    VARCHAR(16),             -- Qualtrics type: MC, Matrix, TE, ...
    block            VARCHAR(64),             -- survey block the question sits in
    scale            VARCHAR(32),             -- e.g. likert4_dk, multi_select, single_choice, free_text
    battery          VARCHAR(16),             -- outcomes, skills, identity, aspirations, ... if any
    activity_type    VARCHAR(128),            -- activity it belongs to, NULL when not activity-specific
    codebook_source  VARCHAR(8)   NOT NULL,
    PRIMARY KEY (survey_version, source_column),
    FOREIGN KEY (survey_version) REFERENCES survey_version (survey_version),
    CHECK (codebook_source IN ('qsf', 'tidy'))
);

CREATE INDEX question_item_question ON question_item (survey_version, question_id);

-- ---------------------------------------------------------------------------
-- Waves
-- ---------------------------------------------------------------------------

-- One row per loaded batch of responses. Every data table below carries
-- wave_id, so waves never mix silently and each one can be removed or reloaded
-- on its own (deleting a wave cascades to all of its data).
CREATE TABLE survey_wave (
    wave_id          VARCHAR(64)  NOT NULL,   -- short label, e.g. 2026-pilot
    survey_version   VARCHAR(16)  NOT NULL,
    collection_start DATE,
    collection_end   DATE,
    source_file      VARCHAR(255) NOT NULL,   -- file name only, never a full path
    date_loaded      VARCHAR(32)  NOT NULL,   -- ISO 8601 timestamp, written by ingest
    is_mock          BOOLEAN      NOT NULL,   -- TRUE = synthetic data
    notes            TEXT,
    PRIMARY KEY (wave_id),
    FOREIGN KEY (survey_version) REFERENCES survey_version (survey_version)
);

-- ---------------------------------------------------------------------------
-- Data tables. Same columns and names as the reshaped CSVs the dashboard's
-- build reads, plus wave_id and row_seq (position in the source CSV, so the
-- export reproduces the file order).
-- ---------------------------------------------------------------------------

-- ResponseId is unique within a wave, not globally: the same Qualtrics id can
-- appear in two waves, so the key is always (wave_id, ResponseId).
CREATE TABLE respondents (
    wave_id                      VARCHAR(64)  NOT NULL,
    row_seq                      INTEGER      NOT NULL,
    ResponseId                   VARCHAR(64)  NOT NULL,
    StartDate                    VARCHAR(32),
    Finished                     BOOLEAN,
    region                       VARCHAR(64),
    gender                       VARCHAR(64),
    language_other_than_english  VARCHAR(8),
    birth_year                   INTEGER,
    is_school_student            VARCHAR(8),
    school                       VARCHAR(128),
    school_level                 VARCHAR(32),
    adult1_occupation            TEXT,
    adult2_occupation            TEXT,
    activities_selected          TEXT,
    pathway                      VARCHAR(32),
    n_activities                 INTEGER,
    did_gals                     BOOLEAN,
    PRIMARY KEY (wave_id, ResponseId),
    UNIQUE (wave_id, row_seq),
    FOREIGN KEY (wave_id) REFERENCES survey_wave (wave_id) ON DELETE CASCADE,
    CHECK (birth_year IS NULL OR (birth_year BETWEEN 1900 AND 2100)),
    CHECK (n_activities IS NULL OR n_activities >= 0)
);

-- Outcome ratings, one row per respondent x activity x statement.
-- score: 1 = No .. 4 = Yes a lot (higher is more positive); NULL for
-- "I do not know". response_code is the raw survey code (1 = Yes a lot ..
-- 4 = No, 5 = I do not know) and is kept for reference only.
CREATE TABLE activity_ratings (
    wave_id        VARCHAR(64)  NOT NULL,
    row_seq        INTEGER      NOT NULL,
    ResponseId     VARCHAR(64)  NOT NULL,
    activity_type  VARCHAR(128) NOT NULL,
    battery        VARCHAR(16)  NOT NULL,
    item           TEXT         NOT NULL,
    response       TEXT,
    response_code  VARCHAR(8),
    score          INTEGER,
    is_dont_know   BOOLEAN,
    source_column  VARCHAR(64)  NOT NULL,
    PRIMARY KEY (wave_id, row_seq),
    UNIQUE (wave_id, ResponseId, activity_type, source_column),
    FOREIGN KEY (wave_id, ResponseId) REFERENCES respondents (wave_id, ResponseId) ON DELETE CASCADE,
    CHECK (score IS NULL OR score BETWEEN 1 AND 4)
);

-- Multi-select skills / identity batteries, one row per option ticked.
CREATE TABLE battery_selections (
    wave_id        VARCHAR(64)  NOT NULL,
    row_seq        INTEGER      NOT NULL,
    ResponseId     VARCHAR(64)  NOT NULL,
    activity_type  VARCHAR(128) NOT NULL,
    battery        VARCHAR(16)  NOT NULL,
    item           TEXT         NOT NULL,
    source_column  VARCHAR(64)  NOT NULL,
    PRIMARY KEY (wave_id, row_seq),
    UNIQUE (wave_id, ResponseId, activity_type, battery, item, source_column),
    FOREIGN KEY (wave_id, ResponseId) REFERENCES respondents (wave_id, ResponseId) ON DELETE CASCADE
);

-- Future / aspirations matrix, same 1-4 scoring as activity_ratings.
CREATE TABLE aspirations (
    wave_id        VARCHAR(64)  NOT NULL,
    row_seq        INTEGER      NOT NULL,
    ResponseId     VARCHAR(64)  NOT NULL,
    item           TEXT         NOT NULL,
    response       TEXT,
    response_code  VARCHAR(8),
    score          INTEGER,
    is_dont_know   BOOLEAN,
    source_column  VARCHAR(64)  NOT NULL,
    PRIMARY KEY (wave_id, row_seq),
    UNIQUE (wave_id, ResponseId, source_column),
    FOREIGN KEY (wave_id, ResponseId) REFERENCES respondents (wave_id, ResponseId) ON DELETE CASCADE,
    CHECK (score IS NULL OR score BETWEEN 1 AND 4)
);

-- Subject-selection and career-decision questions, one row per option picked.
CREATE TABLE subject_career (
    wave_id        VARCHAR(64)  NOT NULL,
    row_seq        INTEGER      NOT NULL,
    ResponseId     VARCHAR(64)  NOT NULL,
    question_group VARCHAR(64)  NOT NULL,
    question       TEXT         NOT NULL,
    item           TEXT         NOT NULL,
    multi_select   BOOLEAN      NOT NULL,
    source_column  VARCHAR(64)  NOT NULL,
    PRIMARY KEY (wave_id, row_seq),
    UNIQUE (wave_id, ResponseId, question, item),
    FOREIGN KEY (wave_id, ResponseId) REFERENCES respondents (wave_id, ResponseId) ON DELETE CASCADE
);

-- Free-text answers. Can contain anything a respondent typed, so it is the
-- riskiest table if real data is ever loaded.
CREATE TABLE open_text (
    wave_id        VARCHAR(64)  NOT NULL,
    row_seq        INTEGER      NOT NULL,
    ResponseId     VARCHAR(64)  NOT NULL,
    question       TEXT         NOT NULL,
    source_column  VARCHAR(64)  NOT NULL,
    response       TEXT         NOT NULL,
    PRIMARY KEY (wave_id, row_seq),
    UNIQUE (wave_id, ResponseId, source_column),
    FOREIGN KEY (wave_id, ResponseId) REFERENCES respondents (wave_id, ResponseId) ON DELETE CASCADE
);
