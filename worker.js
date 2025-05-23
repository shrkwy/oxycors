addEventListener("fetch", event => {
  event.respondWith(globalHandler(event.request));
});

/**
 * Global wrapper to catch uncaught errors
 */
async function globalHandler(request) {
  try {
    return await handleRequest(request);
  } catch (err) {
    return json({ error: "Internal server error", message: err.message || String(err) }, 500);
  }
}

/**
 * Main handler: routes homepage, manifest, segment, and youtube endpoints
 */
async function handleRequest(request) {
  const url = new URL(request.url);
  const path = url.pathname;

  if (path === "/") {
    return new Response(getUsageHtml(), {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" }
    });
  }

  if (path.startsWith("/manifest")) {
    return await handleManifest(request, url);
  }

  if (path.startsWith("/segment")) {
    return await handleSegment(request, url);
  }

  if (path.startsWith("/youtube")) {
    return await handleYouTube(request, url);
  }

  return json({ error: "Not Found", path }, 404);
}

/**
 * Handle /manifest?url=
 */
async function handleManifest(request, url) {
  const logs = [];
  const urlString = url.searchParams.get("url");
  if (!urlString) {
    return json({ error: "Missing url parameter", logs }, 400);
  }

  let originUrl;
  try {
    originUrl = new URL(urlString);
  } catch (err) {
    logs.push(`Invalid URL format: ${err}`);
    return json({ error: "Invalid url format", logs }, 400);
  }

  let upstream;
  try {
    upstream = await fetch(originUrl.toString(), { headers: defaultHeaders() });
  } catch (fetchErr) {
    logs.push(`Network error: ${fetchErr}`);
    return json({ error: "Failed to fetch manifest", logs }, 502);
  }

  if (!upstream.ok) {
    logs.push(`Upstream responded ${upstream.status} ${upstream.statusText}`);
    return json({ error: `Upstream error: ${upstream.statusText}`, logs }, upstream.status);
  }

  let manifestText;
  try {
    manifestText = await upstream.text();
  } catch (textErr) {
    logs.push(`Error reading body: ${textErr}`);
    return json({ error: "Failed to read manifest body", logs }, 500);
  }

  const base = originUrl.toString();
  const rewritten = rewriteManifest(manifestText, base, logs);

  return new Response(rewritten, {
    status: 200,
    headers: {
      "Content-Type": upstream.headers.get("Content-Type") || "application/vnd.apple.mpegurl",
      ...corsHeaders(),
    },
  });
}

/**
 * Handle /segment?url=
 */
async function handleSegment(request, url) {
  const urlString = url.searchParams.get('url');
  if (!urlString) {
    return json({ error: 'Missing url parameter' }, 400);
  }

  try {
    new URL(urlString);
  } catch (err) {
    return json({ error: 'Invalid url format' }, 400);
  }

  let upstream;
  try {
    upstream = await fetch(urlString, { headers: defaultHeaders(true) });
  } catch (fetchErr) {
    return json({ error: `Failed to fetch segment: ${fetchErr.message}` }, 502);
  }

  if (!upstream.ok) {
    return new Response(upstream.body, {
      status: upstream.status,
      headers: copyHeaders(upstream.headers)
    });
  }

  const headers = new Headers();
  copySelect(upstream.headers, headers, [
    'Content-Type', 'Content-Length', 'Content-Encoding', 'Last-Modified', 'ETag'
  ]);
  Object.entries(corsHeaders()).forEach(([k,v]) => headers.set(k,v));
  headers.set('Cache-Control', 'public, max-age=3600');

  return new Response(upstream.body, {
    status: upstream.status,
    headers,
  });
}

/**
 * Handle /youtube?url=
 */
async function handleYouTube(request, url) {
  const logs = [];
  const ytUrl = url.searchParams.get("url");
  if (!ytUrl) {
    return json({ error: "Missing url parameter", logs }, 400);
  }

  const manifestUrl = await extractYouTubeManifest(ytUrl, logs);
  if (!manifestUrl) {
    return json({ error: "Could not extract manifest", logs }, 502);
  }

  try {
    const res = await fetch(manifestUrl, { headers: defaultHeaders() });
    const text = await res.text();
    const base = manifestUrl;
    const rewritten = rewriteManifest(text, base, logs);
    return new Response(rewritten, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.apple.mpegurl',
        ...corsHeaders()
      }
    });
  } catch (err) {
    logs.push(`Failed to proxy YouTube manifest: ${err.message}`);
    return json({ error: "Manifest proxy failed", logs }, 502);
  }
}

/**
 * Extract .m3u8 manifest URL from YouTube watch page
 */
async function extractYouTubeManifest(ytUrl, logs) {
  try {
    const res = await fetch(ytUrl, {
      headers: {
        'User-Agent': defaultUA(),
        'Referer': 'https://www.youtube.com/',
        'Origin': 'https://www.youtube.com',
        'Accept': '*/*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br'
      }
    });
    if (!res.ok) {
      logs.push(`YouTube fetch failed: ${res.status} ${res.statusText}`);
      return null;
    }
    const html = await res.text();
    let match = html.match(/"hlsManifestUrl":"(https:[^\"]+\.m3u8)"/);
    if (!match) match = html.match(/\\"hlsManifestUrl\\":\\"(https:[^\"]+\.m3u8)\\"/);
    if (!match?.[1]) return null;
    return match[1].replace(/\\u0026/g, "&").replace(/\\\//g, "/");
  } catch (err) {
    logs.push(`YouTube extraction error: ${err.message}`);
    return null;
  }
}

/**
 * Default fetch headers
 */
function defaultHeaders(isSegment = false) {
  return isSegment
    ? {
        'User-Agent': defaultUA(),
        'Accept': 'application/vnd.apple.mpegurl,application/x-mpegURL,video/*,audio/*,image/*,text/html,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Connection': 'keep-alive',
      }
    : {
        'User-Agent': defaultUA(),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,application/vnd.apple.mpegurl,application/x-mpegURL,*/*;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Connection': 'keep-alive',
      };
}

/**
 * Universal CORS headers
 */
function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Vary': 'Origin'
  };
}

/**
 * Rewrite URIs in manifest to /... endpoints
 */
function rewriteManifest(text, base, logs) {
  const resolveUrl = input => {
    try { return new URL(input, base).toString(); } catch { return input; }
  };

  return text.split('\n').map(raw => {
    const line = raw.trim();
    if (line.startsWith('#EXT')) {
      let tag = '';
      ['#EXT-X-STREAM-INF','#EXT-X-I-FRAME-STREAM-INF','#EXT-X-MEDIA','#EXT-X-KEY','#EXT-X-MAP']
        .forEach(t => { if (line.startsWith(t)) tag = t; });
      if (tag) {
        const m = line.match(/URI=\"([^\"]+)\"/);
        if (m) {
          const orig = m[1];
          const abs = resolveUrl(orig);
          const isSub = ['#EXT-X-STREAM-INF','#EXT-X-I-FRAME-STREAM-INF','#EXT-X-MEDIA']
            .includes(tag) && orig.toLowerCase().endsWith('.m3u8');
          const path = isSub ? 'manifest' : 'segment';
          const proxied = `/${path}?url=${encodeURIComponent(abs)}`;
          return line.replace(m[0], `URI=\"${proxied}\"`);
        }
      }
      return line;
    }
    if (line.startsWith('#') || line === '') return line;
    const abs = resolveUrl(line);
    const path = line.toLowerCase().endsWith('.m3u8') ? 'manifest' : 'segment';
    return `/${path}?url=${encodeURIComponent(abs)}`;
  }).join('\n');
}

/*** Helpers ***/
function json(obj, status=200) {
  return new Response(JSON.stringify(obj, null, 2), {
    status,
    headers: {'Content-Type':'application/json'}
  });
}

function copyHeaders(src, dest) {
  src.forEach((value, key) => dest.set(key, value));
  return dest;
}

function copySelect(src, dest, keys) {
  keys.forEach(k => {
    const v = src.get(k);
    if (v) dest.set(k, v);
  });
  return dest;
}

/**
 * Default User-Agent string
 */
function defaultUA() {
  return 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.7103.125 Mobile Safari/537.36';
}

/**
 * Simple HTML usage guide
 */
function getUsageHtml() {
  return `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Oxycors - HLS CORS Proxy</title>
    <meta name="description" content="Oxycors is a modern and efficient HLS CORS proxy tool for seamless video streaming without cross-origin restrictions. Enjoy a clean, fast, and reliable proxy experience." />
    <meta name="keywords" content="Oxycors, HLS, CORS, proxy, video streaming, m3u8, live stream, HLS player" />
    <meta name="author" content="shrkwy" />
    <meta property="og:title" content="Oxycors - HLS CORS Proxy" />
    <meta property="og:description" content="Seamlessly stream HLS content without CORS restrictions using Oxycors." />
    <meta property="og:image" content="https://cdn.jsdelivr.net/gh/shrkwy/content.host@master/img/oxycors/oxycors.png" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="Oxycors - HLS CORS Proxy" />
    <meta name="twitter:description" content="Seamlessly stream HLS content without CORS restrictions using Oxycors." />
    <meta name="twitter:image" content="https://cdn.jsdelivr.net/gh/shrkwy/content.host@master/img/oxycors/oxycors.png" />
    <link rel="icon" href="https://cdn.jsdelivr.net/gh/shrkwy/content.host@b5d237d499bbc5321bb8f5859ec2cd805879d89d/img/oxycors/icon.png" type="image/png" />
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700&display=swap" rel="stylesheet" />
    <!-- Toastify for toaster messages -->
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/toastify-js/src/toastify.min.css" />
    <style>
      /* Theme Colors */
      :root {
        --bg-dark: #212121;
        --bg-darker: #1a1a1a;
        --card-bg: #2a2a2a;
        --primary: #4caf50;
        --primary-hover: #45a045;
        --accent: #e0e0e0;
        --border: #444;
        --text-muted: #999;
      }
      /* Base */
      html, body {
        margin: 0;
        padding: 0;
        width: 100%;
        height: 100%;
        background-color: var(--bg-dark);
        color: var(--accent);
        font-family: 'Inter', sans-serif;
        display: flex;
        flex-direction: column;
      }
      /* Redesigned Header */
      header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 16px 32px;
        background: linear-gradient(90deg, #333333 0%, var(--bg-darker) 100%);
        box-shadow: 0 4px 8px rgba(0,0,0,0.5);
        border-bottom-left-radius: 16px;
        border-bottom-right-radius: 16px;
      }
      header .logo {
        display: flex;
        align-items: center;
        gap: 12px;
        color: var(--primary);
        font-size: 1.6rem;
        font-weight: 700;
        text-decoration: none;
      }
      header .logo img {
        max-height: 46px;
        border-radius: 4px;
      }
      nav ul {
        list-style: none;
        display: flex;
        gap: 16px;
        margin: 0;
        padding: 0;
      }
      nav a {
        color: var(--accent);
        text-decoration: none;
        font-weight: 500;
        transition: color 0.2s;
      }
      nav a:hover { color: var(--primary); }
      /* Original Styles */
      .main {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 24px;
        gap: 24px;
      }
      .card {
        background-color: var(--card-bg);
        border-radius: 16px;
        box-shadow: 0 8px 16px rgba(0,0,0,0.4);
        width: 100%;
        max-width: 800px;
        padding: 24px;
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      .controls {
        display: flex;
        gap: 12px;
        flex-wrap: wrap;
        align-items: center;
      }
      .controls input {
        flex: 1 1 300px;
        padding: 12px 16px;
        background-color: #333333;
        border: 1px solid var(--border);
        border-radius: 12px;
        color: var(--accent);
        font-size: 1rem;
        outline: none;
      }
      .controls input::placeholder { color: var(--text-muted); }
      .controls button {
        flex: 1 1 auto;
        padding: 12px 20px;
        border-radius: 12px;
        font-size: 1rem;
        font-weight: 500;
        cursor: pointer;
        transition: background-color 0.2s;
      }
      .btn { background-color: var(--primary); color: #fff; border: none; }
      .btn:hover { background-color: var(--primary-hover); }
      .btn-secondary {
        background-color: var(--bg-darker);
        color: var(--text-muted);
        border: 1px solid #555;
      }
      .btn-secondary:hover { background-color: #555; color: var(--accent); }
      @media (max-width: 600px) {
        .controls input { flex: 1 1 100%; }
        .controls button { flex: 1 1 calc(50% - 6px); }
      }
      #result {
        background-color: #1e1e1e;
        border: 1px solid #333;
        border-radius: 12px;
        padding: 16px;
        font-family: monospace;
        word-break: break-all;
        display: none;
      }
      #result span { display: block; margin-top: 8px; }
      #result a { color: var(--primary); text-decoration: underline; }
      #player {
        width: 100%;
        max-width: 800px;
        border-radius: 12px;
        background-color: #000;
      }
      .quality-container {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-top: 8px;
        color: var(--accent);
      }
      .quality-container select {
        padding: 6px 10px;
        border-radius: 8px;
        border: 1px solid var(--border);
        background-color: #333;
        color: var(--accent);
        font-family: 'Inter', sans-serif;
      }
      footer {
        padding: 12px 24px;
        text-align: center;
        background-color: var(--bg-darker);
        font-size: 0.9rem;
        color: var(--text-muted);
        border-radius: 16px 16px 0 0;
      }
      footer a { color: var(--primary); text-decoration: none; }
      @media (min-width: 768px) {
        ul li {
          padding: 10px 70px !important;
        }
      }
      ul li {
        background-color: #333333;
        padding: 8px 10px;
        border-radius: 10px;
        border: 1px solid var(--border);
        font-size: 0.8rem;
  
      }
    </style>
  </head>
  <body>
    <!-- Redesigned Header -->
    <header>
      <a href="/" class="logo">
        <img src="https://icon.icepanel.io/Technology/svg/Cloudflare-Workers.svg" alt="cf_workers" />
        <img src="https://cdn.jsdelivr.net/gh/shrkwy/content.host@master/img/oxycors/logo.png" alt="oxycors" />
      </a>
      <nav aria-label="Main navigation">
        <ul>
          <li><a href="https://github.com/shrkwy/oxycors?tab=readme-ov-file#%EF%B8%8F%EF%B8%8F-how-to-use">Usage</a></li>
          <li><a href="https://github.com/shrkwy/oxycors" target="_blank">GitHub</a></li>
        </ul>
      </nav>
    </header>
  
    <div class="main">
      <div class="card">
        <div class="controls">
          <input type="text" id="url" placeholder="https://…/manifest.m3u8" />
          <button onclick="play()" class="btn">PLAY</button>
          <button onclick="clearFields()" class="btn btn-secondary">CLEAR</button>
        </div>
        <div id="result"></div>
      </div>
      <video id="player" controls></video>
      <div class="quality-container">
        <label for="qualitySelector"><pre style="font-size: 1rem; margin:0;">Quality:</pre></label>
        <select id="qualitySelector">
          <option value="-1">Auto</option>
        </select>
      </div>
    </div>
  
    <footer>Source available on <a href="https://github.com/shrkwy/oxycors" target="_blank">@shrkwy/oxycors</a></footer>
  
    <!-- Scripts -->
    <script src="https://cdn.jsdelivr.net/npm/toastify-js"></script>
    <script src="https://cdn.jsdelivr.net/npm/hls.js@latest"></script>
    <script>
      let hls;
      function showToast(message, type = 'error') {
        Toastify({
          text: message,
          duration: 4000,
          close: true,
          gravity: 'top',
          position: 'right',
          backgroundColor: type === 'error'
            ? 'linear-gradient(to right, #e74c3c, #c0392b)'
            : 'linear-gradient(to right, #2ecc71, #27ae60)'
        }).showToast();
      }
  
      function play() {
        const url = document.getElementById('url').value.trim();
        if (!url) return showToast('Please enter a valid HLS URL.');
        const proxied = window.location.origin + '/manifest?url=' + encodeURIComponent(url);
        const resultDiv = document.getElementById('result');
        resultDiv.style.display = 'block';
        resultDiv.innerHTML = '<strong>PROXIED_URL:</strong><span><a href="' + proxied + '" target="_blank">' + proxied + '</a></span>';
      
        const video = document.getElementById('player');
        if (hls) { hls.destroy(); }
        if (Hls.isSupported()) {
          hls = new Hls();
          hls.loadSource(proxied);
          hls.attachMedia(video);
          hls.on(Hls.Events.ERROR, (_, data) => showToast('Stream error: ' + data.type + ' – ' + data.details));
          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            populateQuality();
            video.play().catch(() => showToast('Autoplay failed.'));
          });
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
          video.src = proxied;
          video.addEventListener('loadedmetadata', () => video.play(), { once: true });
        }
      }      
  
      function populateQuality() {
        const selector = document.getElementById('qualitySelector');
        // remove old listener
        selector.replaceWith(selector.cloneNode(false));
        const newSel = document.getElementById('qualitySelector');
        newSel.innerHTML = '<option value="-1">Auto</option>';
        hls.levels.forEach((l, i) => {
          const opt = document.createElement('option');
          opt.value = i;
          opt.text = l.height ? l.height+"p" : "Level " + i;
          newSel.appendChild(opt);
        });
        newSel.addEventListener('change', () => {
          hls.currentLevel = parseInt(newSel.value);
        });
      }
  
      function clearFields() {
        document.getElementById('url').value = '';
        const resultDiv = document.getElementById('result');
        resultDiv.style.display = 'none';
        resultDiv.innerHTML = '';
        if (hls) { hls.destroy(); hls = null; }
        document.getElementById('player').src = '';
        document.getElementById('qualitySelector').innerHTML = '<option value="-1">Auto</option>';
      }
    </script>
  </body>
  </html>
`;
}
