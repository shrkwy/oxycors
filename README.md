# Firebase Studio StreamProxy

This is a Next.js application built in Firebase Studio that acts as an HLS (HTTP Live Streaming) proxy. It allows you to route HLS stream requests through this application, which can be useful for modifying headers, logging, or bypassing CORS restrictions.

To get started, take a look at `src/app/page.tsx` for the main interface.

## How it Works

The application provides two main API endpoints:

1.  `/api/proxy/manifest`: Fetches an HLS manifest (`.m3u8` file) from a `url` (provided as a query parameter), rewrites all media segment and sub-manifest URLs within it to also point through this proxy, and then returns the rewritten manifest.
2.  `/api/proxy/segment`: Fetches an HLS media segment (`.ts` file or other segment types) from a `url` and streams it back to the client.

The frontend in `src/app/page.tsx` provides a simple interface to input an HLS manifest URL. When submitted, it constructs a URL pointing to the `/api/proxy/manifest` endpoint, and the `VideoPlayer` component then uses this proxied URL to play the stream.

## Using the Proxy with External Applications

To use this HLS proxy with your own external applications or video players, you'll need to point your player to this proxy's API endpoints.

1.  **Identify the Original HLS Manifest URL:**
    This is the `.m3u8` URL of the stream you want to proxy.
    *Example:* `https://example.com/live/stream.m3u8`

2.  **Construct the Proxied Manifest URL:**
    Your external application will request the HLS manifest through *this* StreamProxy application. If your StreamProxy app is hosted at `https://your-stream-proxy-app.com` (replace with your actual deployment URL), the URL you'd use in your external player would be:

    `https://your-stream-proxy-app.com/api/proxy/manifest?url=ENCODED_ORIGINAL_MANIFEST_URL`

    Where `ENCODED_ORIGINAL_MANIFEST_URL` is the URL-encoded version of the original HLS manifest URL.
    *Using the example above:*
    Original URL: `https://example.com/live/stream.m3u8`
    URL-encoded: `https%3A%2F%2Fexample.com%2Flive%2Fstream.m3u8`
    Full proxied URL: `https://your-stream-proxy-app.com/api/proxy/manifest?url=https%3A%2F%2Fexample.com%2Flive%2Fstream.m3u8`

3.  **Player Configuration:**
    Configure the video player in your external application (e.g., HLS.js, Video.js, JW Player, or native players like AVPlayer on iOS/macOS or ExoPlayer on Android) to load the HLS stream using this proxied manifest URL.

4.  **Proxy Behavior:**
    *   Your external player requests the manifest from your StreamProxy app using the URL constructed in step 2.
    *   The StreamProxy app (`/api/proxy/manifest`) fetches the original manifest from the `url`.
    *   It then intelligently rewrites all relative and absolute URLs for sub-manifests (other `.m3u8` files) and media segments (e.g., `.ts` files) within that manifest. These rewritten URLs will also point back to the appropriate proxy endpoint (`/api/proxy/manifest` for sub-manifests, `/api/proxy/segment` for segments, both using the `?url=` parameter), ensuring all traffic goes through your proxy.
    *   The StreamProxy app returns this rewritten manifest to your external player.
    *   The player then automatically requests all subsequent resources (sub-manifests and segments) through your StreamProxy app using the rewritten URLs.

This setup allows the StreamProxy application to act as an intermediary for all HLS traffic. The proxy endpoints are configured with `Access-Control-Allow-Origin: '*'`, which helps in scenarios where the original stream source might have restrictive CORS policies.
