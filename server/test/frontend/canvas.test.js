/**
 * The client's live preview must build the same canvas document as the renderer (same base
 * styles, same structure), plus a CSP meta tag that blocks the network.
 */
import { describe, expect, it } from 'vitest';
import * as renderer from '../../../infra/renderer/src/document.js';
import * as preview from '../../../client/src/lib/frontendCanvas.js';

describe('canvas document: renderer vs live preview', () => {
  it('uses identical base styles (fonts, overflow)', () => {
    expect(preview.BASE_CSS).toBe(renderer.BASE_CSS);
  });

  it('builds the same document; the preview only adds the CSP meta', () => {
    const page = { html: '<p class="x">hi</p>', css: '.x{color:red}' };
    const csp = `<meta http-equiv="Content-Security-Policy" content="${preview.PREVIEW_CSP}">`;
    expect(preview.buildPreviewDocument(page).replace(csp, '')).toBe(renderer.buildDocument(page));
    expect(preview.PREVIEW_CSP).toBe(
      "default-src 'none'; style-src 'unsafe-inline'; img-src data:",
    );
  });

  it('applies the track to the preview like the server does', () => {
    const cssTrack = { track: 'CSS', fixedHtml: '<div class="c"></div>' };
    expect(preview.pageForTrack(cssTrack, { html: '<b>ignored</b>', css: '.c{}' })).toEqual({
      html: '<div class="c"></div>',
      css: '.c{}',
    });
    expect(preview.pageForTrack({ track: 'HTML' }, { html: '<b>x</b>', css: 'b{}' })).toEqual({
      html: '<b>x</b>',
      css: '',
    });
  });
});
