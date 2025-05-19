import { type NextRequest, NextResponse } from 'next/server';

// Helper function to fetch HTML and extract M3U8 URL from YouTube
async function extractM3U8FromYouTube(youtubeUrl: string, logs: string[]): Promise<string | null> {
  try {
    const response = await fetch(youtubeUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36 Edg/136.0.0.0',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    if (!response.ok) {
      const errorMsg = `Failed to fetch YouTube page ${youtubeUrl}: ${response.status} ${response.statusText}`;
      logs.push(errorMsg);
      return null;
    }

    const html = await response.text();

    // Pattern 1: Standard JSON-like embed
    let match = html.match(/"hlsManifestUrl":"(https:[^"]+\.m3u8)"/);

    if (match && match[1]) {
      return match[1];
    }

    // Pattern 2: Alternative pattern sometimes found in escaped JS strings
    match = html.match(/\\?"hlsManifestUrl\\?":\\?"(https:[^"]+\\.m3u8[^"]*)\\"/);
    if (match && match[1]) {
      return match[1].replace(/\\u0026/g, '&').replace(/\\\//g, '/');
    }

    const warnMsg = `No *.m3u8 manifest found in YouTube page: ${youtubeUrl}.`;
    logs.push(`WARN: ${warnMsg}`);
    return null;

  } catch (error: any) {
    const errorMsg = `Error extracting M3U8 from YouTube URL ${youtubeUrl}: ${error?.message || error}`;
    logs.push(`ERROR: ${errorMsg}`);
    return null;
  }
}


export async function GET(request: NextRequest) {
  const logs: string[] = [];

  const searchParams = request.nextUrl.searchParams;
  const youtubeUrl = searchParams.get('url');

  if (!youtubeUrl) {
    logs.push('ERROR: Missing url parameter');
    return NextResponse.json({ error: 'Missing url parameter', logs }, { status: 400 });
  }

  if (!youtubeUrl.includes('youtube.com') && !youtubeUrl.includes('youtu.be')) {
    logs.push('ERROR: Provided URL does not appear to be a YouTube URL.');
    return NextResponse.json({ error: 'Provided URL does not appear to be a YouTube URL.', logs }, { status: 400 });
  }

  logs.push(`INFO: Received YouTube URL for extraction: ${youtubeUrl}`);

  const hlsManifestUrl = await extractM3U8FromYouTube(youtubeUrl, logs);

  if (!hlsManifestUrl) {
    const errMsg = 'Failed to extract HLS manifest from YouTube URL. The video might not be a live stream, the stream may have ended, or its format is not supported by this proxy method.';
    logs.push(`ERROR: ${errMsg}`);
    return NextResponse.json({ error: errMsg, logs }, { status: 502 });
  }

  logs.push(`INFO: Extracted HLS manifest URL: ${hlsManifestUrl}`);

  const proxyUrl = `${request.nextUrl.origin}/api/proxy/manifest?url=${encodeURIComponent(hlsManifestUrl)}`;
  return NextResponse.json({ responseUrl: youtubeUrl, manifestUrl: hlsManifestUrl, proxyUrl, logs }, { status: 200 });
}
