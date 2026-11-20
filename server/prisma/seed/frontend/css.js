/**
 * CSS track (canvas 400×300): the HTML is fixed and read-only, players write CSS only.
 * Designs use no text, so scores don't depend on fonts.
 */
const CANVAS = { width: 400, height: 300 };
const STARTER_CSS = '/* Style the given HTML to match the target. */\n';

export default [
  {
    slug: 'css-centered-circle',
    title: 'Centered Circle',
    difficulty: 'EASY',
    palette: ['#1e293b', '#f59e0b'],
    description: `Draw an amber circle in the exact center of a dark canvas.

- The canvas background is \`#1e293b\`.
- The circle is **150 × 150 px**, color \`#f59e0b\`, centered horizontally and vertically.

Hint: the body has a default margin.`,
    fixedHtml: '<div class="circle"></div>\n',
    reference: {
      css: `body {
  margin: 0;
  height: 300px;
  background: #1e293b;
  display: grid;
  place-items: center;
}
.circle {
  width: 150px;
  height: 150px;
  border-radius: 50%;
  background: #f59e0b;
}
`,
    },
  },
  {
    slug: 'css-overlapping-squares',
    title: 'Overlapping Squares',
    difficulty: 'EASY',
    palette: ['#fef3c7', '#ef4444', '#3b82f6'],
    description: `Two squares overlap on a cream background.

- Background \`#fef3c7\`.
- Red square (\`#ef4444\`): **140 × 140 px**, top-left corner at (90, 50).
- Blue square (\`#3b82f6\`): **140 × 140 px**, top-left corner at (170, 110), drawn **on top** of the red one.`,
    fixedHtml: '<div class="red"></div>\n<div class="blue"></div>\n',
    reference: {
      css: `body {
  margin: 0;
  height: 300px;
  background: #fef3c7;
  position: relative;
}
.red,
.blue {
  position: absolute;
  width: 140px;
  height: 140px;
}
.red {
  left: 90px;
  top: 50px;
  background: #ef4444;
}
.blue {
  left: 170px;
  top: 110px;
  background: #3b82f6;
}
`,
    },
  },
  {
    slug: 'css-horizontal-stripes',
    title: 'Horizontal Stripes',
    difficulty: 'EASY',
    palette: ['#0f172a', '#22c55e', '#eab308', '#f97316', '#ef4444'],
    description: `Five horizontal stripes of equal height (**60 px** each) fill the canvas, from top to bottom:
\`#0f172a\`, \`#22c55e\`, \`#eab308\`, \`#f97316\`, \`#ef4444\`.`,
    fixedHtml:
      '<div class="flag">\n  <div></div>\n  <div></div>\n  <div></div>\n  <div></div>\n  <div></div>\n</div>\n',
    reference: {
      css: `body {
  margin: 0;
}
.flag div {
  height: 60px;
}
.flag div:nth-child(1) {
  background: #0f172a;
}
.flag div:nth-child(2) {
  background: #22c55e;
}
.flag div:nth-child(3) {
  background: #eab308;
}
.flag div:nth-child(4) {
  background: #f97316;
}
.flag div:nth-child(5) {
  background: #ef4444;
}
`,
    },
  },
  {
    slug: 'css-traffic-light',
    title: 'Traffic Light',
    difficulty: 'MEDIUM',
    palette: ['#cbd5e1', '#111827', '#ef4444', '#f59e0b', '#22c55e'],
    description: `A traffic light in the middle of a light grey canvas (\`#cbd5e1\`).

- Housing: **100 × 260 px**, color \`#111827\`, corner radius **20 px**, centered (top-left corner at (150, 20)).
- Three lights of **64 px** diameter, centered horizontally in the housing, with **18 px** between them and above the first one:
  red \`#ef4444\`, amber \`#f59e0b\`, green \`#22c55e\`.`,
    fixedHtml:
      '<div class="light">\n  <div class="red"></div>\n  <div class="amber"></div>\n  <div class="green"></div>\n</div>\n',
    reference: {
      css: `body {
  margin: 0;
  height: 300px;
  background: #cbd5e1;
}
.light {
  position: absolute;
  left: 150px;
  top: 20px;
  width: 100px;
  height: 260px;
  border-radius: 20px;
  background: #111827;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 18px;
  padding-top: 18px;
  box-sizing: border-box;
}
.light div {
  width: 64px;
  height: 64px;
  border-radius: 50%;
}
.red {
  background: #ef4444;
}
.amber {
  background: #f59e0b;
}
.green {
  background: #22c55e;
}
`,
    },
  },
  {
    slug: 'css-checkerboard',
    title: '4×4 Checkerboard',
    difficulty: 'MEDIUM',
    palette: ['#334155', '#f8fafc', '#0f172a'],
    description: `A 4 × 4 checkerboard centered on a slate background (\`#334155\`).

- The board is **240 × 240 px** (60 px squares), top-left corner at (80, 30).
- The top-left square is light (\`#f8fafc\`), then colors alternate with dark (\`#0f172a\`).`,
    fixedHtml: `<div class="board">\n${'  <span></span>\n'.repeat(16)}</div>\n`,
    reference: {
      css: `body {
  margin: 0;
  height: 300px;
  background: #334155;
}
.board {
  position: absolute;
  left: 80px;
  top: 30px;
  display: grid;
  grid-template-columns: repeat(4, 60px);
  grid-auto-rows: 60px;
}
.board span {
  background: #f8fafc;
}
.board span:nth-child(8n + 2),
.board span:nth-child(8n + 4),
.board span:nth-child(8n + 5),
.board span:nth-child(8n + 7) {
  background: #0f172a;
}
`,
    },
  },
  {
    slug: 'css-concentric-rings',
    title: 'Concentric Rings',
    difficulty: 'MEDIUM',
    palette: ['#0b1120', '#38bdf8', '#a78bfa', '#f472b6'],
    description: `Three concentric rings centered on a dark canvas (\`#0b1120\`). Every ring is a **20 px** thick circle outline with the background showing between rings.

- Outer ring: outer diameter **240 px**, color \`#38bdf8\`.
- Middle ring: outer diameter **160 px**, color \`#a78bfa\`.
- Inner ring: outer diameter **80 px**, color \`#f472b6\`.`,
    fixedHtml:
      '<div class="ring outer">\n  <div class="ring middle">\n    <div class="ring inner"></div>\n  </div>\n</div>\n',
    reference: {
      css: `body {
  margin: 0;
  height: 300px;
  background: #0b1120;
  display: grid;
  place-items: center;
}
.ring {
  box-sizing: border-box;
  border: 20px solid;
  border-radius: 50%;
  display: grid;
  place-items: center;
}
.outer {
  width: 240px;
  height: 240px;
  border-color: #38bdf8;
}
.middle {
  width: 160px;
  height: 160px;
  border-color: #a78bfa;
}
.inner {
  width: 80px;
  height: 80px;
  border-color: #f472b6;
}
`,
    },
  },
  {
    slug: 'css-triangle',
    title: 'Nested Triangles',
    difficulty: 'HARD',
    palette: ['#0f766e', '#fde047', '#134e4a'],
    description: `Two triangles pointing up, drawn with CSS only (no images) on a teal canvas (\`#0f766e\`).

- Yellow triangle (\`#fde047\`): base **240 px**, height **200 px**, base along y = 250, centered horizontally (apex at (200, 50)).
- Dark triangle (\`#134e4a\`): base **120 px**, height **100 px**, base along y = 230, centered horizontally (apex at (200, 130)).

Hint: an element with zero width and height and thick borders draws triangles.`,
    fixedHtml: '<div class="big"></div>\n<div class="small"></div>\n',
    reference: {
      css: `body {
  margin: 0;
  height: 300px;
  background: #0f766e;
}
.big,
.small {
  position: absolute;
  width: 0;
  height: 0;
  border-style: solid;
  border-color: transparent;
}
.big {
  left: 80px;
  top: 50px;
  border-width: 0 120px 200px;
  border-bottom-color: #fde047;
}
.small {
  left: 140px;
  top: 130px;
  border-width: 0 60px 100px;
  border-bottom-color: #134e4a;
}
`,
    },
  },
  {
    slug: 'css-geometric-scene',
    title: 'Geometric Landscape',
    difficulty: 'HARD',
    palette: ['#bae6fd', '#fbbf24', '#64748b', '#475569', '#16a34a'],
    description: `A small landscape made of simple shapes.

- Sky: the whole canvas, \`#bae6fd\`.
- Sun: a **70 px** circle, \`#fbbf24\`, top-left corner at (290, 30).
- Back mountain: a triangle \`#64748b\`, base **260 px** from x = 10 to x = 270 on y = 240, apex at (140, 70).
- Front mountain: a triangle \`#475569\`, base **240 px** from x = 150 to x = 390 on y = 240, apex at (270, 110).
- Ground: a band \`#16a34a\` from y = 240 to the bottom, drawn over the mountains.`,
    fixedHtml:
      '<div class="scene">\n  <div class="sun"></div>\n  <div class="mountain back"></div>\n  <div class="mountain front"></div>\n  <div class="ground"></div>\n</div>\n',
    reference: {
      css: `body {
  margin: 0;
}
.scene {
  position: relative;
  height: 300px;
  background: #bae6fd;
  overflow: hidden;
}
.scene div {
  position: absolute;
}
.sun {
  left: 290px;
  top: 30px;
  width: 70px;
  height: 70px;
  border-radius: 50%;
  background: #fbbf24;
}
.mountain {
  width: 0;
  height: 0;
  border-style: solid;
  border-color: transparent;
}
.back {
  left: 10px;
  top: 70px;
  border-width: 0 130px 170px;
  border-bottom-color: #64748b;
}
.front {
  left: 150px;
  top: 110px;
  border-width: 0 120px 130px;
  border-bottom-color: #475569;
}
.ground {
  left: 0;
  top: 240px;
  width: 400px;
  height: 60px;
  background: #16a34a;
}
`,
    },
  },
].map((p) => ({
  ...p,
  track: 'CSS',
  canvas: CANVAS,
  starter: { html: '', css: STARTER_CSS },
  reference: { html: '', ...p.reference },
}));
