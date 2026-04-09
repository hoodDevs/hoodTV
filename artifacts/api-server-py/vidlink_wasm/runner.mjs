import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));

const tmdbId = process.argv[2];
const mediaType = process.argv[3] || 'movie';
const season = process.argv[4] || null;
const episode = process.argv[5] || null;

if (!tmdbId) {
  console.error(JSON.stringify({ error: 'TMDB ID required' }));
  process.exit(1);
}

global.performance = global.performance || { now: () => Date.now() };
global.TextDecoder = require('util').TextDecoder;
global.TextEncoder = require('util').TextEncoder;

if (!global.crypto) {
  const nodeCrypto = require('crypto');
  global.crypto = { getRandomValues: (arr) => nodeCrypto.randomFillSync(arr) };
}

async function main() {
  const sodium = await import('libsodium-wrappers');
  await sodium.default.ready;
  global.sodium = sodium.default;

  let goRt = readFileSync(join(__dirname, 'go_runtime.js'), 'utf-8');
  eval(goRt);

  if (typeof global.Dm === 'undefined') {
    throw new Error('Go runtime (Dm) not defined after eval');
  }

  const dm = new global.Dm();
  const wasmBuf = readFileSync(join(__dirname, 'fu.wasm'));
  const { instance } = await WebAssembly.instantiate(wasmBuf, dm.importObject);

  const beforeKeys = new Set(Object.keys(global));
  dm.run(instance);

  await new Promise(resolve => setTimeout(resolve, 1500));

  const newKeys = Object.keys(global).filter(k => !beforeKeys.has(k));

  if (typeof global.getAdv !== 'function') {
    throw new Error(`getAdv not registered. New globals: ${newKeys.join(', ')}`);
  }

  const token = global.getAdv(tmdbId.toString());
  if (!token || token === 'null') {
    throw new Error(`getAdv returned null for id=${tmdbId}`);
  }

  let apiPath;
  if (mediaType === 'tv' && season && episode) {
    apiPath = `/api/b/tv/${token}?multiLang=1&s=${season}&e=${episode}`;
  } else {
    apiPath = `/api/b/movie/${token}?multiLang=1`;
  }

  const apiUrl = `https://vidlink.pro${apiPath}`;

  const { default: fetch } = await import('node-fetch').catch(() => ({ default: globalThis.fetch }));
  const fetchFn = typeof fetch !== 'undefined' ? fetch : globalThis.fetch;

  let resp;
  try {
    resp = await globalThis.fetch(apiUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36',
        'Referer': `https://vidlink.pro/${mediaType}/${tmdbId}`,
        'Origin': 'https://vidlink.pro',
        'Accept': 'application/json'
      }
    });
  } catch (e) {
    throw new Error(`fetch failed: ${e.message}`);
  }

  const text = await resp.text();
  const cleaned = text.replace(/^<html><body>/, '').replace(/<\/body><\/html>\s*$/, '').trim();

  let data;
  try {
    data = JSON.parse(cleaned);
  } catch (e) {
    throw new Error(`JSON parse failed: ${cleaned.slice(0, 200)}`);
  }

  console.log(JSON.stringify({ success: true, data }));
}

main().catch(e => {
  console.log(JSON.stringify({ success: false, error: e.message }));
  process.exit(0);
});
