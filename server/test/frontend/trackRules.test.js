import { describe, expect, it } from 'vitest';
import {
  applyTrackRules,
  charCount,
  TrackRuleError,
} from '../../src/services/frontend/trackRules.js';

const HTML = { track: 'HTML', fixedHtml: null };
const CSS = { track: 'CSS', fixedHtml: '<div class="c"></div>' };
const BOTH = { track: 'HTML_CSS', fixedHtml: null };

const refused = (problem, code, field, message) => {
  let error;
  try {
    applyTrackRules(problem, code);
  } catch (err) {
    error = err;
  }
  expect(error).toBeInstanceOf(TrackRuleError);
  expect(error.field).toBe(field);
  if (message) expect(error.message).toMatch(message);
};

describe('HTML track', () => {
  it('accepts plain HTML (presentational attributes are HTML, not CSS)', () => {
    expect(
      applyTrackRules(HTML, { html: '<table border="1"><tr><td>x</td></tr></table>' }),
    ).toEqual({
      html: '<table border="1"><tr><td>x</td></tr></table>',
      css: '',
    });
  });

  it('refuses any CSS: a css field, <style>, style attributes and <link>', () => {
    refused(HTML, { html: '<p>x</p>', css: 'p { color: red }' }, 'css', /does not allow CSS/);
    refused(HTML, { html: '<style>p{color:red}</style><p>x</p>' }, 'html', /<style>/);
    refused(HTML, { html: '<svg><STYLE>rect{fill:red}</STYLE></svg>' }, 'html', /<style>/);
    refused(HTML, { html: '<p style="color:red">x</p>' }, 'html', /style attributes/);
    refused(HTML, { html: "<p class=a STYLE = 'x'>x</p>" }, 'html', /style attributes/);
    refused(HTML, { html: '<link rel="stylesheet" href="x.css"><p>x</p>' }, 'html', /<link>/);
  });

  it('does not mistake text for CSS', () => {
    expect(() =>
      applyTrackRules(HTML, { html: '<p>The style = casual dress code</p>' }),
    ).not.toThrow();
  });
});

describe('CSS track', () => {
  it('renders the fixed HTML with the player CSS', () => {
    expect(applyTrackRules(CSS, { css: '.c { width: 10px }' })).toEqual({
      html: '<div class="c"></div>',
      css: '.c { width: 10px }',
    });
  });

  it('refuses HTML and CSS escaping its <style>', () => {
    refused(CSS, { html: '<div></div>', css: '.c{}' }, 'html', /fixed HTML/);
    refused(CSS, { css: '.c{}</style><script>alert(1)</script>' }, 'css', /<\/style>/);
  });
});

describe('HTML_CSS track', () => {
  it('accepts both, including <style> in the HTML', () => {
    expect(
      applyTrackRules(BOTH, { html: '<style>b{}</style><b>x</b>', css: 'b{color:red}' }),
    ).toEqual({ html: '<style>b{}</style><b>x</b>', css: 'b{color:red}' });
  });
});

describe('every track', () => {
  it('refuses embedded raster images and base64 data URIs (pasting the target)', () => {
    refused(
      BOTH,
      { html: '<img src="data:image/png;base64,iVBORw0KGgo=">' },
      'html',
      /Embedded images/,
    );
    refused(CSS, { css: '.c{background:url(data:image/webp,RIFF)}' }, 'css', /Embedded images/);
    refused(BOTH, { css: 'b{background:url("data:image/svg+xml;base64,PHN2Zz4=")}' }, 'css');
    // Percent-encoded raster inside an SVG data URI.
    refused(
      BOTH,
      {
        html: '<img src="data:image/svg+xml,%3Csvg%3E%3Cimage href=%22data:image/png,x%22/%3E%3C/svg%3E">',
      },
      'html',
    );
    // A plain URL-encoded SVG is fine.
    expect(() =>
      applyTrackRules(BOTH, {
        html: '<img src="data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22/%3E">',
      }),
    ).not.toThrow();
  });

  it('refuses empty submissions', () => {
    refused(CSS, { css: '   ' }, 'css', /Write some code/);
    refused(HTML, { html: '' }, 'html', /Write some code/);
  });

  it('counts the characters the player wrote, whitespace excluded', () => {
    expect(charCount(CSS, { html: '<ignored>', css: '.c {\n  width: 1px;\n}\n' })).toBe(14); // .c{width:1px;}
    expect(charCount(HTML, { html: '<p> a b </p>', css: 'ignored' })).toBe(9);
    expect(charCount(BOTH, { html: '<b>x</b>', css: 'b{}' })).toBe(11);
  });
});
