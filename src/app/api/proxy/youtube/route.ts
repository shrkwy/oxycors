import { NextRequest, NextResponse } from "next/server";
export const runtime = process.env.RUNTIME === 'nodejs' ? 'nodejs' : 'edge'; // or 'nodejs' if CORS issues present.

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
async function extractM3U8FromYouTube(
  youtubeUrl: string,
  logs: string[]
): Promise<string | null> {
  try {
    const res = await fetch(youtubeUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36 Edg/136.0.0.0",
        "Referer": "https://www.youtube.com/",
        "Origin": "https://www.youtube.com",
        "Accept": "*/*",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br, zstd",

        //client hints
        "Sec-CH-UA":
          '"Chromium";v="136", "Not.A/Brand";v="99", "Google Chrome";v="136"',
        "Sec-CH-UA-Mobile": "?0",
        "Sec-CH-UA-Platform": '"Windows"',
        "Sec-CH-UA-Platform-Version": '"10.0.0"',
        "Sec-CH-UA-Arch": '"x86"',
        "Sec-CH-UA-Bitness": '"64"',
      },
    });
    if (!res.ok) {
      const errMsg = `YouTube fetch failed: ${res.status} ${res.statusText}`;
      logs.push(`ERROR: ${errMsg}`);
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
      logs.push("WARN: No HLS manifest in YouTube page.");
      return null;
    }

    // Unescape
    return m[1].replace(/\\u0026/g, "&").replace(/\\\//g, "/");
  } catch (error: any) {
    logs.push(
      `ERROR: Exception during YouTube HLS extraction: ${
        error?.message || error
      }`
    );
    return null;
  }
}

// 2) Proxy + rewrite a fetched manifest
async function proxyAndRewriteManifest(
  manifestUrl: string,
  logs: string[]
): Promise<string> {
  try {
    const res = await fetch(manifestUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36 Edg/136.0.0.0",
        Referer: "https://www.youtube.com/",
      },
    });
    if (!res.ok) {
      const errMsg = `Unable to fetch manifest: ${res.status} ${res.statusText}`;
      logs.push(`ERROR: ${errMsg}`);
      throw new Error(errMsg);
    }

    const text = await res.text();
    const lines = text.split("\n");
    const base = manifestUrl;

    return lines
      .map((line) => {
        line = line.trim();
        // Comment or empty: leave it
        if (line === "" || (line.startsWith("#EXT") && !/URI=/.test(line))) {
          return line;
        }

        // If it’s an #EXT tag with a URI=""
        if (line.startsWith("#EXT") && line.includes('URI="')) {
          return line.replace(/URI="([^"]+)"/, (_, uri) => {
            const abs = resolveUrl(uri, base);
            return `URI="${encodeURI(
              `/api/proxy/manifest?url=${encodeURIComponent(abs)}`
            )}"`;
          });
        }

        // Otherwise it’s a raw URL (segment or sub‑manifest)
        const abs = resolveUrl(line, base);
        return `/api/proxy/manifest?url=${encodeURIComponent(abs)}`;
      })
      .join("\n");
  } catch (error: any) {
    logs.push(
      `ERROR: Exception during manifest proxying: ${error?.message || error}`
    );
    throw error;
  }
}

// ————— Route Handler —————

export async function GET(request: NextRequest) {
  const logs: string[] = [];

  const urlParam = request.nextUrl.searchParams.get("url");
  if (!urlParam) {
    logs.push("ERROR: Missing `url` parameter");
    return NextResponse.json(
      { error: "Missing `url` parameter", logs },
      { status: 400 }
    );
  }

  logs.push(`INFO: Received URL param: ${urlParam}`);

  // If they passed a YouTube watch link, first extract its HLS manifest…
  let targetUrl = urlParam;
  if (/^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\//.test(urlParam)) {
    const manifest = await extractM3U8FromYouTube(urlParam, logs);
    if (!manifest) {
      const errMsg =
        "Could not extract YouTube HLS manifest (not live or format changed)";
      logs.push(`ERROR: ${errMsg}`);
      return NextResponse.json({ error: errMsg, logs }, { status: 502 });
    }
    targetUrl = manifest;
    logs.push(`INFO: Extracted manifest URL: ${targetUrl}`);
  }

  // Now proxy & rewrite wherever targetUrl points
  try {
    const body = await proxyAndRewriteManifest(targetUrl, logs);
    logs.push("INFO: Successfully proxied and rewrote manifest.");
    // For successful manifest response, logs can’t be embedded in the raw text body.
    // If you want logs returned here, you’d need a separate debug endpoint or header.
    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.apple.mpegurl",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err: any) {
    logs.push(`ERROR: Proxy error: ${err?.message || err}`);
    return NextResponse.json(
      { error: err.message || "Unknown error during proxy", logs },
      { status: 502 }
    );
  }
}
