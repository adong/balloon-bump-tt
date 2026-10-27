/* TT Balloon Bump: the page. The Three.js scene with a fixed arcade camera over the lake, the HUD and screens, keys and
   touch, the brother who flies in to pop the nearest rival's balloons, the celebrations, and the window.game test hooks.
   The rules are js/sim.js (fixed 1/120 s steps); the 3D things are js/art.js; sounds are js/sfx.js. */
(function () {
  'use strict';
  const T = THREE, S = BB.sim, A = BB.art, SFX = BB.sfx, L = BB.levels;
  const $ = (id) => document.getElementById(id);
  const PI = Math.PI, DT = S.DT;
  const KEY = 'balloonBumpTT.v1';
  const NAME = (id) => (Kit.roster.get(id) || { name: id.toUpperCase() }).name;
  const fmt = (n) => Math.round(n).toLocaleString('en-US');
  const SCALE = 0.5; // the kit's people are 2 m tall; riders here are 1 m, with 1 m of balloons on top
  const CRY = { bird: 'HONK!', foxy: 'YIP YIP!', froggy: 'RIBBIT!' };

  const store = {
    d: {},
    load() {
      try { this.d = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { this.d = {}; }
      this.d.hi = this.d.hi || {};
    },
    save() { try { localStorage.setItem(KEY, JSON.stringify(this.d)); } catch (e) { /* private mode: fine */ } },
  };

  const G = {
    screen: 'loading', w: null, demo: false, paused: false, hold: false, autoPause: true,
    keys: {}, flapQ: [0, 0], touch: [{}, {}], players: 1, who: 'teddy', mode: 'coop', level: 'easy', sab: null,
    time: 0, frame: 0, overT: 0, cele: null, demoReset: false, newHi: false, sndT: {},
  };
  let renderer, scene, cam, confetti, lake, cloud, fish, ball, treatSprite, last = 0;
  const riders = {}; // the rider bodies: teddy, tommy, foxy, froggy, bird0..bird3
  const islands = [];
  const sparks = [], bonusPool = [], bubbles = [];
  const birdOf = new Map();
  const emojiTex = new Map();
  let portraits = {};
  const v3 = new T.Vector3();

  // ---------- start-up ----------
  function boot() {
    renderer = new T.WebGLRenderer({ canvas: $('game'), antialias: true });
    renderer.outputEncoding = T.sRGBEncoding;
    renderer.setPixelRatio(Math.min(2, Math.max(1, devicePixelRatio || 1)));
    scene = new T.Scene();
    cam = new T.PerspectiveCamera(30, 1, 1, 400);
    scene.add(new T.HemisphereLight('#ffffff', '#8fd0e8', 0.9));
    const sun = new T.DirectionalLight('#fff4dd', 0.7);
    sun.position.set(-10, 24, 30);
    scene.add(sun);
    A.backdrop(scene);
    lake = A.lake(scene);
    A.shores(scene);
    for (let i = 0; i < L.LAYOUTS.length; i++) { const g = A.islands(i); g.visible = false; scene.add(g); islands.push(g); }
    cloud = A.cloud();
    scene.add(cloud);
    fish = A.fish();
    fish.visible = false;
    scene.add(fish);
    for (const id of ['teddy', 'tommy', 'foxy', 'froggy']) riders[id] = makeRider(id);
    for (let i = 0; i < 4; i++) riders['bird' + i] = makeRider('bird', i);
    for (let i = 0; i < 3; i++) { const s = A.spark(); s.visible = false; scene.add(s); sparks.push(s); }
    const cols = ['#ff3d5a', '#ffd400', '#2f8cff', '#7dff5a', '#ff8a1f', '#c77dff', '#ff5fb4'];
    for (let i = 0; i < 22; i++) { const b = A.balloon(cols[i % cols.length], 1.15); b.visible = false; scene.add(b); bonusPool.push(b); }
    const bubGeo = new T.SphereGeometry(0.09, 8, 6), bubMat = new T.MeshStandardMaterial({ color: '#ffffff', transparent: true, opacity: 0.8, roughness: 0.1 });
    for (let i = 0; i < 10; i++) { const b = new T.Mesh(bubGeo, bubMat); b.visible = false; scene.add(b); bubbles.push(b); }
    confetti = A.confetti(scene, 700);
    ball = A.emoji('🏀', 0.4);
    ball.visible = false;
    scene.add(ball);
    treatSprite = A.emoji('🍦', 0.5);
    treatSprite.visible = false;
    scene.add(treatSprite);
    portraits = Kit.portraits(['teddy', 'tommy'].map((id) => Kit.roster.get(id)), { size: 128 });
    store.load();
    const o = store.d.opts || {};
    if (o.players === 2) G.players = 2;
    if (o.who === 'tommy') G.who = 'tommy';
    if (o.mode === 'versus') G.mode = 'versus';
    if (o.level === 'normal') G.level = 'normal';
    setupUI();
    addEventListener('resize', fit);
    showTitle();
    $('loading').classList.add('hidden');
    requestAnimationFrame(frame);
  }
  function makeRider(who, bi) {
    const root = new T.Group(), body = new T.Group();
    root.add(body);
    let person, kind = who;
    if (who === 'bird') {
      person = A.bird(A.BIRDS[bi]);
      body.add(person.root);
    } else {
      person = Kit.people.build(Kit.roster.get(who).look);
      person.root.scale.setScalar(SCALE * (who === 'foxy' || who === 'froggy' ? 0.95 : 1));
      body.add(person.root);
    }
    const cols = A.BALLOON[kind];
    const balloons = A.balloonPair(cols);
    root.add(balloons);
    const para = A.parachute(cols);
    para.visible = false;
    root.add(para);
    const ring = A.ring();
    ring.visible = false;
    root.add(ring);
    root.visible = false;
    scene.add(root);
    return { root, body, person, balloons, para, ring, who, kind, ph: Math.random() * 6, yaw: PI };
  }

  // ---------- the fixed arcade camera: the whole sky fits the free part of the screen ----------
  const BOX = { x0: -13.3, x1: 13.3, y0: -1.1, y1: 14.1 };
  const PITCH = 0.09;
  let view = { left: 58, right: 10, top: 64, bottom: 6 };
  function fit() {
    const W = innerWidth, H = innerHeight;
    renderer.setSize(W, H, false);
    const short = H <= 460, narrow = W <= 520;
    const top = short ? 46 : narrow ? 54 : 64;
    const bw = BOX.x1 - BOX.x0, bh = BOX.y1 - BOX.y0;
    const cands = [];
    const touch = document.body.classList.contains('touch') && (G.screen === 'play' || G.screen === 'pause');
    if (!touch) cands.push({ left: 58, right: 10, bottom: 6 });
    else {
      const rl = $('tL').getBoundingClientRect(), rr = $('tR').getBoundingClientRect();
      cands.push({ left: Math.max(58, rl.right + 6), right: Math.max(10, W - rr.left + 6), bottom: 6 }); // beside the buttons
      cands.push({ left: 58, right: 10, bottom: Math.max(6, H - Math.min(rl.top, rr.top) + 6) }); // above them
    }
    let best = null;
    for (const c of cands) {
      const sw = Math.max(50, W - c.left - c.right), sh = Math.max(50, H - top - c.bottom);
      const k = Math.min(sw / bw, sh / bh);
      if (!best || k > best.k + 1e-6) best = Object.assign({ k, sw, sh, top }, c);
    }
    view = best;
    const k = best.k;
    const D = H / k / 2 / Math.tan((cam.fov * PI) / 360);
    const offX = best.left + best.sw / 2 - W / 2, offY = top + best.sh / 2 - H / 2;
    const cx = (BOX.x0 + BOX.x1) / 2 - offX / k, cy = (BOX.y0 + BOX.y1) / 2 + offY / k;
    cam.aspect = W / H;
    cam.position.set(cx, cy + D * Math.sin(PITCH), D * Math.cos(PITCH));
    cam.near = Math.max(1, D * 0.3);
    cam.far = D + 90;
    cam.lookAt(cx, cy, 0);
    cam.updateProjectionMatrix();
  }
  function toScreen(x, y, z) {
    v3.set(x, y, z || 0).project(cam);
    return [(v3.x * 0.5 + 0.5) * innerWidth, (-v3.y * 0.5 + 0.5) * innerHeight];
  }

  // ---------- games ----------
  function newWorld(demo) {
    const who = demo ? ['teddy'] : G.players === 2 ? ['teddy', 'tommy'] : [G.who];
    return S.create({ level: demo ? 'easy' : G.level, players: who, mode: G.mode, seed: (Math.random() * 1e9) | 0, buddyFor: (id) => Kit.roster.buddyFor(id) });
  }
  function setScreen(name) {
    G.screen = name;
    for (const id of ['title', 'pause', 'results']) $(id).classList.toggle('hidden', id !== name);
    document.body.classList.toggle('title', name === 'title');
    const playing = name === 'play' || name === 'pause';
    $('hud').classList.toggle('hidden', !playing);
    $('touch').classList.toggle('hidden', name !== 'play');
    $('menuMute').classList.toggle('hidden', playing);
    fit();
  }
  function play() {
    Kit.sound.init();
    G.demo = false;
    G.paused = false;
    G.w = newWorld(false);
    G.w.sab = G.simSab || null;
    G.keys = {};
    G.flapQ = [0, 0];
    G.touch = [{}, {}];
    G.overT = 0;
    G.cele = null;
    G.newHi = false;
    birdOf.clear();
    confetti.clear();
    clearPops();
    document.body.classList.toggle('p2', G.players === 2);
    store.d.opts = { players: G.players, who: G.who, mode: G.mode, level: G.level };
    store.save();
    setupHud();
    setScreen('play');
    SFX.click();
  }
  function showTitle() {
    G.demo = true;
    G.paused = false;
    G.w = newWorld(true);
    G.cele = null;
    birdOf.clear();
    clearPops();
    document.body.classList.remove('p2');
    setScreen('title');
    syncOpts();
  }
  function pause() {
    if (G.screen !== 'play') return;
    G.paused = true;
    setScreen('pause');
  }
  function resume() {
    if (G.screen !== 'pause') return;
    G.paused = false;
    setScreen('play');
  }
  function call() {
    if (G.screen !== 'play' || !G.w) return;
    Kit.sound.init();
    G.w.events = []; // the last step's events were handled already
    S.call(G.w);
    handleEvents(G.w.events);
    G.w.events = [];
  }
  function setOpt(k, v) {
    G[k] = v;
    syncOpts();
    SFX.click();
  }
  function syncOpts() {
    document.querySelectorAll('[data-players]').forEach((b) => b.setAttribute('aria-checked', String(+b.dataset.players === G.players)));
    document.querySelectorAll('[data-who]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.who === G.who)));
    document.querySelectorAll('[data-mode]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.mode === G.mode)));
    document.querySelectorAll('[data-level]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.level === G.level)));
    $('whoRow').classList.toggle('off', G.players === 2);
    $('modeRow').classList.toggle('off', G.players !== 2);
    const hi = store.d.hi[G.level];
    $('titleHi').textContent = hi ? `HI-SCORE ${fmt(hi.score)} · ${NAME(hi.who)}` : '';
    $('titleKeys').innerHTML = G.players === 2
      ? '<span>TEDDY: drift · flap</span><span><kbd>A</kbd><kbd>D</kbd> · <kbd>W</kbd> or <kbd>Space</kbd></span><span>TOMMY: drift · flap</span><span><kbd>←</kbd><kbd>→</kbd> · <kbd>↑</kbd> or <kbd>Enter</kbd></span><span>high five</span><span><kbd>T</kbd></span><span>pause · sound</span><span><kbd>P</kbd> · <kbd>M</kbd></span>'
      : '<span>flap and rise</span><span><kbd>Space</kbd> or <kbd>↑</kbd> <kbd>W</kbd> (hold to keep flapping)</span><span>drift</span><span><kbd>←</kbd><kbd>→</kbd> or <kbd>A</kbd><kbd>D</kbd></span><span>call your brother</span><span><kbd>T</kbd></span><span>pause · sound</span><span><kbd>P</kbd> · <kbd>M</kbd></span>';
    $('touchHint').textContent = G.players === 2
      ? 'Teddy: the buttons on the left. Tommy: the buttons on the right. ⬆ flaps, ◀ ▶ drift.'
      : "◀ ▶ drift, the big ⬆ flaps (hold it to keep flapping). Tap your brother's face to call him!";
  }

  // ---------- HUD ----------
  let hudCache = '';
  function setupHud() {
    const w = G.w;
    w.pl.forEach((p, pi) => { $('hudP' + pi).querySelector('[data-name]').textContent = NAME(p.who); });
    $('hudP1').classList.toggle('off', w.pl.length < 2);
    const two = w.pl.length === 2;
    $('budBtn').style.display = two ? 'none' : '';
    const bud = Kit.roster.buddyFor(w.pl[0].who);
    $('budBtn').querySelector('img').src = portraits[bud] || '';
    $('budLbl').textContent = `CALL ${NAME(bud)}`;
    const cb = document.querySelector('#tR .call');
    cb.classList.toggle('hi5', two);
    cb.innerHTML = two ? '✋<small>HIGH FIVE</small>' : `<img alt="" src="${portraits[bud] || ''}"><small>CALL</small>`;
    document.querySelector('#tR .flap').classList.toggle('p0', !two);
    hudCache = '';
  }
  function hud() {
    const w = G.w;
    if (!w || G.demo) return;
    const hi = Math.max((store.d.hi[w.level] || { score: 0 }).score, ...w.pl.map((p) => p.score));
    const wave = w.bonus ? `WAVE ${w.wave} · BONUS` : `WAVE ${w.wave}`;
    const lives = w.pl.map((p) => (p.lives > 6 ? `❤️×${p.lives}` : '❤️'.repeat(p.lives)));
    const key = [hi, wave, w.pl.map((p) => p.score).join(), lives.join(), !!w.buddy].join('|');
    if (key === hudCache) return;
    hudCache = key;
    $('hudHi').textContent = fmt(hi);
    $('hudWave').textContent = wave;
    w.pl.forEach((p, pi) => {
      const box = $('hudP' + pi);
      box.querySelector('.sc').textContent = fmt(p.score);
      box.querySelector('.lives').textContent = lives[pi] || ' ';
    });
    $('budBtn').classList.toggle('on', !!w.buddy);
    const cb = document.querySelector('#tR .call');
    if (cb) cb.classList.toggle('on', !!w.buddy);
  }

  // ---------- input ----------
  const FLAP0 = ['Space', 'ArrowUp', 'KeyW'];
  function flapOwner(c) {
    if (G.players === 1) return FLAP0.includes(c) ? 0 : -1;
    if (c === 'KeyW' || c === 'Space') return 0;
    if (c === 'ArrowUp' || c === 'Enter' || c === 'NumpadEnter') return 1;
    return -1;
  }
  function readInput() {
    const k = G.keys, out = [];
    for (let pi = 0; pi < G.w.pl.length; pi++) {
      const t = G.touch[pi] || {};
      let left, right, hold;
      if (G.players === 1) {
        left = k.ArrowLeft || k.KeyA || t.l;
        right = k.ArrowRight || k.KeyD || t.r;
        hold = k.Space || k.ArrowUp || k.KeyW || t.flap;
      } else if (pi === 0) {
        left = k.KeyA || t.l; right = k.KeyD || t.r; hold = k.KeyW || k.Space || t.flap;
      } else {
        left = k.ArrowLeft || t.l; right = k.ArrowRight || t.r; hold = k.ArrowUp || k.Enter || k.NumpadEnter || t.flap;
      }
      let lr = (right ? 1 : 0) - (left ? 1 : 0);
      if (G.sab === 'mirror') lr = -lr; // the play check's own sabotage
      const flap = G.flapQ[pi] > 0;
      if (flap) G.flapQ[pi]--;
      out.push({ lr, flap, hold: !!hold });
    }
    return out;
  }
  function setupUI() {
    $('logoText').textContent = BB.TITLE;
    $('tagline').textContent = BB.TAGLINE;
    const logo = () => {
      const zh = Kit.lang.is('zh');
      $('logoText').textContent = zh ? BB.ZH : BB.TITLE;
      $('logoSub').textContent = zh ? BB.TITLE : '';
    };
    logo();
    Kit.lang.onChange(logo);
    document.querySelectorAll('[data-who] img').forEach((im) => (im.src = portraits[im.parentNode.dataset.who] || ''));
    document.querySelectorAll('[data-players]').forEach((b) => b.addEventListener('click', () => setOpt('players', +b.dataset.players)));
    document.querySelectorAll('[data-who]').forEach((b) => b.addEventListener('click', () => setOpt('who', b.dataset.who)));
    document.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => setOpt('mode', b.dataset.mode)));
    document.querySelectorAll('[data-level]').forEach((b) => b.addEventListener('click', () => setOpt('level', b.dataset.level)));
    $('startBtn').addEventListener('click', play);
    $('pauseBtn').addEventListener('click', pause);
    $('resumeBtn').addEventListener('click', resume);
    $('quitBtn').addEventListener('click', showTitle);
    $('againBtn').addEventListener('click', play);
    $('menuBtn').addEventListener('click', showTitle);
    $('budBtn').addEventListener('click', call);
    const syncMute = () => document.querySelectorAll('.muteBtn').forEach((b) => (b.textContent = Kit.sound.isMuted() ? '🔇' : '🔊'));
    document.querySelectorAll('.muteBtn').forEach((b) => b.addEventListener('click', () => { Kit.sound.init(); Kit.sound.toggleMute(); syncMute(); }));
    Kit.sound.onMute(syncMute);
    syncMute();

    addEventListener('pointerdown', (e) => {
      Kit.sound.init();
      if (e.pointerType === 'touch' && !document.body.classList.contains('touch')) {
        document.body.classList.add('touch');
        fit();
      }
    }, true);
    if (matchMedia('(hover: none) and (pointer: coarse)').matches || /[?&]touch=1/.test(location.search)) document.body.classList.add('touch');

    addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      Kit.sound.init();
      const c = e.code;
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(c)) e.preventDefault();
      if (c === 'KeyM' && !e.repeat) { Kit.sound.toggleMute(); syncMute(); return; }
      if (G.screen === 'title') {
        if (e.repeat) return;
        if (c === 'Digit1') setOpt('players', 1);
        else if (c === 'Digit2') setOpt('players', 2);
        else if (c === 'KeyE') setOpt('level', 'easy');
        else if (c === 'KeyN') setOpt('level', 'normal');
        else if (c === 'KeyC' || c === 'ArrowLeft' || c === 'ArrowRight') { if (G.players === 1) setOpt('who', G.who === 'teddy' ? 'tommy' : 'teddy'); else setOpt('mode', G.mode === 'coop' ? 'versus' : 'coop'); }
        else if (c === 'Enter' || c === 'Space') play();
        return;
      }
      if (G.screen === 'results') {
        if (e.repeat) return;
        if (c === 'Enter' || c === 'Space') play();
        else if (c === 'Escape' || c === 'KeyQ') showTitle();
        return;
      }
      if (G.paused) {
        if (e.repeat) return;
        if (c === 'KeyP' || c === 'Escape') resume();
        else if (c === 'KeyQ') showTitle();
        G.keys[c] = true; // still held when the game goes on
        return;
      }
      if (G.screen === 'play') {
        if ((c === 'KeyP' || c === 'Escape') && !e.repeat) return pause();
        if (c === 'KeyT' && !e.repeat) { call(); return; }
        if ((c === 'Enter' || c === 'NumpadEnter') && G.players === 1 && !e.repeat) { call(); return; }
        G.keys[c] = true;
        const pi = flapOwner(c);
        if (pi >= 0 && !e.repeat) G.flapQ[pi] = Math.min(3, G.flapQ[pi] + 1);
      }
    });
    addEventListener('keyup', (e) => { G.keys[e.code] = false; });
    addEventListener('blur', () => { G.keys = {}; G.touch = [{}, {}]; });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && G.autoPause && G.screen === 'play' && !G.paused) pause();
      if (document.hidden) Kit.sound.suspend();
      else Kit.sound.resume();
    });

    // touch: drift arrows and a big FLAP (2 players: Teddy's set on the left, Tommy's on the right)
    const capture = (el, e) => { try { el.setPointerCapture(e.pointerId); } catch (err) { /* a test's pointer: fine */ } };
    document.querySelectorAll('#touch [data-k]').forEach((b) => {
      const k = b.dataset.k;
      const owner = () => (b.dataset.p === 'R' ? (G.players === 2 ? 1 : 0) : +b.dataset.p);
      const on = (v) => {
        b.classList.toggle('down', v);
        if (k === 'call') { if (v) call(); return; }
        const pi = owner();
        G.touch[pi] = G.touch[pi] || {};
        G.touch[pi][k] = v;
        if (k === 'flap' && v && G.screen === 'play' && !G.paused) G.flapQ[pi] = Math.min(3, G.flapQ[pi] + 1);
      };
      b.addEventListener('pointerdown', (e) => { e.preventDefault(); capture(b, e); on(true); });
      b.addEventListener('pointerup', () => on(false));
      b.addEventListener('pointercancel', () => on(false));
      b.addEventListener('lostpointercapture', () => on(false));
    });
  }

  // ---------- each frame ----------
  function frame(now) {
    requestAnimationFrame(frame);
    const gap = now - (last || now);
    const dt = Math.min(0.1, Math.max(0, gap / 1000));
    last = now;
    if (gap > 300) { G.touch = [{}, {}]; document.querySelectorAll('#touch .down').forEach((b) => b.classList.remove('down')); } // frames were held back (the ? panel, a hidden tab)
    if (!G.hold) advance(dt);
    draw();
  }
  function inputFor(w) {
    if (G.demo) return [BB.bot.decide(w, 0)];
    if (G.screen === 'play') return readInput();
    return null;
  }
  function afterStep(w) {
    handleEvents(w.events);
    if (G.demo) { if (w.phase === 'over' || w.t > 240) G.demoReset = true; }
    else if (w.phase === 'over' && G.screen === 'play') {
      G.overT += DT;
      if (G.overT > 3.2) showResults();
    }
  }
  function advance(dt) {
    G.time += dt;
    G.frame++;
    const w = G.w;
    if (!w) return;
    if (!G.paused) {
      S.advance(w, dt, inputFor, afterStep);
      if (G.demoReset) { G.demoReset = false; G.w = newWorld(true); birdOf.clear(); }
    }
    visuals(G.paused ? 0 : dt);
  }
  function draw() { renderer.render(scene, cam); }

  // ---------- what the rules said happened ----------
  const riderById = (id) => G.w.riders.find((r) => r.id === id);
  function sfx(name, gap, ...a) {
    if (G.demo) return;
    if (gap && G.time - (G.sndT[name] || -9) < gap) return;
    G.sndT[name] = G.time;
    SFX[name](...a);
  }
  const WATER = ['#bff3ff', '#7fd8ff', '#ffffff', '#4fc3f7'];
  function handleEvents(evs) {
    const w = G.w;
    for (const e of evs) {
      const r = e.r ? riderById(e.r) : null;
      switch (e.type) {
        case 'flap': if (r && r.kind === 'player') sfx('flap', 0.05); break;
        case 'pop': {
          sfx('pop');
          const cols = r ? A.BALLOON[r.who] : null;
          confetti.burst(e.x, e.y, 0.3, 26, 4, cols && cols.concat(['#ffffff']));
          if (e.pts) pop(e.x, e.y + 0.4, `POP! +${e.pts}`);
          else if (r && r.kind === 'player') pop(e.x, e.y + 0.4, e.how === 'fish' ? 'BOOP!' : e.how === 'spark' ? 'ZAP!' : 'POP!', 'ouch');
          break;
        }
        case 'para':
          sfx('para');
          if (r && r.kind === 'rival') pop(e.x, e.y + 1.4, CRY[r.who] || 'WHEEE!', 'cool');
          else pop(e.x, e.y + 1.4, 'OOPS!', 'ouch');
          if (e.pts) setTimeout(() => pop(e.x, e.y + 0.6, `+${e.pts}`, 'big'), 250);
          break;
        case 'boing': sfx('boing', 0.12); break;
        case 'bonk': sfx('bonk', 0.1); break;
        case 'land': sfx('land', 0.1); break;
        case 'splash':
          if (r && r.kind === 'player') { sfx('splash'); pop(e.x, 1.2, 'SPLASH!', 'cool'); }
          confetti.burst(e.x, 0.1, 0.5, 18, 3.5, WATER, 9);
          break;
        case 'sploosh': sfx('sploosh'); confetti.burst(e.x, 0.1, 0.5, 30, 4, WATER, 9); pop(e.x, 1.4, 'SPLOOSH!', 'cool'); break;
        case 'splashDown': sfx('splash', 0.1); confetti.burst(e.x, 0.1, 0.8, 16, 3, WATER, 9); break;
        case 'respawn': pop(S.SPAWN[e.pi].x, 2.6, 'GO!', 'big'); break;
        case 'out': if (w.pl.length === 2) toast(`${NAME(w.pl[e.pi].who)} IS OUT OF LIVES`); break;
        case 'fishWarn': sfx('fishWarn'); break;
        case 'fishJump': sfx('fish'); confetti.burst(e.x, 0.1, 0.4, 24, 4, WATER, 9); break;
        case 'fishSplash': pop(e.x, 2.6, 'WHEEE!', 'cool'); break;
        case 'fishBoop': sfx('boop'); break;
        case 'sparkOut': sfx('sparkOut'); G.puffT = 0.6; break;
        case 'zap': sfx('zap'); confetti.burst(e.x, e.y, 0.4, 14, 3, ['#fff36b', '#ffd400', '#ffffff']); break;
        case 'tickle': sfx('tickle'); confetti.burst(e.x, e.y, 0.4, 12, 3, ['#fff36b', '#ffd400', '#ffffff']); pop(e.x, e.y + 0.5, 'TICKLE! HEE HEE!', 'cool'); break;
        case 'fizzle': confetti.burst(e.x, e.y, 0.4, 8, 2, ['#fff36b', '#ffffff']); break;
        case 'wave':
          sfx('wave');
          birdOf.clear();
          if (e.bonus) big('BONUS STAGE!', 'Pop the rising balloons!');
          else big(`WAVE ${e.n}`, 'Bump the balloons from above!');
          if (!e.bonus) setTimeout(() => sfx('pump'), 300);
          break;
        case 'go': if (!G.demo) pop(0, 6.5, 'GO!', 'big'); break;
        case 'clear':
          sfx('clear');
          big('WAVE CLEAR!');
          celebrate(w.riders.filter((x) => x.kind === 'player' && x.state === 'fly').map((x) => x.id), 2.6);
          if (!G.demo) confetti.rain(-11, 11, 13, 90);
          break;
        case 'bonusEnd':
          if (e.perfect) { sfx('perfect'); big('PERFECT!', `+${fmt(e.pts)}`); if (!G.demo) confetti.rain(-11, 11, 13, 120); }
          else { sfx('clear'); big(`${e.got} / ${e.total}`, 'BALLOONS POPPED'); }
          celebrate(w.riders.filter((x) => x.kind === 'player' && x.state === 'fly').map((x) => x.id), 2.6);
          break;
        case 'bpop': sfx('bpop', 0, e.n % 8); confetti.burst(e.x, e.y, 0.3, 14, 3); pop(e.x, e.y + 0.3, `+${e.pts}`); break;
        case 'life': sfx('life'); pop(w.riders[e.pi].x, w.riders[e.pi].y + 2.4, 'EXTRA LIFE!', 'big'); break;
        case 'over': {
          sfx('gameOver');
          const best = Math.max(...w.pl.map((p) => p.score));
          celebrate(w.riders.filter((x, i) => x.kind === 'player' && w.pl[i].score === best).map((x) => x.id), 99, true);
          if (!G.demo) confetti.rain(-11, 11, 13, 160);
          break;
        }
        case 'buddyIn': sfx('buddy'); if (w.buddy) confetti.burst(w.buddy.x, w.buddy.y + 1, 0.5, 20, 3); break;
        case 'treat': sfx('treat'); throwTreat(e.treat); pop(w.riders[0].x, w.riders[0].y + 2.3, `${e.treat} +${e.pts}`); break;
        case 'helper': sfx('helper'); toast(`${NAME(e.who)} SAYS: I'LL POP 'EM!`); break;
        case 'hi5': {
          sfx('hi5');
          toast('HIGH FIVE! ✋ +50');
          const [a, b] = w.riders;
          const mx = a.x + S.wrapDx(b.x - a.x) / 2;
          confetti.burst(mx, (a.y + b.y) / 2 + 1, 0.6, 40, 4);
          break;
        }
        default: break;
      }
    }
  }
  function celebrate(ids, secs, over) {
    G.cele = { ids: new Set(ids), until: G.time + secs, over: !!over, t0: G.time, n: (G.cele ? G.cele.n : 0) + 1 };
  }
  let treatFly = null;
  function throwTreat(e) {
    const w = G.w, b = w.buddy, me = w.riders[0];
    if (!emojiTex.has(e)) emojiTex.set(e, Kit.gfx.emojiTexture(e));
    treatSprite.material.map = emojiTex.get(e);
    treatSprite.material.needsUpdate = true;
    treatFly = { t: 0, x0: b ? b.x : me.x - 1, y0: b ? b.y + 1 : me.y + 2, me };
  }

  // ---------- pops, toasts and big words ----------
  function pop(x, y, text, cls) {
    if (G.demo) return;
    const [sx, sy] = toScreen(x, y, 0.5);
    const d = document.createElement('div');
    d.className = 'pop' + (cls ? ' ' + cls : '');
    d.textContent = text;
    d.style.left = sx + 'px';
    d.style.top = sy + 'px';
    $('pops').appendChild(d);
    setTimeout(() => d.remove(), 1300);
  }
  function clearPops() { $('pops').innerHTML = ''; }
  let toastTimer = 0;
  function toast(text) {
    if (G.demo) return;
    const t = $('toast');
    t.textContent = text;
    t.classList.remove('show');
    void t.offsetWidth;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
  }
  let bigTimer = 0;
  function big(text, small) {
    if (G.demo) return;
    const b = $('bigmsg');
    b.innerHTML = '';
    b.appendChild(document.createTextNode(text));
    if (small) { const s = document.createElement('small'); s.textContent = small; b.appendChild(s); }
    b.classList.remove('show');
    void b.offsetWidth;
    b.classList.add('show');
    clearTimeout(bigTimer);
    bigTimer = setTimeout(() => b.classList.remove('show'), 1500);
  }

  // ---------- results ----------
  function showResults() {
    const w = G.w;
    if (!w || G.screen === 'results') return;
    const best = Math.max(...w.pl.map((p) => p.score));
    const two = w.pl.length === 2;
    const winners = w.pl.filter((p) => p.score === best);
    $('resTitle').textContent = !two ? 'GREAT FLYING!' : w.mode === 'coop' ? 'GREAT TEAMWORK!' : winners.length === 2 ? "IT'S A TIE!" : `${NAME(winners[0].who)} WINS!`;
    $('resSub').textContent = two ? `WAVE ${w.wave} · TEAM ${fmt(w.pl[0].score + w.pl[1].score)}` : `WAVE ${w.wave} · ${fmt(best)} POINTS`;
    $('resTable').innerHTML = '';
    w.pl.slice().sort((a, b) => b.score - a.score).forEach((p) => {
      const tr = document.createElement('tr');
      if (p.score === best) tr.className = 'me';
      tr.innerHTML = `<td class="who"><img alt="" src="${portraits[p.who] || ''}">${NAME(p.who)}</td><td class="pts">${fmt(p.score)}</td><td>🎈 ${p.pops || 0}</td>`;
      $('resTable').appendChild(tr);
    });
    const old = store.d.hi[w.level];
    const top = w.pl.reduce((a, b) => (b.score > a.score ? b : a));
    if (top.score > 0 && (!old || top.score > old.score)) {
      store.d.hi[w.level] = { score: top.score, who: top.who };
      store.save();
      G.newHi = true;
    }
    const hi = store.d.hi[w.level];
    $('resBest').textContent = G.newHi ? '⭐ NEW HI-SCORE!' : hi ? `HI-SCORE ${fmt(hi.score)} · ${NAME(hi.who)}` : '';
    $('resBest').classList.toggle('new', G.newHi);
    setScreen('results');
  }

  // ---------- moving the 3D things to match the rules ----------
  function bodyFor(r, used) {
    if (r.who !== 'bird') return riders[r.who];
    let i = birdOf.get(r.id);
    if (i == null || used.has('bird' + i)) {
      i = [0, 1, 2, 3].find((k) => !used.has('bird' + k) && ![...birdOf.values()].includes(k));
      if (i == null) i = [0, 1, 2, 3].find((k) => !used.has('bird' + k));
      if (i == null) return null;
      birdOf.set(r.id, i);
    }
    return riders['bird' + i];
  }
  function visuals(dt) {
    const w = G.w;
    const t = G.time;
    const k = 1 - Math.exp(-14 * dt);
    lake.update(t);
    for (const c of A.farClouds) { c.position.x += dt * 0.25; if (c.position.x > 40) c.position.x = -40; }
    islands.forEach((g, i) => (g.visible = i === w.layout));
    const cpos = L.LAYOUTS[w.layout].cloud;
    G.puffT = Math.max(0, (G.puffT || 0) - dt);
    cloud.position.set(cpos[0], cpos[1] + 0.15 * Math.sin(t * 0.9), -0.6);
    cloud.scale.setScalar(1 + (G.puffT > 0 ? 0.08 * Math.sin(G.puffT * 20) : 0));
    cloud.userData.face(G.puffT > 0);

    const used = new Set();
    const cele = G.cele && G.time < G.cele.until ? G.cele : null;
    for (const r of w.riders) {
      const c = bodyFor(r, used);
      if (!c) continue;
      used.add(c.who === 'bird' ? 'bird' + birdOf.get(r.id) : c.who);
      drawRider(c, r, dt, t, k, cele);
    }
    // the brother on his visit (1 player: his body is free)
    const b = w.buddy;
    if (b && riders[b.who] && !used.has(b.who)) {
      used.add(b.who);
      drawBuddy(riders[b.who], b, dt, t, k);
    }
    for (const id in riders) if (!used.has(id)) riders[id].root.visible = false;
    ballFollow(t);

    // the fish and its bubbles
    const f = w.fish;
    fish.visible = f.state === 'jump';
    if (fish.visible) {
      const u = Math.min(1, f.t / 0.9);
      fish.position.set(f.x, f.y, 0.4);
      fish.rotation.set(0, 0, (PI / 2) * (1 - 2 * u));
    }
    bubbles.forEach((m, i) => {
      m.visible = f.state === 'warn';
      if (m.visible) { const ph = (f.t * 2 + i / bubbles.length) % 1; m.position.set(f.x + Math.sin(i * 2.3) * 0.7, -0.1 + ph * 0.5, 0.4 + Math.cos(i * 1.7) * 0.4); m.scale.setScalar(1 - ph * 0.5); }
    });
    // sparks
    sparks.forEach((s, i) => {
      const o = w.sparks[i];
      s.visible = !!o;
      if (!o) return;
      s.position.set(o.x, o.y, 0.3);
      s.userData.star.material.rotation = t * 4;
      const fl = 1 + 0.15 * Math.sin(t * 30 + i);
      s.userData.glow.scale.set(1.6 * fl, 1.6 * fl, 1);
    });
    // bonus balloons
    const list = w.bonus ? w.bonus.list : [];
    bonusPool.forEach((m, i) => {
      const o = list[i];
      m.visible = !!o;
      if (!o) return;
      m.position.set(o.x, o.y, 0.1);
      m.rotation.z = 0.15 * Math.sin(t * 2 + o.ph);
    });
    // a treat flying from the brother to you
    if (treatFly) {
      treatFly.t += dt;
      const u = Math.min(1, treatFly.t / 0.55), me = treatFly.me;
      treatSprite.visible = u < 1;
      treatSprite.position.set(treatFly.x0 + S.wrapDx(me.x - treatFly.x0) * u, treatFly.y0 + (me.y + 1.6 - treatFly.y0) * u + Math.sin(u * PI) * 1.2, 1);
      if (u >= 1) treatFly = null;
    } else treatSprite.visible = false;
    confetti.update(dt);
    hud();
  }
  // the side the rider faces, turned a little toward the camera so you see the face
  const YAW = (face) => (face > 0 ? -PI / 2 - 0.5 : PI / 2 + 0.5);
  function turn(c, yaw, k) {
    let d = yaw - c.yaw;
    while (d > PI) d -= 2 * PI;
    while (d < -PI) d += 2 * PI;
    c.yaw += d * Math.min(1, k * 1.3);
    c.body.rotation.y = c.yaw;
  }
  function flapArms(c, r, t, k) {
    const p = c.person;
    if (p.bird) {
      const a = 0.3 + 1.3 * r.flapK + 0.15 * Math.sin(t * 9 + c.ph);
      p.wings[0].rotation.z = -a;
      p.wings[1].rotation.z = a;
      return;
    }
    Kit.people.pose(p, t * 6 + c.ph, 'jump', k);
    const az = 0.55 + 1.8 * (1 - r.flapK);
    p.armL.rotation.z = -az;
    p.armR.rotation.z = az;
    p.armL.rotation.x = p.armR.rotation.x = 0.25;
    p.legL.rotation.x = 0.35 * Math.sin(t * 7 + c.ph);
    p.legR.rotation.x = -0.35 * Math.sin(t * 7 + c.ph);
  }
  function posePerson(c, mode, ph, k) {
    const p = c.person;
    if (p.bird) {
      const a = mode === 'stand' ? 0.25 : 0.8 + 0.6 * Math.sin(ph * 2);
      p.wings[0].rotation.z = -a;
      p.wings[1].rotation.z = mode === 'wave' ? 1.6 + 0.5 * Math.sin(ph * 3) : a;
      p.body.position.y = mode === 'walk' ? Math.abs(Math.sin(ph)) * 0.08 : 0;
      return;
    }
    Kit.people.pose(p, ph, mode, k);
  }
  function sigMode(who, n) {
    const e = Kit.roster.get(who);
    if (!e || !e.signature) return 'wave';
    return e.signature[(n || 0) % e.signature.length];
  }
  let ballOwner = null;
  function ballFollow(t) {
    ball.visible = !!ballOwner;
    if (ballOwner) {
      const c = ballOwner;
      c.root.updateMatrixWorld(true);
      Kit.people.handWorld(c.person, 1, v3);
      ball.position.set(v3.x, v3.y + 0.18 + 0.05 * Math.sin(t * 8), v3.z + 0.3);
    }
    ballOwner = null;
  }
  function drawRider(c, r, dt, t, k, cele) {
    const w = G.w;
    const st = r.state;
    let vis = st !== 'out' && st !== 'gone';
    let x = r.x, y = r.y, z = 0;
    const celebr = cele && cele.ids.has(r.id);
    if (celebr && cele.over) { // the winner on the middle island, doing his move
      const p = L.LAYOUTS[w.layout].plats[0];
      const ids = [...cele.ids];
      x = (p.x0 + p.x1) / 2 + (ids.length > 1 ? (ids.indexOf(r.id) - 0.5) * 1.6 : 0);
      y = p.y;
      z = 0.3;
      vis = true;
    } else if (st === 'swim') { // swims away across the lake, waving
      const u = Math.min(1, r.t / 2.6);
      z = 0.6 - u * 7;
      y = -0.42 + 0.06 * Math.sin(t * 4 + c.ph);
    } else if (st === 'para') z = 1.3;
    if (vis && r.kind === 'player' && st === 'fly' && r.inv > 0 && !celebr) vis = Math.floor(t * 10) % 2 === 0;
    c.root.visible = vis;
    if (!vis) return;
    c.root.position.set(x, y, z);
    c.root.scale.setScalar(1);
    c.ph += dt * 6;
    const air = st === 'fly' && r.ground < 0;
    if (celebr) {
      turn(c, PI, k * 2);
      const mode = sigMode(r.who, cele.n + (cele.over ? 1 : 0));
      posePerson(c, mode, (G.time - cele.t0) * 7, k);
      if (mode === 'jumpshot') { c.root.position.y += Math.abs(Math.sin((G.time - cele.t0) * 3)) * 0.4; ballOwner = c; }
    } else if (st === 'para' || st === 'swim') {
      turn(c, PI, k);
      posePerson(c, 'wave', c.ph, k);
    } else if (st === 'pump') {
      turn(c, YAW(r.face), k);
      posePerson(c, 'give', c.ph * 1.5, k);
      if (!c.person.bird) c.person.armR.rotation.x = 1.2 + 0.5 * Math.sin(c.ph * 2.5);
    } else if (air) {
      turn(c, YAW(r.face), k);
      flapArms(c, r, t, k);
    } else {
      turn(c, YAW(r.face), k);
      posePerson(c, Math.abs(r.vx) > 0.3 ? 'walk' : 'stand', c.ph * 1.4, k);
    }
    // balloons: inflating while pumping, wobbling, the first one gone after a pop
    const nb = celebr && cele.over ? 2 : r.balloons;
    c.balloons.visible = nb > 0 && st !== 'para' && st !== 'swim';
    if (c.balloons.visible) {
      c.balloons.scale.setScalar(st === 'pump' ? 0.25 + 0.75 * r.pumpK : 1);
      c.balloons.userData.set(nb, t + c.ph * 0.1, -r.vx * 0.04);
    }
    c.para.visible = st === 'para';
    if (c.para.visible) c.para.rotation.z = 0.15 * Math.sin(r.t * 2.2 + r.id);
    c.ring.visible = st === 'swim';
  }
  function drawBuddy(c, b, dt, t, k) {
    c.root.visible = true;
    c.root.position.set(b.x, b.y, 0.5);
    c.root.scale.setScalar((Kit.roster.get(b.who) || {}).buddyScale || 0.8);
    c.ph += dt * 6;
    c.balloons.visible = true;
    c.balloons.scale.setScalar(1);
    c.balloons.userData.set(2, t, 0);
    c.para.visible = false;
    c.ring.visible = false;
    if (b.phase === 'sig') {
      turn(c, PI, k * 2);
      const mode = sigMode(b.who, b.n - 1);
      posePerson(c, mode, b.t * 7, k);
      if (mode === 'jumpshot') ballOwner = c;
    } else if (b.phase === 'out') {
      turn(c, PI, k);
      posePerson(c, 'wave', c.ph, k);
    } else {
      turn(c, YAW(b.face), k);
      flapArms(c, { flapK: 0.5 + 0.5 * Math.sin(t * 10) }, t, k);
    }
  }

  // ---------- test hooks ----------
  function state() {
    const w = G.w;
    const me = w && w.riders[0];
    return {
      screen: G.screen, paused: G.paused, demo: G.demo, phase: w && w.phase, wave: w && w.wave, level: w && w.level, mode: w && w.mode,
      p: me && { x: +me.x.toFixed(3), y: +me.y.toFixed(3), vx: +me.vx.toFixed(3), vy: +me.vy.toFixed(3), state: me.state, balloons: me.balloons, ground: me.ground, inv: +me.inv.toFixed(2) },
      players: w && w.pl.map((p, i) => ({ who: p.who, score: p.score, lives: p.lives, state: w.riders[i].state })),
      rivals: w && w.riders.filter((r) => r.kind === 'rival').map((r) => ({ who: r.who, state: r.state, balloons: r.balloons })),
      buddy: w && w.buddy && { who: w.buddy.who, phase: w.buddy.phase },
      muted: Kit.sound.isMuted(), sfx: Object.assign({}, SFX.log), lang: Kit.lang.get(), touch: document.body.classList.contains('touch'),
    };
  }
  window.game = {
    start(o) {
      o = o || {};
      if (o.players) G.players = o.players;
      if (o.who) G.who = o.who;
      if (o.mode) G.mode = o.mode;
      if (o.level) G.level = o.level;
      play();
      if (o.wave && o.wave !== 1) { S.startWave(G.w, o.wave); G.w.events = []; }
      if (o.go && G.w.phase === 'ready') { G.w.phase = 'play'; G.w.phaseT = 0; }
      return state();
    },
    step(secs, o) {
      const n = Math.max(1, Math.round((secs || DT) / DT));
      for (let i = 0; i < n; i++) advance(DT);
      if (!o || o.draw !== false) draw();
      return state();
    },
    state,
    hold(v) { G.hold = v !== false; return G.hold; },
    call, pause, resume, showTitle, showResults, play,
    check: (only) => BB.check.run(only),
    checkFail: () => BB.check.fail(),
    // put player pi at (x, y) in the air (tests); the rules stay the real ones
    put(pi, x, y, o) {
      const r = G.w.riders[pi || 0];
      Object.assign(r, { x, y, vx: 0, vy: 0, ground: -1, state: 'fly', balloons: 2, inv: 0, flapBuf: 0 }, o || {});
      return state();
    },
    // no rivals, no fish, no sparks (tests that only look at moving)
    quiet() { const w = G.w; w.riders = w.riders.filter((r) => r.kind === 'player'); w.fish.cd = 1e9; w.fish.state = 'idle'; w.sparks = []; w.sparkT = 1e9; if (w.phase === 'ready') w.phase = 'play'; return state(); },
    sabotage(s) { G.sab = s || null; return G.sab; },
    simSabotage(s) { G.simSab = s || null; if (G.w) G.w.sab = G.simSab; return G.simSab; },
    // where player pi is drawn on the screen (the rider's own 3D body, projected through the camera)
    drawn(pi) {
      const r = G.w.riders[pi || 0], c = r && riders[r.who];
      if (!c) return null;
      c.root.updateMatrixWorld(true);
      c.root.getWorldPosition(v3);
      const [sx, sy] = toScreen(v3.x, v3.y + 1, v3.z);
      return { sx, sy, x: v3.x, y: v3.y };
    },
    toScreen, view: () => view, world: () => G.w, G,
    info() { draw(); const r = renderer.info.render; let meshes = 0; scene.traverseVisible((o) => { if (o.isMesh || o.isSprite) meshes++; }); return { calls: r.calls, triangles: r.triangles, meshes, pixelRatio: renderer.getPixelRatio() }; },
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
