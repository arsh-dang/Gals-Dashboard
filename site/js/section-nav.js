// Section jump links: marks the link for the section currently in view.
// Plain links still work without this script; it only adds the highlight.
(function () {
  'use strict';

  const nav = document.getElementById('section-nav');
  if (!nav || !('IntersectionObserver' in window)) return;
  const links = [...nav.querySelectorAll('a[href^="#"]')];
  const sections = links.map((a) => document.querySelector(a.getAttribute('href'))).filter(Boolean);

  function mark(id) {
    links.forEach((a) => {
      const on = a.getAttribute('href') === `#${id}`;
      if (on) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
      // Keep the active chip visible in the sideways-scrolling phone row.
      if (on && nav.scrollWidth > nav.clientWidth) {
        nav.scrollTo({ left: a.offsetLeft - nav.clientWidth / 2 + a.clientWidth / 2, behavior: 'auto' });
      }
    });
  }

  // A section counts as current once its top passes just under the sticky nav.
  const visible = new Map();
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => visible.set(e.target.id, e.isIntersecting));
    const current = sections.find((s) => visible.get(s.id));
    if (current) mark(current.id);
  }, { rootMargin: '-80px 0px -55% 0px' });
  sections.forEach((s) => io.observe(s));
})();
