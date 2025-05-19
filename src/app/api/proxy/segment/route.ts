import { type NextRequest, NextResponse } from 'next/server';

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
        // It's good practice to mimic the user-agent or specify one
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36 Edg/136.0.0.0',
        // Forward range requests if any (important for seeking, though HLS segments are usually small)
        // Range: request.headers.get('Range') || undefined, // Be careful with this
      },
    });

    if (!response.ok) {
      return NextResponse.json({ error: `Failed to fetch segment: ${response.statusText}` }, { status: response.status });
    }

    // Stream the response
    const readableStream = response.body;
    
    // Copy relevant headers from the original response
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
    
    headers.set('Access-Control-Allow-Origin', '*'); // CORS for the player
    headers.set('Cache-Control', 'public, max-age=3600'); // Cache segments for an hour

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