/* The keys the ? panel shows. Press ? (Shift + /) in the game, or tap the round ? button.
   The panel and the freeze live in the shared kit: kit/help.js (Kit.help). */
Kit.help.setup({
  title: BB.TITLE, // the name lives in js/title.js
  cols: ['1 player · Teddy (2 players)', 'Tommy (2 players)'],
  keys: [
    ['flap and rise (hold to keep flapping)', 'Space or W', '↑ or Enter'],
    ['drift left · right', 'A D', '← →'],
    ['call your brother: he pops the nearest rival\'s balloons (2 players: high five)', 'T', 'T'],
    ['pause · sound', 'P or Esc · M', 'P or Esc · M'],
    ['title: 1 or 2 players · easy · normal · flyer or mode', '1 2 · E · N · C', '1 2 · E · N · C'],
  ],
  note: 'In 1 player both sets of keys work. Come down on a balloon from above to pop it: 500 points, and 1,000 more when the rider parachutes into the lake. Stay above the rivals! Sparks: on EASY they tickle, on NORMAL they pop a balloon. Hang low over the lake and the big fish jumps (EASY: a splash back up). The sky wraps: fly off one side and you come back on the other. Call your brother as often as you like.',
  touch: '◀ ▶ drift and the big ⬆ flaps (hold it). Your brother\'s face calls him. 2 players: Teddy\'s buttons on the left, Tommy\'s on the right.',
});
