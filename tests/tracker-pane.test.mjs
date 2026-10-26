import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

 test('tracker styles do not override Leaflet map pane sizing', () => {
    const stylesheet = readFileSync(new URL('../src/styles/pages/tracker.scss', import.meta.url), 'utf8');
    assert.doesNotMatch(stylesheet, /\.leaflet-map-pane\s*\{[^}]*\}/s);
});