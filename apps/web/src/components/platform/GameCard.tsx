"use client";

import { useRef, useState, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";

interface GameCardProps {
  id: string;
  title: string;
  titleKo?: string;
  thumbnailUrl: string;
  previewVideoUrl?: string;
  categoryName?: string;
  plays?: number;
  rating?: number;
}

export function GameCard({
  id,
  title,
  titleKo,
  thumbnailUrl,
  previewVideoUrl,
  categoryName,
  plays = 0,
  rating = 0,
}: GameCardProps) {
  // videoError 만 상태로 유지(깨진 영상 숨김). hover 스타일링은 전부 CSS :hover.
  const [videoError, setVideoError] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hoverTimeout = useRef<ReturnType<typeof setTimeout>>(undefined);

  // hover 시 미리보기 영상 재생/정지(스타일 변경 아님 — 재생 제어만 JS)
  const handleMouseEnter = useCallback(() => {
    if (!previewVideoUrl || videoError) return;
    hoverTimeout.current = setTimeout(() => {
      videoRef.current?.play().catch(() => setVideoError(true));
    }, 200);
  }, [previewVideoUrl, videoError]);

  const handleMouseLeave = useCallback(() => {
    clearTimeout(hoverTimeout.current);
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  }, []);

  const formatPlays = (n: number) =>
    n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M`
    : n >= 1_000 ? `${(n / 1_000).toFixed(1)}K`
    : String(n);

  return (
    <Link href={`/play/${id}`} id={`game-card-${id}`}>
      <article
        className="game-card"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        aria-label={titleKo || title}
      >
        {/* Thumbnail Image */}
        <Image
          src={thumbnailUrl || "https://picsum.photos/seed/default/640/360"}
          alt={titleKo || title}
          fill
          sizes="(max-width: 640px) 50vw, (max-width: 1280px) 25vw, 20vw"
          className="game-card-media"
          priority={false}
        />

        {/* Preview Video — CSS 로 hover 시 페이드인(썸네일 위 오버레이) */}
        {previewVideoUrl && !videoError && (
          <video
            ref={videoRef}
            src={previewVideoUrl}
            muted
            loop
            playsInline
            onError={() => setVideoError(true)}
            className="game-card-video"
          />
        )}

        {/* Hover Overlay Info */}
        <div className="game-card-info">
          <p className="game-card-title">{titleKo || title}</p>
          <div className="game-card-meta">
            {categoryName && (
              <span className="game-card-meta-item">{categoryName}</span>
            )}
            {plays > 0 && (
              <>
                <span className="game-card-meta-dot">·</span>
                <span className="game-card-meta-item">
                  {formatPlays(plays)} 플레이
                </span>
              </>
            )}
            {rating > 0 && (
              <>
                <span className="game-card-meta-dot">·</span>
                <span className="game-card-meta-rating">★ {rating.toFixed(1)}</span>
              </>
            )}
          </div>
        </div>

        {/* Play Icon — 순수 CSS :hover */}
        <div className="game-card-play">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
            <path d="M8 5v14l11-7z" />
          </svg>
        </div>
      </article>
    </Link>
  );
}

/** Skeleton placeholder while loading */
export function GameCardSkeleton() {
  return (
    <div
      className="skeleton"
      style={{ aspectRatio: "16 / 9", borderRadius: 10 }}
      aria-label="게임 로딩 중"
    />
  );
}
