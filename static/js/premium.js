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
    if (!themeToggle) return;
    const target = next === 'dark' ? 'light' : 'dark';
    themeToggle.setAttribute('aria-label', `Switch to ${target} theme`);
    themeToggle.title = `Switch to ${target} theme`;
    if (announce) {
      themeToggle.classList.remove('theme-confirm');
      requestAnimationFrame(() => themeToggle.classList.add('theme-confirm'));
      window.setTimeout(() => themeToggle.classList.remove('theme-confirm'), 350);
    }
  }

  try {
    const storedTheme = localStorage.getItem('solaris-theme');
    const legacyTheme = localStorage.getItem('theme');
    applyTheme(storedTheme || (allowedThemes.has(legacyTheme) ? legacyTheme : 'light'));
  } catch (_) { applyTheme('light'); }

  themeToggle?.addEventListener('click', () => {
    applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark', true);
  });

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

  // Desktop-only pointer tracking is intentionally subtle and disabled for reduced motion.
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

  // First-run guidance is deliberately self-contained so it does not add a UI dependency.
  const guideKey = 'solaris-onboarding-complete-v1';
  const style = document.createElement('style');
  style.textContent = `
    .guide-trigger{height:30px;display:inline-flex;align-items:center;gap:6px;border:1px solid var(--line);border-radius:7px;background:var(--surface);color:var(--muted);padding:0 9px;font:600 9px 'DM Sans',sans-serif;cursor:pointer;transition:all .2s}
    .guide-trigger:hover{border-color:#8eae90;color:var(--green);transform:translateY(-1px)}.guide-trigger svg{width:14px;height:14px;stroke:currentColor;fill:none;stroke-width:1.6}
    .guide-dialog{width:min(490px,calc(100vw - 30px));max-width:none;padding:0;border:1px solid var(--line);border-radius:18px;background:var(--surface);color:var(--ink);box-shadow:0 30px 100px rgba(0,0,0,.26);overflow:hidden}
    .guide-dialog::backdrop{background:rgba(9,15,11,.48);backdrop-filter:blur(7px);-webkit-backdrop-filter:blur(7px);animation:guide-fade .2s ease both}
    .guide-dialog[open]{animation:guide-enter .34s cubic-bezier(.2,.8,.2,1) both}.guide-top{height:150px;position:relative;overflow:hidden;background:radial-gradient(circle at 75% 30%,rgba(228,215,155,.75),transparent 25%),linear-gradient(135deg,#e9efe4,#dbe8d9 55%,#c9ddcd)}
    html[data-theme="dark"] .guide-top{background:radial-gradient(circle at 75% 30%,rgba(179,155,91,.38),transparent 25%),linear-gradient(135deg,#1d2b21,#24382a 55%,#304535)}
    .guide-top::before{content:"";position:absolute;inset:0;background:linear-gradient(180deg,transparent 30%,rgba(16,28,19,.17))}.guide-sun{position:absolute;width:49px;height:49px;border-radius:50%;right:69px;top:24px;background:#fff8db;box-shadow:0 0 42px rgba(241,212,137,.7);animation:guide-glow 4s ease-in-out infinite}
    .guide-panel{position:absolute;left:17%;right:4%;bottom:-27px;height:95px;display:grid;grid-template-columns:repeat(3,1fr);grid-template-rows:repeat(2,1fr);gap:3px;padding:4px;border:2px solid rgba(255,255,255,.84);border-radius:7px;background:#9eb39f;transform:perspective(220px) rotateX(42deg) rotateZ(-8deg);box-shadow:0 12px 25px rgba(42,72,48,.22)}.guide-panel i{background:linear-gradient(135deg,#506d5b,#7f9b84);border:1px solid rgba(233,243,229,.48)}
    .guide-close{position:absolute;top:12px;right:13px;width:30px;height:30px;border:1px solid rgba(255,255,255,.48);border-radius:50%;background:rgba(255,255,255,.35);color:#34513a;font-size:20px;line-height:1;cursor:pointer;z-index:1}.guide-body{padding:24px 25px 22px}.guide-step{font-size:8px;letter-spacing:1.5px;font-weight:700;color:#6b8a70}.guide-body h2{font:700 22px Manrope,sans-serif;letter-spacing:-.7px;margin:9px 0 7px}.guide-body>p{font-size:11px;line-height:1.7;color:var(--muted);margin:0;max-width:410px}.guide-points{display:grid;gap:9px;margin:19px 0 21px}.guide-point{display:flex;align-items:center;gap:10px;font-size:10px;color:var(--ink)}.guide-point-icon{width:26px;height:26px;border-radius:8px;background:var(--green-soft);color:var(--green);display:grid;place-items:center;flex:none}.guide-point-icon svg{width:14px;height:14px;stroke:currentColor;fill:none;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round}.guide-actions{display:flex;align-items:center;justify-content:space-between;gap:12px}.guide-progress{display:flex;gap:4px}.guide-progress i{width:17px;height:3px;border-radius:3px;background:var(--line);transition:background .2s,width .2s}.guide-progress i.active{width:25px;background:#5b9266}.guide-buttons{display:flex;gap:9px;align-items:center}.guide-skip{border:0;background:transparent;color:var(--muted);font:600 9px 'DM Sans',sans-serif;padding:9px;cursor:pointer}.guide-next{border:0;background:#326e49;color:#fff;border-radius:7px;padding:10px 14px;font:700 9px 'DM Sans',sans-serif;cursor:pointer;transition:transform .2s,background .2s}.guide-next:hover{background:#285e3d;transform:translateY(-1px)}.guide-dialog button:focus-visible{outline:2px solid #6b9b72;outline-offset:3px}
    @keyframes guide-enter{from{opacity:0;transform:translateY(12px) scale(.98)}to{opacity:1;transform:translateY(0) scale(1)}}@keyframes guide-fade{from{opacity:0}to{opacity:1}}@keyframes guide-glow{0%,100%{transform:scale(1);opacity:.85}50%{transform:scale(1.08);opacity:1}}
    @media(max-width:520px){.guide-trigger{width:31px;height:31px;justify-content:center;padding:0;font-size:0}.guide-trigger svg{width:15px;height:15px}.guide-dialog{border-radius:16px}.guide-top{height:126px}.guide-body{padding:20px 19px 18px}.guide-body h2{font-size:20px}.guide-actions{align-items:flex-end}.guide-next{padding:11px 13px}}
    @media(prefers-reduced-motion:reduce){.guide-dialog[open],.guide-dialog::backdrop,.guide-sun{animation:none!important;transition:none!important}}
  `;
  document.head.append(style);

  const topbarActions = document.querySelector('.topbar-right');
  if (!topbarActions) return;
  const guideButton = document.createElement('button');
  guideButton.className = 'guide-trigger';
  guideButton.type = 'button';
  guideButton.setAttribute('aria-label', 'Open quick start guide');
  guideButton.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M9.6 9a2.5 2.5 0 1 1 4.2 1.8c-1 .9-1.8 1.2-1.8 2.7m0 3h.01" stroke-linecap="round"/></svg><span>Quick guide</span>';
  const dialog = document.createElement('dialog');
  dialog.className = 'guide-dialog';
  dialog.setAttribute('aria-labelledby', 'guideTitle');
  dialog.innerHTML = `
    <div class="guide-top" aria-hidden="true"><div class="guide-sun"></div><div class="guide-panel"><i></i><i></i><i></i><i></i><i></i><i></i></div></div>
    <button class="guide-close" type="button" aria-label="Close guide">×</button>
    <div class="guide-body"><div class="guide-step" id="guideStepLabel">WELCOME · 01 / 03</div><h2 id="guideTitle">Clearer decisions start here.</h2><p id="guideDescription">Solaris turns a panel image into a focused dust assessment, helping your team plan the next maintenance step.</p><div class="guide-points" id="guidePoints"></div><div class="guide-actions"><div class="guide-progress" aria-hidden="true"><i></i><i></i><i></i></div><div class="guide-buttons"><button type="button" class="guide-skip">Skip guide</button><button type="button" class="guide-next">Show me around <span aria-hidden="true">→</span></button></div></div></div>`;
  document.body.append(dialog);
  topbarActions.insertBefore(guideButton, themeToggle || topbarActions.firstChild);

  const steps = [
    { eyebrow: 'WELCOME · 01 / 03', title: 'Clearer decisions start here.', description: 'Solaris turns a panel image into a focused dust assessment, helping your team plan the next maintenance step.', points: [['camera', 'Start with a clear JPG or PNG panel image.'], ['shield', 'Images are removed by the current analysis service after processing.']] },
    { eyebrow: 'YOUR WORKFLOW · 02 / 03', title: 'A simple field inspection.', description: 'Capture the panel, run the analysis, then review the dust score and maintenance guidance before moving on.', points: [['upload', 'Upload or drag a panel photo into the inspection area.'], ['chart', 'Review the result and recent scans on this device.']] },
    { eyebrow: 'MODEL NOTES · 03 / 03', title: 'Designed around your model.', description: 'The current application uses VGG16 feature extraction with an SVM classifier. Recommendations are guidance—not a substitute for an on-site safety assessment.', points: [['model', 'VGG16 features are classified by the bundled SVM model.'], ['note', 'Scan history is stored locally in this browser, not in a shared team account.']] }
  ];
  const icons = {
    camera: '<rect x="3" y="6" width="18" height="14" rx="2"/><circle cx="12" cy="13" r="3"/><path d="m7 6 1-2h8l1 2"/>',
    shield: '<path d="M12 3 5 6v5c0 4.5 3 8 7 10 4-2 7-5.5 7-10V6l-7-3Z"/><path d="m9 12 2 2 4-4"/>',
    upload: '<path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5"/><path d="M5 14v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4"/>',
    chart: '<path d="M4 19V5m0 14h16M8 15l3-4 3 2 5-7"/>',
    model: '<path d="M12 3 4 7.5v9L12 21l8-4.5v-9L12 3Z"/><path d="M9 12h6M12 9v6"/>',
    note: '<path d="M5 3h14v18l-7-4-7 4V3Z"/><path d="M9 8h6m-6 4h6"/>'
  };
  let stepIndex = 0;
  const closeGuide = (completed) => {
    if (completed) { try { localStorage.setItem(guideKey, 'true'); } catch (_) { /* Guide can still be dismissed. */ } }
    if (dialog.open) dialog.close();
  };
  const renderStep = () => {
    const step = steps[stepIndex];
    dialog.querySelector('#guideStepLabel').textContent = step.eyebrow;
    dialog.querySelector('#guideTitle').textContent = step.title;
    dialog.querySelector('#guideDescription').textContent = step.description;
    const points = dialog.querySelector('#guidePoints');
    points.replaceChildren();
    step.points.forEach(([icon, text]) => {
      const row = document.createElement('div');
      row.className = 'guide-point';
      const iconBox = document.createElement('span');
      iconBox.className = 'guide-point-icon';
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', '0 0 24 24');
      svg.setAttribute('aria-hidden', 'true');
      svg.innerHTML = icons[icon];
      iconBox.append(svg);
      const label = document.createElement('span');
      label.textContent = text;
      row.append(iconBox, label);
      points.append(row);
    });
    dialog.querySelectorAll('.guide-progress i').forEach((dot, index) => dot.classList.toggle('active', index === stepIndex));
    dialog.querySelector('.guide-skip').textContent = stepIndex === steps.length - 1 ? 'Close' : 'Skip guide';
    dialog.querySelector('.guide-next').innerHTML = stepIndex === steps.length - 1 ? 'Get started <span aria-hidden="true">✓</span>' : 'Continue <span aria-hidden="true">→</span>';
  };
  const openGuide = () => {
    stepIndex = 0;
    renderStep();
    if (!dialog.open) dialog.showModal();
  };
  guideButton.addEventListener('click', openGuide);
  dialog.querySelector('.guide-close').addEventListener('click', () => closeGuide(true));
  dialog.querySelector('.guide-skip').addEventListener('click', () => closeGuide(true));
  dialog.querySelector('.guide-next').addEventListener('click', () => {
    if (stepIndex < steps.length - 1) { stepIndex += 1; renderStep(); }
    else closeGuide(true);
  });
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) closeGuide(true);
  });
  dialog.addEventListener('close', () => guideButton.focus({ preventScroll: true }));
  let hasSeenGuide = false;
  try { hasSeenGuide = localStorage.getItem(guideKey) === 'true'; } catch (_) { /* Show the guide once per page when storage is unavailable. */ }
  if (!hasSeenGuide) window.setTimeout(openGuide, 650);
})();
