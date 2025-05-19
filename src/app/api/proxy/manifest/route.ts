import { type NextRequest, NextResponse } from 'next/server';

// Function to resolve a possibly relative URL against a base URL
function resolveUrl(relativeOrAbsoluteUrl: string, baseUrl: string): string {
  try {
    return new URL(relativeOrAbsoluteUrl, baseUrl).toString();
  } catch (e) {
    // If it's already a valid absolute URL or other error, return as is or handle
    console.warn(`Could not resolve URL: ${relativeOrAbsoluteUrl} with base ${baseUrl}`, e);
    return relativeOrAbsoluteUrl; // Fallback, might be incorrect for some relative paths
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const originUrlString = searchParams.get('origin_url');

  if (!originUrlString) {
    return NextResponse.json({ error: 'Missing origin_url parameter' }, { status: 400 });
  }

  let originUrl: URL;
  try {
    originUrl = new URL(originUrlString);
  } catch (error) {
    return NextResponse.json({ error: 'Invalid origin_url format' }, { status: 400 });
  }

  try {
    const response = await fetch(originUrl.toString(), {
      headers: {
        // It's good practice to mimic the user-agent or specify one
        'User-Agent': 'StreamProxy/1.0',
      },
    });

    if (!response.ok) {
      return NextResponse.json({ error: `Failed to fetch manifest: ${response.statusText}` }, { status: response.status });
    }

    const manifestText = await response.text();
    const manifestBaseUrl = originUrl.toString();

    const lines = manifestText.split('\n');
    const rewrittenLines = lines.map(line => {
      line = line.trim();
      if (line.startsWith('#') || line === '') {
        // Process directives that might contain URIs
        if (line.startsWith('#EXT-X-STREAM-INF') || line.startsWith('#EXT-X-I-FRAME-STREAM-INF') || line.startsWith('#EXT-X-MEDIA')) {
          const uriMatch = line.match(/URI="([^"]+)"/);
          if (uriMatch && uriMatch[1]) {
            const originalUri = uriMatch[1];
            const absoluteUri = resolveUrl(originalUri, manifestBaseUrl);
            const proxyPath = originalUri.toLowerCase().endsWith('.m3u8') ? 'manifest' : 'segment';
            const proxiedUri = `/api/proxy/${proxyPath}?origin_url=${encodeURIComponent(absoluteUri)}`;
            return line.replace(uriMatch[0], `URI="${proxiedUri}"`);
          }
        }
        return line;
      }

      // This line is likely a URL itself (segment or sub-manifest)
      const absoluteLineUrl = resolveUrl(line, manifestBaseUrl);
      const proxyPath = line.toLowerCase().endsWith('.m3u8') ? 'manifest' : 'segment';
      return `/api/proxy/${proxyPath}?origin_url=${encodeURIComponent(absoluteLineUrl)}`;
    });

    const rewrittenManifest = rewrittenLines.join('\n');

    return new NextResponse(rewrittenManifest, {
      status: 200,
      headers: {
        'Content-Type': response.headers.get('Content-Type') || 'application/vnd.apple.mpegurl',
        'Access-Control-Allow-Origin': '*', // CORS for the player
      },
    });

  } catch (error) {
    console.error('Error proxying manifest:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: `Internal server error: ${errorMessage}` }, { status: 500 });
  }
}
