import { type NextRequest, NextResponse } from 'next/server';
export const runtime = process.env.RUNTIME === 'nodejs' ? 'nodejs' : 'edge'; // or 'nodejs' if CORS issues present.

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const urlString = searchParams.get('url');

  if (!urlString) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
  }

  try {
    // Validate URL (basic check, fetch will do more)
    new URL(urlString);
  } catch (error) {
    return NextResponse.json({ error: 'Invalid url format' }, { status: 400 });
  }
  
  try {
    const response = await fetch(urlString, {
      headers: {
        // identity
        'User-Agent':
          'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.7103.125 Mobile Safari/537.36',
        // what we accept
        'Accept':
          'application/vnd.apple.mpegurl,application/x-mpegURL,video/*,audio/*,image/*,text/html,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Accept-Language': 'en-US,en;q=0.9',
        // anti-bot metadata
        'Sec-Fetch-Dest': 'video',
        'Sec-Fetch-Mode': 'no-cors',
        'Sec-Fetch-Site': 'cross-site',
        // connection/cache
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

    if (!response.ok) {
      return NextResponse.json({ error: `Failed to fetch segment: ${response.statusText}` }, { status: response.status });
    }

    const readableStream = response.body;
    
    const headers = new Headers();
    const contentType = response.headers.get('Content-Type');
    const contentLength = response.headers.get('Content-Length');
    const contentEncoding = response.headers.get('Content-Encoding');
    const lastModified = response.headers.get('Last-Modified');
    const eTag = response.headers.get('ETag');

    if (contentType) headers.set('Content-Type', contentType);
    if (contentLength) headers.set('Content-Length', contentLength);
    if (contentEncoding) headers.set('Content-Encoding', contentEncoding);
    if (lastModified) headers.set('Last-Modified', lastModified);
    if (eTag) headers.set('ETag', eTag);

    // ✅ CORS control
    const origin = request.headers.get('Origin');
    try {
      const allowedOriginsRaw = process.env.ALLOWED_ORIGINS;
      const allowedOrigins = allowedOriginsRaw ? JSON.parse(allowedOriginsRaw) as string[] : null;
    
      if (allowedOrigins && origin && allowedOrigins.includes(origin)) {
        headers.set('Access-Control-Allow-Origin', origin);
        headers.set('Vary', 'Origin');
      } else if (!allowedOrigins) {
        headers.set('Access-Control-Allow-Origin', '*');
        headers.set('Vary', 'Origin');
      }
    } catch {
      // Fail silently if ALLOWED_ORIGINS is malformed
    }

    headers.set('Cache-Control', 'public, max-age=3600');

    return new NextResponse(readableStream, {
      status: response.status,
      headers: headers,
    });

  } catch (error) {
    console.error('Error proxying segment:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: `Internal server error: ${errorMessage}` }, { status: 500 });
  }
}
