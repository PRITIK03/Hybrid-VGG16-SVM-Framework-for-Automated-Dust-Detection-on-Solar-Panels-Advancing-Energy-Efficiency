'use strict';

(() => {
  const root = document.documentElement;
  const themeToggle = document.getElementById('themeToggle');
  const themeMeta = document.querySelector('meta[name="theme-color"]');
  const validThemes = new Set(['light', 'dark']);

  function setTheme(theme) {
    const activeTheme = validThemes.has(theme) ? theme : 'light';
    root.dataset.theme = activeTheme;
    if (themeMeta) themeMeta.content = activeTheme === 'dark' ? '#111411' : '#f7f8f6';
    if (themeToggle) {
      const targetTheme = activeTheme === 'dark' ? 'light' : 'dark';
      themeToggle.setAttribute('aria-label', `Switch to ${targetTheme} theme`);
      themeToggle.title = `Switch to ${targetTheme} theme`;
    }
    try {
      localStorage.setItem('solaris-theme', activeTheme);
    } catch (_) {
      // Theme selection remains available for the current page view.
    }
  }

  let savedTheme;
  try {
    savedTheme = localStorage.getItem('solaris-theme') || localStorage.getItem('theme');
  } catch (_) {
    savedTheme = 'light';
  }
  setTheme(savedTheme);

  themeToggle?.addEventListener('click', () => {
    setTheme(root.dataset.theme === 'dark' ? 'light' : 'dark');
  });

  const links = Array.from(document.querySelectorAll('.nav-link[href^="#"]'));
  const sections = links.map((link) => document.querySelector(link.getAttribute('href'))).filter(Boolean);
  if (!('IntersectionObserver' in window) || !sections.length) return;

  const observer = new IntersectionObserver((entries) => {
    const section = entries
      .filter((entry) => entry.isIntersecting)
      .sort((first, second) => second.intersectionRatio - first.intersectionRatio)[0]?.target;
    if (!section) return;

    links.forEach((link) => {
      const active = link.hash === `#${section.id}`;
      link.classList.toggle('active', active);
      if (active) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
  }, { rootMargin: '-20% 0px -65% 0px', threshold: [0, 0.15, 0.35] });

  sections.forEach((section) => observer.observe(section));
})();
