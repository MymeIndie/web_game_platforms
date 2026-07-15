"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useEffect, useRef } from "react";
import { authFetch } from "@/lib/auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

/**
 * 게임 서빙 오리진(env 주도, HARDENING_SPEC 핵심 ①).
 * 설정 시 iframe 이 앱과 **다른 오리진**에서 로드 → same-origin 정책으로 부모(앱) 토큰/DOM 접근 차단.
 * 미설정 시(개발) 같은 오리진 /game-proxy 로 폴백. **운영에서는 반드시 앱과 다른 오리진을 지정한다.**
 */
const GAME_ORIGIN = (process.env.NEXT_PUBLIC_GAME_ORIGIN || "").replace(/\/$/, "");

function buildGameSrc(id?: string, gamePath?: string): string | null {
  if (!id || !gamePath) return null;
  // 별도 오리진이 지정되면 교차 오리진 절대 URL, 아니면 같은 오리진 프록시(폴백).
  return GAME_ORIGIN
    ? `${GAME_ORIGIN}/games/${id}/index.html`
    : `/game-proxy/${id}/index.html`;
}

interface Game {
  id?: string;
  title: string;
  titleKo?: string;
  description?: string;
  descriptionKo?: string;
  gamePath?: string;
  thumbnailUrl?: string;
  categoryName?: string;
  categoryNameKo?: string;
  categorySlug?: string;
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
            .map((g) => ({ id: g.id!, title: g.titleKo || g.title, thumbnailUrl: g.thumbnailUrl || "", plays: g.plays }))
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

/* ── Rating Widget ── (POST /rate · GET /my-rating, Lane 2 백엔드) */
function RatingWidget({ gameId, initialAvg }: { gameId?: string; initialAvg?: number }) {
  const [avg, setAvg] = useState<number>(initialAvg ?? 0);
  const [myRating, setMyRating] = useState<number | null>(null);
  const [hover, setHover] = useState(0);
  const [status, setStatus] = useState<"" | "saving" | "saved" | "auth" | "error">("");

  // 초기 내 평점 조회(비로그인이면 401 → 조용히 무시)
  useEffect(() => {
    if (!gameId) return;
    let active = true;
    authFetch(`/api/games/${gameId}/my-rating`)
      .then(async (res) => {
        if (!active || res.status === 401 || !res.ok) return;
        const json = await res.json().catch(() => null);
        if (json?.success && typeof json.data?.rating === "number") {
          setMyRating(json.data.rating);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [gameId]);

  const submit = async (value: number) => {
    if (!gameId || status === "saving") return;
    setStatus("saving");
    try {
      const res = await authFetch(`/api/games/${gameId}/rate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating: value }),
      });
      if (res.status === 401) {
        setStatus("auth");
        return;
      }
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        setStatus("error");
        return;
      }
      setMyRating(value);
      if (typeof json.data?.rating === "number") setAvg(json.data.rating);
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  };

  const active = hover || myRating || 0;

  return (
    <div id="rating-widget" style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap", marginBottom: "0.5rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.15rem" }} onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            id={`rate-star-${star}`}
            aria-label={`${star}점`}
            onMouseEnter={() => setHover(star)}
            onClick={() => submit(star)}
            disabled={!gameId || status === "saving"}
            style={{
              background: "none",
              border: "none",
              cursor: gameId ? "pointer" : "default",
              padding: "0.1rem",
              fontSize: "1.15rem",
              lineHeight: 1,
              color: star <= active ? "#fbbf24" : "rgba(255,255,255,0.25)",
              transition: "color 0.1s",
            }}
          >
            ★
          </button>
        ))}
      </div>
      {avg > 0 && (
        <span style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.45)" }}>
          평균 <span style={{ color: "#fbbf24" }}>{Number(avg).toFixed(1)}</span>
        </span>
      )}
      {status === "saved" && <span style={{ fontSize: "0.72rem", color: "#4ade80" }}>평점이 저장되었습니다</span>}
      {status === "auth" && <span style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.5)" }}>평점을 남기려면 로그인이 필요합니다</span>}
      {status === "error" && <span style={{ fontSize: "0.72rem", color: "#f87171" }}>저장에 실패했습니다</span>}
    </div>
  );
}

/* ── Main ── */
export default function PlayClient({ game }: { game: Game | null }) {
  const [liked, setLiked] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [copied, setCopied] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // 게임 iframe src — 별도 오리진(교차 오리진 격리) 또는 개발용 same-origin 프록시 폴백.
  const gameSrc = buildGameSrc(game?.id, game?.gamePath);
  const gameTitle = game ? game.titleKo || game.title : "데모 게임";

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
            {game?.categoryNameKo && (
              <>
                <span>›</span>
                <Link href={`/category/${game.categorySlug || ""}`} style={{ color: "inherit", textDecoration: "none" }}>{game.categoryNameKo}</Link>
              </>
            )}
            <span>›</span>
            <span style={{ color: "#9ca3c8" }}>{gameTitle}</span>
          </div>

          <h1 style={{ fontSize: "1.05rem", fontWeight: 800, color: "#f0f2ff", marginBottom: "0.45rem" }}>{gameTitle}</h1>

          {game?.id && <RatingWidget gameId={game.id} initialAvg={game.rating} />}

          <div style={{ display: "flex", gap: "1.25rem", fontSize: "0.75rem", color: "rgba(255,255,255,0.4)", marginBottom: "0.5rem", flexWrap: "wrap" }}>
            {game?.categoryNameKo && <span>장르: <span style={{ color: "#c7d2fe" }}>{game.categoryNameKo}</span></span>}
            {(game?.rating ?? 0) > 0 && <span>평점: <span style={{ color: "#fbbf24" }}>★ {Number(game?.rating).toFixed(1)}</span></span>}
            {(game?.plays ?? 0) > 0 && <span>플레이: <span style={{ color: "#f0f2ff" }}>{game?.plays?.toLocaleString()}</span></span>}
          </div>

          {(game?.descriptionKo || game?.description) && (
            <p style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.5)", lineHeight: 1.7, marginBottom: "0.5rem" }}>
              {game?.descriptionKo || game?.description}
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
        <RelatedGames categorySlug={game?.categorySlug} excludeId={game?.id} />
      </aside>
    </div>
  );
}
