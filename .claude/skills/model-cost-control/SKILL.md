---
name: model-cost-control
description: Reduce token usage and usage-limit consumption in Claude Code by choosing the right model and effort level for each task. Use when the user asks about saving tokens, hitting usage limits, reducing costs, which model to use, switching models, effort levels, or says a task is burning through their quota. Also use before starting long or repetitive agentic work, where the default model and effort settings are often more than the task needs.
---

# Model and effort cost control

## The two dials

Most people know they can switch models. Fewer know that **effort level** is a
separate dial that often matters more, because it controls how much the model
thinks before answering, and thinking tokens are billed whether or not you see
them.

Turning both down on work that doesn't need them is the single biggest lever on
usage. Turning both up on work that does is worth it. The skill here is matching
them to the task rather than leaving defaults everywhere.

## Switching model

```
/model              # opens the picker, shows the current model
/model haiku        # switch immediately
/model sonnet
/model opus
/model default      # back to your configured default
```

The switch applies immediately and your conversation context carries over.

**A gotcha worth knowing:** as of v2.1.153, `/model` also saves your choice as
the default for new sessions. In the picker, `Enter` switches and saves, `s`
switches for this session only. Typing `/model haiku` directly behaves like
`Enter`, so it sticks. If you drop to Haiku for one quick job and forget, you'll
still be on Haiku tomorrow.

Other ways in:

```bash
claude --model haiku          # this session only
claude --model sonnet -p "fix the failing tests"
export ANTHROPIC_MODEL=sonnet # this shell's sessions
```

Or persist it in `~/.claude/settings.json` (user) or `.claude/settings.json`
(project):

```json
{ "model": "sonnet" }
```

Run `/status` to see what's currently active.

## Which model

| Alias | Use it for |
|---|---|
| `haiku` | Mechanical work: renaming, formatting, boilerplate, simple lookups, high-volume repetitive edits |
| `sonnet` | The default for most coding: features, tests, docs, review, refactors of moderate scope |
| `opus` | Genuinely hard problems: subtle multi-file bugs, architecture decisions, tricky reasoning |
| `fable` | Tasks larger than one sitting: long autonomous sessions, codebase-scale migrations |
| `opusplan` | Hybrid: Opus while planning, Sonnet for execution |
| `best` | Fable 5 where available, otherwise the latest Opus |

`opusplan` is underused and worth reaching for. Planning is where the deep
reasoning pays off; execution rarely needs it. You get Opus-quality decisions at
close to Sonnet cost for the bulk of the tokens.

Two notes: Fable 5 can bill to usage credits rather than your plan's included
limits, and the picker shows "Requires usage credits" when it does. And on
subscription plans, Opus draws down usage limits considerably faster than
Sonnet, so save it for when Sonnet has actually struggled rather than starting
there by default.

## Effort level

This is the dial people miss.

```
/effort             # interactive slider
/effort low
/effort medium
/effort high        # the default on most models
/effort xhigh
/effort auto        # back to the model default
```

Levels are `low`, `medium`, `high`, `xhigh`, `max`, and the default is `high`
on every model that supports effort (except Opus 4.7, which defaults to `xhigh`).

| Level | When |
|---|---|
| `low` | Short, scoped, latency-sensitive work that isn't intelligence-sensitive |
| `medium` | Cost-sensitive work that can trade off some capability |
| `high` | The balanced default |
| `xhigh` | Deeper reasoning, higher token spend |
| `max` | Demanding tasks, but prone to overthinking and diminishing returns |

**Dropping from `high` to `medium` on routine work is often a bigger saving than
switching model tier**, and it costs less capability than people expect. Try it
before reaching for Haiku.

`low` through `xhigh` persist across sessions when set interactively. `max`
applies to the current session only unless set via `CLAUDE_CODE_EFFORT_LEVEL`.

For one-off deep reasoning without changing your setting, include the word
`ultrathink` anywhere in your prompt. Other phrasings like "think hard" are just
prompt text and don't trigger anything.

## Combining them

The pairing matters more than either alone:

- **Bulk mechanical edits**: `haiku` + `low`
- **Routine feature work**: `sonnet` + `medium`
- **Normal development**: `sonnet` + `high` (the sensible default)
- **Hard debugging**: `opus` + `high` or `xhigh`
- **Long autonomous runs**: `opusplan`, or `fable` if it's genuinely multi-sitting

## Subagents and skills

Subagents inherit the session model unless told otherwise, and they can be a
quiet source of spend when a long task spawns several.

```bash
export CLAUDE_CODE_SUBAGENT_MODEL=haiku
```

That overrides both the per-invocation `model` parameter and any subagent
frontmatter, so it's a blunt but effective cap. Set it to `inherit` to return to
normal resolution.

Individual skills and subagents can also pin their own model and effort in
frontmatter, which is the right approach for a skill that's always cheap or
always expensive:

```yaml
---
name: my-skill
description: ...
model: haiku
effort: low
---
```

## Practical habits

**Check before a long run.** `/status` takes a second and tells you what you're
about to spend the next hour on. Being on Opus at `xhigh` for a file-renaming
task is a common and expensive accident.

**Switch down, not just up.** People remember to switch to Opus for hard
problems and forget to switch back. The saving is in the switching back.

**Watch for the sticky default.** Because `/model` now saves your choice, a
temporary switch becomes permanent unless you use `s` in the picker.

**Don't fight prompt caching.** Claude Code caches automatically, and switching
models mid-session invalidates the cache for the new model. Frequent flip-
flopping costs more than it saves. Pick a model for a phase of work, not per
message.

**Effort first, model second.** When something feels expensive, try dropping
effort a level before dropping a model tier. You usually keep more capability
that way.

## Reference

- Model configuration: https://code.claude.com/docs/en/model-config
- Choosing a model and effort level: https://claude.com/blog/claude-model-and-effort-level-in-claude-code
