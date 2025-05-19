
import { type NextRequest, NextResponse } from 'next/server';

// Function to resolve a possibly relative URL against a base URL
function resolveUrl(relativeOrAbsoluteUrl: string, baseUrl: string): string {
  try {
    // If baseUrl is a file, get its directory
    let base = baseUrl;
    if (!baseUrl.endsWith('/')) {
      const lastSlash = baseUrl.lastIndexOf('/');
      if (lastSlash !== -1) {
        base = baseUrl.substring(0, lastSlash + 1);
      } else {
        // It's a base domain or similar, ensure it has a trailing slash for resolution
        base = baseUrl + '/';
      }
    }
    return new URL(relativeOrAbsoluteUrl, base).toString();
  } catch (e) {
    console.warn(`Could not resolve URL: ${relativeOrAbsoluteUrl} with base ${baseUrl}`, e);
    return relativeOrAbsoluteUrl;
  }
}

// Helper function to extract M3U8 URL from YouTube HTML
async function extractM3U8FromYouTube(youtubeUrl: string): Promise<string | null> {
  try {
    const response = await fetch(youtubeUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    if (!response.ok) {
      console.error(`Failed to fetch YouTube page ${youtubeUrl}: ${response.status} ${response.statusText}`);
      return null;
    }

    const html = await response.text();
    
    // Pattern 1: Standard JSON-like embed
    let match = html.match(/"hlsManifestUrl":"(https:[^"]+\.m3u8[^"]*)"/);
    if (match && match[1]) {
      return match[1].replace(/\\u0026/g, '&').replace(/\\\//g, '/');
    }

    // Pattern 2: Alternative pattern sometimes found in escaped JS strings
    match = html.match(/\\"hlsManifestUrl\\":\\"(https:[^"]+\\.m3u8[^"]*)\\"/);
    if (match && match[1]) {
      return match[1].replace(/\\u0026/g, '&').replace(/\\\//g, '/');
    }
    
    console.warn(`No *.m3u8 HLS manifest found in YouTube page: ${youtubeUrl}.`);
    return null;

  } catch (error) {
    console.error(`Error extracting M3U8 from YouTube URL ${youtubeUrl}:`, error);
    return null;
  }
}


export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  let urlString = searchParams.get('url');
  const allowedOrigin = 'https://pixelarc.vercel.app';

  if (!urlString) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400, headers: { 'Access-Control-Allow-Origin': allowedOrigin } });
  }

  let originUrl: URL;
  let isYouTubeUrl = false;

  try {
    const tempUrl = new URL(urlString);
    if (tempUrl.hostname.includes('youtube.com') || tempUrl.hostname.includes('youtu.be')) {
      isYouTubeUrl = true;
      console.log(`Detected YouTube URL: ${urlString}. Attempting to extract HLS manifest.`);
      const hlsManifestUrl = await extractM3U8FromYouTube(urlString);
      if (hlsManifestUrl) {
        console.log(`Extracted HLS manifest from YouTube: ${hlsManifestUrl}`);
        urlString = hlsManifestUrl; // Use the extracted HLS manifest URL
      } else {
        const message = 'Failed to extract HLS manifest from YouTube URL. The video might not be a live stream or its format is not supported.';
        console.error(message);
        return NextResponse.json({ error: message }, { status: 502, headers: { 'Access-Control-Allow-Origin': allowedOrigin } });
      }
    }
    originUrl = new URL(urlString); // Now, this is either the original URL or the extracted HLS manifest URL
  } catch (error) {
    return NextResponse.json({ error: 'Invalid url format' }, { status: 400, headers: { 'Access-Control-Allow-Origin': allowedOrigin } });
  }

  try {
    const response = await fetch(originUrl.toString(), {
      headers: {
        'User-Agent': 'StreamProxy/1.0', // Mimic a common user-agent
      },
    });

    if (!response.ok) {
      return NextResponse.json({ error: `Failed to fetch manifest: ${response.statusText}` }, { status: response.status, headers: { 'Access-Control-Allow-Origin': allowedOrigin } });
    }

    const manifestText = await response.text();
    const manifestBaseUrl = originUrl.toString(); 

    const lines = manifestText.split('\n');
    const rewrittenLines = lines.map(line => {
      line = line.trim();

      if (line.startsWith('#EXT')) {
        let tagName = "";
        if (line.startsWith('#EXT-X-STREAM-INF')) tagName = '#EXT-X-STREAM-INF';
        else if (line.startsWith('#EXT-X-I-FRAME-STREAM-INF')) tagName = '#EXT-X-I-FRAME-STREAM-INF';
        else if (line.startsWith('#EXT-X-MEDIA')) tagName = '#EXT-X-MEDIA';
        else if (line.startsWith('#EXT-X-KEY')) tagName = '#EXT-X-KEY';
        else if (line.startsWith('#EXT-X-MAP')) tagName = '#EXT-X-MAP';
        
        if (tagName) {
          const uriMatch = line.match(/URI="([^"]+)"/);
          if (uriMatch && uriMatch[1]) {
            const originalUri = uriMatch[1];
            const absoluteUri = resolveUrl(originalUri, manifestBaseUrl);
            
            const isSubManifest = (tagName === '#EXT-X-STREAM-INF' || tagName === '#EXT-X-I-FRAME-STREAM-INF' || tagName === '#EXT-X-MEDIA') && 
                                  originalUri.toLowerCase().endsWith('.m3u8');
            const proxyPath = isSubManifest ? 'manifest' : 'segment';
            const proxiedUri = `/api/proxy/${proxyPath}?url=${encodeURIComponent(absoluteUri)}`;
            return line.replace(uriMatch[0], `URI="${proxiedUri}"`);
          }
        }
        return line;
      }

      if (line.startsWith('#') || line === '') {
        return line;
      }

      const absoluteLineUrl = resolveUrl(line, manifestBaseUrl);
      const isSubManifestLine = line.toLowerCase().endsWith('.m3u8');
      const proxyPathLine = isSubManifestLine ? 'manifest' : 'segment';
      return `/api/proxy/${proxyPathLine}?url=${encodeURIComponent(absoluteLineUrl)}`;
    });

    const rewrittenManifest = rewrittenLines.join('\n');

    return new NextResponse(rewrittenManifest, {
      status: 200,
      headers: {
        'Content-Type': response.headers.get('Content-Type') || 'application/vnd.apple.mpegurl',
        'Access-Control-Allow-Origin': allowedOrigin,
      },
    });

  } catch (error) {
    console.error('Error proxying manifest:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: `Internal server error: ${errorMessage}` }, { status: 500, headers: { 'Access-Control-Allow-Origin': allowedOrigin } });
  }
}
