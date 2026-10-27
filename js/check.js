/* TT Balloon Bump: the headless check. The brief's rules, run on the real js/sim.js with no page and no Three.js:
   flapping is the same at 30, 60 and 120 fps; only a bump from above pops a balloon; a rider loses one balloon, then
   parachutes; a wave ends when every rival is down; the screen wraps. Plus the brother, the lake and the fish, the
   sparks, the bonus stage, 2 players, and the autopilot clearing every wave on EASY and NORMAL.
     BB.check.run()   every check (node tools/check.js, or game.check() in the page)
     BB.check.fail()  switches on one sabotage at a time in the rules and makes sure its check catches it */
(function (root) {
  'use strict';
  const BB = (root.BB = root.BB || {});
  const S = BB.sim, L = BB.levels;
  const near = (a, b, e) => Math.abs(a - b) <= (e || 1e-9);

  // a quiet test world: no rivals unless asked, open sky (only the two shores), no fish, no sparks
  function lab(o) {
    o = o || {};
    const w = S.create({ level: o.level || 'easy', players: o.players || ['teddy'], mode: o.mode, seed: o.seed || 7, sab: o.sab });
    w.riders = w.riders.filter((r) => r.kind === 'player');
    if (!o.islands) w.plats = w.plats.filter((p) => p.shore);
    w.phase = 'play';
    w.fish.cd = 1e9;
    w.sparkT = 1e9;
    return w;
  }
  function put(r, x, y, vx, vy) { Object.assign(r, { x, y, vx: vx || 0, vy: vy || 0, ground: -1, state: 'fly', balloons: 2, inv: 0 }); return r; }
  function dummy(w, who, x, y, vx, vy) {
    const r = { id: w.nextId++, kind: 'rival', who: who || 'bird', pi: -1, x, y, vx: vx || 0, vy: vy || 0, balloons: 2, state: 'fly', ground: -1, inv: 0, face: 1, flapCd: 0, flapBuf: 0, holdT: 0.3, flapK: 0, flaps: 0, t: 0, pumpT: 0, lowT: 0, maxV: 3, ai: null, pumpK: 1, dummy: true };
    w.riders.push(r);
    return r;
  }
  const run = (w, secs, inp, each) => {
    const n = Math.round(secs / S.DT);
    for (let i = 0; i < n; i++) { S.step(w, typeof inp === 'function' ? inp(w, i) : inp); if (each && each(w, i) === false) return i; }
    return n;
  };
  const evs = (w, secs, inp) => { const out = []; run(w, secs, inp, (w2) => { out.push(...w2.events); }); return out; };

  const CHECKS = {};

  // ---------- flapping is the same at 30, 60 and 120 fps ----------
  const PRESSES = [0, 0.4, 0.8, 1, 1.2, 1.6, 2.4, 2.6, 3.3];
  function flapRun(fps, sab) {
    const w = lab({ sab });
    const r = put(w.riders[0], -6, 3);
    const out = [];
    const frames = Math.round(4.5 * fps);
    for (let k = 0; k < frames; k++) {
      const t = k / fps;
      let pressed = PRESSES.some((p) => near(p, t, 1e-7));
      const lr = t >= 0.5 && t < 1.5 ? 1 : t >= 2 && t < 2.8 ? -1 : 0;
      const hold = t >= 3.3 && t < 4.1;
      S.advance(w, 1 / fps, () => { const i = [{ lr, flap: pressed, hold: hold || pressed }]; pressed = false; return i; });
      const k30 = ((k + 1) * 30) / fps;
      if (near(k30, Math.round(k30), 1e-7)) out.push([r.x, r.y, r.vy, r.flaps]);
    }
    return out;
  }
  CHECKS.flapFps = (sab) => {
    const a = flapRun(30, sab), b = flapRun(60, sab), c = flapRun(120, sab);
    let worst = 0;
    for (let i = 0; i < a.length; i++) for (let j = 0; j < 4; j++) worst = Math.max(worst, Math.abs(a[i][j] - b[i][j]), Math.abs(a[i][j] - c[i][j]));
    // and a flap really lifts you: from a standstill, one flap and you go up
    const w = lab({ sab });
    const r = put(w.riders[0], -6, 3);
    S.advance(w, 1 / 60, () => [{ flap: true }]);
    const up = r.vy > 2;
    const flaps = a[a.length - 1][3];
    const ok = a.length === b.length && b.length === c.length && worst < 1e-9 && up && flaps >= 10;
    return { ok, info: `${a.length} samples at 30, 60 and 120 fps, largest difference ${worst.toExponential(1)} m; ${flaps} flaps (8 taps + holding Space); one flap from rest: vy ${r.vy.toFixed(2)} m/s` };
  };

  // ---------- only a bump from above pops a balloon ----------
  CHECKS.onlyFromAbove = (sab) => {
    const fails = [];
    const meet = (setup) => {
      const w = lab({ sab, players: setup.players, mode: setup.mode });
      const a = setup.a(w), b = setup.b(w);
      run(w, 1.2, null, () => !(a.balloons < 2 || b.balloons < 2) || false);
      return { a: a.balloons, b: b.balloons };
    };
    // the player comes down on the rival's balloons: the rival's pops, the player's don't
    let r = meet({ a: (w) => put(w.riders[0], 0.2, 5.4, 0, -2), b: (w) => dummy(w, 'bird', 0, 4) });
    if (!(r.a === 2 && r.b === 1)) fails.push(`from above: player ${r.a}, rival ${r.b} (want 2, 1)`);
    // level with each other, side by side: they bounce apart, nobody pops
    let bounced = false;
    {
      const w = lab({ sab });
      const a = put(w.riders[0], -1.4, 4, 3, 0), b = dummy(w, 'bird', 0, 4, -1, 0);
      run(w, 1, null, (w2) => { if (w2.events.some((e) => e.type === 'boing')) bounced = a.vx < 0 && b.vx > 0; });
      if (a.balloons !== 2 || b.balloons !== 2) fails.push(`side bump popped: player ${a.balloons}, rival ${b.balloons}`);
      if (!bounced) fails.push('side bump did not bounce them apart');
    }
    // the player rises up into the rival from below: the rival keeps both, the player (the lower one) loses one
    r = meet({ a: (w) => put(w.riders[0], 0.1, 2.6, 0, 3), b: (w) => dummy(w, 'bird', 0, 4) });
    if (!(r.a === 1 && r.b === 2)) fails.push(`from below: player ${r.a}, rival ${r.b} (want 1, 2)`);
    // a rival coming down on the player pops the player's balloon
    r = meet({ a: (w) => put(w.riders[0], 0, 4), b: (w) => dummy(w, 'foxy', 0.1, 5.4, 0, -2) });
    if (!(r.a === 1 && r.b === 2)) fails.push(`rival from above: player ${r.a}, rival ${r.b} (want 1, 2)`);
    // two rivals never pop each other
    r = meet({ a: (w) => dummy(w, 'bird', 0, 4), b: (w) => dummy(w, 'foxy', 0.1, 5.4, 0, -2) });
    if (!(r.a === 2 && r.b === 2)) fails.push(`rival on rival: ${r.a}, ${r.b} (want 2, 2)`);
    // 2 players: co-op brothers bounce, versus brothers pop from above
    r = meet({ players: ['teddy', 'tommy'], mode: 'coop', a: (w) => put(w.riders[0], 0, 5.4, 0, -2), b: (w) => put(w.riders[1], 0.1, 4) });
    if (!(r.a === 2 && r.b === 2)) fails.push(`co-op: ${r.a}, ${r.b} (want 2, 2)`);
    r = meet({ players: ['teddy', 'tommy'], mode: 'versus', a: (w) => put(w.riders[0], 0, 5.4, 0, -2), b: (w) => put(w.riders[1], 0.1, 4) });
    if (!(r.a === 2 && r.b === 1)) fails.push(`versus from above: ${r.a}, ${r.b} (want 2, 1)`);
    // 400 random meetings: every pop came from a rider whose feet were at least 0.7 m higher
    const R = S.rng(99);
    let pops = 0, bad = 0;
    for (let i = 0; i < 400; i++) {
      const w = lab({ sab });
      const a = put(w.riders[0], (R() - 0.5) * 2, 3 + R() * 4, (R() - 0.5) * 6, (R() - 0.5) * 8);
      const b = dummy(w, 'bird', (R() - 0.5) * 2, 3 + R() * 4, (R() - 0.5) * 6, (R() - 0.5) * 8);
      run(w, 0.6, null, (w2) => {
        for (const e of w2.events) {
          if (e.type !== 'pop' || e.how !== 'bump') continue;
          pops++;
          const by = e.by === a.id ? a : b, got = by === a ? b : a;
          if (by.y - got.y < S.ABOVE - 0.12) bad++;
        }
      });
    }
    if (bad) fails.push(`${bad} of ${pops} random pops came from a rider who was not above`);
    return { ok: !fails.length, info: fails.length ? fails.join('; ') : `from above pops (player 2, rival 1); side bumps bounce apart; from below the higher rider wins; rivals never pop rivals; co-op bounces, versus pops; 400 random meetings: all ${pops} pops from above` };
  };

  // ---------- a rider loses one balloon, then parachutes ----------
  CHECKS.oneThenParachute = (sab) => {
    const fails = [];
    const w = lab({ sab });
    const me = w.riders[0];
    const b = dummy(w, 'bird', 0, 4);
    put(me, 0.1, 5.4, 0, -2);
    run(w, 1, null, () => b.balloons === 2);
    if (b.balloons !== 1 || b.state !== 'fly') fails.push(`after one bump: ${b.balloons} balloons, ${b.state} (want 1, fly)`);
    run(w, 1);
    Object.assign(b, { x: 0, y: 4, vx: 0, vy: 0 });
    put(me, 0.1, 5.4, 0, -2);
    run(w, 1, null, () => b.balloons === 1);
    if (b.balloons !== 0 || b.state !== 'para') fails.push(`after two bumps: ${b.balloons} balloons, ${b.state} (want 0, para)`);
    // the parachute floats down gently into the lake, he swims and waves, and goes
    let slow = true, splash = false, swam = false;
    run(w, 12, null, (w2) => {
      if (b.state === 'para' && Math.abs(b.vy - S.P.paraFall) > 1e-9) slow = false;
      if (w2.events.some((e) => e.type === 'splashDown' && e.r === b.id)) splash = true;
      if (b.state === 'swim') swam = true;
    });
    if (!slow || !splash || !swam || w.riders.includes(b)) fails.push(`parachute: slow ${slow}, splash ${splash}, swam ${swam}, gone ${!w.riders.includes(b)}`);
    // the same for a player: one balloon, then the parachute, a life, and back on the shore with two
    const w2 = lab({ sab });
    const p = w2.riders[0];
    put(p, 0, 4);
    const f1 = dummy(w2, 'foxy', 0.1, 5.4, 0, -2);
    run(w2, 1, null, () => p.balloons === 2);
    const one = p.balloons, st = p.state;
    run(w2, 1);
    put(p, 0, 4); p.balloons = 1;
    Object.assign(f1, { x: 0.1, y: 5.4, vy: -2, vx: 0 });
    run(w2, 1, null, () => p.balloons === 1);
    const para = p.state;
    run(w2, 14, null, () => p.state !== 'fly' || p.balloons !== 2);
    if (one !== 1 || st !== 'fly' || para !== 'para') fails.push(`player: ${one} balloons ${st}, then ${para} (want 1 fly, then para)`);
    if (w2.pl[0].lives !== S.LV.easy.lives - 1 || p.state !== 'fly' || p.balloons !== 2) fails.push(`player after the swim: lives ${w2.pl[0].lives}, ${p.state}, ${p.balloons} balloons`);
    return { ok: !fails.length, info: fails.length ? fails.join('; ') : `rival: 2 → 1 (still flying) → 0 (parachute at ${-S.P.paraFall} m/s), splash, swims and waves, gone; player: the same, a life, back on the shore with 2 balloons` };
  };

  // ---------- a wave ends when every rival is down ----------
  CHECKS.waveEnds = (sab) => {
    const fails = [];
    for (const level of ['easy', 'normal']) {
      const w = S.create({ level, seed: 3, sab });
      w.riders[0].inv = 1e9;
      w.fish.cd = 1e9;
      run(w, 3);
      const rivals = w.riders.filter((r) => r.kind === 'rival');
      if (rivals.length !== 3) { fails.push(`${level}: wave 1 has ${rivals.length} rivals`); continue; }
      const me = w.riders[0];
      const down = (r) => { S.pop(w, r, me); r.inv = 0; S.pop(w, r, me); };
      down(rivals[0]);
      down(rivals[1]);
      let early = false;
      run(w, 6, null, (w2) => { if (w2.phase !== 'play') early = true; });
      if (early || rivals[2].balloons === 0) fails.push(`${level}: with one rival still up the wave is ${w.phase}`);
      down(rivals[2]);
      run(w, S.DT);
      if (w.phase !== 'clear') fails.push(`${level}: every rival down but the wave is ${w.phase}`);
      run(w, 3.3);
      const next = w.riders.filter((r) => r.kind === 'rival').length;
      if (w.wave !== 2 || next !== 3) fails.push(`${level}: next wave ${w.wave} with ${next} rivals`);
    }
    // the bonus stage (wave 4) ends when every bonus balloon is popped or gone, then wave 5
    const w = S.create({ level: 'easy', seed: 4, wave: 4, sab });
    const got = evs(w, 30, (w2) => [BB.bot.decide(w2, 0)]).filter((e) => e.type === 'bonusEnd')[0];
    if (!got || w.wave !== 5) fails.push(`bonus stage: ended ${!!got}, now wave ${w.wave}`);
    return { ok: !fails.length, info: fails.length ? fails.join('; ') : `EASY and NORMAL: 2 of 3 rivals down keeps the wave going for 6 s; the 3rd down ends it at once; 3.2 s later wave 2 with 3 rivals; the bonus stage ends (${got.got}/${got.total} balloons) and wave 5 starts` };
  };

  // ---------- the screen wraps ----------
  CHECKS.wraps = (sab) => {
    const fails = [];
    for (const dir of [1, -1]) {
      const w = lab({ sab });
      const r = put(w.riders[0], dir * 11.2, 6, dir * 3.5, 0);
      let crossed = false, maxJump = 0, lastX = r.x;
      run(w, 0.9, () => [{ lr: dir, hold: true }], () => {
        if (Math.abs(r.x - lastX) > 20) crossed = true;
        else maxJump = Math.max(maxJump, Math.abs(r.x - lastX));
        lastX = r.x;
      });
      if (!crossed || Math.sign(r.x) !== -dir || Math.abs(r.x) > 11.5 || Math.sign(r.vx) !== dir) fails.push(`${dir > 0 ? '→' : '←'}: crossed ${crossed}, now x ${r.x.toFixed(2)}, vx ${r.vx.toFixed(2)}`);
      if (maxJump > 0.1) fails.push(`a jump of ${maxJump.toFixed(2)} m inside the field`);
    }
    // a rival wraps too, and a bump across the seam counts (the player at the right edge, the rival at the left)
    const w = lab({ sab });
    const d = dummy(w, 'bird', -11.6, 6, -4, 0);
    run(w, 0.5);
    if (d.x < 0) fails.push(`the rival did not wrap (x ${d.x.toFixed(2)})`);
    const w2 = lab({ sab });
    const me = put(w2.riders[0], 11.85, 5.4, 0, -2), b = dummy(w2, 'bird', -11.9, 4);
    run(w2, 1, null, () => b.balloons === 2);
    if (b.balloons !== 1) fails.push(`a bump across the seam did not pop (rival ${b.balloons})`);
    void me;
    return { ok: !fails.length, info: fails.length ? fails.join('; ') : 'off the right edge → back on the left, and the other way, keeping speed; rivals wrap; a bump across the seam pops' };
  };

  // ---------- the brother flies in and pops the nearest rival's balloons ----------
  CHECKS.buddy = (sab) => {
    const fails = [];
    for (const who of ['teddy', 'tommy']) {
      const w = S.create({ level: 'easy', players: [who], seed: 5, sab });
      w.riders[0].inv = 1e9;
      w.fish.cd = 1e9;
      run(w, 2.6);
      const me = w.riders[0];
      const rivals = w.riders.filter((r) => r.kind === 'rival');
      const score0 = w.pl[0].score;
      S.call(w);
      const want = who === 'teddy' ? 'tommy' : 'teddy';
      if (!w.buddy || w.buddy.who !== want) fails.push(`${who}: the buddy is ${w.buddy && w.buddy.who} (want ${want})`);
      // the rival nearest to you when he sets off, worked out here on its own
      let nearest = null;
      const seen = [];
      run(w, 5, null, (w2) => {
        for (const e of w2.events) {
          seen.push(e.type);
          if (e.type !== 'helper') continue;
          let bd = 1e9;
          for (const r of rivals) {
            if (r.balloons <= 0) continue;
            const d = Math.hypot(S.wrapDx(r.x - me.x), r.y - me.y);
            if (d < bd) { bd = d; nearest = r; }
          }
          if (!nearest || e.target !== nearest.id) fails.push(`${who}: he set off for rival ${e.target}, the nearest is ${nearest && nearest.id}`);
        }
      });
      if (!nearest) { fails.push(`${who}: he never set off`); continue; }
      for (const t of ['buddySig', 'treat', 'helper', 'buddyPop']) if (!seen.includes(t)) fails.push(`${who}: no ${t}`);
      if (nearest.balloons !== 0) fails.push(`${who}: the nearest rival still has ${nearest.balloons}`);
      const others = rivals.filter((r) => r !== nearest && r.balloons === 2).length;
      if (others !== rivals.length - 1) fails.push(`${who}: ${rivals.length - 1 - others} other rivals were popped`);
      if (w.pl[0].score - score0 < S.PTS.treat + 2 * S.PTS.pop + S.PTS.para) fails.push(`${who}: score +${w.pl[0].score - score0}`);
    }
    // call as often as you like: six calls in a row, every one answered, and the whole wave goes down
    const w = S.create({ level: 'normal', seed: 6, sab });
    w.riders[0].inv = 1e9;
    w.fish.cd = 1e9;
    run(w, 2.6);
    let treats = 0;
    for (let i = 0; i < 6; i++) { w.events = []; S.call(w); treats += w.events.filter((e) => e.type === 'treat').length; }
    const later = evs(w, 12, null);
    treats += later.filter((e) => e.type === 'treat').length;
    if (treats !== 6) fails.push(`six calls gave ${treats} treats`);
    if (!later.some((e) => e.type === 'clear')) fails.push('six calls did not clear the wave');
    return { ok: !fails.length, info: fails.length ? fails.join('; ') : 'Teddy gets Tommy and Tommy gets Teddy: in, signature, treat (+100), "SAYS", then the nearest rival loses both balloons and nobody else; six calls in a row: six treats and the whole wave down' };
  };

  // ---------- the lake, the fish and the sparks ----------
  CHECKS.lakeFishSparks = (sab) => {
    const fails = [];
    // EASY: falling into the lake splashes you back up, as often as it happens
    let w = lab({ level: 'easy', sab });
    let me = put(w.riders[0], 0, 2.5);
    let e = evs(w, 6, null);
    if (!e.some((x) => x.type === 'splash') || me.balloons !== 2 || w.pl[0].lives !== 5 || me.state !== 'fly') fails.push(`EASY lake: splash ${e.some((x) => x.type === 'splash')}, ${me.balloons} balloons, ${w.pl[0].lives} lives`);
    // NORMAL: the lake costs a life (sploosh, swim, back on the shore)
    w = lab({ level: 'normal', sab });
    me = put(w.riders[0], 0, 2.5);
    e = evs(w, 5, null);
    if (!e.some((x) => x.type === 'sploosh') || w.pl[0].lives !== 2 || me.state !== 'fly') fails.push(`NORMAL lake: ${w.pl[0].lives} lives, ${me.state}`);
    // the big fish: hang low over the water and he jumps up (EASY: a splash back up; NORMAL: boop, one balloon)
    for (const level of ['easy', 'normal']) {
      w = lab({ level, sab });
      w.fish.cd = 0;
      me = put(w.riders[0], 2, 1);
      let jumped = false, effect = '';
      run(w, 2.5, null, (w2) => {
        if (me.vy <= 0 && !effect) { me.y = 1; me.vy = 0; }
        for (const x of w2.events) { if (x.type === 'fishJump') jumped = true; if (x.type === 'fishSplash' || x.type === 'fishBoop') effect = effect || x.type; }
      });
      const want = level === 'easy' ? ['fishSplash', 2] : ['fishBoop', 1];
      if (!jumped || effect !== want[0] || me.balloons !== want[1] || me.vy <= 0 && me.y < 1.2) fails.push(`${level} fish: jumped ${jumped}, ${effect || 'nothing'}, ${me.balloons} balloons`);
    }
    // the sparks: EASY tickles you (no pop), NORMAL pops a balloon
    for (const level of ['easy', 'normal']) {
      w = lab({ level, sab });
      me = put(w.riders[0], 0, 6);
      w.sparks.push({ id: 999, x: 1.2, y: 7, vx: -3, vy: 0, t: 0 });
      e = evs(w, 0.8, () => [{ hold: true }]);
      const want = level === 'easy' ? ['tickle', 2] : ['zap', 1];
      if (!e.some((x) => x.type === want[0]) || me.balloons !== want[1] || w.sparks.length) fails.push(`${level} spark: ${e.filter((x) => x.type === 'tickle' || x.type === 'zap').map((x) => x.type)}, ${me.balloons} balloons`);
    }
    return { ok: !fails.length, info: fails.length ? fails.join('; ') : 'EASY: the lake and the fish splash you back up, sparks tickle; NORMAL: the lake costs a life, the fish boops a balloon, sparks pop one' };
  };

  // ---------- the bonus stage ----------
  CHECKS.bonusStage = (sab) => {
    const fails = [];
    const w = S.create({ level: 'easy', seed: 8, wave: 4, sab });
    const me = w.riders[0];
    const s0 = w.pl[0].score;
    let end = null;
    run(w, 30, () => {
      const b = w.bonus && w.bonus.list[0];
      if (b) { me.x = b.x; me.y = Math.max(0.5, b.y - 1); me.vy = 0; me.ground = -1; }
      return [{}];
    }, (w2) => { const x = w2.events.find((e2) => e2.type === 'bonusEnd'); if (x) end = x; });
    if (!end || end.got !== 20 || !end.perfect) fails.push(`magnet run: ${end ? end.got + '/20' : 'no end'}`);
    if (w.pl[0].score - s0 !== 20 * S.PTS.bpop + S.PTS.perfect) fails.push(`score +${w.pl[0].score - s0} (want ${20 * S.PTS.bpop + S.PTS.perfect})`);
    if (w.wave !== 5) fails.push(`after the bonus: wave ${w.wave}`);
    // nobody loses a life in the bonus stage, even on NORMAL in the lake
    const w2 = S.create({ level: 'normal', seed: 8, wave: 4, sab });
    put(w2.riders[0], 0, 3);
    run(w2, 5, null);
    if (w2.pl[0].lives !== 3) fails.push(`NORMAL bonus lake: ${w2.pl[0].lives} lives`);
    return { ok: !fails.length, info: fails.length ? fails.join('; ') : '20 balloons rise, each +300, all 20 = PERFECT +5000, then wave 5; the lake is safe in the bonus stage' };
  };

  // ---------- 2 players ----------
  CHECKS.twoPlayers = (sab) => {
    const fails = [];
    const w = S.create({ level: 'easy', players: ['teddy', 'tommy'], seed: 9, sab });
    const [a, b] = w.riders;
    if (!(a.x < -8.6 && b.x > 8.6)) fails.push(`spawns: ${a.x}, ${b.x}`);
    const s = w.pl.map((p) => p.score);
    if (S.call(w) !== 'hi5' || w.pl[0].score - s[0] !== S.PTS.hi5 || w.pl[1].score - s[1] !== S.PTS.hi5 || w.buddy) fails.push('T is not a high five in 2 players');
    // the game goes on while one brother still has lives
    w.pl[0].lives = 0;
    a.state = 'out';
    run(w, 1);
    if (w.phase === 'over') fails.push('over with Tommy still playing');
    w.pl[1].lives = 1;
    put(b, 0, 6); b.balloons = 1;
    S.pop(w, b, null);
    run(w, 12);
    if (w.phase !== 'over') fails.push(`both out but the game is ${w.phase}`);
    return { ok: !fails.length, info: fails.length ? fails.join('; ') : 'Teddy starts on the left shore, Tommy on the right; T = high five (+50 each); the game ends only when both are out' };
  };

  // ---------- the autopilot clears every wave on EASY and NORMAL ----------
  CHECKS.autopilot = (sab) => {
    const fails = [], info = [];
    for (const level of ['easy', 'normal']) {
      for (const seed of [11, 12]) {
        const w = S.create({ level, seed, sab });
        let t = 0;
        while (t < 420 && w.phase !== 'over' && w.wave <= 8) { S.step(w, [BB.bot.decide(w, 0)]); t += S.DT; }
        if (w.wave <= 8) fails.push(`${level} seed ${seed}: stuck at wave ${w.wave} (${w.phase}) after ${t.toFixed(0)} s`);
        else info.push(`${level} ${seed}: ${t.toFixed(0)} s, ${w.pl[0].score}`);
      }
    }
    return { ok: !fails.length, info: fails.length ? fails.join('; ') : `all 8 waves (6 rival waves, 2 bonus) cleared: ${info.join(', ')}` };
  };

  const SABOTAGES = [
    ['frameFlap', 'a flap as strong as the frame is long', 'flapFps'],
    ['anyBump', 'any touch pops a balloon', 'onlyFromAbove'],
    ['paraFirst', 'one bump and down you go', 'oneThenParachute'],
    ['waveEarly', 'the wave ends one rival early', 'waveEnds'],
    ['noWrap', 'walls at the edges instead of wrapping', 'wraps'],
    ['lazyBuddy', 'the brother never pops anything', 'buddy'],
  ];

  BB.check = {
    names: Object.keys(CHECKS),
    run(only) {
      const results = [];
      for (const name of only || Object.keys(CHECKS)) {
        let r;
        try { r = CHECKS[name](null); } catch (e) { r = { ok: false, info: 'threw ' + (e && e.stack || e) }; }
        results.push({ name, ok: r.ok, info: r.info });
      }
      const failed = results.filter((r) => !r.ok).map((r) => r.name);
      return { ok: !failed.length, results, failed };
    },
    fail() {
      const caught = SABOTAGES.map(([sab, what, check]) => {
        let r;
        try { r = CHECKS[check](sab); } catch (e) { r = { ok: false, info: 'threw ' + e }; }
        return { sabotage: sab, what, check, caught: !r.ok, failed: [r.info] };
      });
      return { ok: caught.every((c) => c.caught), caught };
    },
    lab, put, dummy,
  };
})(typeof window !== 'undefined' ? window : globalThis);
