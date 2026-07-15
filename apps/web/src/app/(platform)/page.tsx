import type { Metadata } from "next";
import { GameCard, GameCardSkeleton } from "@/components/platform/GameCard";
import { Suspense } from "react";
import Link from "next/link";

export const metadata: Metadata = {
  title: "WGP 공감 — 무료 웹 게임 플랫폼",
  description: "설치 없이 바로 즐기는 웹 게임. 액션, 퍼즐, RPG, 레이싱 등 수백 개의 게임을 무료로 플레이하세요.",
};

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

async function getGames(sort: string, limit = 12) {
  try {
    const params = new URLSearchParams({ limit: String(limit), status: "active", sort });
    const res = await fetch(`${API_URL}/api/games?${params.toString()}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return [];
    const json = await res.json();
    return json.data?.items || [];
  } catch {
    return [];
  }
}

async function searchGames(search: string) {
  try {
    const params = new URLSearchParams({ limit: "20", status: "active", sort: "plays", search });
    const res = await fetch(`${API_URL}/api/games?${params.toString()}`, {
      next: { revalidate: 30 },
    });
    if (!res.ok) return [];
    const json = await res.json();
    return json.data?.items || [];
  } catch {
    return [];
  }
}

// 결정적 의사난수(0..1). 렌더마다 값이 흔들리지 않게(하이드레이션·캐시 안정).
function seeded(n: number): number {
  const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

// Demo games fallback — 인덱스 기반 결정적 데이터(Math.random 미사용)
function makeDemoGames(offset = 0, count = 6) {
  return Array.from({ length: count }, (_, i) => {
    const idx = offset + i;
    return {
      id: `demo-${idx}`,
      title: `Game ${idx + 1}`,
      titleKo: `게임 ${idx + 1}`,
      thumbnailUrl: `https://picsum.photos/seed/wgp${idx}/640/360`,
      previewVideoUrl: undefined,
      categoryName: ["액션", "퍼즐", "RPG", "레이싱", "스포츠", "슈터"][i % 6],
      plays: Math.floor(seeded(idx + 1) * 200000),
      rating: parseFloat((3.5 + seeded(idx + 101) * 1.5).toFixed(1)),
    };
  });
}

// ── Sub-components ──────────────────────────────────────

function SectionHeader({
  title,
  href,
  showMore = true,
}: {
  title: string;
  href?: string;
  showMore?: boolean;
}) {
  return (
    <div className="section-header">
      <h2 className="section-header-title">{title}</h2>
      {showMore && href && (
        <Link href={href} className="see-all-link">
          모두 보기
        </Link>
      )}
    </div>
  );
}

function GameRow({
  games,
}: {
  games: {
    id: string;
    title: string;
    titleKo?: string;
    thumbnailUrl: string;
    previewVideoUrl?: string;
    categoryName?: string;
    plays?: number;
    rating?: number;
  }[];
}) {
  return (
    <div className="game-grid">
      {games.map((game) => (
        <GameCard key={game.id} {...game} />
      ))}
    </div>
  );
}

function SkeletonRow() {
  return (
    <div className="game-grid">
      {Array.from({ length: 8 }).map((_, i) => (
        <GameCardSkeleton key={i} />
      ))}
    </div>
  );
}

// Featured / big card row (first card wide)
function FeaturedRow({ games }: { games: ReturnType<typeof makeDemoGames> }) {
  const [featured, ...rest] = games;
  return (
    <div className="featured-grid">
      {/* Big featured card */}
      {featured && (
        <div style={{ gridRow: "span 1" }}>
          <GameCard {...featured} />
        </div>
      )}
      {rest.slice(0, 4).map((g) => (
        <GameCard key={g.id} {...g} />
      ))}
    </div>
  );
}

// ── Async data sections ──────────────────────────────────

async function PopularSection() {
  const games = await getGames("plays", 16);
  const data = games.length > 0 ? games : makeDemoGames(0, 16);
  return <GameRow games={data} />;
}

async function RecommendedSection() {
  const games = await getGames("rating", 5);
  const data = games.length > 0 ? games : makeDemoGames(10, 5);
  return <FeaturedRow games={data} />;
}

async function NewSection() {
  const games = await getGames("newest", 16);
  const data = games.length > 0 ? games : makeDemoGames(20, 16);
  return <GameRow games={data} />;
}

async function SearchSection({ search }: { search: string }) {
  const games = await searchGames(search);
  const data = games.length > 0 ? games : makeDemoGames(0, 16);
  return <GameRow games={data} />;
}

/** sort=rating 단독 뷰 전용 — FeaturedRow 아닌 GameRow로 표시 */
async function RecommendedFlatSection() {
  const games = await getGames("rating", 16);
  const data = games.length > 0 ? games : makeDemoGames(10, 16);
  return <GameRow games={data} />;
}


// ── Page ────────────────────────────────────────────────

type Props = {
  searchParams: Promise<{ sort?: string; search?: string }>;
};

export default async function HomePage({ searchParams }: Props) {
  const { sort = "plays", search = "" } = await searchParams;

  if (search) {
    return (
      <div style={{ width: "100%" }}>
        <SectionHeader title={`🔍 "${search}" 검색 결과`} showMore={false} />
        <Suspense fallback={<SkeletonRow />}>
          <SearchSection search={search} />
        </Suspense>
      </div>
    );
  }

  // sort 파라미터가 있으면 단일 정렬 그리드
  const sortLabels: Record<string, string> = {
    plays: "🔥 인기 게임",
    newest: "🆕 신규 게임",
    rating: "⭐ 평점 높은 게임",
  };

  if (sort && sortLabels[sort]) {
    const SortedSection =
      sort === "newest" ? NewSection
      : sort === "rating" ? RecommendedFlatSection
      : PopularSection;

    return (
      <div style={{ width: "100%" }}>
        <div className="sort-bar">
          {[
            { value: "plays", label: "인기순" },
            { value: "newest", label: "최신순" },
            { value: "rating", label: "평점순" },
          ].map(({ value, label: l }) => (
            <Link
              key={value}
              href={`/?sort=${value}`}
              className={`btn btn-sm ${sort === value ? "btn-primary" : "btn-secondary"}`}
            >
              {l}
            </Link>
          ))}
        </div>
        <SectionHeader title={sortLabels[sort]} showMore={false} />
        <Suspense fallback={<SkeletonRow />}>
          <SortedSection />
        </Suspense>
      </div>
    );
  }

  return (
    <div className="page-stack">

      {/* ── 인기 게임 ── */}
      <section id="popular-section">
        <SectionHeader title="🔥 인기 게임" href="/?sort=plays" />
        <Suspense fallback={<SkeletonRow />}>
          <PopularSection />
        </Suspense>
      </section>

      {/* ── 당신을 위한 추천 ── */}
      <section id="recommended-section">
        <SectionHeader title="⭐ 추천 게임" href="/?sort=rating" />
        <Suspense fallback={<SkeletonRow />}>
          <RecommendedSection />
        </Suspense>
      </section>

      {/* ── 새로운 게임 ── */}
      <section id="new-section">
        <SectionHeader title="🆕 새로운 게임" href="/?sort=newest" />
        <Suspense fallback={<SkeletonRow />}>
          <NewSection />
        </Suspense>
      </section>

    </div>
  );
}
