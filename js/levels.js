/* TT Balloon Bump: the sky over the lake as plain data. The field is 24 m wide (x from -12 to 12, and it wraps: fly off one
   side and you come back on the other), from the lake (y = 0) up to the ceiling of the sky. Platforms are floating grassy
   islands: { x0, x1, y } with y the top you stand on. The two sandy shores sit at the bottom corners and meet across the wrap.
   No Three.js here, so node runs it (tools/check.js). */
(function (root) {
  'use strict';
  const BB = (root.BB = root.BB || {});
  const HALF = 12;
  const SHORE = 0.8; // the top of the sand
  const shores = [
    { x0: -HALF, x1: -8.6, y: SHORE, shore: true },
    { x0: 8.6, x1: HALF, y: SHORE, shore: true },
  ];
  // four island layouts; cloud is the sleepy cloud the sparks come out of
  const LAYOUTS = [
    { name: 'A', cloud: [0, 11.5], plats: [{ x0: -3.2, x1: 3.2, y: 5 }, { x0: -9.4, x1: -5.4, y: 8.8 }, { x0: 5.4, x1: 9.4, y: 8.8 }] },
    { name: 'B', cloud: [-6.8, 11.4], plats: [{ x0: -2.2, x1: 2.2, y: 3.8 }, { x0: -8.8, x1: -4.8, y: 6.8 }, { x0: 4.8, x1: 8.8, y: 6.8 }, { x0: -2, x1: 2, y: 10.2 }] },
    { name: 'C', cloud: [0, 11.6], plats: [{ x0: -6.8, x1: -2.8, y: 4.4 }, { x0: 2.8, x1: 6.8, y: 4.4 }, { x0: -1.8, x1: 1.8, y: 8 }, { x0: -11.2, x1: -8.2, y: 10.8 }, { x0: 8.2, x1: 11.2, y: 10.8 }] },
    { name: 'D', cloud: [0, 11.4], plats: [{ x0: -3.6, x1: 3.6, y: 6.4 }, { x0: -8.2, x1: -5.2, y: 3.9 }, { x0: 5.2, x1: 8.2, y: 3.9 }, { x0: -10.6, x1: -7, y: 10 }, { x0: 7, x1: 10.6, y: 10 }] },
  ];
  // the waves, in a loop; each time round the rivals get a little quicker
  const WAVES = [
    { layout: 0, riders: ['bird', 'bird', 'bird'] },
    { layout: 1, riders: ['bird', 'foxy', 'bird'] },
    { layout: 2, riders: ['foxy', 'froggy', 'bird'] },
    { layout: 0, bonus: true },
    { layout: 3, riders: ['bird', 'foxy', 'froggy', 'bird'] },
    { layout: 1, riders: ['froggy', 'bird', 'bird', 'foxy'] },
    { layout: 2, riders: ['bird', 'bird', 'foxy', 'froggy', 'bird'] },
    { layout: 3, bonus: true },
  ];
  // where the rivals start (pumping up their balloons): island middles first, then a second spot on the wide ones
  function spots(layout, n) {
    const ps = LAYOUTS[layout].plats.map((p, i) => ({ p, i })).sort((a, b) => a.p.y - b.p.y);
    const out = [];
    for (const { p } of ps) out.push({ x: (p.x0 + p.x1) / 2, y: p.y });
    for (const { p } of ps) if (p.x1 - p.x0 >= 4) out.push({ x: p.x0 + 0.9, y: p.y }, { x: p.x1 - 0.9, y: p.y });
    return out.slice(0, n);
  }
  BB.levels = {
    HALF, WIDTH: HALF * 2, CEIL: 13.4, SHORE, TH: 0.6, shores, LAYOUTS, WAVES, spots,
    // every platform of a layout, the shores first (index 0 and 1)
    plats: (layout) => shores.concat(LAYOUTS[layout].plats),
    wave: (n) => WAVES[(n - 1) % WAVES.length],
    cycle: (n) => Math.floor((n - 1) / WAVES.length),
  };
})(typeof window !== 'undefined' ? window : globalThis);
