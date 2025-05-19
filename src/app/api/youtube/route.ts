import { url } from 'inspector';
import { type NextRequest, NextResponse } from 'next/server';

// Helper function to fetch HTML and extract M3U8 URL from YouTube
async function extractM3U8FromYouTube(youtubeUrl: string): Promise<string | null> {
  try {
    const response = await fetch(youtubeUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36 Edg/136.0.0.0',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    if (!response.ok) {
      console.error(`Failed to fetch YouTube page ${youtubeUrl}: ${response.status} ${response.statusText}`);
      return null;
    }

    const html = await response.text();

    // Pattern 1: Standard JSON-like embed
    let match = html.match(/"hlsManifestUrl":"(https:[^"]+\.m3u8)"/);

    if (match && match[1]) {
      // return match[1].replace(/\\u0026/g, '&').replace(/\\\//g, '/');
      return match[1]
    }

    // Pattern 2: Alternative pattern sometimes found in escaped JS strings
    match = html.match(/\\?"hlsManifestUrl\\?":\\?"(https:[^"]+\\.m3u8[^"]*)\\"/);
    if (match && match[1]) {
      return match[1].replace(/\\u0026/g, '&').replace(/\\\//g, '/');
    }

    console.warn(`No *.m3u8 manifest found in YouTube page: ${youtubeUrl}.`);
    return null;

  } catch (error) {
    console.error(`Error extracting M3U8 from YouTube URL ${youtubeUrl}:`, error);
    return null;
  }
}


export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const youtubeUrl = searchParams.get('url');

  if (!youtubeUrl) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
  }

  // Basic check if it looks like a YouTube URL, though extractM3U8FromYouTube will do the heavy lifting
  if (!youtubeUrl.includes('youtube.com') && !youtubeUrl.includes('youtu.be')) {
      return NextResponse.json({ error: 'Provided URL does not appear to be a YouTube URL.' }, { status: 400 });
  }

  console.log(`Received YouTube URL for extraction: ${youtubeUrl}`);

  const hlsManifestUrl = await extractM3U8FromYouTube(youtubeUrl);

  if (!hlsManifestUrl) {
    console.error(`Failed to extract HLS manifest from YouTube URL: ${youtubeUrl}.`);
    return NextResponse.json({ error: 'Failed to extract HLS manifest from YouTube URL. The video might not be a live stream, the stream may have ended, or its format is not supported by this proxy method.' }, { status: 502 }); // 502 Bad Gateway
  }

  console.log(`Extracted HLS manifest URL: ${hlsManifestUrl}`);
  const proxyUrl = `${request.nextUrl.origin}/api/proxy/manifest?url=${encodeURIComponent(hlsManifestUrl)}`;
  return NextResponse.json({ responseUrl: youtubeUrl, manifestUrl: hlsManifestUrl, proxyUrl: proxyUrl }, { status: 200 });
}