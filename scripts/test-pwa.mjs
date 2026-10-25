import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

test('manifest contains standalone launch and valid PNG sizes', () => {
  const manifest = JSON.parse(readFileSync(new URL('../public/manifest.webmanifest', import.meta.url)));
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.start_url, '/');
  assert.ok(manifest.icons.some(icon => icon.purpose === 'maskable'));
  for (const icon of manifest.icons) {
    const bytes = readFileSync(new URL('../public' + icon.src, import.meta.url));
    const [width, height] = icon.sizes.split('x').map(Number);
    assert.equal(bytes.readUInt32BE(16), width);
    assert.equal(bytes.readUInt32BE(20), height);
  }
});

function worker(fetch) {
  const handlers = {};
  const fallback = new Response('Reconnect');
  vm.runInNewContext(readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8'), {
    self: {location: {origin: 'https://example.test'}, addEventListener: (name, handler) => {handlers[name] = handler;}},
    caches: {match: async path => {assert.equal(path, '/offline.html');return fallback;}},
    fetch, URL, Response,
  });
  return {handlers, fallback};
}
test('worker leaves APIs and cross-origin requests untouched', () => {
  const {handlers} = worker(() => assert.fail('unexpected fetch'));
  for (const request of [
    {mode:'cors',url:'https://example.test/api/spot-candles'},
    {mode:'navigate',url:'https://other.test/'},
  ]) handlers.fetch({request,respondWith:()=>assert.fail('request intercepted')});
});
test('navigation uses fresh network response', async () => {
  const fresh = new Response('fresh');
  const {handlers} = worker(async () => fresh);
  let result;
  handlers.fetch({request:{mode:'navigate',url:'https://example.test/'},respondWith:promise=>{result=promise;}});
  assert.equal(await result, fresh);
});
test('offline navigation shows reconnect information', async () => {
  const {handlers, fallback} = worker(async () => {throw new TypeError('offline');});
  let result;
  handlers.fetch({request:{mode:'navigate',url:'https://example.test/?legal=terms'},respondWith:promise=>{result=promise;}});
  assert.equal(await result, fallback);
});
