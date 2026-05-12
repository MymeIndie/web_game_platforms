import type { Metadata } from "next";
import Link from "next/link";
import { GameCard, GameCardSkeleton } from "@/components/platform/GameCard";
import { Suspense } from "react";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ sort?: string; page?: string }>;
};

const CATEGORY_NAMES: Record<string, { name: string; nameKo: string; icon: string }> = {
  action:     { name: "Action",      nameKo: "액션",       icon: "⚡" },
  adventure:  { name: "Adventure",   nameKo: "어드벤처",   icon: "🧭" },
  puzzle:     { name: "Puzzle",      nameKo: "퍼즐",       icon: "🧩" },
  racing:     { name: "Racing",      nameKo: "레이싱",     icon: "🏁" },
  sports:     { name: "Sports",      nameKo: "스포츠",     icon: "🏆" },
  shooter:    { name: "Shooter",     nameKo: "슈터",       icon: "🎯" },
  rpg:        { name: "RPG",         nameKo: "RPG",        icon: "⚔️" },
  strategy:   { name: "Strategy",    nameKo: "전략",       icon: "🧠" },
  simulation: { name: "Simulation",  nameKo: "시뮬레이션", icon: "⚙️" },
  idle:       { name: "Idle",        nameKo: "방치형",     icon: "⏰" },
  casual:     { name: "Casual",      nameKo: "캐주얼",     icon: "😊" },
  multiplayer:{ name: "Multiplayer", nameKo: "멀티플레이", icon: "👥" },
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const cat = CATEGORY_NAMES[slug];
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

// Demo data for when API is not connected
const DEMO_GAMES = Array.from({ length: 8 }, (_, i) => ({
  id: `demo-cat-${i}`,
  title: `Category Game ${i + 1}`,
  titleKo: `카테고리 게임 ${i + 1}`,
  thumbnailUrl: `https://picsum.photos/seed/cat${i}/640/360`,
  plays: Math.floor(Math.random() * 50000),
  rating: 3.5 + Math.random() * 1.5,
}));

async function CategoryGames({ slug, sort }: { slug: string; sort: string }) {
  const { items, total } = await getGamesByCategory(slug, sort);
  const games = items.length > 0 ? items : DEMO_GAMES;

  return (
    <>
      <p style={{ color: "var(--text-muted)", fontSize: "0.875rem", marginBottom: "1.25rem" }}>
        총 {total || games.length}개의 게임
      </p>
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        gap: "0.875rem",
      }} id="category-game-grid">
        {games.map((game: {
          id: string; title: string; title_ko?: string; titleKo?: string;
          thumbnail_url?: string; thumbnailUrl?: string;
          preview_video_url?: string; previewVideoUrl?: string;
          category_name_ko?: string; plays?: number; rating?: number;
        }) => (
          <GameCard
            key={game.id}
            id={game.id}
            title={game.title}
            titleKo={game.title_ko || game.titleKo}
            thumbnailUrl={game.thumbnail_url || game.thumbnailUrl || ""}
            previewVideoUrl={game.preview_video_url || game.previewVideoUrl}
            categoryName={game.category_name_ko}
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
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0.875rem" }}>
        {Array.from({ length: 8 }).map((_, i) => <GameCardSkeleton key={i} />)}
      </div>
    </>
  );
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { sort = "plays" } = await searchParams;
  const cat = CATEGORY_NAMES[slug];

  if (!cat) {
    return (
      <div style={{ textAlign: "center", padding: "4rem 2rem" }}>
        <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>🔍</div>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "0.5rem" }}>카테고리를 찾을 수 없습니다</h1>
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
      <div style={{ marginBottom: "1.75rem", display: "flex", alignItems: "center", gap: "1rem" }}>
        <div style={{
          width: 56, height: 56,
          background: "linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))",
          borderRadius: 14,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "1.75rem",
        }}>
          {cat.icon}
        </div>
        <div>
          <h1 style={{ fontSize: "1.75rem", fontWeight: 800, lineHeight: 1.2 }}>
            {cat.nameKo} <span style={{ color: "var(--text-muted)", fontSize: "1rem", fontWeight: 400 }}>게임</span>
          </h1>
          <p style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>{cat.name} Games</p>
        </div>
      </div>

      {/* Sort Controls */}
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem" }}>
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
