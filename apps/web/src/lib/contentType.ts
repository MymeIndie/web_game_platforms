/**
 * Content-Type 매핑 — 프론트엔드 단일 소스.
 *
 * 이전에는 game-proxy 라우트 등 여러 곳에 CT_MAP 이 복제돼 있었다.
 * 프론트에서 파일 확장자 → MIME 타입이 필요한 곳은 모두 이 유틸을 쓴다.
 * (백엔드(unzip 워커 등)는 자체 백엔드 유틸을 사용 — Lane 3/4 소관)
 */

/** 확장자(선행 '.' 포함, 소문자) → Content-Type */
export const CONTENT_TYPE_MAP: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".htm": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".wasm": "application/wasm",
  ".data": "application/octet-stream",
  ".unityweb": "application/octet-stream",
  ".bin": "application/octet-stream",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".svg": "image/svg+xml",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".wav": "audio/wav",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".webmanifest": "application/manifest+json",
  ".manifest": "application/manifest+json",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
};

export const DEFAULT_CONTENT_TYPE = "application/octet-stream";

/**
 * 파일 경로/이름에서 확장자를 뽑아 Content-Type 을 돌려준다.
 * 매칭 없으면 application/octet-stream.
 */
export function getContentType(filePath: string): string {
  const clean = filePath.split(/[?#]/)[0];
  const dot = clean.lastIndexOf(".");
  if (dot < 0) return DEFAULT_CONTENT_TYPE;
  const ext = clean.slice(dot).toLowerCase();
  return CONTENT_TYPE_MAP[ext] ?? DEFAULT_CONTENT_TYPE;
}
