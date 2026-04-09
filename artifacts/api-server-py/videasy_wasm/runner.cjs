const fs = require('fs');
const path = require('path');
const https = require('https');

const tmdbId = process.argv[2];
const mediaType = process.argv[3] || 'movie';
const season = process.argv[4] || null;
const episode = process.argv[5] || null;
const title = process.argv[6] || '';
const year = process.argv[7] || '';
const imdbId = process.argv[8] || '';
const totalSeasons = process.argv[9] || '1';

if (!tmdbId) {
  process.stdout.write(JSON.stringify({ success: false, error: 'TMDB ID required' }) + '\n');
  process.exit(1);
}

const CryptoJS = require(path.join(__dirname, 'node_modules', 'crypto-js'));

const PROVIDER_TIMEOUT_MS = 10000;

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    const opts = new URL(url);
    const req = https.request({
      hostname: opts.hostname,
      path: opts.pathname + opts.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json, */*',
        'Origin': 'https://player.videasy.net',
        'Referer': 'https://player.videasy.net/',
      },
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, text: data }));
    });
    req.on('error', reject);
    req.setTimeout(PROVIDER_TIMEOUT_MS, () => {
      req.destroy(new Error('socket timeout'));
    });
    req.end();
  });
}

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ]);
}

async function initWasm() {
  const wasmBytes = fs.readFileSync(path.join(__dirname, 'module.wasm'));
  const mem = new WebAssembly.Memory({ initial: 64, maximum: 256 });
  const instance = await WebAssembly.instantiate(wasmBytes, {
    env: {
      memory: mem,
      seed: () => Math.random(),
      abort: (_msg, _file, line, col) => { throw new Error(`wasm abort at ${line}:${col}`); },
    },
  });
  const exp = instance.instance.exports;
  const wmem = exp.memory || mem;

  function readStr(ptr) {
    if (!ptr) return null;
    const u32 = new Uint32Array(wmem.buffer);
    const len = ptr + u32[(ptr - 4) >>> 2];
    const u16 = new Uint16Array(wmem.buffer);
    let start = ptr >>> 1;
    let result = '';
    const end = len >>> 1;
    while (start < end) {
      const chunk = Math.min(1024, end - start);
      result += String.fromCharCode(...u16.subarray(start, start + chunk));
      start += chunk;
    }
    return result;
  }

  function writeStr(str) {
    if (!str) return 0;
    const ptr = exp.__new(str.length << 1, 2) >>> 0;
    const u16 = new Uint16Array(wmem.buffer);
    for (let i = 0; i < str.length; i++) u16[(ptr >>> 1) + i] = str.charCodeAt(i);
    return ptr;
  }

  return { exp, readStr, writeStr };
}

function wasmDecrypt(wasm, encryptedHex, tmdbIdNum) {
  const { exp, readStr, writeStr } = wasm;
  const encPtr = writeStr(encryptedHex);
  const resultPtr = exp.decrypt(encPtr, tmdbIdNum);
  return readStr(resultPtr >>> 0);
}

function decryptFinal(stage1) {
  const result = CryptoJS.AES.decrypt(stage1, '');
  return result.toString(CryptoJS.enc.Utf8);
}

const PROVIDERS = [
  { name: 'myflixerzupcloud', base: 'https://api.videasy.net' },
  { name: 'visioncine',       base: 'https://api.videasy.net' },
  { name: 'meine',            base: 'https://api.videasy.net' },
  { name: 'hdmovie2',         base: 'https://api.videasy.net' },
  { name: 'overflix',         base: 'https://api2.videasy.net' },
];

async function tryProvider(wasm, provider, params) {
  const qs = new URLSearchParams(params).toString();
  const url = `${provider.base}/${provider.name}/sources-with-title?${qs}`;

  let encrypted;
  try {
    const resp = await withTimeout(httpsGet(url), PROVIDER_TIMEOUT_MS);
    if (resp.status !== 200 || !resp.text) return null;
    encrypted = resp.text.trim();
  } catch {
    return null;
  }

  try {
    const stage1 = wasmDecrypt(wasm, encrypted, Number(tmdbId));
    if (!stage1) return null;
    const json = decryptFinal(stage1);
    if (!json) return null;
    const parsed = JSON.parse(json);

    const sources = (parsed.sources || []).filter(s => s.url && s.url.includes('.m3u8'));
    if (sources.length === 0) return null;

    return {
      provider: provider.name,
      sources: sources.map(s => ({ quality: s.quality || 'auto', url: s.url })),
      subtitles: parsed.subtitles || [],
    };
  } catch {
    return null;
  }
}

function qualityRank(q) {
  const s = String(q).toLowerCase();
  if (s.includes('1080')) return 0;
  if (s.includes('720'))  return 1;
  if (s.includes('480'))  return 2;
  if (s.includes('360'))  return 3;
  return 4;
}

async function main() {
  const wasm = await initWasm();

  const params = {
    title: title || '',
    mediaType: mediaType === 'tv' ? 'tv' : 'movie',
    year: year || '',
    totalSeasons: totalSeasons || '1',
    tmdbId,
    imdbId: imdbId || '',
  };

  if (mediaType === 'tv' && season && episode) {
    params.seasonId = season;
    params.episodeId = episode;
  }

  const results = await Promise.allSettled(
    PROVIDERS.map(p => tryProvider(wasm, p, params))
  );

  const allSources = [];
  const seenUrls = new Set();
  let subtitles = [];

  for (const result of results) {
    if (result.status !== 'fulfilled' || !result.value) continue;
    const { provider, sources, subtitles: subs } = result.value;

    if (subtitles.length === 0 && subs.length > 0) {
      subtitles = subs;
    }

    for (const src of sources) {
      const key = src.url.split('?')[0];
      if (!seenUrls.has(key)) {
        seenUrls.add(key);
        allSources.push({ ...src, provider });
      }
    }
  }

  if (allSources.length === 0) {
    process.stdout.write(JSON.stringify({ success: false, error: 'No sources found' }) + '\n');
    process.exit(0);
  }

  allSources.sort((a, b) => qualityRank(a.quality) - qualityRank(b.quality));

  process.stdout.write(JSON.stringify({ success: true, sources: allSources, subtitles }) + '\n');
}

main().catch(e => {
  process.stdout.write(JSON.stringify({ success: false, error: e.message }) + '\n');
  process.exit(0);
});
