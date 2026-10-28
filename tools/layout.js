/* A layout report for the page in its current size (run in the page by tools/layout.json): the play area on the screen,
   and anything that covers it or each other. */
window.layoutReport = function (label) {
  const R = (el) => { if (!el) return null; const s = getComputedStyle(el); if (s.display === 'none' || s.visibility === 'hidden' || +s.opacity === 0) return null; const r = el.getBoundingClientRect(); return r.width && r.height ? r : null; };
  const hit = (a, b) => a && b && a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1;
  const g = game;
  const [x0, y0] = g.toScreen(-12, 13.4, 0), [x1, y1] = g.toScreen(12, -0.2, 0);
  const field = { left: x0, top: y0, right: x1, bottom: y1, width: x1 - x0, height: y1 - y0 };
  const kit = ['kit-help-btn', 'kit-lang-btn', 'kit-sound-btn'].map((id) => [id, R(document.getElementById(id))]).filter(([, r]) => r);
  const touch = [...document.querySelectorAll('#touch .tk')].map((b) => [b.getAttribute('aria-label') + (b.dataset.p ? ' ' + b.dataset.p : ''), R(b)]).filter(([, r]) => r);
  const hud = [...document.querySelectorAll('#hud .box, #hud .ibtn, #hud .bud')].map((b) => [b.id || b.className, R(b)]).filter(([, r]) => r);
  const problems = [];
  const inField = (r) => hit(r, field);
  for (const [id, r] of kit) { if (inField(r)) problems.push(`${id} over the play area`); for (const [t, tr] of touch) if (hit(r, tr)) problems.push(`${id} over ${t}`); }
  for (const [t, r] of touch) if (inField(r)) problems.push(`${t} over the play area`);
  for (let i = 0; i < touch.length; i++) for (let j = i + 1; j < touch.length; j++) if (hit(touch[i][1], touch[j][1])) problems.push(`${touch[i][0]} over ${touch[j][0]}`);
  for (const [h, r] of hud) { for (const [t, tr] of touch) if (hit(r, tr)) problems.push(`${h} over ${t}`); for (const [id, kr] of kit) if (hit(r, kr)) problems.push(`${h} over ${id}`); }
  const scr = [...document.querySelectorAll('.screen')].find((s) => !s.classList.contains('hidden'));
  if (scr && scr.scrollHeight > scr.clientHeight + 2) problems.push(`${scr.id} scrolls (${scr.scrollHeight} > ${scr.clientHeight})`);
  if (field.left < -1 || field.right > innerWidth + 1 || field.top < -1 || field.bottom > innerHeight + 1) problems.push('the play area is cut off');
  const taps = touch.map(([, r]) => Math.min(r.width, r.height));
  return { label, size: innerWidth + 'x' + innerHeight, field: [Math.round(field.left), Math.round(field.top), Math.round(field.width), Math.round(field.height)], minTap: taps.length ? Math.round(Math.min(...taps)) : null, problems };
};
