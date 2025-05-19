
import { type NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const urlString = searchParams.get('url');
  const allowedOrigin = 'https://pixelarc.vercel.app';

  if (!urlString) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400, headers: { 'Access-Control-Allow-Origin': allowedOrigin } });
  }

  try {
    // Validate URL (basic check, fetch will do more)
    new URL(urlString);
  } catch (error) {
    return NextResponse.json({ error: 'Invalid url format' }, { status: 400, headers: { 'Access-Control-Allow-Origin': allowedOrigin } });
  }
  
  try {
    const response = await fetch(urlString, {
      headers: {
        'User-Agent': 'StreamProxy/1.0',
      },
    });

    if (!response.ok) {
      return NextResponse.json({ error: `Failed to fetch segment: ${response.statusText}` }, { status: response.status, headers: { 'Access-Control-Allow-Origin': allowedOrigin } });
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
    
    headers.set('Access-Control-Allow-Origin', allowedOrigin); 
    headers.set('Cache-Control', 'public, max-age=3600'); 

    return new NextResponse(readableStream, {
      status: response.status,
      headers: headers,
    });

  } catch (error) {
    console.error('Error proxying segment:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: `Internal server error: ${errorMessage}` }, { status: 500, headers: { 'Access-Control-Allow-Origin': allowedOrigin } });
  }
}
