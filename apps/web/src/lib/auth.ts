/**
 * lib/auth.ts — 프론트 토큰 클라이언트 (단일 소스)
 *
 * 보안 모델 (HARDENING_SPEC 핵심 ①, CONVENTIONS §4):
 *  - access 토큰 = **메모리**(이 모듈 클로저). localStorage/쿠키에 저장하지 않는다 → XSS·게임 iframe 탈취 불가.
 *  - refresh 토큰 = **httpOnly 쿠키**(서버 Set-Cookie). 프론트 JS는 절대 읽지/쓰지 않는다.
 *    401 발생 시 `/api/auth/refresh`(쿠키 자동 전송)로 access 재발급.
 *  - 모든 API 호출은 `authFetch`/`apiJson`으로 일원화 → Bearer 부착 + 401 재발급 인터셉트.
 *
 * 오리진/쿠키 정책 (env 주도, 하드코딩 금지):
 *  - 기본은 **같은 오리진의 상대경로**(`/api/...`)로 호출한다. next.config 의 rewrite 가
 *    `/api/*` → API 서버로 프록시하므로, 서버가 심는 refresh 쿠키가 앱 오리진에 대해 **1st-party** 로 저장된다
 *    (CORS 불필요, SameSite 완화 가능). 별도 오리진으로 직접 붙어야 하면 `NEXT_PUBLIC_API_BASE` 로 오버라이드.
 */

export interface AuthUser {
  id: string;
  email?: string;
  role: string;
  username?: string;
}

/** API 베이스. 기본 "" = 같은 오리진 상대경로(next.config rewrite 경유 → 쿠키 1st-party). */
const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "";

function apiUrl(path: string): string {
  // path 는 항상 "/api/..." 형태(상대). API_BASE 가 있으면 절대 오리진으로.
  return `${API_BASE}${path}`;
}

// ── 메모리 세션 상태 (모듈 클로저) ────────────────────────────────
let accessToken: string | null = null;
let currentUser: AuthUser | null = null;

// React 구독(로그인/로그아웃/재발급 시 UI 갱신용)
const subscribers = new Set<() => void>();
function notify() {
  subscribers.forEach((cb) => {
    try {
      cb();
    } catch {
      /* noop */
    }
  });
}

export function subscribe(cb: () => void): () => void {
  subscribers.add(cb);
  return () => subscribers.delete(cb);
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function getCurrentUser(): AuthUser | null {
  return currentUser;
}

export function isAuthenticated(): boolean {
  return accessToken !== null;
}

function setAccessToken(token: string | null) {
  accessToken = token;
}

export function clearSession() {
  accessToken = null;
  currentUser = null;
  notify();
}

function normalizeUser(data: Record<string, unknown> | null | undefined): AuthUser | null {
  if (!data) return null;
  const role = (data.role as string) ?? "";
  const id = (data.id as string) ?? (data.userId as string) ?? "";
  if (!role && !id) return null;
  return {
    id,
    role,
    email: (data.email as string) ?? undefined,
    username: (data.username as string) ?? undefined,
  };
}

// ── refresh (동시 호출 dedupe) ────────────────────────────────────
let refreshInFlight: Promise<boolean> | null = null;

async function doRefresh(): Promise<boolean> {
  try {
    // refresh 토큰은 httpOnly 쿠키로 자동 전송 → 바디 없음, credentials include 필수.
    const res = await fetch(apiUrl("/api/auth/refresh"), {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) return false;
    const json = await res.json().catch(() => null);
    const newToken = json?.success ? json.data?.accessToken : null;
    if (!newToken) return false;
    setAccessToken(newToken);
    notify();
    return true;
  } catch {
    return false;
  }
}

/** access 토큰을 refresh 쿠키로 재발급. 동시 다중 호출은 하나로 합쳐진다. */
export function refresh(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = doRefresh().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

// ── 핵심 fetch 래퍼 ───────────────────────────────────────────────
/**
 * Bearer 부착 + credentials include + 401 시 1회 재발급 후 재시도.
 * 재발급 실패 시 세션을 비운다(호출부가 로그인 이동 판단).
 */
export async function authFetch(
  path: string,
  options: RequestInit = {},
  _retried = false,
): Promise<Response> {
  const headers = new Headers(options.headers);
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);

  const res = await fetch(apiUrl(path), {
    ...options,
    headers,
    credentials: "include",
  });

  if (res.status === 401 && !_retried) {
    const ok = await refresh();
    if (ok) return authFetch(path, options, true);
    clearSession();
  }
  return res;
}

/**
 * authFetch + JSON 파싱 + `{success,data,error}` 규약 해제.
 * 성공 시 data 반환, 실패 시 throw. (upload 등 기존 apiRequest 대체용)
 */
export async function apiJson<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const res = await authFetch(path, { ...options, headers });
  const json = await res.json().catch(() => null);
  if (!json || !json.success) {
    throw new Error(json?.error || `API 오류 (${res.status})`);
  }
  return json.data as T;
}

// ── 로그인 / 로그아웃 / 세션 확인 ─────────────────────────────────
export interface LoginResult {
  ok: boolean;
  user?: AuthUser;
  error?: string;
}

export async function login(email: string, password: string): Promise<LoginResult> {
  let res: Response;
  try {
    res = await fetch(apiUrl("/api/auth/login"), {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
  } catch {
    return { ok: false, error: "서버에 연결할 수 없습니다. API 서버가 실행 중인지 확인하세요." };
  }

  const json = await res.json().catch(() => null);
  if (!json?.success) {
    return { ok: false, error: json?.error || "로그인에 실패했습니다." };
  }

  // access 토큰 = 메모리. refresh 토큰은 응답 바디에서 읽지 않는다(httpOnly 쿠키).
  const token = json.data?.accessToken as string | undefined;
  if (!token) {
    return { ok: false, error: "인증 토큰을 받지 못했습니다." };
  }
  setAccessToken(token);
  currentUser = normalizeUser(json.data);
  notify();
  return { ok: true, user: currentUser ?? undefined };
}

export async function logout(): Promise<void> {
  try {
    // 쿠키(refresh) 자동 전송 → 서버가 쿠키 폐기 + DB 토큰 삭제. 바디로 토큰 보내지 않는다.
    await authFetch("/api/auth/logout", { method: "POST" });
  } catch {
    /* 로그아웃은 실패해도 로컬 세션은 비운다 */
  }
  clearSession();
}

/** 현재 access 토큰으로 사용자 정보 조회. 실패 시 null. */
export async function fetchMe(): Promise<AuthUser | null> {
  const res = await authFetch("/api/auth/me");
  if (!res.ok) return null;
  const json = await res.json().catch(() => null);
  if (!json?.success) return null;
  const user = normalizeUser(json.data);
  if (user) {
    currentUser = user;
    notify();
  }
  return user;
}

/**
 * 인증 가드용: 유효 세션이면 사용자, 아니면 null.
 *  1) 메모리 토큰 있으면 그대로(없으면 refresh 쿠키로 재발급 시도)
 *  2) /me 로 검증(authFetch 가 만료 토큰이면 한 번 더 재발급 시도)
 */
export async function ensureAuth(): Promise<AuthUser | null> {
  if (!accessToken) {
    const ok = await refresh();
    if (!ok) return null;
  }
  return fetchMe();
}
