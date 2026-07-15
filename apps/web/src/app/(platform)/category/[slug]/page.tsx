import type { Metadata } from "next";
import Link from "next/link";
import { GameCard, GameCardSkeleton } from "@/components/platform/GameCard";
import { Suspense } from "react";
import { fetchCategories, findCategory, categoryEmoji } from "@/lib/categories";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ sort?: string; page?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const cat = findCategory(await fetchCategories(), slug);
  if (!cat) return { title: "카테고리" };
  return {
    title: `${cat.nameKo} 게임 — WGP 공감`,
    description: `${cat.nameKo} 장르의 무료 웹게임을 즐기세요.`,
  };
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

async function getGamesByCategory(slug: string, sort: string) {
  try {
    const params = new URLSearchParams({
      category: slug,
      sort,
      limit: "24",
      status: "active",
    });
    const res = await fetch(`${API_URL}/api/games?${params}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return { items: [], total: 0 };
    const json = await res.json();
    return json.data || { items: [], total: 0 };
  } catch {
    return { items: [], total: 0 };
  }
}

// 결정적 의사난수(0..1) — Math.random 미사용(하이드레이션·캐시 안정)
function seeded(n: number): number {
  const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

// Demo data for when API is not connected — 인덱스 기반 결정적 값
const DEMO_GAMES = Array.from({ length: 8 }, (_, i) => ({
  id: `demo-cat-${i}`,
  title: `Category Game ${i + 1}`,
  titleKo: `카테고리 게임 ${i + 1}`,
  thumbnailUrl: `https://picsum.photos/seed/cat${i}/640/360`,
  plays: Math.floor(seeded(i + 1) * 50000),
  rating: parseFloat((3.5 + seeded(i + 51) * 1.5).toFixed(1)),
}));

async function CategoryGames({ slug, sort }: { slug: string; sort: string }) {
  const { items, total } = await getGamesByCategory(slug, sort);
  const games = items.length > 0 ? items : DEMO_GAMES;

  return (
    <>
      <p className="category-count">총 {total || games.length}개의 게임</p>
      <div className="game-grid-fixed" id="category-game-grid">
        {games.map((game: {
          id: string; title: string; title_ko?: string; titleKo?: string;
          thumbnail_url?: string; thumbnailUrl?: string;
          preview_video_url?: string; previewVideoUrl?: string;
          categoryNameKo?: string; plays?: number; rating?: number;
        }) => (
          <GameCard
            key={game.id}
            id={game.id}
            title={game.title}
            titleKo={game.title_ko || game.titleKo}
            thumbnailUrl={game.thumbnail_url || game.thumbnailUrl || ""}
            previewVideoUrl={game.preview_video_url || game.previewVideoUrl}
            categoryName={game.categoryNameKo}
            plays={game.plays}
            rating={game.rating}
          />
        ))}
      </div>
    </>
  );
}

function CategorySkeletons() {
  return (
    <>
      <div style={{ height: 20, width: 120, marginBottom: "1.25rem" }} className="skeleton" />
      <div className="game-grid-fixed">
        {Array.from({ length: 8 }).map((_, i) => <GameCardSkeleton key={i} />)}
      </div>
    </>
  );
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { sort = "plays" } = await searchParams;
  const cat = findCategory(await fetchCategories(), slug);

  if (!cat) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">🔍</div>
        <h1 className="empty-state-title">카테고리를 찾을 수 없습니다</h1>
        <Link href="/" className="btn btn-primary" style={{ marginTop: "1rem" }}>홈으로</Link>
      </div>
    );
  }

  const sortOptions = [
    { value: "plays",   label: "인기순" },
    { value: "newest",  label: "최신순" },
    { value: "rating",  label: "평점순" },
  ];

  return (
    <div style={{ maxWidth: 1600 }}>
      {/* Category Header */}
      <div className="category-hero">
        <div className="category-hero-icon">{categoryEmoji(cat.slug)}</div>
        <div>
          <h1 className="category-hero-title">
            {cat.nameKo} <span>게임</span>
          </h1>
          <p className="category-hero-sub">{cat.name} Games</p>
        </div>
      </div>

      {/* Sort Controls */}
      <div className="sort-bar">
        {sortOptions.map((opt) => (
          <a
            key={opt.value}
            href={`/category/${slug}?sort=${opt.value}`}
            id={`sort-${opt.value}`}
            className={`btn btn-sm ${sort === opt.value ? "btn-primary" : "btn-secondary"}`}
          >
            {opt.label}
          </a>
        ))}
      </div>

      {/* Games */}
      <Suspense fallback={<CategorySkeletons />}>
        <CategoryGames slug={slug} sort={sort} />
      </Suspense>

    </div>
  );
}
