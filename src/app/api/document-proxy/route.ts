import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Server-side Document Proxy
 * Resolves CORS, X-Frame-Options, and Content-Disposition: attachment blocks
 * by fetching documents server-side and streaming them same-origin with inline disposition.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const targetUrl = searchParams.get("url");

  if (!targetUrl) {
    return new NextResponse("Missing url parameter", { status: 400 });
  }

  // Security check: only allow http or https protocols
  try {
    const parsed = new URL(targetUrl);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return new NextResponse("Invalid protocol. Only HTTP/HTTPS allowed.", { status: 400 });
    }
  } catch {
    return new NextResponse("Invalid target URL format.", { status: 400 });
  }

  try {
    const upstreamRes = await fetch(targetUrl, {
      headers: {
        "User-Agent": "HostelHQ-Document-Viewer/1.0",
        Accept: "*/*",
      },
    });

    if (!upstreamRes.ok) {
      return new NextResponse(`Upstream document returned HTTP ${upstreamRes.status}`, {
        status: upstreamRes.status,
      });
    }

    const rawContentType = upstreamRes.headers.get("content-type") || "";
    let finalContentType = rawContentType;

    // Detect PDF if mime type is missing or generic octet-stream
    if (
      !finalContentType ||
      finalContentType.includes("octet-stream") ||
      finalContentType.includes("text/plain")
    ) {
      if (targetUrl.toLowerCase().includes(".pdf")) {
        finalContentType = "application/pdf";
      } else if (targetUrl.toLowerCase().match(/\.(jpg|jpeg)$/)) {
        finalContentType = "image/jpeg";
      } else if (targetUrl.toLowerCase().endsWith(".png")) {
        finalContentType = "image/png";
      } else if (targetUrl.toLowerCase().endsWith(".webp")) {
        finalContentType = "image/webp";
      }
    }

    const arrayBuffer = await upstreamRes.arrayBuffer();

    return new NextResponse(arrayBuffer, {
      status: 200,
      headers: {
        "Content-Type": finalContentType || "application/pdf",
        // Force inline display in browser/iframe, never trigger silent attachment download
        "Content-Disposition": 'inline; filename="document.pdf"',
        // Explicitly allow embedding inside HostelHQ iframes
        "X-Frame-Options": "SAMEORIGIN",
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=3600",
      },
    });
  } catch (error: any) {
    console.error("[DocumentProxy] Error streaming document:", error);
    return new NextResponse(`Failed to fetch document: ${error.message || "Network error"}`, {
      status: 502,
    });
  }
}
