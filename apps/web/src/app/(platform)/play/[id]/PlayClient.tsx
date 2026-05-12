"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useEffect, useRef } from "react";

const CDN_URL = process.env.NEXT_PUBLIC_CDN_URL || "";
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface Game {
  id?: string;
  title: string;
  title_ko?: string;
  description?: string;
  description_ko?: string;
  game_path?: string;
  thumbnail_url?: string;
  category_name?: string;
  category_name_ko?: string;
  category_slug?: string;
  plays?: number;
  rating?: number;
  tags?: string[];
}

function formatPlays(n?: number) {
  if (!n) return "0";
  if (n >= 10000) return `${(n / 10000).toFixed(1)}만`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}천`;
  return n.toLocaleString();
}

/* ── Related Games: 2열 그리드 ── */
function RelatedGames({ categorySlug, excludeId }: { categorySlug?: string; excludeId?: string }) {
  const [games, setGames] = useState<{ id: string; title: string; thumbnailUrl: string; plays?: number }[]>([]);

  useEffect(() => {
    const url = categorySlug
      ? `${API_URL}/api/games?limit=20&status=active&sort=plays&category=${categorySlug}`
      : `${API_URL}/api/games?limit=20&status=active&sort=plays`;
    fetch(url)
      .then((r) => r.json())
      .then((json) => {
        const items = (json.data?.items || []) as Game[];
        setGames(
          items
            .filter((g) => g.id !== excludeId)
            .slice(0, 16)
            .map((g) => ({ id: g.id!, title: g.title_ko || g.title, thumbnailUrl: g.thumbnail_url || "", plays: g.plays }))
        );
      })
      .catch(() => {});
  }, [categorySlug, excludeId]);

  const demo = Array.from({ length: 16 }, (_, i) => ({
    id: `demo-${i}`,
    title: `게임 ${i + 1}`,
    thumbnailUrl: `https://picsum.photos/seed/rel${i + 20}/200/120`,
    plays: Math.floor(Math.random() * 50000),
  }));

  const list = games.length > 0 ? games : demo;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.375rem" }}>
      {list.map((g) => (
        <Link key={g.id} href={`/play/${g.id}`} style={{ textDecoration: "none", display: "block" }}>
          <div
            style={{
              borderRadius: 6,
              overflow: "hidden",
              background: "#242838",
              transition: "transform 0.15s, box-shadow 0.15s",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.transform = "scale(1.04)";
              (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 16px rgba(0,0,0,0.5)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.transform = "scale(1)";
              (e.currentTarget as HTMLElement).style.boxShadow = "none";
            }}
          >
            <div style={{ position: "relative", aspectRatio: "16/9", background: "#1a1d27" }}>
              {g.thumbnailUrl
                ? <Image src={g.thumbnailUrl} alt={g.title} fill style={{ objectFit: "cover" }} sizes="110px" />
                : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.2rem" }}>🎮</div>
              }
            </div>
            <div style={{ padding: "0.3rem 0.4rem 0.35rem" }}>
              <p style={{ fontSize: "0.65rem", fontWeight: 600, color: "#f0f2ff", lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {g.title}
              </p>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}

/* ── Main ── */
export default function PlayClient({ game }: { game: Game | null }) {
  const [liked, setLiked] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [copied, setCopied] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // /game-proxy 경로: Next.js 내장 라우트로 서빙 (same-origin, 크로스 오리진 없음)
  const gameSrc = game?.id && game?.game_path
    ? `/game-proxy/${game.id}/index.html`
    : null;
  const gameTitle = game ? game.title_ko || game.title : "데모 게임";

  const handleFullscreen = () => {
    if (!document.fullscreenElement) {
      wrapRef.current?.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  const handleShare = () => {
    navigator.clipboard?.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  useEffect(() => {
    const h = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", h);
    return () => document.removeEventListener("fullscreenchange", h);
  }, []);

  return (
    <div
      style={{
        margin: "-1.25rem -1.5rem",
        height: "calc(100vh - var(--header-height))",
        display: "flex",
        overflow: "hidden",
        background: "#0f1117",
      }}
    >
      {/* ══ LEFT: Game Area ══ */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>

        {/* IFrame - 16:9 letterbox */}
        <div
          ref={wrapRef}
          style={{
            flex: 1,
            position: "relative",
            background: "#080a0f",
            minHeight: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
          }}
        >
          {/* 16:9 game wrapper — height-first sizing creates side letterbox */}
          <div
            style={{
              position: "relative",
              aspectRatio: "16 / 9",
              maxHeight: "calc(100% - 2rem)",
              maxWidth: "calc(100% - 4rem)",
              width: "auto",
              height: "100%",
              background: "#000",
              boxShadow: "0 0 60px rgba(0,0,0,0.9)",
              borderRadius: 4,
              overflow: "hidden",
            }}
          >
          {gameSrc ? (
            <iframe
              id="game-iframe"
              src={gameSrc}
              title={gameTitle}
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: "none", display: "block" }}
              allow="fullscreen; autoplay; clipboard-write"
              sandbox="allow-scripts allow-same-origin allow-pointer-lock allow-popups allow-forms allow-downloads"
            />
          ) : (
            <div style={{
              width: "100%", height: "100%",
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              gap: "1.25rem", color: "rgba(255,255,255,0.45)",
            }}>
              <div style={{
                width: 68, height: 68,
                background: "linear-gradient(135deg,#6c63ff,#ff6584)",
                borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "2rem",
              }}>🎮</div>
              <div style={{ textAlign: "center" }}>
                <p style={{ fontSize: "1.05rem", fontWeight: 700, color: "#f0f2ff", marginBottom: "0.4rem" }}>게임 준비 중</p>
                <p style={{ fontSize: "0.8rem", lineHeight: 1.7 }}>업로드 처리 중이거나 아직 배포되지 않았습니다.</p>
              </div>
              <Link href="/" className="btn btn-primary" style={{ fontSize: "0.85rem" }}>다른 게임 보기</Link>
            </div>
          )}
          </div>{/* end 16:9 inner wrapper */}
        </div>{/* end letterbox outer */}

        {/* ── Game Bar ── */}
        <div style={{
          background: "#1a1d27",
          borderTop: "1px solid rgba(255,255,255,0.07)",
          padding: "0.45rem 0.875rem",
          display: "flex", alignItems: "center", gap: "0.75rem",
          flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.45rem", flex: 1, minWidth: 0 }}>
            <div style={{
              width: 24, height: 24, borderRadius: 5, flexShrink: 0,
              background: "rgba(108,99,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.75rem",
            }}>🎮</div>
            <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "#f0f2ff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {gameTitle}
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexShrink: 0 }}>
            {(game?.plays ?? 0) > 0 && (
              <span style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.4)", display: "flex", alignItems: "center", gap: "0.25rem" }}>
                <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
                </svg>
                {formatPlays(game?.plays)}
              </span>
            )}

            {/* Like */}
            <button onClick={() => setLiked(!liked)} style={{
              display: "flex", alignItems: "center", gap: "0.25rem",
              background: "none", border: "none", cursor: "pointer",
              color: liked ? "#f87171" : "rgba(255,255,255,0.4)", fontSize: "0.72rem",
            }}>
              <svg width="13" height="13" fill={liked ? "currentColor" : "none"} stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
              좋아요
            </button>

            {/* Share */}
            <button onClick={handleShare} style={{
              display: "flex", alignItems: "center", gap: "0.25rem",
              background: "none", border: "none", cursor: "pointer",
              color: copied ? "#4ade80" : "rgba(255,255,255,0.4)", fontSize: "0.72rem",
            }}>
              <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
              </svg>
              {copied ? "복사됨!" : "공유"}
            </button>

            {/* Fullscreen */}
            <button id="fullscreen-btn" onClick={handleFullscreen} style={{
              display: "flex", alignItems: "center", gap: "0.25rem",
              background: "none", border: "none", cursor: "pointer",
              color: "rgba(255,255,255,0.4)", fontSize: "0.72rem",
            }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = "white")}
              onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.4)")}
            >
              {isFullscreen ? (
                <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
                </svg>
              ) : (
                <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
                </svg>
              )}
              전체화면
            </button>
          </div>
        </div>

        {/* ── Game Info ── */}
        <div style={{
          background: "#0f1117",
          borderTop: "1px solid rgba(255,255,255,0.06)",
          padding: "0.75rem 1rem",
          flexShrink: 0,
          overflowY: "auto",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", fontSize: "0.72rem", color: "rgba(255,255,255,0.35)", marginBottom: "0.45rem" }}>
            <Link href="/" style={{ color: "inherit", textDecoration: "none" }}>게임</Link>
            {game?.category_name_ko && (
              <>
                <span>›</span>
                <Link href={`/category/${game.category_slug || ""}`} style={{ color: "inherit", textDecoration: "none" }}>{game.category_name_ko}</Link>
              </>
            )}
            <span>›</span>
            <span style={{ color: "#9ca3c8" }}>{gameTitle}</span>
          </div>

          <h1 style={{ fontSize: "1.05rem", fontWeight: 800, color: "#f0f2ff", marginBottom: "0.45rem" }}>{gameTitle}</h1>

          <div style={{ display: "flex", gap: "1.25rem", fontSize: "0.75rem", color: "rgba(255,255,255,0.4)", marginBottom: "0.5rem", flexWrap: "wrap" }}>
            {game?.category_name_ko && <span>장르: <span style={{ color: "#c7d2fe" }}>{game.category_name_ko}</span></span>}
            {(game?.rating ?? 0) > 0 && <span>평점: <span style={{ color: "#fbbf24" }}>★ {Number(game?.rating).toFixed(1)}</span></span>}
            {(game?.plays ?? 0) > 0 && <span>플레이: <span style={{ color: "#f0f2ff" }}>{game?.plays?.toLocaleString()}</span></span>}
          </div>

          {(game?.description_ko || game?.description) && (
            <p style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.5)", lineHeight: 1.7, marginBottom: "0.5rem" }}>
              {game?.description_ko || game?.description}
            </p>
          )}

          {game?.tags && game.tags.length > 0 && (
            <div style={{ display: "flex", gap: "0.3rem", flexWrap: "wrap" }}>
              {game.tags.map((tag) => (
                <span key={tag} style={{
                  padding: "0.18rem 0.55rem",
                  background: "rgba(108,99,255,0.1)", border: "1px solid rgba(108,99,255,0.2)",
                  borderRadius: 999, fontSize: "0.68rem", color: "#9ca3c8",
                }}>{tag}</span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ══ RIGHT: Related Games Sidebar (2열 그리드) ══ */}
      <aside style={{
        width: 240,
        flexShrink: 0,
        background: "#1a1d27",
        borderLeft: "1px solid rgba(255,255,255,0.07)",
        overflowY: "auto",
        padding: "0.75rem 0.625rem",
      }}>
        <p style={{
          fontSize: "0.68rem", fontWeight: 700, color: "rgba(255,255,255,0.3)",
          textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.625rem",
        }}>
          다음 게임 플레이
        </p>
        <RelatedGames categorySlug={game?.category_slug} excludeId={game?.id} />
      </aside>
    </div>
  );
}
