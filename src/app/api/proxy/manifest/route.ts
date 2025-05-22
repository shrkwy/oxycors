import { type NextRequest, NextResponse } from "next/server";

// Function to resolve a possibly relative URL against a base URL
function resolveUrl(relativeOrAbsoluteUrl: string, baseUrl: string): string {
  try {
    return new URL(relativeOrAbsoluteUrl, baseUrl).toString();
  } catch (e) {
    // We can't push to logs here; resolution errors will surface later
    return relativeOrAbsoluteUrl;
  }
}

export async function GET(request: NextRequest) {
  const logs: string[] = [];
  const searchParams = request.nextUrl.searchParams;
  const urlString = searchParams.get("url");

  if (!urlString) {
    logs.push("Missing url parameter");
    return NextResponse.json({ error: "Missing url parameter", logs }, { status: 400 });
  }

  let originUrl: URL;
  try {
    originUrl = new URL(urlString);
  } catch (error) {
    logs.push(`Invalid URL format: ${String(error)}`);
    return NextResponse.json({ error: "Invalid url format", logs }, { status: 400 });
  }

  let response: Response;
  try {
    response = await fetch(originUrl.toString(), {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36 Edg/136.0.0.0",
      },
    });
  } catch (fetchError) {
    logs.push(`Network error fetching manifest: ${String(fetchError)}`);
    return NextResponse.json(
      { error: "Failed to fetch manifest", logs },
      { status: 502 }
    );
  }

  if (!response.ok) {
    logs.push(`Upstream responded ${response.status} ${response.statusText}`);
    return NextResponse.json(
      { error: `Failed to fetch manifest: ${response.statusText}`, logs },
      { status: response.status }
    );
  }

  let manifestText: string;
  try {
    manifestText = await response.text();
  } catch (textError) {
    logs.push(`Error reading manifest text: ${String(textError)}`);
    return NextResponse.json(
      { error: "Failed to read manifest body", logs },
      { status: 500 }
    );
  }

  const manifestBaseUrl = originUrl.toString();
  let rewrittenManifest: string;

  try {
    const lines = manifestText.split("\n");
    const rewrittenLines = lines.map((rawLine) => {
      const line = rawLine.trim();

      // Tag-based URI rewriting
      if (line.startsWith("#EXT")) {
        let tagName = "";
        if (line.startsWith("#EXT-X-STREAM-INF")) tagName = "#EXT-X-STREAM-INF";
        else if (line.startsWith("#EXT-X-I-FRAME-STREAM-INF"))
          tagName = "#EXT-X-I-FRAME-STREAM-INF";
        else if (line.startsWith("#EXT-X-MEDIA")) tagName = "#EXT-X-MEDIA";
        else if (line.startsWith("#EXT-X-KEY")) tagName = "#EXT-X-KEY";
        else if (line.startsWith("#EXT-X-MAP")) tagName = "#EXT-X-MAP";

        if (tagName) {
          const uriMatch = line.match(/URI="([^"]+)"/);
          if (uriMatch && uriMatch[1]) {
            const originalUri = uriMatch[1];
            const absoluteUri = resolveUrl(originalUri, manifestBaseUrl);

            const isSubManifest =
              (tagName === "#EXT-X-STREAM-INF" ||
                tagName === "#EXT-X-I-FRAME-STREAM-INF" ||
                tagName === "#EXT-X-MEDIA") &&
              originalUri.toLowerCase().endsWith(".m3u8");

            const proxyPath = isSubManifest ? "manifest" : "segment";
            const proxiedUri = `/api/proxy/${proxyPath}?url=${encodeURIComponent(
              absoluteUri
            )}`;

            return line.replace(uriMatch[0], `URI="${proxiedUri}"`);
          }
        }
        return line;
      }

      // Comments or empty
      if (line.startsWith("#") || line === "") {
        return line;
      }

      // Direct URL lines
      const absoluteLineUrl = resolveUrl(line, manifestBaseUrl);
      const isSubManifest = line.toLowerCase().endsWith(".m3u8");
      const proxyPath = isSubManifest ? "manifest" : "segment";
      return `/api/proxy/${proxyPath}?url=${encodeURIComponent(
        absoluteLineUrl
      )}`;
    });

    rewrittenManifest = rewrittenLines.join("\n");
  } catch (rewriteError) {
    logs.push(`Error rewriting manifest: ${String(rewriteError)}`);
    return NextResponse.json(
      { error: "Failed to rewrite manifest", logs },
      { status: 500 }
    );
  }

  // Success — no logs returned
  return new NextResponse(rewrittenManifest, {
    status: 200,
    headers: {
      "Content-Type":
        response.headers.get("Content-Type") || "application/vnd.apple.mpegurl",
      "Access-Control-Allow-Origin": (() => {
        try {
          const origin = request.headers.get("Origin");
          const allowedRaw = process.env.ALLOWED_ORIGINS;
          const allowed = allowedRaw ? JSON.parse(allowedRaw) : null;
          if (allowed && origin && allowed.includes(origin)) return origin;
          if (!allowed) return "*";
          return "none";
        } catch {
          return "none";
        }
      })(),
      Vary: "Origin",
    },
  });
}
