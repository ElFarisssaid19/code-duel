/**
 * HTML track (canvas 600×400): HTML only, no CSS at all. The target is rendered with the
 * browser's default styles, so the challenge is the structure: headings, lists, tables, forms.
 * (Presentational attributes such as <table border> are HTML, not CSS, so they are allowed.)
 */
const CANVAS = { width: 600, height: 400 };
const STARTER_HTML = '<!-- HTML only: no <style>, no style attributes. -->\n';

export default [
  {
    slug: 'html-recipe-page',
    title: 'Recipe Page',
    difficulty: 'EASY',
    palette: ['#000000', '#ffffff'],
    description: `Reproduce a short recipe with headings and lists, using the default browser styles.

- A level-1 heading **Pancakes**, then the paragraph *Makes 8 small pancakes.* (in italics).
- A level-2 heading **Ingredients** and a bulleted list: \`200 g flour\`, \`2 eggs\`, \`300 ml milk\`.
- A level-2 heading **Steps** and a numbered list: \`Whisk everything together.\`, \`Cook on a hot pan.\``,
    reference: {
      html: `<h1>Pancakes</h1>
<p><em>Makes 8 small pancakes.</em></p>
<h2>Ingredients</h2>
<ul>
  <li>200 g flour</li>
  <li>2 eggs</li>
  <li>300 ml milk</li>
</ul>
<h2>Steps</h2>
<ol>
  <li>Whisk everything together.</li>
  <li>Cook on a hot pan.</li>
</ol>
`,
    },
  },
  {
    slug: 'html-data-table',
    title: 'Data Table',
    difficulty: 'MEDIUM',
    palette: ['#000000', '#808080', '#ffffff'],
    description: `A table of planets with a caption, a header row (\`<thead>\`) and a body (\`<tbody>\`).

- The table has \`border="1"\` (an HTML attribute, not CSS) and the caption **Inner planets**.
- Header cells: **Planet**, **Moons**, **Day length**.
- Rows: Mercury · 0 · 59 days, Venus · 0 · 243 days, Earth · 1 · 24 hours, Mars · 2 · 25 hours.`,
    reference: {
      html: `<table border="1">
  <caption>Inner planets</caption>
  <thead>
    <tr>
      <th>Planet</th>
      <th>Moons</th>
      <th>Day length</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Mercury</td>
      <td>0</td>
      <td>59 days</td>
    </tr>
    <tr>
      <td>Venus</td>
      <td>0</td>
      <td>243 days</td>
    </tr>
    <tr>
      <td>Earth</td>
      <td>1</td>
      <td>24 hours</td>
    </tr>
    <tr>
      <td>Mars</td>
      <td>2</td>
      <td>25 hours</td>
    </tr>
  </tbody>
</table>
`,
    },
  },
  {
    slug: 'html-contact-form',
    title: 'Contact Form',
    difficulty: 'MEDIUM',
    palette: ['#000000', '#767676', '#efefef', '#ffffff'],
    description: `A contact form with proper labels, using the default browser styles.

- A level-2 heading **Contact us**.
- Each field on its own line (\`<p>\` around label + control):
  **Name** (text input), **Email** (email input), **Topic** (a select with the options *Question* and *Bug report*), **Message** (a textarea, 4 rows, 40 columns).
- A checkbox labelled **Send me a copy**, then a **Send** submit button.`,
    reference: {
      html: `<h2>Contact us</h2>
<form>
  <p><label for="name">Name</label> <input id="name" type="text"></p>
  <p><label for="email">Email</label> <input id="email" type="email"></p>
  <p>
    <label for="topic">Topic</label>
    <select id="topic">
      <option>Question</option>
      <option>Bug report</option>
    </select>
  </p>
  <p><label for="message">Message</label><br><textarea id="message" rows="4" cols="40"></textarea></p>
  <p><label><input type="checkbox"> Send me a copy</label> <button type="submit">Send</button></p>
</form>
`,
    },
  },
  {
    slug: 'html-nested-navigation',
    title: 'Nested Navigation',
    difficulty: 'HARD',
    palette: ['#000000', '#0000ee', '#ffffff'],
    description: `A site map: nested navigation lists inside a \`<nav>\`, with links.

- A level-2 heading **Site map**.
- A bulleted list of links (\`href="#"\`): **Home**, **Products**, **Docs**, **About**.
- **Products** contains a nested list: *Laptops*, *Phones* (both links). **Phones** itself contains a nested list: *Android*, *iOS* (links).
- **Docs** contains a nested list: *Getting started*, *API reference* (links).`,
    reference: {
      html: `<nav>
  <h2>Site map</h2>
  <ul>
    <li><a href="#">Home</a></li>
    <li>
      <a href="#">Products</a>
      <ul>
        <li><a href="#">Laptops</a></li>
        <li>
          <a href="#">Phones</a>
          <ul>
            <li><a href="#">Android</a></li>
            <li><a href="#">iOS</a></li>
          </ul>
        </li>
      </ul>
    </li>
    <li>
      <a href="#">Docs</a>
      <ul>
        <li><a href="#">Getting started</a></li>
        <li><a href="#">API reference</a></li>
      </ul>
    </li>
    <li><a href="#">About</a></li>
  </ul>
</nav>
`,
    },
  },
].map((p) => ({
  ...p,
  track: 'HTML',
  canvas: CANVAS,
  fixedHtml: null,
  starter: { html: STARTER_HTML, css: '' },
  reference: { css: '', ...p.reference },
}));
