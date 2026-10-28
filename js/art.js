/* TT Balloon Bump: the 3D things, chunky toy style, all painted on canvases (no image files). The sky and the hills, the
   lake with its waves, the sandy shores, the grassy floating islands, the candy poles at the edges (you fly behind one and
   come out of the other), the sleepy cloud the sparks come from, the riders with two balloons on their backs, the striped
   parachutes and swim rings, the silly birds, the big goofy fish, the sparks, the bonus balloons and the confetti.
   js/game.js places and moves them. */
(function () {
  'use strict';
  const T = THREE, G = Kit.gfx, L = BB.levels;
  const A = (BB.art = {});
  const PI = Math.PI;
  const mats = new Map();
  const mat = (color, o) => {
    const k = color + JSON.stringify(o || {});
    if (!mats.has(k)) mats.set(k, G.std(color, o));
    return mats.get(k);
  };
  A.mat = mat;
  A.BALLOON = { teddy: ['#ff3d5a', '#ffd400'], tommy: ['#2f8cff', '#7dff5a'], foxy: ['#ff8a1f', '#ffcf3d'], froggy: ['#57d16a', '#c8ff7a'], bird: ['#ff5fb4', '#c77dff'] };
  A.BIRDS = [['#2fc9c0', '#ffe9a8'], ['#9b6bff', '#ffd6f0'], ['#ffcf3d', '#fff4d6'], ['#ff7a9e', '#ffe2ea']];

  // many still meshes with one material drawn as one (fewer draw calls for older iPads); from TT Barrel Climb
  function merge(meshes, material) {
    const parts = meshes.map((m) => {
      m.updateMatrix();
      const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
      g.applyMatrix4(m.matrix);
      return g;
    });
    const cat = (name, n) => {
      const out = new Float32Array(parts.reduce((a, g) => a + g.attributes.position.count * n, 0));
      let o = 0;
      for (const g of parts) { out.set(g.attributes[name].array, o); o += g.attributes.position.count * n; }
      return new T.BufferAttribute(out, n);
    };
    const geo = new T.BufferGeometry();
    geo.setAttribute('position', cat('position', 3));
    geo.setAttribute('normal', cat('normal', 3));
    if (parts.every((g) => g.attributes.uv)) geo.setAttribute('uv', cat('uv', 2));
    parts.forEach((g) => g.dispose());
    return new T.Mesh(geo, material);
  }
  const at = (geo, x, y, z, rx, ry, rz, sx, sy, sz) => {
    const m = new T.Mesh(geo);
    m.position.set(x, y, z);
    m.rotation.set(rx || 0, ry || 0, rz || 0);
    if (sx) m.scale.set(sx, sy || sx, sz || sx);
    return m;
  };

  // ---------- textures ----------
  function skyTex() {
    const [c, g] = G.makeCanvas(4, 256);
    const gr = g.createLinearGradient(0, 0, 0, 256);
    gr.addColorStop(0, '#5ec2ff');
    gr.addColorStop(0.6, '#a8e2ff');
    gr.addColorStop(1, '#fff1c9');
    g.fillStyle = gr;
    g.fillRect(0, 0, 4, 256);
    return G.toTexture(c);
  }
  function faceTex(kind) {
    const [c, g] = G.makeCanvas(256, 256);
    g.lineCap = 'round';
    g.strokeStyle = '#3a4a6a';
    g.fillStyle = '#3a4a6a';
    g.lineWidth = 10;
    if (kind === 'sun') {
      g.beginPath(); g.arc(88, 110, 14, 0, PI * 2); g.arc(168, 110, 14, 0, PI * 2); g.fill();
      g.beginPath(); g.arc(128, 140, 44, 0.15 * PI, 0.85 * PI); g.stroke();
      g.fillStyle = 'rgba(255,120,120,0.55)';
      g.beginPath(); g.arc(62, 150, 18, 0, PI * 2); g.arc(194, 150, 18, 0, PI * 2); g.fill();
    } else { // the sleepy cloud: closed eyes, rosy cheeks, a little o (puff: a big O)
      g.beginPath(); g.arc(88, 120, 20, 0.1 * PI, 0.9 * PI); g.stroke();
      g.beginPath(); g.arc(168, 120, 20, 0.1 * PI, 0.9 * PI); g.stroke();
      g.fillStyle = 'rgba(255,130,160,0.6)';
      g.beginPath(); g.arc(58, 156, 18, 0, PI * 2); g.arc(198, 156, 18, 0, PI * 2); g.fill();
      g.fillStyle = '#3a4a6a';
      g.beginPath();
      if (kind === 'puff') g.ellipse(128, 176, 22, 26, 0, 0, PI * 2); else g.ellipse(128, 170, 10, 8, 0, 0, PI * 2);
      g.fill();
    }
    return G.toTexture(c);
  }
  function stripes(cols, w, h, vertical) {
    const [c, g] = G.makeCanvas(w || 128, h || 128);
    const n = cols.length;
    for (let i = 0; i < n * 2; i++) {
      g.fillStyle = cols[i % n];
      if (vertical) g.fillRect((i * c.width) / (n * 2), 0, c.width / (n * 2) + 1, c.height);
      else g.fillRect(0, (i * c.height) / (n * 2), c.width, c.height / (n * 2) + 1);
    }
    return G.toTexture(c);
  }
  function grassTex() {
    const [c, g] = G.makeCanvas(128, 64);
    g.fillStyle = '#6fdc4a';
    g.fillRect(0, 0, 128, 64);
    g.fillStyle = '#8ef06a';
    for (let i = 0; i < 40; i++) g.fillRect((i * 37) % 128, (i * 23) % 64, 6, 3);
    g.fillStyle = '#4fbf35';
    for (let i = 0; i < 30; i++) g.fillRect((i * 53) % 128, (i * 31) % 64, 4, 4);
    return G.toTexture(c, [2, 1]);
  }
  function dirtTex() {
    const [c, g] = G.makeCanvas(128, 64);
    g.fillStyle = '#b8743a';
    g.fillRect(0, 0, 128, 64);
    g.fillStyle = '#9a5c2a';
    for (let i = 0; i < 26; i++) { g.beginPath(); g.arc((i * 41) % 128, (i * 29) % 64, 4 + (i % 3), 0, PI * 2); g.fill(); }
    g.fillStyle = '#d18f4f';
    for (let i = 0; i < 18; i++) g.fillRect((i * 59) % 128, (i * 17) % 64, 5, 3);
    return G.toTexture(c, [2, 1]);
  }
  function sandTex() {
    const [c, g] = G.makeCanvas(128, 128);
    g.fillStyle = '#ffe08a';
    g.fillRect(0, 0, 128, 128);
    g.fillStyle = '#f5cc6a';
    for (let i = 0; i < 60; i++) g.fillRect((i * 37) % 128, (i * 53) % 128, 3, 3);
    return G.toTexture(c, [3, 1]);
  }
  function starTex() {
    const [c, g] = G.makeCanvas(128, 128);
    g.translate(64, 64);
    g.beginPath();
    for (let i = 0; i < 10; i++) { const r = i % 2 ? 26 : 58, a = (i / 10) * PI * 2 - PI / 2; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
    g.closePath();
    g.fillStyle = '#fff36b';
    g.strokeStyle = '#ff9f1c';
    g.lineWidth = 7;
    g.fill();
    g.stroke();
    // a cheeky face: it giggles, it doesn't bite
    g.fillStyle = '#5a3a10';
    g.beginPath(); g.arc(-12, -4, 5, 0, PI * 2); g.arc(12, -4, 5, 0, PI * 2); g.fill();
    g.strokeStyle = '#5a3a10';
    g.lineWidth = 4;
    g.beginPath(); g.arc(0, 4, 11, 0.15 * PI, 0.85 * PI); g.stroke();
    return G.toTexture(c);
  }

  // ---------- the sky, the sun, the hills, far clouds ----------
  A.backdrop = function (scene) {
    scene.background = skyTex();
    const sun = new T.Sprite(new T.SpriteMaterial({ map: G.radialTexture(128, [[0, '#fff6a8'], [0.55, '#ffd84a'], [0.62, 'rgba(255,216,74,0.35)'], [1, 'rgba(255,216,74,0)']]), depthWrite: false }));
    sun.scale.set(9, 9, 1);
    sun.position.set(14, 17, -40);
    scene.add(sun);
    const face = new T.Sprite(new T.SpriteMaterial({ map: faceTex('sun'), transparent: true, depthWrite: false }));
    face.scale.set(5, 5, 1);
    face.position.set(14, 17, -39.8);
    scene.add(face);
    const hillGeo = new T.SphereGeometry(1, 20, 12);
    const hills = [];
    [[-26, -6, 14, 7], [-12, -7, 12, 6], [2, -8, 16, 8], [18, -6, 13, 7], [32, -7, 14, 6], [-38, -7, 12, 6]].forEach(([x, y, sx, sy]) => hills.push(at(hillGeo, x, y, -34, 0, 0, 0, sx, sy, 6)));
    scene.add(merge(hills, mat('#8fdc73', { roughness: 1 })));
    const hills2 = [];
    [[-20, -6, 10, 5], [-4, -5.5, 9, 4.5], [12, -6, 11, 5], [26, -5.5, 9, 4.5]].forEach(([x, y, sx, sy]) => hills2.push(at(hillGeo, x, y, -24, 0, 0, 0, sx, sy, 5)));
    scene.add(merge(hills2, mat('#6fca5a', { roughness: 1 })));
    // little round trees on the far hills
    const treeGeo = new T.SphereGeometry(0.9, 10, 8), trunkGeo = new T.CylinderGeometry(0.15, 0.2, 1, 6);
    const tops = [], trunks = [];
    [[-22, -2.4], [-15, -1.2], [-6, -1.6], [6, -1.3], [15, -1.6], [24, -1.9]].forEach(([x, y]) => { tops.push(at(treeGeo, x, y + 1.3, -23, 0, 0, 0, 1, 1.15, 1)); trunks.push(at(trunkGeo, x, y + 0.3, -23)); });
    scene.add(merge(tops, mat('#3fae4a')));
    scene.add(merge(trunks, mat('#8a5a2b')));
    const puff = new T.SphereGeometry(1, 12, 10);
    A.farClouds = [];
    [[-18, 15, -30, 1.4], [3, 18, -32, 1.2], [22, 14, -30, 1.1], [-34, 18, -34, 1.3]].forEach(([x, y, z, s]) => {
      const c = merge([at(puff, 0, 0, 0, 0, 0, 0, 1.6 * s, 1 * s, 1 * s), at(puff, 1.5 * s, -0.2 * s, 0, 0, 0, 0, 1.2 * s), at(puff, -1.5 * s, -0.3 * s, 0, 0, 0, 0, 1.1 * s)], mat('#ffffff', { roughness: 1, emissive: '#e8f6ff', emissiveIntensity: 0.35 }));
      c.position.set(x, y, z);
      c.castShadow = false;
      scene.add(c);
      A.farClouds.push(c);
    });
  };

  // ---------- the lake: a wavy, chunky plane ----------
  A.lake = function (scene) {
    const geo = new T.PlaneGeometry(90, 52, 56, 24); // from the far shore to well past the camera, so tall screens see water below
    geo.rotateX(-PI / 2);
    geo.translate(0, 0, 9);
    const base = geo.attributes.position.array.slice();
    const m = new T.Mesh(geo, new T.MeshStandardMaterial({ color: '#2fb3ec', roughness: 0.25, metalness: 0.05, flatShading: true }));
    scene.add(m);
    // a pale band where the lake meets the far shore
    const far = new T.Mesh(new T.PlaneGeometry(90, 3), mat('#c6f1ff', { roughness: 1 }));
    far.rotation.x = -PI / 2;
    far.position.set(0, -0.02, -16.5);
    scene.add(far);
    // lily pads near the front
    const pad = new T.CylinderGeometry(0.55, 0.55, 0.06, 14, 1, false, 0.3, PI * 2 - 0.6);
    const pads = [[-6, 2.4], [-5.2, 3.1], [4.5, 2.8], [7, 1.9], [0.5, 3.4]].map(([x, z]) => at(pad, x, 0.03, z, 0, x, 0));
    const padMesh = merge(pads, mat('#3fbf4a'));
    scene.add(padMesh);
    const pos = geo.attributes.position;
    return {
      mesh: m,
      pads: padMesh,
      update(t) {
        const a = pos.array;
        for (let i = 0; i < a.length; i += 3) {
          const x = base[i], z = base[i + 2];
          a[i + 1] = 0.07 * Math.sin(x * 0.9 + t * 1.8) + 0.05 * Math.sin(z * 1.6 - t * 1.3) + 0.03 * Math.sin((x + z) * 2.3 + t * 2.6);
        }
        pos.needsUpdate = true;
        geo.computeVertexNormals();
        padMesh.position.y = 0.04 * Math.sin(t * 1.5);
      },
    };
  };

  // ---------- the sandy shores (they meet across the wrap) and the candy poles at the edges ----------
  A.shores = function (scene) {
    const sandM = new T.MeshStandardMaterial({ map: sandTex(), roughness: 1 });
    const parts = [], grass = [], trunks = [], leaves = [], coco = [];
    const box = new T.BoxGeometry(1, 1, 1);
    for (const s of [-1, 1]) {
      const x0 = 8.6, x1 = 18;
      parts.push(at(box, s * (x0 + x1) / 2, L.SHORE - 1.4, -1.6, 0, 0, 0, x1 - x0, 2.8, 6));
      parts.push(at(box, s * (x0 - 0.35), L.SHORE - 1.7, -1.6, 0, 0, 0, 0.9, 2.2, 5.6)); // a rounded-looking step into the lake
      for (let i = 0; i < 6; i++) grass.push(at(new T.ConeGeometry(0.12, 0.45, 4), s * (9.4 + i * 1.05), L.SHORE + 0.2, -3.6 + (i % 3) * 0.3));
      // a palm tree behind the riders
      const tx = s * 10.9;
      for (let k = 0; k < 6; k++) trunks.push(at(new T.CylinderGeometry(0.2 - k * 0.01, 0.24 - k * 0.01, 0.7, 7), tx + s * k * 0.08, L.SHORE + 0.35 + k * 0.66, -3.2, 0, 0, -s * 0.06));
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * PI * 2;
        leaves.push(at(new T.BoxGeometry(1.9, 0.08, 0.5), tx + s * 0.48 + Math.cos(a) * 0.9, L.SHORE + 4.2 - 0.25, -3.2 + Math.sin(a) * 0.9, 0, -a, -0.35));
      }
      coco.push(at(new T.SphereGeometry(0.17, 8, 6), tx + s * 0.5, L.SHORE + 3.85, -2.9), at(new T.SphereGeometry(0.17, 8, 6), tx + s * 0.3, L.SHORE + 3.8, -3.05));
    }
    const sand = merge(parts, sandM);
    scene.add(sand);
    scene.add(merge(grass, mat('#4fbf35')));
    scene.add(merge(trunks, mat('#b07a3e')));
    scene.add(merge(leaves, mat('#3fbf4a')));
    scene.add(merge(coco, mat('#7a4a1e')));
    // the edge poles: candy stripes from the lake to the top of the sky; riders slip behind and come out of the other one
    const tex = stripes(['#ffffff', '#ff3d7f'], 16, 256);
    tex.wrapS = tex.wrapT = T.RepeatWrapping;
    tex.repeat.set(1, 6);
    const poleM = new T.MeshStandardMaterial({ map: tex, roughness: 0.5 });
    const poles = [];
    for (const s of [-1, 1]) {
      const p = new T.Mesh(new T.CylinderGeometry(0.62, 0.62, 16, 16), poleM);
      p.position.set(s * 12.62, 6.4, 0.9);
      scene.add(p);
      const knob = new T.Mesh(new T.SphereGeometry(0.85, 14, 10), mat('#ffd400', { roughness: 0.4 }));
      knob.position.set(s * 12.62, 14.5, 0.9);
      scene.add(knob);
      poles.push(p);
    }
    return { sand, poles };
  };

  // ---------- the floating islands: one merged group per layout ----------
  A.islands = function (layout) {
    const g = new T.Group();
    const grassM = new T.MeshStandardMaterial({ map: grassTex(), roughness: 0.9 });
    const dirtM = new T.MeshStandardMaterial({ map: dirtTex(), roughness: 1 });
    const box = new T.BoxGeometry(1, 1, 1), cone = new T.ConeGeometry(0.5, 1, 6);
    const tops = [], dirts = [], rocks = [], petals = [], stems = [];
    L.LAYOUTS[layout].plats.forEach((p, i) => {
      const w = p.x1 - p.x0, cx = (p.x0 + p.x1) / 2;
      tops.push(at(box, cx, p.y - 0.13, 0, 0, 0, 0, w + 0.1, 0.26, 2.4));
      dirts.push(at(box, cx, p.y - 0.42, 0, 0, 0, 0, w - 0.1, 0.36, 2.2));
      const n = Math.max(2, Math.round(w / 1.4));
      for (let k = 0; k < n; k++) {
        const x = p.x0 + ((k + 0.5) / n) * w, h = 0.5 + ((k * 7 + i) % 3) * 0.25;
        rocks.push(at(cone, x, p.y - 0.6 - h / 2, ((k % 2) - 0.5) * 0.6, PI, 0, 0, 0.9, h, 0.9));
      }
      for (let k = 0; k < Math.round(w / 1.6); k++) {
        const x = p.x0 + 0.6 + k * 1.6 + 0.3 * (i % 2), z = -0.8 + (k % 2) * 0.25;
        stems.push(at(new T.CylinderGeometry(0.03, 0.03, 0.3, 4), x, p.y + 0.15, z));
        petals.push(at(new T.SphereGeometry(0.1, 6, 5), x, p.y + 0.32, z, 0, 0, 0, 1.4, 0.6, 1.4));
      }
    });
    g.add(merge(tops, grassM), merge(dirts, dirtM), merge(rocks, dirtM));
    if (stems.length) g.add(merge(stems, mat('#3fae4a')), merge(petals, mat(['#ff5fb4', '#ffd400', '#ffffff'][layout % 3], { roughness: 0.6 })));
    return g;
  };

  // ---------- the sleepy cloud the sparks come out of ----------
  A.cloud = function () {
    const g = new T.Group();
    const puff = new T.SphereGeometry(1, 14, 10);
    const body = merge([at(puff, 0, 0, 0, 0, 0, 0, 1.3, 0.85, 0.8), at(puff, 1.1, -0.15, 0, 0, 0, 0, 0.85), at(puff, -1.1, -0.2, 0, 0, 0, 0, 0.8), at(puff, 0.4, 0.55, 0, 0, 0, 0, 0.75)], mat('#ffffff', { roughness: 1, emissive: '#eef8ff', emissiveIntensity: 0.4 }));
    g.add(body);
    const faces = { sleep: faceTex('sleep'), puff: faceTex('puff') };
    const face = new T.Sprite(new T.SpriteMaterial({ map: faces.sleep, transparent: true, depthWrite: false }));
    face.scale.set(1.9, 1.9, 1);
    face.position.set(0, -0.05, 0.95);
    g.add(face);
    g.userData.face = (puffing) => { face.material.map = puffing ? faces.puff : faces.sleep; };
    return g;
  };

  // ---------- balloons ----------
  const balloonGeo = new T.SphereGeometry(0.3, 16, 12);
  const knotGeo = new T.ConeGeometry(0.06, 0.1, 6);
  A.balloon = function (color, size) {
    const g = new T.Group();
    const m = new T.MeshStandardMaterial({ color, roughness: 0.25, metalness: 0.05, emissive: color, emissiveIntensity: 0.12 });
    const b = new T.Mesh(balloonGeo, m);
    b.scale.set(1, 1.18, 1);
    g.add(b);
    const knot = new T.Mesh(knotGeo, m);
    knot.position.y = -0.36;
    knot.rotation.x = PI;
    g.add(knot);
    const shine = new T.Mesh(new T.SphereGeometry(0.07, 8, 6), mat('#ffffff', { roughness: 0.1, emissive: '#ffffff', emissiveIntensity: 0.6 }));
    shine.position.set(-0.11, 0.14, 0.23);
    shine.scale.set(1, 1.6, 0.6);
    g.add(shine);
    if (size) g.scale.setScalar(size);
    return g;
  };
  // two balloons on a rider's back, with their strings; strings are one line drawing
  A.balloonPair = function (cols) {
    const g = new T.Group();
    const b1 = A.balloon(cols[0]), b2 = A.balloon(cols[1]);
    b1.position.set(-0.24, 1.62, -0.28);
    b2.position.set(0.25, 1.52, -0.32);
    g.add(b1, b2);
    const geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.BufferAttribute(new Float32Array(12), 3));
    const lines = new T.LineSegments(geo, new T.LineBasicMaterial({ color: '#ffffff' }));
    g.add(lines);
    g.userData = { b: [b1, b2], lines };
    g.userData.set = (n, t, lean) => {
      // n balloons left: the first goes first
      b1.visible = n >= 2;
      b2.visible = n >= 1;
      const a = geo.attributes.position.array;
      const pts = [[b1, -0.08, 0.1], [b2, 0.08, 0.6]];
      pts.forEach(([b, sx, ph], i) => {
        b.rotation.z = 0.12 * Math.sin(t * 2.1 + ph) + (lean || 0);
        b.position.x = (i ? 0.25 : -0.24) + 0.04 * Math.sin(t * 1.7 + ph);
        a[i * 6 + 0] = sx; a[i * 6 + 1] = 0.82; a[i * 6 + 2] = -0.18;
        a[i * 6 + 3] = b.position.x; a[i * 6 + 4] = b.visible ? b.position.y - 0.42 : 0.82; a[i * 6 + 5] = b.position.z;
      });
      geo.attributes.position.needsUpdate = true;
    };
    return g;
  };

  // ---------- the parachute and the swim ring ----------
  A.parachute = function (cols) {
    const g = new T.Group();
    const tex = stripes([cols[0], '#ffffff', cols[1], '#ffffff'], 256, 16, true);
    const canopy = new T.Mesh(new T.SphereGeometry(0.95, 16, 6, 0, PI * 2, 0, PI / 2), new T.MeshStandardMaterial({ map: tex, roughness: 0.7, side: T.DoubleSide }));
    canopy.scale.set(1, 0.6, 1);
    canopy.position.y = 2.25;
    g.add(canopy);
    const pts = [];
    for (let k = 0; k < 4; k++) { const a = (k / 4) * PI * 2 + PI / 4; pts.push(Math.cos(a) * 0.9, 2.25, Math.sin(a) * 0.9, Math.cos(a) * 0.12, 0.85, Math.sin(a) * 0.12); }
    const geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.BufferAttribute(new Float32Array(pts), 3));
    g.add(new T.LineSegments(geo, new T.LineBasicMaterial({ color: '#ffffff' })));
    return g;
  };
  A.ring = function () {
    const tex = stripes(['#ff3d5a', '#ffffff'], 256, 8, true);
    const r = new T.Mesh(new T.TorusGeometry(0.36, 0.13, 8, 20), new T.MeshStandardMaterial({ map: tex, roughness: 0.5 }));
    r.rotation.x = PI / 2;
    r.position.y = 0.42;
    return r;
  };

  // ---------- a silly bird rider (they are the rivals with Foxy and Froggy) ----------
  A.bird = function (cols) {
    const root = new T.Group(), body = new T.Group();
    root.add(body);
    const feather = mat(cols[0], { roughness: 0.6 }), belly = mat(cols[1], { roughness: 0.7 }), orange = mat('#ff9f1c', { roughness: 0.5 });
    const b = new T.Mesh(new T.SphereGeometry(0.42, 16, 12), feather);
    b.position.y = 0.5;
    b.scale.set(1, 1.05, 0.95);
    body.add(b);
    const bel = new T.Mesh(new T.SphereGeometry(0.3, 12, 10), belly);
    bel.position.set(0, 0.42, -0.2);
    bel.scale.set(1, 1.1, 0.7);
    body.add(bel);
    const beak = new T.Mesh(new T.ConeGeometry(0.11, 0.34, 8), orange);
    beak.rotation.x = -PI / 2;
    beak.position.set(0, 0.6, -0.48);
    body.add(beak);
    for (const s of [-1, 1]) {
      const eye = new T.Mesh(new T.SphereGeometry(0.12, 12, 10), mat('#ffffff', { roughness: 0.3 }));
      eye.position.set(s * 0.15, 0.78, -0.32);
      body.add(eye);
      const pu = new T.Mesh(new T.SphereGeometry(0.055, 8, 6), mat('#14121f', { roughness: 0.3 }));
      pu.position.set(s * 0.15 + s * 0.02, 0.77, -0.43);
      pu.userData.s = s;
      body.add(pu);
      const leg = new T.Mesh(new T.BoxGeometry(0.06, 0.18, 0.06), orange);
      leg.position.set(s * 0.14, 0.05, 0);
      body.add(leg);
      const foot = new T.Mesh(new T.BoxGeometry(0.16, 0.04, 0.2), orange);
      foot.position.set(s * 0.14, -0.03, -0.06);
      body.add(foot);
    }
    const tuft = new T.Mesh(new T.ConeGeometry(0.07, 0.28, 5), feather);
    tuft.position.set(0, 1.0, -0.05);
    tuft.rotation.x = -0.4;
    body.add(tuft);
    const tuft2 = tuft.clone();
    tuft2.position.set(0.08, 0.98, 0.02);
    tuft2.rotation.set(-0.2, 0, -0.5);
    body.add(tuft2);
    const wings = [];
    for (const s of [-1, 1]) {
      const piv = new T.Group();
      piv.position.set(s * 0.38, 0.62, 0);
      const wg = new T.Mesh(new T.SphereGeometry(0.22, 10, 8), feather);
      wg.scale.set(0.35, 1, 0.8);
      wg.position.y = -0.16;
      piv.add(wg);
      body.add(piv);
      wings.push(piv);
    }
    return { root, body, wings, bird: true };
  };

  // ---------- the big goofy fish ----------
  A.fish = function () {
    const g = new T.Group();
    const orange = mat('#ff8a3d', { roughness: 0.45 }), white = mat('#fff4e6', { roughness: 0.6 }), fin = mat('#ffc04d', { roughness: 0.5 });
    const body = new T.Mesh(new T.SphereGeometry(0.8, 18, 14), orange);
    body.scale.set(1.45, 1, 0.8);
    g.add(body);
    const belly = new T.Mesh(new T.SphereGeometry(0.62, 14, 10), white);
    belly.position.set(0.1, -0.32, 0.12);
    belly.scale.set(1.4, 0.7, 0.75);
    g.add(belly);
    const tail = new T.Mesh(new T.ConeGeometry(0.55, 0.8, 4), fin);
    tail.rotation.z = PI / 2;
    tail.position.x = -1.45;
    tail.scale.set(1, 1, 0.3);
    g.add(tail);
    const top = new T.Mesh(new T.ConeGeometry(0.35, 0.6, 4), fin);
    top.position.set(-0.1, 0.85, 0);
    top.scale.set(1.4, 1, 0.3);
    g.add(top);
    for (const s of [-1, 1]) {
      const eye = new T.Mesh(new T.SphereGeometry(0.24, 14, 10), mat('#ffffff', { roughness: 0.25 }));
      eye.position.set(0.62, 0.3, s * 0.42);
      g.add(eye);
      const pu = new T.Mesh(new T.SphereGeometry(0.11, 10, 8), mat('#14121f', { roughness: 0.25 }));
      pu.position.set(0.78, 0.33, s * 0.5);
      g.add(pu);
    }
    const lips = new T.Mesh(new T.TorusGeometry(0.17, 0.08, 8, 14), mat('#ff5fa0', { roughness: 0.35 }));
    lips.position.set(1.15, -0.05, 0);
    lips.rotation.y = PI / 2;
    g.add(lips);
    g.scale.setScalar(0.95);
    return g;
  };

  // ---------- a spark: a giggly star in a glow ----------
  const sparkTex = { star: null, glow: null };
  A.spark = function () {
    sparkTex.star = sparkTex.star || starTex();
    sparkTex.glow = sparkTex.glow || G.radialTexture(64, [[0, 'rgba(255,255,200,1)'], [0.4, 'rgba(255,230,90,0.6)'], [1, 'rgba(255,200,40,0)']]);
    const g = new T.Group();
    const glow = new T.Sprite(new T.SpriteMaterial({ map: sparkTex.glow, depthWrite: false, blending: T.AdditiveBlending }));
    glow.scale.set(1.6, 1.6, 1);
    const star = new T.Sprite(new T.SpriteMaterial({ map: sparkTex.star, depthWrite: false }));
    star.scale.set(0.75, 0.75, 1);
    g.add(glow, star);
    g.userData = { glow, star };
    return g;
  };

  // ---------- confetti: one instanced mesh of little paper squares (from TT Barrel Climb) ----------
  A.confetti = function (scene, max) {
    max = max || 500;
    const geo = new T.PlaneGeometry(0.16, 0.1);
    const im = new T.InstancedMesh(geo, new T.MeshBasicMaterial({ side: T.DoubleSide }), max);
    im.instanceMatrix.setUsage(T.DynamicDrawUsage);
    im.frustumCulled = false;
    scene.add(im);
    const ps = [];
    const col = new T.Color(), m4 = new T.Matrix4(), q = new T.Quaternion(), e = new T.Euler(), s = new T.Vector3(1, 1, 1), v = new T.Vector3();
    const COLS = ['#ff3d7f', '#ffd400', '#18d4ff', '#7dff5a', '#ff8a1f', '#c77dff', '#ffffff'];
    for (let i = 0; i < max; i++) { im.setColorAt(i, col.set(COLS[i % COLS.length])); m4.makeScale(0, 0, 0); im.setMatrixAt(i, m4); }
    let next = 0;
    return {
      burst(x, y, z, n, power, colors, grav) {
        for (let i = 0; i < n; i++) {
          const k = next++ % max;
          const a = Math.random() * PI * 2, sp = (0.4 + Math.random()) * (power || 4);
          ps[k] = { x, y, z: z || 0.5, vx: Math.cos(a) * sp, vy: Math.abs(Math.sin(a)) * sp + 1.5, vz: (Math.random() - 0.3) * 2, rx: Math.random() * 6, ry: Math.random() * 6, life: 1.6 + Math.random() * 1.2, g: grav || 6 };
          im.setColorAt(k, col.set(colors ? colors[i % colors.length] : COLS[k % COLS.length]));
        }
        im.instanceColor.needsUpdate = true;
      },
      rain(x0, x1, y, n) {
        for (let i = 0; i < n; i++) {
          const k = next++ % max;
          ps[k] = { x: x0 + Math.random() * (x1 - x0), y: y + Math.random() * 3, z: 0.6 + Math.random(), vx: (Math.random() - 0.5) * 1.5, vy: -1 - Math.random(), vz: 0, rx: Math.random() * 6, ry: Math.random() * 6, life: 4 + Math.random() * 2, g: 6 };
          im.setColorAt(k, col.set(COLS[k % COLS.length]));
        }
        im.instanceColor.needsUpdate = true;
      },
      update(dt) {
        for (let k = 0; k < max; k++) {
          const p = ps[k];
          if (!p) continue;
          p.life -= dt;
          if (p.life <= 0) { ps[k] = null; m4.makeScale(0, 0, 0); im.setMatrixAt(k, m4); continue; }
          p.vy -= p.g * dt;
          p.vx *= 1 - 1.2 * dt;
          p.vy = Math.max(p.vy, -2.2);
          p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
          p.rx += dt * 7; p.ry += dt * 5;
          q.setFromEuler(e.set(p.rx, p.ry, 0));
          s.setScalar(Math.min(1, p.life * 2));
          m4.compose(v.set(p.x, p.y, p.z), q, s);
          im.setMatrixAt(k, m4);
        }
        im.instanceMatrix.needsUpdate = true;
      },
      clear() { for (let k = 0; k < max; k++) if (ps[k]) { ps[k] = null; m4.makeScale(0, 0, 0); im.setMatrixAt(k, m4); } im.instanceMatrix.needsUpdate = true; },
    };
  };
  A.emoji = function (e, size) {
    const s = new T.Sprite(new T.SpriteMaterial({ map: G.emojiTexture(e), depthTest: false }));
    s.scale.set(size || 0.6, size || 0.6, 1);
    s.renderOrder = 5;
    return s;
  };
})();
