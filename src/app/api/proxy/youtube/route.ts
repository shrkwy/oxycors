// app/api/youtube-proxy/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge'; // or 'nodejs' if you run into fetch/CORS issues

// ————— Helpers —————

// Resolve possibly‐relative URIs against a base
function resolveUrl(uri: string, base: string): string {
  try {
    return new URL(uri, base).toString();
  } catch {
    return uri; // fallback to whatever it was
  }
}

// 1) Extract the .m3u8 URL from YouTube’s HTML
async function extractM3U8FromYouTube(youtubeUrl: string): Promise<string | null> {
  const res = await fetch(youtubeUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36 Edg/136.0.0.0',
    },
  });
  if (!res.ok) {
    console.error(`YouTube fetch failed: ${res.status} ${res.statusText}`);
    return null;
  }

  const html = await res.text();

  // Prefer JSON parse from ytInitialPlayerResponse if you like,
  // but here’s the quick regex fallback:
  let m = html.match(/"hlsManifestUrl":"(https:[^"]+\.m3u8)"/);
  if (!m) {
    m = html.match(/\\"hlsManifestUrl\\":\\"(https:[^"]+\.m3u8)\\"/);
  }
  if (!m?.[1]) {
    console.warn('No HLS manifest in YouTube page.');
    return null;
  }

  // Unescape
  return m[1].replace(/\\u0026/g, '&').replace(/\\\//g, '/');
}

// 2) Proxy + rewrite a fetched manifest
async function proxyAndRewriteManifest(manifestUrl: string): Promise<string> {
  const res = await fetch(manifestUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36 Edg/136.0.0.0' },
  });
  if (!res.ok) {
    throw new Error(`Unable to fetch manifest: ${res.statusText}`);
  }
  const text = await res.text();
  const lines = text.split('\n');
  const base = manifestUrl;

  return lines
    .map((line) => {
      line = line.trim();
      // Comment or empty: leave it
      if (line === '' || line.startsWith('#EXT') && !/URI=/.test(line)) {
        return line;
      }

      // If it’s an #EXT tag with a URI=""
      if (line.startsWith('#EXT') && line.includes('URI="')) {
        return line.replace(/URI="([^"]+)"/, (_, uri) => {
          const abs = resolveUrl(uri, base);
          return `URI="${encodeURI(`/api/proxy/manifest?url=${encodeURIComponent(abs)}`)}"`;
        });
      }

      // Otherwise it’s a raw URL (segment or sub‑manifest)
      const abs = resolveUrl(line, base);
      return `/api/proxy/manifest?url=${encodeURIComponent(abs)}`;
    })
    .join('\n');
}

// ————— Route Handler —————

export async function GET(request: NextRequest) {
  const urlParam = request.nextUrl.searchParams.get('url');
  if (!urlParam) {
    return NextResponse.json({ error: 'Missing `url` parameter' }, { status: 400 });
  }

  // If they passed a YouTube watch link, first extract its HLS manifest…
  let targetUrl = urlParam;
  if (/^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\//.test(urlParam)) {
    const manifest = await extractM3U8FromYouTube(urlParam);
    if (!manifest) {
      return NextResponse.json(
        { error: 'Could not extract YouTube HLS manifest (not live or format changed)' },
        { status: 502 }
      );
    }
    targetUrl = manifest;
  }

  // Now proxy & rewrite wherever targetUrl points
  try {
    const body = await proxyAndRewriteManifest(targetUrl);
    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.apple.mpegurl',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err: any) {
    console.error('Proxy error:', err);
    return NextResponse.json(
      { error: err.message || 'Unknown error during proxy' },
      { status: 502 }
    );
  }
}
