/* TT Balloon Bump: sound effects, all synth through Kit.sound (so the page's one mute switch covers them).
   BB.sfx.log counts every effect played, so tests can check sound in code while muted. */
(function () {
  'use strict';
  const S = Kit.sound;
  const log = {};
  const note = (name, fn) => (...a) => { log[name] = (log[name] || 0) + 1; fn(...a); };
  BB.sfx = {
    log,
    flap: note('flap', () => S.hiss({ filter: 'bandpass', f: 900, to: 500, q: 1.2, dur: 0.09, vol: 0.07 })),
    pop: note('pop', () => { S.hiss({ filter: 'highpass', f: 2500, to: 6000, dur: 0.08, vol: 0.22 }); S.tone({ type: 'triangle', f: 900, to: 300, dur: 0.1, vol: 0.12 }); }),
    para: note('para', () => { S.tone({ type: 'sine', f: 880, to: 440, dur: 0.6, vol: 0.08 }); S.tone({ type: 'sine', f: 660, to: 330, dur: 0.6, vol: 0.05, at: 0.05 }); }),
    boing: note('boing', () => S.tone({ type: 'sine', f: 220, to: 520, dur: 0.16, vol: 0.12 })),
    bonk: note('bonk', () => S.tone({ type: 'triangle', f: 300, to: 160, dur: 0.08, vol: 0.08 })),
    land: note('land', () => S.tone({ f: 160, to: 90, dur: 0.07, vol: 0.1 })),
    splash: note('splash', () => { S.hiss({ f: 1200, to: 300, dur: 0.4, vol: 0.18 }); S.tone({ type: 'sine', f: 300, to: 700, dur: 0.2, vol: 0.06, at: 0.05 }); }),
    sploosh: note('sploosh', () => { S.hiss({ f: 900, to: 200, dur: 0.6, vol: 0.2 }); [520, 440, 360].forEach((f, i) => S.tone({ type: 'sine', f, dur: 0.12, vol: 0.06, at: 0.2 + i * 0.1 })); }),
    swim: note('swim', () => [700, 900, 1100].forEach((f, i) => S.tone({ type: 'sine', f, to: f * 1.2, dur: 0.06, vol: 0.04, at: i * 0.1 }))),
    fishWarn: note('fishWarn', () => [0, 0.12, 0.24].forEach((at) => S.tone({ type: 'sine', f: 500, to: 900, dur: 0.07, vol: 0.06, at }))),
    fish: note('fish', () => { S.hiss({ f: 1500, to: 400, dur: 0.35, vol: 0.16 }); S.tone({ type: 'square', f: 140, to: 260, dur: 0.18, vol: 0.06, lp: 900 }); }),
    boop: note('boop', () => { S.tone({ type: 'sine', f: 400, to: 200, dur: 0.15, vol: 0.14 }); S.tone({ type: 'sine', f: 600, to: 300, dur: 0.15, vol: 0.08, at: 0.12 }); }),
    sparkOut: note('sparkOut', () => S.hiss({ filter: 'highpass', f: 5000, to: 9000, dur: 0.35, vol: 0.06 })),
    zap: note('zap', () => { S.tone({ type: 'square', f: 1600, to: 400, dur: 0.18, vol: 0.06, lp: 3000 }); S.hiss({ filter: 'highpass', f: 4000, dur: 0.2, vol: 0.08 }); }),
    tickle: note('tickle', () => [1200, 1500, 1300, 1700].forEach((f, i) => S.tone({ type: 'triangle', f, dur: 0.05, vol: 0.05, at: i * 0.06 }))),
    bpop: note('bpop', (n) => { S.hiss({ filter: 'highpass', f: 3000, to: 7000, dur: 0.06, vol: 0.18 }); S.coin(n || 0); }),
    wave: note('wave', () => { S.tone({ type: 'square', f: 660, dur: 0.1, vol: 0.07 }); S.tone({ type: 'square', f: 990, dur: 0.18, vol: 0.07, at: 0.12 }); }),
    clear: note('clear', () => [523, 659, 784, 1047].forEach((f, i) => S.tone({ type: 'triangle', f, dur: 0.22, vol: 0.14, at: i * 0.12 }))),
    perfect: note('perfect', () => [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => S.tone({ type: 'triangle', f, dur: 0.26, vol: 0.14, at: i * 0.12 }))),
    pump: note('pump', () => S.hiss({ filter: 'bandpass', f: 600, to: 1400, q: 2, dur: 0.18, vol: 0.05 })),
    buddy: note('buddy', () => { S.tone({ f: 400, to: 900, dur: 0.15, vol: 0.12 }); S.hiss({ f: 2000, to: 500, dur: 0.25, vol: 0.08 }); }),
    treat: note('treat', () => S.coin(4)),
    helper: note('helper', () => S.powerup()),
    hi5: note('hi5', () => { S.hiss({ filter: 'bandpass', f: 1800, dur: 0.08, vol: 0.25, q: 1 }); S.tone({ f: 880, to: 1320, dur: 0.15, vol: 0.08, at: 0.05 }); }),
    life: note('life', () => [784, 988, 1175, 1568].forEach((f, i) => S.tone({ type: 'square', f, dur: 0.1, vol: 0.06, at: i * 0.09 }))),
    gameOver: note('gameOver', () => [523, 440, 392, 523].forEach((f, i) => S.tone({ type: 'triangle', f, dur: 0.25, vol: 0.12, at: i * 0.2 }))),
    click: note('click', () => S.click()),
  };
})();
