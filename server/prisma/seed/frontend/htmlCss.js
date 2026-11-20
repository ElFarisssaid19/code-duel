/**
 * HTML_CSS track (canvas 600×400): write both HTML and CSS to reproduce a UI component.
 * Text uses the canvas font (DejaVu Sans, set by the base styles), so only sizes and weights
 * need to match.
 */
const CANVAS = { width: 600, height: 400 };
const STARTER = { html: '<!-- Your HTML -->\n', css: 'body {\n  margin: 0;\n}\n' };

export default [
  {
    slug: 'ui-button-set',
    title: 'Button Set',
    difficulty: 'EASY',
    palette: ['#c7d2fe', '#4f46e5', '#ffffff', '#4338ca', '#dc2626'],
    description: `Three buttons side by side, centered on a light indigo canvas (\`#c7d2fe\`), with **16 px** between them.

- Every button: **120 × 44 px**, corner radius **8 px**, text **16 px** bold, centered.
- **Save**: background \`#4f46e5\`, white text.
- **Cancel**: white background, \`#4338ca\` text, a **2 px** \`#4338ca\` border (inside the 120 × 44 box).
- **Delete**: background \`#dc2626\`, white text.`,
    reference: {
      html: `<div class="buttons">
  <button class="primary">Save</button>
  <button class="secondary">Cancel</button>
  <button class="danger">Delete</button>
</div>
`,
      css: `body {
  margin: 0;
  height: 400px;
  background: #c7d2fe;
  display: grid;
  place-items: center;
}
.buttons {
  display: flex;
  gap: 16px;
}
button {
  box-sizing: border-box;
  width: 120px;
  height: 44px;
  border: 0;
  border-radius: 8px;
  font: bold 16px "DejaVu Sans", sans-serif;
  color: #fff;
}
.primary {
  background: #4f46e5;
}
.secondary {
  background: #fff;
  color: #4338ca;
  border: 2px solid #4338ca;
}
.danger {
  background: #dc2626;
}
`,
    },
  },
  {
    slug: 'ui-notification-toast',
    title: 'Notification Toast',
    difficulty: 'EASY',
    palette: ['#94a3b8', '#ffffff', '#16a34a', '#0f172a', '#64748b'],
    description: `A success notification card centered on \`#94a3b8\`.

- Card: **360 × 88 px**, white, corner radius **12 px**, a **6 px** green (\`#16a34a\`) bar on its left edge.
- A green circle (**32 px**, \`#16a34a\`) with a white **✓** (18 px bold), 20 px from the bar, vertically centered.
- Title **Changes saved** (16 px bold, \`#0f172a\`) and the message *Your profile is up to date.* (14 px, \`#64748b\`), 16 px right of the circle.
- A **×** (20 px, \`#64748b\`) in the top-right corner (12 px from the top and right).`,
    reference: {
      html: `<div class="toast">
  <span class="icon">✓</span>
  <div>
    <p class="title">Changes saved</p>
    <p class="message">Your profile is up to date.</p>
  </div>
  <span class="close">×</span>
</div>
`,
      css: `body {
  margin: 0;
  height: 400px;
  background: #94a3b8;
  display: grid;
  place-items: center;
}
.toast {
  position: relative;
  box-sizing: border-box;
  width: 360px;
  height: 88px;
  background: #fff;
  border-radius: 12px;
  border-left: 6px solid #16a34a;
  display: flex;
  align-items: center;
  gap: 16px;
  padding-left: 20px;
}
.icon {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: #16a34a;
  color: #fff;
  font-size: 18px;
  font-weight: bold;
  display: grid;
  place-items: center;
}
p {
  margin: 0;
}
.title {
  font-size: 16px;
  font-weight: bold;
  color: #0f172a;
}
.message {
  margin-top: 4px;
  font-size: 14px;
  color: #64748b;
}
.close {
  position: absolute;
  top: 12px;
  right: 12px;
  font-size: 20px;
  line-height: 20px;
  color: #64748b;
}
`,
    },
  },
  {
    slug: 'ui-profile-card',
    title: 'Profile Card',
    difficulty: 'MEDIUM',
    palette: ['#1e1b4b', '#ffffff', '#8b5cf6', '#0f172a', '#64748b', '#f1f5f9'],
    description: `A profile card centered on a dark indigo canvas (\`#1e1b4b\`).

- Card: **280 × 320 px**, white, corner radius **16 px**, content centered.
- Avatar: an **88 px** circle \`#8b5cf6\` with the initials **AL** (32 px bold, white), 28 px from the top of the card.
- **Ada Lovelace** (20 px bold, \`#0f172a\`) 16 px under the avatar, then **Analyst** (14 px, \`#64748b\`).
- A stats box (**232 × 56 px**, \`#f1f5f9\`, radius 10 px), 20 px under the role, with two columns: **42** *Posts* and **1.2k** *Followers* (numbers 18 px bold, labels 12 px \`#64748b\`).`,
    reference: {
      html: `<div class="card">
  <div class="avatar">AL</div>
  <h1>Ada Lovelace</h1>
  <p class="role">Analyst</p>
  <div class="stats">
    <div><strong>42</strong><span>Posts</span></div>
    <div><strong>1.2k</strong><span>Followers</span></div>
  </div>
</div>
`,
      css: `body {
  margin: 0;
  height: 400px;
  background: #1e1b4b;
  display: grid;
  place-items: center;
}
.card {
  box-sizing: border-box;
  width: 280px;
  height: 320px;
  padding-top: 28px;
  background: #fff;
  border-radius: 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.avatar {
  width: 88px;
  height: 88px;
  border-radius: 50%;
  background: #8b5cf6;
  color: #fff;
  font-size: 32px;
  font-weight: bold;
  display: grid;
  place-items: center;
}
h1 {
  margin: 16px 0 0;
  font-size: 20px;
  color: #0f172a;
}
.role {
  margin: 4px 0 0;
  font-size: 14px;
  color: #64748b;
}
.stats {
  margin-top: 20px;
  width: 232px;
  height: 56px;
  border-radius: 10px;
  background: #f1f5f9;
  display: flex;
}
.stats div {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}
.stats strong {
  font-size: 18px;
  color: #0f172a;
}
.stats span {
  font-size: 12px;
  color: #64748b;
}
`,
    },
  },
  {
    slug: 'ui-navbar',
    title: 'Navigation Bar',
    difficulty: 'MEDIUM',
    palette: ['#f8fafc', '#0f172a', '#ffffff', '#94a3b8', '#38bdf8'],
    description: `A navigation bar at the top of a light page (\`#f8fafc\`).

- Bar: full width, **64 px** tall, \`#0f172a\`, horizontal padding **24 px**, items vertically centered.
- Logo **Acme** (22 px bold, white) on the left.
- Links **Home**, **Pricing**, **Blog** (15 px, \`#94a3b8\`), **28 px** apart, starting 48 px after the logo. **Home** is active: white, with a **3 px** \`#38bdf8\` bar along the bottom edge of the navbar under it.
- A **Sign up** button on the right: **96 × 36 px**, \`#38bdf8\`, radius 6 px, text 15 px bold \`#0f172a\`.`,
    reference: {
      html: `<nav>
  <span class="logo">Acme</span>
  <a class="active">Home</a>
  <a>Pricing</a>
  <a>Blog</a>
  <button>Sign up</button>
</nav>
`,
      css: `body {
  margin: 0;
  height: 400px;
  background: #f8fafc;
}
nav {
  box-sizing: border-box;
  height: 64px;
  padding: 0 24px;
  background: #0f172a;
  display: flex;
  align-items: center;
  gap: 28px;
}
.logo {
  margin-right: 20px;
  font-size: 22px;
  font-weight: bold;
  color: #fff;
}
a {
  font-size: 15px;
  color: #94a3b8;
  height: 64px;
  line-height: 64px;
  box-sizing: border-box;
}
a.active {
  color: #fff;
  border-bottom: 3px solid #38bdf8;
}
button {
  margin-left: auto;
  width: 96px;
  height: 36px;
  border: 0;
  border-radius: 6px;
  background: #38bdf8;
  color: #0f172a;
  font: bold 15px "DejaVu Sans", sans-serif;
}
`,
    },
  },
  {
    slug: 'ui-pricing-card',
    title: 'Pricing Card',
    difficulty: 'HARD',
    palette: ['#a5b4fc', '#ffffff', '#4f46e5', '#0f172a', '#475569', '#22c55e'],
    description: `A pricing card centered on \`#a5b4fc\`.

- Card: **300 × 360 px**, white, radius **16 px**, a **2 px** \`#4f46e5\` border, padding 24 px, left-aligned content.
- A **POPULAR** badge in the top-right corner (16 px from the top and right): \`#4f46e5\`, white 11 px bold text, radius 999 px, padding 4 × 10 px.
- **Pro** (18 px bold, \`#4f46e5\`), then the price **$29** (44 px bold, \`#0f172a\`) followed by **/month** (16 px, \`#475569\`) on the same baseline.
- Three features, each a green **✓** (\`#22c55e\`, bold) then the text (15 px, \`#475569\`), 12 px apart: *Unlimited projects*, *Priority support*, *Custom domains*.
- A full-width **Choose Pro** button at the bottom: 48 px tall, \`#4f46e5\`, radius 10 px, white 16 px bold text.`,
    reference: {
      html: `<div class="card">
  <span class="badge">POPULAR</span>
  <h2>Pro</h2>
  <p class="price"><strong>$29</strong> /month</p>
  <ul>
    <li>Unlimited projects</li>
    <li>Priority support</li>
    <li>Custom domains</li>
  </ul>
  <button>Choose Pro</button>
</div>
`,
      css: `body {
  margin: 0;
  height: 400px;
  background: #a5b4fc;
  display: grid;
  place-items: center;
}
.card {
  position: relative;
  box-sizing: border-box;
  width: 300px;
  height: 360px;
  padding: 24px;
  background: #fff;
  border: 2px solid #4f46e5;
  border-radius: 16px;
  display: flex;
  flex-direction: column;
}
.badge {
  position: absolute;
  top: 16px;
  right: 16px;
  padding: 4px 10px;
  border-radius: 999px;
  background: #4f46e5;
  color: #fff;
  font-size: 11px;
  font-weight: bold;
}
h2 {
  margin: 0;
  font-size: 18px;
  color: #4f46e5;
}
.price {
  margin: 8px 0 16px;
  font-size: 16px;
  color: #475569;
}
.price strong {
  font-size: 44px;
  color: #0f172a;
}
ul {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
li {
  font-size: 15px;
  color: #475569;
}
li::before {
  content: "✓";
  margin-right: 10px;
  color: #22c55e;
  font-weight: bold;
}
button {
  margin-top: auto;
  height: 48px;
  border: 0;
  border-radius: 10px;
  background: #4f46e5;
  color: #fff;
  font: bold 16px "DejaVu Sans", sans-serif;
}
`,
    },
  },
  {
    slug: 'ui-login-form',
    title: 'Login Form',
    difficulty: 'HARD',
    palette: ['#0f172a', '#1e293b', '#f8fafc', '#94a3b8', '#334155', '#22c55e', '#052e16'],
    description: `A dark login form centered on \`#0f172a\`.

- Panel: **320 × 340 px**, \`#1e293b\`, radius **14 px**, padding **28 px**.
- Title **Welcome back** (22 px bold, \`#f8fafc\`), 20 px above the first field.
- Two fields, **Email** then **Password**: label (13 px, \`#94a3b8\`) 6 px above a **40 px** tall full-width input (\`#0f172a\` background, a **1 px** \`#334155\` border, radius 8 px), 16 px between fields.
- A full-width **Log in** button 24 px under the last field: 44 px tall, \`#22c55e\`, radius 8 px, 16 px bold text \`#052e16\`.
- Under it, centered, *Forgot password?* (13 px, \`#94a3b8\`), 16 px below the button.`,
    reference: {
      html: `<form>
  <h1>Welcome back</h1>
  <label>Email<input type="email"></label>
  <label>Password<input type="password"></label>
  <button type="submit">Log in</button>
  <p>Forgot password?</p>
</form>
`,
      css: `body {
  margin: 0;
  height: 400px;
  background: #0f172a;
  display: grid;
  place-items: center;
}
form {
  box-sizing: border-box;
  width: 320px;
  height: 340px;
  padding: 28px;
  background: #1e293b;
  border-radius: 14px;
  display: flex;
  flex-direction: column;
}
h1 {
  margin: 0 0 20px;
  font-size: 22px;
  color: #f8fafc;
}
label {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 16px;
  font-size: 13px;
  color: #94a3b8;
}
input {
  box-sizing: border-box;
  height: 40px;
  border: 1px solid #334155;
  border-radius: 8px;
  background: #0f172a;
}
button {
  margin-top: 8px;
  height: 44px;
  border: 0;
  border-radius: 8px;
  background: #22c55e;
  color: #052e16;
  font: bold 16px "DejaVu Sans", sans-serif;
}
p {
  margin: 16px 0 0;
  text-align: center;
  font-size: 13px;
  color: #94a3b8;
}
`,
    },
  },
].map((p) => ({
  ...p,
  track: 'HTML_CSS',
  canvas: CANVAS,
  fixedHtml: null,
  starter: STARTER,
}));
