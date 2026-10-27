/* TT Balloon Bump: the real-key play check. It presses keys with real keydown/keyup events on window and taps the touch
   buttons with pointer events, never the autopilot, and reads where the rider is drawn on the screen (his 3D body through
   the camera). Time runs with game.step, the same advance() the frames use.
     game.playCheck()           every check; { ok, total, failed }
     game.playCheck('mirror')   with ← and → swapped in the input layer: the direction checks must fail
     game.playCheck('stuck')    with flapping off while standing on an island (in the rules): the stuck checks must fail
     game.playCheck.prove()     runs both and says whether each one was caught */
(function () {
  'use strict';
  const L = BB.levels;
  const KEYS = { ArrowLeft: 'ArrowLeft', ArrowRight: 'ArrowRight', ArrowUp: 'ArrowUp', KeyA: 'a', KeyD: 'd', KeyW: 'w', Space: ' ', Enter: 'Enter', KeyP: 'p', KeyT: 't' };
  const key = (type, code) => window.dispatchEvent(new KeyboardEvent(type, { code, key: KEYS[code] || code, bubbles: true, cancelable: true }));
  const down = (code) => key('keydown', code), up = (code) => key('keyup', code);
  let pid = 40;
  const btn = (pi, k) => {
    const sel = k === 'flap' ? (pi === 0 ? '#tL [data-k="flap"]' : '#tR [data-k="flap"]') : `#touch [data-p="${pi}"][data-k="${k}"]`;
    return document.querySelector(sel);
  };
  const touch = (b, on) => { const id = on ? ++pid : pid; b.dispatchEvent(new PointerEvent(on ? 'pointerdown' : 'pointerup', { bubbles: true, cancelable: true, pointerId: id, pointerType: 'touch', isPrimary: true })); };
  const step = (s) => game.step(s, { draw: false });
  const W = () => game.world();
  const TH = (p) => (p.shore ? 4 : L.TH); // how thick an island is (the rules add it as p.th)

  // an open bit of sky in this layout, away from the islands and the edges
  function openSpot(layout) {
    const plats = L.plats(layout);
    for (const y of [6.5, 5.5, 7.5, 4.5, 8, 8.4]) {
      for (const x of [-5, 5, -3, 3, 0, -6.5, 6.5, -4, 4]) {
        if (plats.every((p) => x + 2 < p.x0 || x - 2 > p.x1 || y - 1.2 > p.y || y + 3.2 < p.y - TH(p))) return { x, y };
      }
    }
    return null;
  }

  const putOpen = (pi, o) => { const sp = openSpot(W().layout); return game.put(pi, sp.x, sp.y, o); };

  function run(sab) {
    const fails = [];
    let total = 0;
    const ok = (cond, what) => { total++; if (!cond) fails.push(what); return cond; };
    const prev = { sab: game.sabotage(), auto: game.G.autoPause, touch: document.body.classList.contains('touch') };
    game.sabotage(sab === 'mirror' ? 'mirror' : null);
    game.simSabotage(sab === 'stuck' ? 'stuckLand' : null);
    game.G.autoPause = false;
    game.hold(true);
    const release = () => { for (const c of Object.keys(KEYS)) up(c); document.querySelectorAll('#touch [data-k]').forEach((b) => b.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: pid }))); };

    // which keys and buttons belong to each player
    const SETS = [
      { name: '1P Teddy ← →', start: { players: 1, who: 'teddy' }, pi: 0, l: 'ArrowLeft', r: 'ArrowRight', flap: 'Space' },
      { name: '1P Teddy A D', start: { players: 1, who: 'teddy' }, pi: 0, l: 'KeyA', r: 'KeyD', flap: 'KeyW' },
      { name: '1P Tommy ← →', start: { players: 1, who: 'tommy' }, pi: 0, l: 'ArrowLeft', r: 'ArrowRight', flap: 'ArrowUp' },
      { name: '2P Teddy', start: { players: 2, mode: 'coop' }, pi: 0, l: 'KeyA', r: 'KeyD', flap: 'KeyW' },
      { name: '2P Tommy', start: { players: 2, mode: 'versus' }, pi: 1, l: 'ArrowLeft', r: 'ArrowRight', flap: 'ArrowUp' },
      { name: '1P touch', start: { players: 1, who: 'tommy' }, pi: 0, touch: true },
      { name: '2P touch Teddy', start: { players: 2, mode: 'coop' }, pi: 0, touch: true },
      { name: '2P touch Tommy', start: { players: 2, mode: 'coop' }, pi: 1, touch: true },
    ];
    const hold = (set, what, on) => {
      if (set.touch) touch(btn(set.pi, what), on);
      else (on ? down : up)(set[what]);
    };
    const tap = (set) => { hold(set, 'flap', true); step(1 / 60); hold(set, 'flap', false); };

    try {
      // ---------- every direction moves the way it shows, on every wave, both levels, keys and touch ----------
      for (const level of ['easy', 'normal']) {
        for (let wave = 1; wave <= 8; wave++) {
          const layout = L.wave(wave).layout;
          for (const set of SETS) {
            if (level === 'normal' && set.touch && wave > 4) continue; // the layouts repeat; touch is covered on all 4 on EASY
            document.body.classList.toggle('touch', !!set.touch);
            game.start(Object.assign({ level, wave, go: true }, set.start));
            game.quiet();
            const spot = openSpot(layout);
            const tag = `${level} wave ${wave} ${set.name}`;
            if (!ok(spot, `${tag}: no open sky to test in`)) continue;
            const { x, y } = spot;
            const others = W().riders.filter((r, i) => i !== set.pi);
            others.forEach((r, i) => game.put(r.pi, x > 0 ? -9 : 9, 3 + i * 3.5, { inv: 99 })); // the other brother well out of the way
            game.put(set.pi, x, y);
            step(0.05);
            for (const [what, sign] of [['r', 1], ['l', -1]]) {
              game.put(set.pi, x, y);
              step(1 / 60);
              const a = game.drawn(set.pi);
              hold(set, what, true);
              for (let k = 0; k < 4; k++) { tap(set); step(0.12); }
              hold(set, what, false);
              const b = game.drawn(set.pi);
              const dx = b.sx - a.sx;
              ok(sign > 0 ? dx > 25 : dx < -25, `${tag}: ${what === 'r' ? '→' : '←'} moved ${dx.toFixed(0)} px on screen`);
            }
            // flap: up the screen
            game.put(set.pi, x, y);
            step(1 / 60);
            const a = game.drawn(set.pi);
            tap(set);
            step(0.25);
            const b = game.drawn(set.pi);
            ok(a.sy - b.sy > 10, `${tag}: a flap moved ${(a.sy - b.sy).toFixed(0)} px up the screen`);
            release();
          }
        }
      }
      document.body.classList.toggle('touch', false);
      const K = SETS[0];

      // ---------- holding flap keeps flapping (Tommy can just hold Space) ----------
      for (const set of [SETS[0], SETS[5]]) {
        document.body.classList.toggle('touch', !!set.touch);
        game.start({ level: 'easy', players: 1, who: 'tommy', go: true });
        game.quiet();
        game.put(0, -5, 3);
        hold(set, 'flap', true);
        step(1.5);
        hold(set, 'flap', false);
        ok(W().riders[0].y > 6, `${set.name}: holding flap for 1.5 s rose to ${W().riders[0].y.toFixed(1)} m`);
      }
      document.body.classList.toggle('touch', false);

      // ---------- nothing leaves you stuck ----------
      // still flying: → takes you right and ← left (wherever you are: on an island, on the shore, in the sky)
      const canFly = (tag, pi) => {
        pi = pi || 0;
        const set = pi ? SETS[4] : K;
        const r = W().riders[pi];
        if (!ok(r.state === 'fly', `${tag}: state ${r.state}`)) return;
        for (const [what, sign] of [['r', 1], ['l', -1]]) {
          hold(set, what, true);
          for (let k = 0; k < 4; k++) { tap(set); step(0.12); } // turning round from the other way first
          const x0 = r.x;
          for (let k = 0; k < 5; k++) { tap(set); step(0.12); }
          hold(set, what, false);
          const dx = BB.sim.wrapDx(r.x - x0);
          ok(sign * dx > 0.8, `${tag}: ${what === 'r' ? '→' : '←'} moved ${dx.toFixed(2)} m`);
        }
      };
      for (let layout = 0; layout < L.LAYOUTS.length; layout++) {
        const wave = BB.levels.WAVES.findIndex((d) => d.layout === layout && !d.bonus) + 1;
        const plats = L.plats(layout);
        plats.forEach((p, i) => {
          const tag = `layout ${L.LAYOUTS[layout].name} island ${i}`;
          // standing on it: flap lifts off, and you can walk off it
          game.start({ level: 'easy', wave, go: true });
          game.quiet();
          const cx = p.shore ? (p.x0 < 0 ? -10.3 : 10.3) : (p.x0 + p.x1) / 2;
          game.put(0, cx, p.y + 0.05);
          step(0.3);
          const r = W().riders[0];
          ok(r.ground >= 0, `${tag}: did not land (y ${r.y.toFixed(2)})`);
          tap(K);
          step(0.3);
          ok(r.y > p.y + 0.4, `${tag}: a flap from standing went to ${(r.y - p.y).toFixed(2)} m`);
          game.put(0, cx, p.y + 0.05);
          step(0.3);
          const x0 = r.x;
          down('ArrowRight'); step(1.4); up('ArrowRight');
          ok(Math.abs(r.x - x0) > 1 || r.ground < 0, `${tag}: walking moved ${Math.abs(r.x - x0).toFixed(2)} m`);
          if (p.shore) return;
          // right under it: you can always get out and up above it
          for (const dir of ['ArrowRight', 'ArrowLeft']) {
            game.put(0, cx, p.y - TH(p) - 2.05);
            down(dir);
            let above = false;
            for (let k = 0; k < 40 && !above; k++) { tap(K); step(0.12); above = r.y > p.y + 0.3; }

            up(dir);
            ok(above, `${tag}: from under it holding ${dir === 'ArrowRight' ? '→' : '←'} never got above (y ${r.y.toFixed(2)}, ${r.state}, ${W().phase}, ${W().riders.length} riders)`);
          }
          // pressed against its side: let go, go the other way, and you move off
          game.put(0, p.x0 - 0.5, p.y - 1.2);
          down('ArrowRight');
          for (let k = 0; k < 6; k++) { tap(K); step(0.1); }
          up('ArrowRight');
          const xs = r.x;
          down('ArrowLeft');
          for (let k = 0; k < 6; k++) { tap(K); step(0.12); }
          up('ArrowLeft');
          ok(xs - r.x > 1, `${tag}: off its left side ← moved ${(xs - r.x).toFixed(2)} m`);
        });
      }

      // popped down to the parachute: back on the shore and flying again
      for (const level of ['easy', 'normal']) {
        game.start({ level, go: true });
        game.quiet();
        game.put(0, 0, 6, { balloons: 1 });
        BB.sim.pop(W(), W().riders[0], null);
        let back = false;
        for (let k = 0; k < 80 && !back; k++) { step(0.1); back = W().riders[0].state === 'fly'; }
        ok(back, `${level}: after the parachute: ${W().riders[0].state}`);
        step(2.6);
        canFly(`${level} after the parachute`);
      }
      // the lake: EASY splashes you up, NORMAL costs a life; either way you fly again
      for (const level of ['easy', 'normal']) {
        game.start({ level, go: true });
        game.quiet();
        game.put(0, 0, 1.5);
        let k = 0;
        for (; k < 80 && !(W().riders[0].state === 'fly' && W().riders[0].vy > 3) && !(level === 'normal' && W().riders[0].inv > 2); k++) step(0.05);
        step(level === 'normal' ? 6 : 0.2);
        canFly(`${level} after the lake`);
      }
      // the big fish
      for (const level of ['easy', 'normal']) {
        game.start({ level, go: true });
        game.quiet();
        const w = W();
        w.fish.cd = 0;
        game.put(0, 2, 1.1);
        for (let k = 0; k < 120 && w.fish.state !== 'jump'; k++) { const r = w.riders[0]; r.y = 1.1; r.vy = 0; step(1 / 60); }
        step(0.6);
        canFly(`${level} after the fish (${w.fish.hit ? 'hit' : 'missed'})`);
      }
      // a spark
      for (const level of ['easy', 'normal']) {
        game.start({ level, go: true });
        game.quiet();
        game.put(0, 0, 6);
        W().sparks.push({ id: 991, x: 0.9, y: 7, vx: -3, vy: 0, t: 0 });
        step(0.5);
        canFly(`${level} after a spark`);
      }
      // the brother's visit: the keys work the whole time
      game.start({ level: 'easy', go: true });
      step(2.5);
      W().riders.forEach((r, i) => { if (r.kind === 'rival') Object.assign(r, { dummy: true, x: 6 + i * 0.9, y: 1 }); }); // they bob in the far corner and leave you be
      putOpen(0, { inv: 99 });
      game.call();
      for (let k = 0; k < 4 && W().buddy; k++) canFly(`during the brother's visit (${W().buddy && W().buddy.phase})`), putOpen(0, { inv: 99 });
      // a key held through the pause and let go while paused: it is not stuck afterwards
      game.start({ level: 'easy', go: true });
      game.quiet();
      game.put(0, -4, 7);
      down('ArrowRight');
      step(0.3);
      down('KeyP');
      up('KeyP');
      ok(game.state().paused, 'P did not pause');
      up('ArrowRight');
      down('KeyP');
      up('KeyP');
      ok(!game.state().paused, 'P did not go on');
      step(0.8);
      const xa = W().riders[0].x;
      step(1);
      ok(Math.abs(W().riders[0].x - xa) < 0.6, `→ let go during the pause still drifts (${(W().riders[0].x - xa).toFixed(2)} m)`);
      // switching away from the window lets go of every key
      down('ArrowLeft');
      window.dispatchEvent(new Event('blur'));
      step(0.8);
      const xb = W().riders[0].x;
      step(1);
      ok(Math.abs(W().riders[0].x - xb) < 0.6, `← still held after blur (${(W().riders[0].x - xb).toFixed(2)} m)`);
      up('ArrowLeft');
      // the wave clear and the next wave's start: you can fly through them
      game.start({ level: 'easy', go: true });
      W().riders.filter((r) => r.kind === 'rival').forEach((r) => { BB.sim.pop(W(), r, W().riders[0]); r.inv = 0; BB.sim.pop(W(), r, W().riders[0]); });
      step(0.05);
      ok(W().phase === 'clear', `wave clear: ${W().phase}`);
      putOpen(0, { inv: 99 });
      canFly('during WAVE CLEAR');
      step(3.2);
      ok(W().wave === 2 && W().riders.some((r) => r.kind === 'rival'), `next wave: ${W().wave} ${W().phase}`);
      putOpen(0, { inv: 99 });
      canFly('while the rivals pump up');
      // the bonus stage
      game.start({ level: 'normal', wave: 4 });
      putOpen(0);
      canFly('in the bonus stage');
      // 2 players, versus: a popped brother comes back and flies
      game.start({ level: 'easy', players: 2, mode: 'versus', go: true });
      game.quiet();
      game.put(0, 0.1, 6.4);
      W().riders[0].vy = -2;
      game.put(1, 0, 5, { balloons: 1 });
      step(0.5);
      ok(W().riders[1].balloons === 0, `versus: Teddy coming down on Tommy left him ${W().riders[1].balloons}`);
      step(8);
      putOpen(1, { inv: 99 });
      canFly('Tommy after a versus pop', 1);
      // the keyboard kid: mashing keys for 40 s on EASY with the rivals; never stuck, never broken
      game.start({ level: 'easy', go: true });
      const R = BB.sim.rng(5);
      const codes = ['ArrowLeft', 'ArrowRight', 'Space', 'ArrowUp', 'KeyA', 'KeyD', 'KeyW', 'KeyT'];
      let still = 0, lastX = 0, lastY = 0, broken = 0;
      for (let k = 0; k < 400; k++) {
        const c = codes[Math.floor(R() * codes.length)];
        if (R() < 0.6) down(c); else up(c);
        step(0.1);
        const r = W().riders[0];
        if (!isFinite(r.x + r.y + r.vx + r.vy)) broken++;
        const gk = game.G.keys, lr = (gk.ArrowRight || gk.KeyD ? 1 : 0) - (gk.ArrowLeft || gk.KeyA ? 1 : 0);
        if (r.state === 'fly' && lr && Math.abs(r.x - lastX) + Math.abs(r.y - lastY) < 1e-4) still++;
        lastX = r.x; lastY = r.y;
        if (W().phase === 'over') break;
      }
      release();
      ok(!broken, `keyboard kid: ${broken} broken positions`);
      ok(still < 8, `keyboard kid: ${still} steps standing still while holding a direction`);
    } catch (e) {
      fails.push('threw ' + (e && e.stack || e));
    } finally {
      release();
      game.sabotage(prev.sab);
      game.simSabotage(null);
      game.G.autoPause = prev.auto;
      document.body.classList.toggle('touch', prev.touch);
      document.body.classList.remove('p2');
      game.showTitle();
      game.hold(false);
    }
    return { ok: !fails.length, total, failed: fails };
  }
  game.playCheck = run;
  game.playCheck.prove = () => {
    const m = run('mirror'), s = run('stuck');
    return {
      ok: !m.ok && !s.ok,
      mirror: { caught: !m.ok, failed: m.failed.length, first: m.failed.slice(0, 2) },
      stuck: { caught: !s.ok, failed: s.failed.length, first: s.failed.slice(0, 2) },
    };
  };
})();
