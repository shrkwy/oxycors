
import { type NextRequest, NextResponse } from 'next/server';

// Helper function to detect YouTube video/live URLs
function isYouTubeUrl(url: string): boolean {
  const youtubePatterns = [
    /youtube\.com\/watch\?v=/,
    /youtube\.com\/live\//,
    /youtu\.be\//, // Shorter YouTube URLs
    /youtube\.com\/@[\w.-]+\/live/, // URLs for channel live streams
  ];
  return youtubePatterns.some(pattern => pattern.test(url));
}

// Helper function to fetch HTML and extract M3U8 URL from YouTube
async function extractM3U8FromYouTube(youtubeUrl: string): Promise<string | null> {
  try {
    const response = await fetch(youtubeUrl, {
      headers: {
        // Using a common browser User-Agent can help avoid blocks
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
      // Clean up potential extra characters like \u0026 if any
      return match[1].replace(/\\u0026/g, '&').replace(/\\\//g, '/');
    }

    // Pattern 2: Alternative pattern sometimes found in escaped JS strings
    match = html.match(/\\/"hlsManifestUrl\\/":\\"(https:[^"]+\.m3u8[^"]*)\\"/);
    if (match && match[1]) {
      return match[1].replace(/\\u0026/g, '&').replace(/\\\//g, '/');
    }
    
    console.warn(`No .m3u8 URL found in YouTube page: ${youtubeUrl}.`);
    // You can log a snippet of HTML here for debugging if needed, e.g.:
    // console.warn(`HTML snippet: ${html.substring(0, 1000)}`);
    return null;

  } catch (error) {
    console.error(`Error extracting M3U8 from YouTube URL ${youtubeUrl}:`, error);
    return null;
  }
}


// Function to resolve a possibly relative URL against a base URL
function resolveUrl(relativeOrAbsoluteUrl: string, baseUrl: string): string {
  try {
    // If baseUrl is already a directory (ends with /), URL constructor handles it well.
    // If baseUrl is a file, we need its directory part.
    const base = new URL(baseUrl);
    // Ensure the base for resolution ends with a slash if it's not just a hostname
    const effectiveBase = base.pathname.includes('.') && !base.pathname.endsWith('/') 
        ? base.toString().substring(0, base.toString().lastIndexOf('/') + 1)
        : base.toString();

    return new URL(relativeOrAbsoluteUrl, effectiveBase).toString();
  } catch (e) {
    console.warn(`Could not resolve URL: ${relativeOrAbsoluteUrl} with base ${baseUrl}. Error: ${e instanceof Error ? e.message : String(e)}`);
    // Fallback for already absolute URLs or if resolution fails unexpectedly
    if (relativeOrAbsoluteUrl.startsWith('http://') || relativeOrAbsoluteUrl.startsWith('https://')) {
        return relativeOrAbsoluteUrl;
    }
    // If it's a path and base is just a domain, this might still be problematic
    // but it's better than throwing.
    return new URL(baseUrl).origin + (relativeOrAbsoluteUrl.startsWith('/') ? '' : '/') + relativeOrAbsoluteUrl;
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const originalUserUrl = searchParams.get('url');

  if (!originalUserUrl) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
  }

  let effectiveManifestUrl = originalUserUrl;

  if (isYouTubeUrl(originalUserUrl)) {
    console.log(`Detected YouTube URL: ${originalUserUrl}. Attempting to extract HLS manifest.`);
    const hlsManifestUrl = await extractM3U8FromYouTube(originalUserUrl);
    if (hlsManifestUrl) {
      console.log(`Extracted HLS manifest from YouTube: ${hlsManifestUrl}`);
      effectiveManifestUrl = hlsManifestUrl;
    } else {
      console.error(`Failed to extract HLS manifest from YouTube URL: ${originalUserUrl}.`);
      return NextResponse.json({ error: 'Failed to extract HLS manifest from YouTube URL. The video might not be a live stream, the stream may have ended, or its format is not supported by this proxy method.' }, { status: 502 }); // 502 Bad Gateway, as we failed to get a proper response from upstream logic
    }
  }

  let manifestUrlToFetch: URL;
  try {
    manifestUrlToFetch = new URL(effectiveManifestUrl);
  } catch (error) {
    return NextResponse.json({ error: `Invalid manifest URL format after processing: ${effectiveManifestUrl}` }, { status: 400 });
  }

  try {
    console.log(`Fetching final manifest from: ${manifestUrlToFetch.toString()}`);
    const response = await fetch(manifestUrlToFetch.toString(), {
      headers: {
        'User-Agent': 'StreamProxy/1.0 (Manifest Fetch)', 
      },
    });

    if (!response.ok) {
      return NextResponse.json({ error: `Failed to fetch manifest: ${response.statusText} from ${manifestUrlToFetch.toString()}` }, { status: response.status });
    }

    const manifestText = await response.text();
    // The manifestBaseUrl should be the URL from which the manifest was actually fetched,
    // which is manifestUrlToFetch.toString(). This is crucial for resolving relative paths within this manifest.
    const manifestBaseUrl = manifestUrlToFetch.toString(); 

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
            // Resolve the URI against the base URL of the manifest it came from
            const absoluteUri = resolveUrl(originalUri, manifestBaseUrl);
            
            // Determine if the URI points to another manifest or a media segment/key
            // Keys and init maps are treated like segments for proxying purposes.
            const isSubManifest = (tagName === '#EXT-X-STREAM-INF' || tagName === '#EXT-X-I-FRAME-STREAM-INF' || tagName === '#EXT-X-MEDIA') && 
                                  originalUri.toLowerCase().endsWith('.m3u8'); // Check originalUri here, not absoluteUri, for the .m3u8 extension
            const proxyPath = isSubManifest ? 'manifest' : 'segment';
            const proxiedUri = `/api/proxy/${proxyPath}?url=${encodeURIComponent(absoluteUri)}`;
            return line.replace(uriMatch[0], `URI="${proxiedUri}"`);
          }
        }
        return line;
      }

      if (line.startsWith('#') || line === '') {
        // Other comments or empty lines
        return line;
      }

      // If it's not a comment and not empty, assume it's a direct URL (segment or sub-manifest)
      // Resolve this line (which is a URL) against the base URL of the manifest it came from
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
    return NextResponse.json({ error: `Internal server error during manifest processing: ${errorMessage}` }, { status: 500 });
  }
}
