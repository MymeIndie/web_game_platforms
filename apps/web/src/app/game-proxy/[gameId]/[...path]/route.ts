import { NextRequest, NextResponse } from 'next/server';
import path from 'path';

// Content-Type 매핑
const CT_MAP: Record<string, string> = {
  '.html':        'text/html; charset=utf-8',
  '.js':          'application/javascript; charset=utf-8',
  '.css':         'text/css; charset=utf-8',
  '.json':        'application/json; charset=utf-8',
  '.wasm':        'application/wasm',
  '.data':        'application/octet-stream',
  '.unityweb':    'application/octet-stream',
  '.png':         'image/png',
  '.jpg':         'image/jpeg',
  '.jpeg':        'image/jpeg',
  '.gif':         'image/gif',
  '.webp':        'image/webp',
  '.ico':         'image/x-icon',
  '.svg':         'image/svg+xml',
  '.mp3':         'audio/mpeg',
  '.ogg':         'audio/ogg',
  '.wav':         'audio/wav',
  '.mp4':         'video/mp4',
  '.webm':        'video/webm',
  '.webmanifest': 'application/manifest+json',
  '.manifest':    'application/manifest+json',
};

function getContentType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  return CT_MAP[ext] || 'application/octet-stream';
}

// NEXT_PUBLIC_CDN_URL은 서버/클라이언트 모두 사용 가능
const CDN_URL = process.env.NEXT_PUBLIC_CDN_URL ||
  `https://${process.env.NEXT_PUBLIC_COS_BUCKET || 'wgp-gonggam-dev-1393441266'}.cos.ap-seoul.myqcloud.com`;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ gameId: string; path: string[] }> }
) {
  const { gameId, path: fileParts } = await params;
  const filePath = fileParts?.join('/') || 'index.html';

  // Path traversal 방지
  const normalized = path.normalize(filePath).replace(/^(\.\.(\/|\\|$))+/, '');
  const cosUrl = `${CDN_URL}/games/${gameId}/${normalized}`;
  const contentType = getContentType(normalized);

  try {
    const upstream = await fetch(cosUrl, {
      headers: { 'User-Agent': 'WGP-Proxy/1.0' },
      next: { revalidate: 300 },
    });

    if (!upstream.ok) {
      return NextResponse.json(
        { error: 'Game file not found', path: normalized },
        { status: upstream.status }
      );
    }

    const body = await upstream.arrayBuffer();

    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': 'inline',
        'Cache-Control': 'public, max-age=3600',
        'Access-Control-Allow-Origin': '*',
        // Unity ServiceWorker 허용
        'Cross-Origin-Embedder-Policy': 'require-corp',
        'Cross-Origin-Opener-Policy': 'same-origin',
      },
    });
  } catch (err) {
    console.error(`[game-proxy] Failed to fetch ${cosUrl}:`, err);
    return NextResponse.json({ error: 'Proxy failed' }, { status: 502 });
  }
}
