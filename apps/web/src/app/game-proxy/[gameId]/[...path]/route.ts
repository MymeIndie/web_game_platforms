import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { getContentType } from '@/lib/contentType';

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
        // 교차 오리진 임베드 허용(COEP require-corp 부모 페이지에서 로드 가능하게).
        // 운영에서는 NEXT_PUBLIC_GAME_ORIGIN(별도 오리진)이 게임을 직접 서빙하고,
        // 이 프록시는 개발/폴백 경로다.
        'Cross-Origin-Resource-Policy': 'cross-origin',
        // Unity ServiceWorker / SharedArrayBuffer 허용
        'Cross-Origin-Embedder-Policy': 'require-corp',
        'Cross-Origin-Opener-Policy': 'same-origin',
      },
    });
  } catch (err) {
    console.error(`[game-proxy] Failed to fetch ${cosUrl}:`, err);
    return NextResponse.json({ error: 'Proxy failed' }, { status: 502 });
  }
}
