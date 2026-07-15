/**
 * 카테고리 단일 소스 — GET /api/categories 페치 + 정규화.
 *
 * 이전에는 카테고리 목록이 사이드바 / 카테고리 페이지 / 업로드 폼에 각각
 * 하드코딩돼 있었다(이중·삼중 관리). 진짜 소스는 DB(categories 테이블)이며
 * 이 유틸이 API 를 통해 그것을 읽어온다.
 *
 * 주의: DB 의 `icon` 컬럼은 lucide 아이콘 이름('zap','compass'…)이라
 * 화면에 그대로 못 쓴다. 이모지는 순수 표현 계층이라 slug→이모지 맵으로
 * 프론트에서 붙인다(카테고리 "목록"을 복제하는 게 아니라 표현만 매핑).
 */

export interface Category {
  id: number;
  slug: string;
  name: string;
  nameKo: string;
  /** DB 원본 아이콘 이름(lucide). 표시는 categoryEmoji() 사용 */
  icon: string;
  gameCount: number;
}

/** slug → 이모지 (표현 전용). DB icon 이름과 별개. */
export const CATEGORY_EMOJI: Record<string, string> = {
  action: "⚡",
  adventure: "🧭",
  puzzle: "🧩",
  racing: "🏁",
  sports: "🏆",
  shooter: "🎯",
  rpg: "⚔️",
  strategy: "🧠",
  simulation: "⚙️",
  idle: "⏰",
  casual: "😊",
  multiplayer: "👥",
};

export function categoryEmoji(slug: string): string {
  return CATEGORY_EMOJI[slug] ?? "🎮";
}

/**
 * 정적 폴백 — baseline 마이그레이션 시드와 동일 순서/내용.
 * API 불가(오프라인/기동 전) 시 첫 페인트가 비지 않도록. 정상 경로는 API.
 */
export const FALLBACK_CATEGORIES: Category[] = [
  { id: 1, slug: "action", name: "Action", nameKo: "액션", icon: "zap", gameCount: 0 },
  { id: 2, slug: "adventure", name: "Adventure", nameKo: "어드벤처", icon: "compass", gameCount: 0 },
  { id: 3, slug: "puzzle", name: "Puzzle", nameKo: "퍼즐", icon: "grid", gameCount: 0 },
  { id: 4, slug: "racing", name: "Racing", nameKo: "레이싱", icon: "flag", gameCount: 0 },
  { id: 5, slug: "sports", name: "Sports", nameKo: "스포츠", icon: "trophy", gameCount: 0 },
  { id: 6, slug: "shooter", name: "Shooter", nameKo: "슈터", icon: "crosshair", gameCount: 0 },
  { id: 7, slug: "rpg", name: "RPG", nameKo: "RPG", icon: "sword", gameCount: 0 },
  { id: 8, slug: "strategy", name: "Strategy", nameKo: "전략", icon: "brain", gameCount: 0 },
  { id: 9, slug: "simulation", name: "Simulation", nameKo: "시뮬레이션", icon: "settings", gameCount: 0 },
  { id: 10, slug: "idle", name: "Idle", nameKo: "방치형", icon: "clock", gameCount: 0 },
  { id: 11, slug: "casual", name: "Casual", nameKo: "캐주얼", icon: "smile", gameCount: 0 },
  { id: 12, slug: "multiplayer", name: "Multiplayer", nameKo: "멀티플레이", icon: "users", gameCount: 0 },
];

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

/** API row(snake_case) → Category(camelCase) */
function normalizeCategory(row: Record<string, unknown>): Category {
  return {
    id: Number(row.id),
    slug: String(row.slug),
    name: String(row.name ?? ""),
    nameKo: String(row.name_ko ?? row.nameKo ?? ""),
    icon: String(row.icon ?? ""),
    gameCount: Number(row.game_count ?? row.gameCount ?? 0),
  };
}

/**
 * GET /api/categories → Category[].
 * 실패/빈 응답 시 FALLBACK_CATEGORIES 반환(화면이 비지 않게).
 * 서버 컴포넌트에서 호출 시 기본 revalidate=300s 캐시.
 */
export async function fetchCategories(init?: RequestInit): Promise<Category[]> {
  try {
    const res = await fetch(`${API_URL}/api/categories`, {
      next: { revalidate: 300 },
      ...init,
    } as RequestInit);
    if (!res.ok) return FALLBACK_CATEGORIES;
    const json = await res.json();
    const rows = json?.data;
    if (!Array.isArray(rows) || rows.length === 0) return FALLBACK_CATEGORIES;
    return rows.map(normalizeCategory);
  } catch {
    return FALLBACK_CATEGORIES;
  }
}

/** slug 로 카테고리 하나 찾기(폴백 포함). 못 찾으면 null. */
export function findCategory(categories: Category[], slug: string): Category | null {
  return categories.find((c) => c.slug === slug) ?? null;
}
