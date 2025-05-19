
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
  const urlString = searchParams.get('url');

  if (!urlString) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
  }

  let originUrl: URL;
  try {
    originUrl = new URL(urlString);
  } catch (error) {
    return NextResponse.json({ error: 'Invalid url format' }, { status: 400 });
  }

  try {
    const response = await fetch(originUrl.toString(), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36 Edg/136.0.0.0',
      },
    });

    if (!response.ok) {
      return NextResponse.json({ error: `Failed to fetch manifest: ${response.statusText}` }, { status: response.status });
    }

    const manifestText = await response.text();
    const manifestBaseUrl = originUrl.toString(); // Base URL for resolving relative paths in this manifest

    const lines = manifestText.split('\n');
    const rewrittenLines = lines.map(line => {
      line = line.trim();

      if (line.startsWith('#EXT')) {
        let tagName = "";
        // Identify known tags that can contain URIs
        if (line.startsWith('#EXT-X-STREAM-INF')) tagName = '#EXT-X-STREAM-INF';
        else if (line.startsWith('#EXT-X-I-FRAME-STREAM-INF')) tagName = '#EXT-X-I-FRAME-STREAM-INF';
        else if (line.startsWith('#EXT-X-MEDIA')) tagName = '#EXT-X-MEDIA';
        else if (line.startsWith('#EXT-X-KEY')) tagName = '#EXT-X-KEY';
        else if (line.startsWith('#EXT-X-MAP')) tagName = '#EXT-X-MAP';
        // Add other tags like #EXT-X-SESSION-DATA if they can contain URIs that need proxying

        if (tagName) {
          const uriMatch = line.match(/URI="([^"]+)"/);
          if (uriMatch && uriMatch[1]) {
            const originalUri = uriMatch[1];
            const absoluteUri = resolveUrl(originalUri, manifestBaseUrl);
            
            // Determine if the URI points to another manifest or a media segment/key
            // Keys and init maps are treated like segments for proxying purposes.
            const isSubManifest = (tagName === '#EXT-X-STREAM-INF' || tagName === '#EXT-X-I-FRAME-STREAM-INF' || tagName === '#EXT-X-MEDIA') && 
                                  originalUri.toLowerCase().endsWith('.m3u8');
            const proxyPath = isSubManifest ? 'manifest' : 'segment';
            const proxiedUri = `/api/proxy/${proxyPath}?url=${encodeURIComponent(absoluteUri)}`;
            return line.replace(uriMatch[0], `URI="${proxiedUri}"`);
          }
        }
        // If it's a comment tag we don't specifically handle for URI rewriting, return it as is
        return line;
      }

      if (line.startsWith('#') || line === '') {
        // Other comments or empty lines
        return line;
      }

      // If it's not a comment and not empty, assume it's a direct URL (segment or sub-manifest)
      const absoluteLineUrl = resolveUrl(line, manifestBaseUrl);
      const isSubManifest = line.toLowerCase().endsWith('.m3u8');
      const proxyPath = isSubManifest ? 'manifest' : 'segment';
      return `/api/proxy/${proxyPath}?url=${encodeURIComponent(absoluteLineUrl)}`;
    });

    const rewrittenManifest = rewrittenLines.join('\n');

    return new NextResponse(rewrittenManifest, {
      status: 200,
      headers: {
        'Content-Type': response.headers.get('Content-Type') || 'application/vnd.apple.mpegurl',
        'Access-Control-Allow-Origin': '*', 
      },
    });

  } catch (error) {
    console.error('Error proxying manifest:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: `Internal server error: ${errorMessage}` }, { status: 500 });
  }
}