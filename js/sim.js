/* TT Balloon Bump: the rules, in fixed 1/120 s steps (S.advance turns any frame rate into the same steps, so a flap is the
   same at 30, 60 or 120 fps). Riders float with two balloons: a flap pushes them up, gravity pulls them down, ← → drift.
   A rider whose feet come down on another rider's balloons pops one; with no balloons left he parachutes into the lake
   and swims away, waving. The field wraps left and right. Also the sparks, the big fish, the bonus stage, the waves,
   and the brother who flies in to pop the nearest rival's balloons. No Three.js here, so node runs it (tools/check.js). */
(function (root) {
  'use strict';
  const BB = (root.BB = root.BB || {});
  const L = BB.levels;
  const DT = 1 / 120;
  const HALF = L.HALF, WIDTH = L.WIDTH, CEIL = L.CEIL;
  const SHIFTS = [0, -WIDTH, WIDTH];
  const EPS = 1e-6;
  const HW = 0.42; // half the width of a rider
  const ABOVE = 0.7; // how much higher your feet must be to pop the other rider's balloon
  const P = {
    grav: 6.6, grav1: 7.6, flap: 3.7, flap1: 3.3, maxUp: 5.2, maxFall: -5, paraFall: -1.35,
    airAcc: 7.5, drag: 1.1, walk: 3, walkAcc: 14, flapPush: 0.7, hold: 0.3, minFlap: 0.1,
  };
  const LV = {
    easy: { lives: 5, airMax: 3.8, rivalMax: 2, rivalFlap: [0.5, 0.64], sparkFrom: 3, sparkMax: 1, sparkEvery: 14, sparkSpeed: 2, waterSafe: true, sparkPops: false, fishPops: false, bonusRise: 1.1 },
    normal: { lives: 3, airMax: 4.3, rivalMax: 3.2, rivalFlap: [0.3, 0.4], sparkFrom: 2, sparkMax: 2, sparkEvery: 9, sparkSpeed: 3, waterSafe: false, sparkPops: true, fishPops: true, bonusRise: 1.5 },
  };
  const KIND = { bird: { speed: 0.9, flap: 1.08, wander: 0.4 }, foxy: { speed: 1, flap: 1, wander: 0.25 }, froggy: { speed: 1.12, flap: 0.95, wander: 0.35 } };
  const PTS = { pop: 500, para: 1000, bpop: 300, perfect: 5000, treat: 100, hi5: 50, life: 20000 };
  const TREATS = ['🍦', '💧', '🧃', '🍪', '🍉', '🍌'];
  const SPAWN = [{ x: -10.3, ground: 0 }, { x: 10.3, ground: 1 }];
  const NOIN = {};

  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const sign = (v) => (v > 0 ? 1 : v < 0 ? -1 : 0);
  const wrapDx = (d) => { while (d > HALF) d -= WIDTH; while (d < -HALF) d += WIDTH; return d; };
  function rng(seed) {
    let a = seed >>> 0 || 1;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const ev = (w, type, o) => w.events.push(Object.assign({ type }, o));
  const H = (r) => (r.balloons > 0 ? 2 : 1); // feet to the top of the balloons

  // ---------- a new game ----------
  function create(o) {
    o = o || {};
    const who = o.players || ['teddy'];
    const w = {
      level: o.level === 'normal' ? 'normal' : 'easy', mode: who.length === 2 && o.mode === 'versus' ? 'versus' : 'coop',
      seed: o.seed || 1, rng: rng(o.seed || 1), sab: o.sab || null, buddyFor: o.buddyFor || ((id) => (id === 'tommy' ? 'teddy' : 'tommy')),
      t: 0, acc: 0, wave: 0, layout: 0, phase: 'ready', phaseT: 0, events: [], riders: [], plats: [], pl: [],
      sparks: [], sparkT: 0, fish: { state: 'idle', t: 0, x: 0, y: -1.5, cd: 2, target: -1, hit: false }, bonus: null, buddy: null,
      calls: 0, nextId: 1, flapScale: 1, overDone: false,
    };
    const lv = LV[w.level];
    who.forEach((id, pi) => {
      w.pl.push({ who: id, score: 0, lives: lv.lives, nextLife: PTS.life, pops: 0 });
      const r = rider(w, { kind: 'player', who: id, pi });
      w.riders.push(r);
    });
    startWave(w, o.wave || 1);
    w.pl.forEach((p, pi) => spawn(w, w.riders[pi], 0));
    return w;
  }
  function rider(w, o) {
    return Object.assign({
      id: w.nextId++, kind: 'rival', who: 'bird', pi: -1, x: 0, y: 0, vx: 0, vy: 0, balloons: 2, state: 'fly', ground: -1,
      inv: 0, face: 1, flapCd: 0, flapBuf: 0, holdT: P.hold, flapK: 0, flaps: 0, t: 0, pumpT: 0, lowT: 0, maxV: 0, ai: null, pumpK: 1,
    }, o);
  }
  function spawn(w, r, inv) {
    const s = SPAWN[r.pi] || SPAWN[0];
    Object.assign(r, { state: 'fly', x: s.x, y: L.SHORE, vx: 0, vy: 0, balloons: 2, ground: s.ground, inv: inv, face: s.x < 0 ? 1 : -1, t: 0, flapBuf: 0, lowT: 0 });
  }
  function startWave(w, n) {
    const lv = LV[w.level], def = L.wave(n), cyc = L.cycle(n);
    w.wave = n;
    w.layout = def.layout;
    w.plats = L.plats(def.layout).map((p) => Object.assign({ th: p.shore ? 4 : L.TH }, p));
    w.riders = w.riders.filter((r) => r.kind === 'player');
    w.sparks = [];
    w.sparkT = lv.sparkEvery * 0.6;
    Object.assign(w.fish, { state: 'idle', t: 0, cd: 2, hit: false });
    w.bonus = null;
    w.phaseT = 0;
    if (def.bonus) {
      w.phase = 'bonus';
      w.bonus = { total: 20, spawned: 0, got: w.pl.map(() => 0), list: [], next: 1.2 };
    } else {
      w.phase = 'ready';
      const sp = L.spots(def.layout, def.riders.length);
      def.riders.forEach((kind, i) => {
        const k = KIND[kind], mult = 1 + 0.08 * cyc;
        const r = rider(w, { kind: 'rival', who: kind, x: sp[i].x, y: sp[i].y, state: 'pump', pumpT: 1.1 + i * 0.45 + w.rng() * 0.4, pumpK: 0, face: sp[i].x < 0 ? 1 : -1 });
        r.ground = w.plats.findIndex((p) => !p.shore && Math.abs(p.y - sp[i].y) < 1e-6 && sp[i].x > p.x0 && sp[i].x < p.x1);
        r.maxV = lv.rivalMax * k.speed * mult;
        r.ai = { t: 0, off: 1.5, wander: false, wdir: 1, cd: 0, flapI: [lv.rivalFlap[0] * k.flap / mult, lv.rivalFlap[1] * k.flap / mult], wanderP: k.wander };
        w.riders.push(r);
      });
    }
    // a player inside an island of the new layout is lifted on top of it
    for (const r of w.riders) {
      if (r.kind !== 'player' || r.state !== 'fly') continue;
      r.ground = -1;
      for (let i = 0; i < w.plats.length; i++) {
        const p = w.plats[i];
        if (overX(r.x, p) && r.y < p.y && r.y + H(r) > p.y - p.th) { r.y = p.y; r.vy = 0; r.ground = i; }
      }
      r.inv = Math.max(r.inv, 1.2);
    }
    ev(w, 'wave', { n, bonus: !!def.bonus });
  }

  // ---------- moving ----------
  function overX(x, p) {
    for (const s of SHIFTS) if (x + s + HW > p.x0 && x + s - HW < p.x1) return true;
    return false;
  }
  function wrap(w, r) {
    if (w.sab === 'noWrap') { // the check's sabotage: walls instead of wrapping
      if (r.x > HALF - HW) { r.x = HALF - HW; r.vx = -Math.abs(r.vx); }
      if (r.x < -HALF + HW) { r.x = -HALF + HW; r.vx = Math.abs(r.vx); }
      return;
    }
    if (r.x >= HALF) { r.x -= WIDTH; ev(w, 'wrap', { r: r.id }); }
    else if (r.x < -HALF) { r.x += WIDTH; ev(w, 'wrap', { r: r.id }); }
  }
  function moveX(w, r) {
    r.x += r.vx * DT;
    const h = H(r);
    for (const p of w.plats) {
      if (r.y >= p.y - EPS || r.y + h <= p.y - p.th + EPS) continue;
      for (const s of SHIFTS) {
        const x = r.x + s;
        if (x + HW <= p.x0 || x - HW >= p.x1) continue;
        r.x = x < (p.x0 + p.x1) / 2 ? p.x0 - HW - s - EPS : p.x1 + HW - s + EPS;
        r.vx = -r.vx * 0.5;
        break;
      }
    }
    wrap(w, r);
  }
  function moveY(w, r) {
    const y0 = r.y, h = H(r);
    if (r.ground >= 0) {
      const p = w.plats[r.ground];
      if (p && overX(r.x, p) && r.vy <= 0) { r.y = p.y; r.vy = 0; return; }
      r.ground = -1;
    }
    r.y += r.vy * DT;
    for (let i = 0; i < w.plats.length; i++) {
      const p = w.plats[i];
      if (!overX(r.x, p)) continue;
      if (r.vy <= 0 && y0 >= p.y - EPS && r.y < p.y) {
        if (r.vy < -2) ev(w, 'land', { r: r.id });
        r.y = p.y; r.vy = 0; r.ground = i;
      } else if (r.vy > 0 && y0 + h <= p.y - p.th + EPS && r.y + h > p.y - p.th) {
        r.y = p.y - p.th - h;
        r.vy = -Math.max(0.6, r.vy * 0.35);
        ev(w, 'bonk', { r: r.id });
      }
    }
    if (r.y + h > CEIL) { r.y = CEIL - h; r.vy = -Math.abs(r.vy) * 0.3; }
  }
  function flyStep(w, r, inp, lv) {
    const lr = sign(inp.lr || 0);
    r.flapCd -= DT;
    if (inp.flap) { r.flapBuf = 0.12; r.holdT = P.hold; }
    else if (inp.hold) { r.holdT -= DT; if (r.holdT <= 0) { r.flapBuf = 0.12; r.holdT = P.hold; } }
    else r.holdT = P.hold;
    r.flapBuf -= DT;
    const stuck = w.sab === 'stuckLand' && r.kind === 'player' && r.ground >= 0; // the play check's sabotage
    if (r.flapBuf > 0 && r.flapCd <= 0 && !stuck) {
      r.flapBuf = 0;
      r.flapCd = P.minFlap;
      const imp = (r.balloons > 1 ? P.flap : P.flap1) * (r.kind === 'player' ? w.flapScale : 1);
      r.vy = Math.min(P.maxUp, Math.max(r.vy, -1.2) + imp);
      r.vx += lr * P.flapPush;
      r.ground = -1;
      r.flapK = 1;
      r.flaps++;
      ev(w, 'flap', { r: r.id });
    }
    const max = r.kind === 'player' ? lv.airMax : r.maxV;
    if (r.ground >= 0) r.vx += clamp(lr * P.walk - r.vx, -P.walkAcc * DT, P.walkAcc * DT);
    else if (lr) r.vx += lr * P.airAcc * DT;
    else r.vx *= 1 - P.drag * DT;
    r.vx = clamp(r.vx, -max, max);
    if (lr) r.face = lr;
    if (r.ground < 0) r.vy = Math.max(P.maxFall, r.vy - (r.balloons > 1 ? P.grav : P.grav1) * DT);
    moveX(w, r);
    moveY(w, r);
  }
  // touching the lake with balloons: on EASY (and in the bonus stage) a splash throws you back up
  function water(w, r, lv) {
    if (r.y > 0 || r.ground >= 0) return;
    if (r.kind === 'rival' || lv.waterSafe || w.phase === 'bonus' || w.phase === 'bonusEnd') {
      r.y = 0;
      r.vy = r.kind === 'rival' ? 6 : 7;
      ev(w, 'splash', { r: r.id, x: r.x });
      if (r.kind === 'player') fishShow(w, r.x);
      return;
    }
    r.balloons = 0;
    ev(w, 'sploosh', { r: r.id, x: r.x });
    toSwim(w, r);
  }
  function paraStep(w, r) {
    r.t += DT;
    const shore = Math.abs(r.x) > 8.3;
    r.vx = (shore ? -sign(r.x) * 1.6 : 0) + 0.5 * Math.sin(r.t * 2.2 + r.id);
    r.vy = P.paraFall;
    r.x += r.vx * DT;
    wrap(w, r);
    r.y += r.vy * DT;
    if (shore && r.y < L.SHORE) r.y = L.SHORE;
    if (!shore && r.y <= -0.15) { ev(w, 'splashDown', { r: r.id, x: r.x }); toSwim(w, r); }
  }
  function toSwim(w, r) {
    r.state = 'swim';
    r.t = 0;
    r.y = -0.15;
    r.vx = r.vy = 0;
    r.ground = -1;
    if (r.kind === 'player') {
      const p = w.pl[r.pi];
      p.lives = Math.max(0, p.lives - 1);
      ev(w, 'lifeLost', { pi: r.pi, lives: p.lives });
    }
  }
  function swimStep(w, r) {
    r.t += DT;
    if (r.kind === 'rival') { if (r.t > 2.6) r.state = 'gone'; return; }
    if (r.t < 1.8) return;
    if (w.pl[r.pi].lives > 0) { spawn(w, r, 2.5); ev(w, 'respawn', { pi: r.pi }); }
    else { r.state = 'out'; ev(w, 'out', { pi: r.pi }); }
  }

  // ---------- the rivals ----------
  function rivalAI(w, r) {
    const ai = r.ai, R = w.rng;
    ai.t -= DT;
    ai.cd -= DT;
    if (ai.t <= 0) {
      ai.t = 0.8 + R() * 1.4;
      ai.off = 0.6 + R() * 2;
      ai.wander = R() < ai.wanderP;
      ai.wdir = R() < 0.5 ? -1 : 1;
    }
    let tgt = null, best = 1e9;
    for (const p of w.riders) {
      if (p.kind !== 'player' || p.state !== 'fly') continue;
      const d = Math.abs(wrapDx(p.x - r.x)) + Math.abs(p.y - r.y);
      if (d < best) { best = d; tgt = p; }
    }
    let lr = 0, want = 7;
    if (tgt && !ai.wander) {
      const dx = wrapDx(tgt.x - r.x);
      lr = Math.abs(dx) > 0.4 ? sign(dx) : 0;
      want = clamp(tgt.y + ai.off, 2.4, 11.4);
    } else lr = ai.wdir;
    let flap = false;
    if (ai.cd <= 0 && (r.y < want || r.y < 2.4)) {
      flap = true;
      ai.cd = r.y < 2.4 ? ai.flapI[0] * 0.8 : ai.flapI[0] + R() * (ai.flapI[1] - ai.flapI[0]);
    }
    return { lr, flap };
  }

  // ---------- bumps ----------
  function canPop(w, top, bot) {
    if (top.kind === 'rival' && bot.kind === 'rival') return false;
    if (top.kind === 'player' && bot.kind === 'player') return w.mode === 'versus';
    return true;
  }
  function pop(w, r, by, how) {
    r.balloons = w.sab === 'paraFirst' ? 0 : Math.max(0, r.balloons - 1); // paraFirst: the check's sabotage
    r.inv = 0.9;
    if (r.state === 'pump') { r.state = 'fly'; r.pumpK = 1; }
    const scorer = by && by.kind === 'player' ? by.pi : -1; // the fish and the sparks score nothing
    if (scorer >= 0) addScore(w, scorer, PTS.pop);
    ev(w, 'pop', { r: r.id, by: by ? by.id : 0, x: r.x, y: r.y + 1.5, left: r.balloons, how: how || 'bump', pts: scorer >= 0 ? PTS.pop : 0 });
    if (r.balloons === 0) {
      r.state = 'para';
      r.t = 0;
      r.ground = -1;
      r.vy = P.paraFall;
      if (scorer >= 0) addScore(w, scorer, PTS.para);
      ev(w, 'para', { r: r.id, x: r.x, y: r.y + 1, pts: scorer >= 0 ? PTS.para : 0 });
    }
  }
  function collide(w) {
    const rs = w.riders.filter((r) => (r.state === 'fly' || r.state === 'pump') && r.balloons > 0);
    for (let i = 0; i < rs.length; i++) {
      for (let j = i + 1; j < rs.length; j++) {
        const a = rs[i], b = rs[j];
        if (a.balloons <= 0 || b.balloons <= 0) continue; // popped earlier in this step
        const dx = wrapDx(b.x - a.x);
        if (Math.abs(dx) >= HW * 2) continue;
        if (a.y >= b.y + H(b) || b.y >= a.y + H(a)) continue;
        const dy = a.y - b.y;
        let top = dy >= ABOVE ? a : dy <= -ABOVE ? b : null;
        if (!top && w.sab === 'anyBump') top = a; // the check's sabotage: any touch pops
        if (top) {
          const bot = top === a ? b : a;
          if (canPop(w, top, bot) && bot.inv <= 0) pop(w, bot, top);
          else ev(w, 'boing', { x: (a.x + b.x) / 2, y: Math.max(a.y, b.y) });
          top.vy = Math.max(top.vy, 4.2);
          top.ground = -1;
          if (bot.state === 'fly') { bot.vy = Math.min(bot.vy, -1.2); bot.ground = -1; }
          const s = sign(wrapDx(top.x - bot.x)) || 1;
          top.vx += s * 0.6;
        } else {
          const s = sign(dx) || 1; // a side bump: both bounce apart, nobody pops
          if (a.state === 'fly') { a.vx = -s * 2.6; a.x -= s * 0.02; }
          if (b.state === 'fly') { b.vx = s * 2.6; b.x += s * 0.02; }
          ev(w, 'boing', { x: a.x + dx / 2, y: (a.y + b.y) / 2 + 1 });
        }
      }
    }
  }

  // ---------- the big fish, the sparks, the bonus balloons ----------
  function fishShow(w, x) {
    const f = w.fish;
    if (f.state !== 'idle') return;
    Object.assign(f, { state: 'jump', t: 0, x, hit: true, target: -1 });
    ev(w, 'fishJump', { x });
  }
  function fishStep(w, lv) {
    const f = w.fish;
    if (f.state === 'idle') {
      f.cd -= DT;
      f.y = -1.5;
      for (const r of w.riders) {
        if (r.kind !== 'player') continue;
        if (r.state === 'fly' && r.ground < 0 && Math.abs(r.x) < 8.3 && r.y < 1.5) r.lowT += DT;
        else r.lowT = 0;
        if (f.cd <= 0 && r.lowT > 0.35 && w.phase !== 'clear') {
          Object.assign(f, { state: 'warn', t: 0, x: r.x, target: r.pi, hit: false });
          ev(w, 'fishWarn', { x: r.x });
          break;
        }
      }
      return;
    }
    f.t += DT;
    if (f.state === 'warn') {
      if (f.t >= 0.6) { f.state = 'jump'; f.t = 0; ev(w, 'fishJump', { x: f.x }); }
      return;
    }
    f.y = -1.2 + 4.2 * Math.sin(Math.PI * Math.min(1, f.t / 0.9));
    if (!f.hit && f.t > 0.12 && f.t < 0.62) {
      for (const r of w.riders) {
        if (r.kind !== 'player' || r.state !== 'fly') continue;
        if (Math.abs(wrapDx(r.x - f.x)) > 1.3 || r.y > f.y + 0.3) continue;
        f.hit = true;
        r.ground = -1;
        if (!lv.fishPops || w.phase === 'bonus') { r.vy = 7.2; ev(w, 'fishSplash', { r: r.id, x: r.x }); }
        else {
          r.vy = 6;
          if (r.inv <= 0) pop(w, r, null, 'fish');
          ev(w, 'fishBoop', { r: r.id, x: r.x });
        }
        break;
      }
    }
    if (f.t >= 0.9) { f.state = 'idle'; f.cd = 3; f.y = -1.5; }
  }
  function sparkStep(w, lv) {
    if (w.phase === 'play' && w.wave >= lv.sparkFrom) {
      w.sparkT -= DT;
      if (w.sparkT <= 0 && w.sparks.length < lv.sparkMax) {
        const c = L.LAYOUTS[w.layout].cloud, a = -Math.PI / 2 + (w.rng() - 0.5) * 2.2;
        w.sparks.push({ id: w.nextId++, x: c[0], y: c[1] - 0.6, vx: Math.cos(a) * lv.sparkSpeed, vy: Math.sin(a) * lv.sparkSpeed, t: 0 });
        w.sparkT = lv.sparkEvery;
        ev(w, 'sparkOut', { x: c[0], y: c[1] });
      }
    }
    for (const s of w.sparks) {
      const y0 = s.y;
      s.t += DT;
      s.x += s.vx * DT;
      if (s.x >= HALF) s.x -= WIDTH; else if (s.x < -HALF) s.x += WIDTH;
      s.y += s.vy * DT;
      if (s.y > CEIL - 0.3) s.vy = -Math.abs(s.vy);
      if (s.y < 0.35) s.vy = Math.abs(s.vy);
      for (const p of w.plats) {
        let inX = false;
        for (const sh of SHIFTS) if (s.x + sh + 0.25 > p.x0 && s.x + sh - 0.25 < p.x1) inX = true;
        if (!inX || s.y - 0.25 >= p.y || s.y + 0.25 <= p.y - p.th) continue;
        if (y0 - 0.25 >= p.y - 0.02) { s.vy = Math.abs(s.vy); s.y = p.y + 0.25; }
        else if (y0 + 0.25 <= p.y - p.th + 0.02) { s.vy = -Math.abs(s.vy); s.y = p.y - p.th - 0.25; }
        else s.vx = -s.vx;
      }
      if (s.t > 16) { s.gone = true; ev(w, 'fizzle', { x: s.x, y: s.y }); continue; }
      for (const r of w.riders) {
        if (r.kind !== 'player' || r.state !== 'fly' || r.inv > 0) continue;
        const dx = wrapDx(s.x - r.x);
        if (Math.abs(dx) > 0.75 || s.y < r.y - 0.3 || s.y > r.y + H(r) + 0.3) continue;
        s.gone = true;
        r.ground = -1;
        if (lv.sparkPops) { pop(w, r, null, 'spark'); r.vy = Math.max(r.vy, 2); ev(w, 'zap', { r: r.id, x: s.x, y: s.y }); }
        else { r.vx = -(sign(dx) || 1) * 3; r.vy = Math.max(r.vy, 2.5); r.inv = 0.8; ev(w, 'tickle', { r: r.id, x: s.x, y: s.y }); }
        break;
      }
    }
    w.sparks = w.sparks.filter((s) => !s.gone);
  }
  const LANES = [-6.5, -3.2, 0, 3.2, 6.5];
  function bonusStep(w, lv) {
    const b = w.bonus;
    b.next -= DT;
    if (b.next <= 0 && b.spawned < b.total) {
      b.list.push({ id: w.nextId++, n: b.spawned, x: LANES[Math.floor(w.rng() * LANES.length)] + (w.rng() - 0.5) * 1.2, y: -0.3, vy: lv.bonusRise * (0.85 + w.rng() * 0.3), ph: w.rng() * 6 });
      b.spawned++;
      b.next = 0.7;
    }
    for (const o of b.list) {
      o.y += o.vy * DT;
      o.x += 0.3 * Math.sin(w.t * 1.3 + o.ph) * DT;
      if (o.y > CEIL + 0.6) { o.gone = true; ev(w, 'bmiss', { x: o.x }); continue; }
      for (const r of w.riders) {
        if (r.kind !== 'player' || r.state !== 'fly') continue;
        if (Math.abs(wrapDx(o.x - r.x)) > 0.85 || o.y < r.y - 0.4 || o.y > r.y + 2.3) continue;
        bpop(w, o, r.pi);
        break;
      }
    }
    b.list = b.list.filter((o) => !o.gone);
    if (b.spawned >= b.total && !b.list.length) {
      const got = b.got.reduce((a, c) => a + c, 0), perfect = got === b.total;
      if (perfect) w.pl.forEach((p, pi) => { if (w.riders[pi].state !== 'out') addScore(w, pi, PTS.perfect); });
      w.phase = 'bonusEnd';
      w.phaseT = 0;
      ev(w, 'bonusEnd', { got, total: b.total, perfect, pts: perfect ? PTS.perfect : 0 });
    }
  }
  function bpop(w, o, pi) {
    o.gone = true;
    w.bonus.got[pi]++;
    addScore(w, pi, PTS.bpop);
    ev(w, 'bpop', { x: o.x, y: o.y, pi, n: o.n, pts: PTS.bpop });
  }

  // ---------- scores ----------
  function addScore(w, pi, n) {
    const p = w.pl[pi];
    if (!p || !n) return;
    p.score += n;
    while (p.score >= p.nextLife) {
      p.nextLife += PTS.life;
      p.lives++;
      ev(w, 'life', { pi });
    }
  }

  // ---------- the brother: pops in, his move, a treat, then flies over and pops the nearest rival's balloons ----------
  function call(w) {
    if (w.phase === 'over') return null;
    if (w.pl.length === 2) { // both brothers are playing: a high five
      w.pl.forEach((p, pi) => { if (w.riders[pi].state !== 'out') addScore(w, pi, PTS.hi5); });
      ev(w, 'hi5', {});
      return 'hi5';
    }
    const me = w.riders[0];
    w.calls++;
    const treat = TREATS[(w.calls - 1) % TREATS.length];
    const b = w.buddy;
    if (!b) {
      w.buddy = { who: w.buddyFor(w.pl[0].who), phase: 'in', t: 0, x: me.x - me.face * 1.5, y: Math.max(1.5, me.y + 0.6), pending: 1, target: null, treat, n: w.calls, popT: 0, bonusLeft: 0, face: me.face, treatDone: false };
      ev(w, 'buddyIn', { who: w.buddy.who, n: w.calls });
    } else {
      b.pending++;
      addScore(w, 0, PTS.treat);
      ev(w, 'treat', { treat, quick: true, pts: PTS.treat });
      if (b.phase === 'out') { b.phase = 'fly'; b.t = 0; b.target = null; }
    }
    return 'buddy';
  }
  function pickTarget(w) {
    const me = w.riders[0];
    let best = null, bd = 1e9;
    for (const r of w.riders) {
      if (r.kind !== 'rival' || r.balloons <= 0 || (r.state !== 'fly' && r.state !== 'pump')) continue;
      const d = Math.hypot(wrapDx(r.x - me.x), r.y - me.y);
      if (d < bd) { bd = d; best = r; }
    }
    return best;
  }
  function buddyStep(w) {
    const b = w.buddy;
    if (!b) return;
    const me = w.riders[0];
    b.t += DT;
    const toward = (tx, ty, sp) => {
      const dx = wrapDx(tx - b.x), dy = ty - b.y, d = Math.hypot(dx, dy);
      if (d > 1e-6) { const k = Math.min(1, (sp * DT) / d); b.x += dx * k; b.y += dy * k; if (Math.abs(dx) > 0.05) b.face = sign(dx); }
      if (b.x >= HALF) b.x -= WIDTH; else if (b.x < -HALF) b.x += WIDTH;
      return d;
    };
    if (b.phase === 'in' || b.phase === 'sig') {
      toward(me.x - me.face * 1.5, clamp(me.y + 0.6, 1.5, 11), 9);
      if (b.phase === 'in' && b.t >= 0.5) { b.phase = 'sig'; b.t = 0; ev(w, 'buddySig', { who: b.who, n: b.n }); }
      else if (b.phase === 'sig') {
        if (!b.treatDone && b.t >= 0.55) { b.treatDone = true; addScore(w, 0, PTS.treat); ev(w, 'treat', { treat: b.treat, pts: PTS.treat }); }
        if (b.t >= 1.3) { b.phase = 'fly'; b.t = 0; b.target = pickTarget(w); ev(w, 'helper', { who: b.who, target: b.target ? b.target.id : 0 }); }
      }
      return;
    }
    if (b.phase === 'fly' || b.phase === 'pop') {
      if (w.bonus && w.phase === 'bonus') { // the bonus stage: he pops the nearest bonus balloons for you
        if (!b.bonusLeft) b.bonusLeft = 3 * b.pending;
        let o = null, bd = 1e9;
        for (const x of w.bonus.list) { const d = Math.hypot(wrapDx(x.x - b.x), x.y - b.y); if (d < bd) { bd = d; o = x; } }
        if (!o) { if (w.bonus.spawned >= w.bonus.total) { b.phase = 'out'; b.t = 0; } return; }
        if (toward(o.x, o.y - 1, 11) < 0.6) { bpop(w, o, 0); ev(w, 'buddyPop', { x: o.x, y: o.y }); if (--b.bonusLeft <= 0) { b.pending = 0; b.phase = 'out'; b.t = 0; } }
        return;
      }
      if (!b.target || b.target.balloons <= 0 || !w.riders.includes(b.target)) {
        b.target = pickTarget(w);
        b.phase = 'fly';
        if (!b.target) { b.pending = 0; b.phase = 'out'; b.t = 0; ev(w, 'buddyDone', {}); return; }
      }
      const r = b.target;
      if (b.phase === 'fly') {
        if (toward(r.x, r.y + 2.1, 11) < 0.35) { b.phase = 'pop'; b.popT = 0; }
        return;
      }
      b.x = r.x; b.y = r.y + 2.1;
      b.popT -= DT;
      if (b.popT <= 0 && w.sab !== 'lazyBuddy') {
        b.popT = 0.22;
        pop(w, r, me, 'buddy');
        ev(w, 'buddyPop', { x: r.x, y: r.y + 1.5 });
        if (r.balloons <= 0) {
          b.target = null;
          b.pending--;
          if (b.pending <= 0 || !pickTarget(w)) { b.pending = 0; b.phase = 'out'; b.t = 0; ev(w, 'buddyDone', {}); }
          else b.phase = 'fly';
        }
      }
      return;
    }
    // out: float up and away
    b.y += 5 * DT;
    if (b.t > 1.2) { w.buddy = null; ev(w, 'buddyOut', {}); }
  }

  // ---------- one step ----------
  function step(w, inp) {
    w.events = [];
    w.t += DT;
    w.phaseT += DT;
    const lv = LV[w.level];
    for (const r of w.riders) {
      r.inv = Math.max(0, r.inv - DT);
      r.flapK = Math.max(0, r.flapK - DT * 4);
      if (r.state === 'fly') {
        flyStep(w, r, r.kind === 'player' ? (inp && inp[r.pi]) || NOIN : r.dummy ? NOIN : rivalAI(w, r), lv);
        water(w, r, lv);
      } else if (r.state === 'pump') {
        r.pumpT -= DT;
        r.pumpK = Math.min(1, r.pumpK + DT / 1.1);
        if (r.pumpT <= 0) { r.state = 'fly'; r.pumpK = 1; r.flapBuf = 0.12; ev(w, 'liftoff', { r: r.id }); }
      } else if (r.state === 'para') paraStep(w, r);
      else if (r.state === 'swim') swimStep(w, r);
    }
    if (w.phase !== 'over') {
      collide(w);
      fishStep(w, lv);
      sparkStep(w, lv);
      if (w.phase === 'bonus') bonusStep(w, lv);
      buddyStep(w);
    }
    w.riders = w.riders.filter((r) => r.state !== 'gone');
    const rivals = w.riders.filter((r) => r.kind === 'rival');
    if (w.phase === 'ready' && w.phaseT >= 1.6) { w.phase = 'play'; w.phaseT = 0; ev(w, 'go', {}); }
    if (w.phase === 'play' || w.phase === 'ready') {
      const down = rivals.filter((r) => r.balloons === 0).length;
      const all = rivals.length > 0 && (w.sab === 'waveEarly' ? down >= rivals.length - 1 : down === rivals.length);
      if (all) { w.phase = 'clear'; w.phaseT = 0; w.sparks = []; ev(w, 'clear', { n: w.wave }); }
    } else if (w.phase === 'clear' && w.phaseT >= 3.2) startWave(w, w.wave + 1);
    else if (w.phase === 'bonusEnd' && w.phaseT >= 3.2) startWave(w, w.wave + 1);
    if (w.phase !== 'over' && w.riders.filter((r) => r.kind === 'player').every((r) => r.state === 'out')) {
      w.phase = 'over';
      w.phaseT = 0;
      w.buddy = null;
      ev(w, 'over', {});
    }
  }
  // any frame time in, whole steps out: input(w) gives this step's keys, after(w) sees each step's events
  function advance(w, dt, input, after) {
    w.acc = Math.min(w.acc + dt, 0.25);
    w.flapScale = w.sab === 'frameFlap' ? dt * 60 : 1; // the check's sabotage: a flap that depends on the frame rate
    let n = 0;
    while (w.acc >= DT - 1e-9) {
      w.acc -= DT;
      step(w, input ? input(w) : null);
      if (after) after(w);
      n++;
    }
    return n;
  }

  BB.sim = { DT, P, LV, PTS, KIND, TREATS, HW, ABOVE, SPAWN, create, step, advance, startWave, call, pop, wrapDx, H, rng, pickTarget, LANES };
})(typeof window !== 'undefined' ? window : globalThis);
