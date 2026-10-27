/* TT Balloon Bump: the autopilot. It plays the title-screen demo, and the headless check uses it to prove every wave can be
   cleared. The plan is the arcade one: climb above the nearest rival (drifting away while you are under him), then come
   down on his balloons. In the bonus stage it floats to the nearest rising balloon. It only presses the same keys a
   player has: ← →, and a flap at most every 0.18 s. */
(function (root) {
  'use strict';
  const BB = (root.BB = root.BB || {});
  const S = BB.sim;
  const sign = (v) => (v > 0 ? 1 : v < 0 ? -1 : 0);

  function decide(w, pi) {
    const r = w.riders[pi];
    if (!r || r.state !== 'fly') return {};
    const mem = (w.botMem = w.botMem || {});
    const m = (mem[pi] = mem[pi] || { cd: 0 });
    m.cd -= S.DT;
    let lr = 0, want = 6;
    if (w.bonus && w.phase === 'bonus') {
      let o = null, bd = 1e9;
      for (const b of w.bonus.list) {
        if (b.y > 12.6) continue;
        const d = Math.abs(S.wrapDx(b.x - r.x)) + Math.abs(b.y - 1 - r.y) * 0.6;
        if (d < bd) { bd = d; o = b; }
      }
      if (o) {
        const dx = S.wrapDx(o.x - r.x);
        lr = Math.abs(dx) > 0.2 ? sign(dx) : 0;
        want = o.y - 0.6;
      }
    } else {
      let t = null, bd = 1e9;
      for (const o of w.riders) {
        if (o.kind !== 'rival' || o.balloons <= 0 || (o.state !== 'fly' && o.state !== 'pump')) continue;
        const d = Math.abs(S.wrapDx(o.x - r.x)) + Math.abs(o.y - r.y);
        if (d < bd) { bd = d; t = o; }
      }
      if (t) {
        const dx = S.wrapDx(t.x - r.x);
        if (r.y < t.y + 1.1) { // under or level with him: get up there, away from his feet
          lr = Math.abs(dx) < 2.6 ? -sign(dx) || 1 : 0;
          want = t.y + 2.6;
        } else {
          lr = Math.abs(dx) > 0.2 ? sign(dx) : 0;
          want = Math.abs(dx) < 1.2 ? t.y + 1.2 : t.y + 2.4; // right above him: drop onto the balloons
        }
      }
    }
    // dodge a spark that is close
    for (const s of w.sparks) {
      const dx = S.wrapDx(s.x - r.x), dy = s.y - (r.y + 1);
      if (Math.abs(dx) < 2 && Math.abs(dy) < 2) { lr = -sign(dx) || 1; if (dy < 0) want = Math.max(want, r.y + 2); }
    }
    want = Math.min(11, Math.max(2.2, want));
    let flap = false;
    if (m.cd <= 0 && (r.y < want || (r.y < 1.6 && r.ground < 0)) && r.vy < 2.2) { flap = true; m.cd = 0.18; }
    return { lr, flap };
  }
  BB.bot = { decide };
})(typeof window !== 'undefined' ? window : globalThis);
