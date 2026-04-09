const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const tmdbId = process.argv[2];
const mediaType = process.argv[3] || 'movie';
const season = process.argv[4] || null;
const episode = process.argv[5] || null;

if (!tmdbId) {
  process.stdout.write(JSON.stringify({ success: false, error: 'TMDB ID required' }) + '\n');
  process.exit(1);
}

global.performance = global.performance || { now: () => Date.now() };
global.TextDecoder = require('util').TextDecoder;
global.TextEncoder = require('util').TextEncoder;
if (!global.crypto) {
  const nc = require('crypto');
  global.crypto = { getRandomValues: (arr) => nc.randomFillSync(arr) };
}

function httpsGet(url, headers) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    const opts = new URL(url);
    const req = lib.request({
      hostname: opts.hostname,
      path: opts.pathname + opts.search,
      headers: { 'User-Agent': 'Mozilla/5.0 Chrome/131.0.0.0', ...headers }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, text: data }));
    });
    req.on('error', reject);
    req.end();
  });
}

async function main() {
  const sodium = require(path.join(__dirname, 'node_modules', 'libsodium-wrappers', 'dist', 'modules', 'libsodium-wrappers.js'));
  await sodium.ready;
  global.sodium = sodium;

  let goRt = fs.readFileSync(path.join(__dirname, 'go_runtime.js'), 'utf-8');
  eval(goRt);

  if (typeof global.Dm === 'undefined') {
    throw new Error('Go runtime Dm not defined');
  }

  const dm = new global.Dm();
  const wasmBuf = fs.readFileSync(path.join(__dirname, 'fu.wasm'));
  const { instance } = await WebAssembly.instantiate(wasmBuf, dm.importObject);

  const beforeKeys = new Set(Object.keys(global));
  dm.run(instance);

  await new Promise(r => setTimeout(r, 1500));

  const newGlobals = Object.keys(global).filter(k => !beforeKeys.has(k));

  if (typeof global.getAdv !== 'function') {
    throw new Error('getAdv not found. New globals: ' + newGlobals.join(','));
  }

  const token = global.getAdv(tmdbId.toString());
  if (!token || token === 'null') {
    throw new Error('getAdv returned null/empty for id=' + tmdbId);
  }

  let apiPath;
  if (mediaType === 'tv' && season && episode) {
    apiPath = `/api/b/tv/${token}/${season}/${episode}?multiLang=1`;
  } else {
    apiPath = `/api/b/movie/${token}?multiLang=1`;
  }

  const apiUrl = 'https://vidlink.pro' + apiPath;

  const result = await httpsGet(apiUrl, {
    'Referer': `https://vidlink.pro/${mediaType}/${tmdbId}`,
    'Origin': 'https://vidlink.pro',
    'Accept': 'application/json, text/plain, */*'
  });

  if (result.status !== 200) {
    throw new Error('API returned status ' + result.status);
  }

  const cleaned = result.text.replace(/^<html><body>/, '').replace(/<\/body><\/html>\s*$/, '').trim();

  let data;
  try {
    data = JSON.parse(cleaned);
  } catch (e) {
    throw new Error('JSON parse failed: ' + cleaned.slice(0, 300));
  }

  process.stdout.write(JSON.stringify({ success: true, data }) + '\n');
}

main().catch(e => {
  process.stdout.write(JSON.stringify({ success: false, error: e.message }) + '\n');
  process.exit(0);
});
