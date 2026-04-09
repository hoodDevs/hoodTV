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

function httpsGet(url, headers) {
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
        ...headers,
      },
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, text: data, headers: res.headers }));
    });
    req.on('error', reject);
    req.end();
  });
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
  'myflixerzupcloud',
  'visioncine',
  'hdmovie2',
  'meine',
  'overflix',
];

async function fetchSources(provider, params) {
  const base = provider === 'overflix'
    ? 'https://api2.videasy.net'
    : 'https://api.videasy.net';
  const qs = new URLSearchParams(params).toString();
  const url = `${base}/${provider}/sources-with-title?${qs}`;
  try {
    const resp = await httpsGet(url);
    if (resp.status !== 200) return null;
    return resp.text;
  } catch {
    return null;
  }
}

async function main() {
  const wasm = await initWasm();

  const params = {
    title: title || '',
    mediaType: mediaType === 'tv' ? 'tv' : 'movie',
    year: year || '',
    totalSeasons: totalSeasons || '1',
    tmdbId: tmdbId,
    imdbId: imdbId || '',
  };

  if (mediaType === 'tv' && season && episode) {
    params.seasonId = season;
    params.episodeId = episode;
  }

  let sources = [];
  let subtitles = [];

  for (const provider of PROVIDERS) {
    const encrypted = await fetchSources(provider, params);
    if (!encrypted) continue;

    try {
      const stage1 = wasmDecrypt(wasm, encrypted.trim(), Number(tmdbId));
      if (!stage1) continue;
      const json = decryptFinal(stage1);
      if (!json) continue;
      const parsed = JSON.parse(json);

      if (parsed.sources && parsed.sources.length > 0) {
        for (const src of parsed.sources) {
          if (src.url && src.url.includes('.m3u8')) {
            sources.push({
              quality: src.quality || 'auto',
              url: src.url,
              provider,
            });
          }
        }
        if (parsed.subtitles && subtitles.length === 0) {
          subtitles = parsed.subtitles || [];
        }
        if (sources.length > 0) break;
      }
    } catch {
      continue;
    }
  }

  if (sources.length === 0) {
    process.stdout.write(JSON.stringify({ success: false, error: 'No sources found' }) + '\n');
    process.exit(0);
  }

  process.stdout.write(JSON.stringify({ success: true, sources, subtitles }) + '\n');
}

main().catch(e => {
  process.stdout.write(JSON.stringify({ success: false, error: e.message }) + '\n');
  process.exit(0);
});
