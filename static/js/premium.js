'use strict';

(() => {
  const themeToggle = document.getElementById('themeToggle');
  const themeMeta = document.querySelector('meta[name="theme-color"]');
  const allowedThemes = new Set(['light', 'dark']);

  function applyTheme(theme, announce = false) {
    const next = allowedThemes.has(theme) ? theme : 'light';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('solaris-theme', next); } catch (_) { /* Theme still works for this page view. */ }
    if (themeMeta) themeMeta.content = next === 'dark' ? '#0b100e' : '#f6f7f4';
    if (themeToggle) {
      const target = next === 'dark' ? 'light' : 'dark';
      themeToggle.setAttribute('aria-label', `Switch to ${target} theme`);
      themeToggle.title = `Switch to ${target} theme`;
      if (announce) {
        themeToggle.classList.remove('theme-confirm');
        requestAnimationFrame(() => themeToggle.classList.add('theme-confirm'));
        window.setTimeout(() => themeToggle.classList.remove('theme-confirm'), 350);
      }
    }
  }

  try {
    const storedTheme = localStorage.getItem('solaris-theme');
    const legacyTheme = localStorage.getItem('theme');
    applyTheme(storedTheme || (allowedThemes.has(legacyTheme) ? legacyTheme : 'light'));
  } catch (_) { applyTheme('light'); }

  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark', true);
    });
  }

  const navLinks = Array.from(document.querySelectorAll('.nav-link[href^="#"]'));
  const sections = navLinks.map((link) => document.querySelector(link.getAttribute('href'))).filter(Boolean);
  if ('IntersectionObserver' in window && sections.length) {
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!visible) return;
      navLinks.forEach((link) => {
        const active = link.getAttribute('href') === `#${visible.target.id}`;
        link.classList.toggle('active', active);
        if (active) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      });
    }, { rootMargin: '-15% 0px -65% 0px', threshold: [0, .15, .35] });
    sections.forEach((section) => observer.observe(section));
  }

  const motionSafe = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (motionSafe && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    document.querySelectorAll('.metric-card, .panel-card').forEach((card) => {
      card.addEventListener('pointermove', (event) => {
        const bounds = card.getBoundingClientRect();
        card.style.setProperty('--pointer-x', `${event.clientX - bounds.left}px`);
        card.style.setProperty('--pointer-y', `${event.clientY - bounds.top}px`);
      });
    });
  }
})();
