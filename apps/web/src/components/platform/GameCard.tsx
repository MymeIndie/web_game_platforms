"use client";

import { useState, useRef, useCallback } from "react";
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
  const [isHovered, setIsHovered] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hoverTimeout = useRef<ReturnType<typeof setTimeout>>(undefined);

  const handleMouseEnter = useCallback(() => {
    hoverTimeout.current = setTimeout(() => {
      setIsHovered(true);
      if (videoRef.current && previewVideoUrl && !videoError) {
        videoRef.current.play().catch(() => setVideoError(true));
      }
    }, 200);
  }, [previewVideoUrl, videoError]);

  const handleMouseLeave = useCallback(() => {
    clearTimeout(hoverTimeout.current);
    setIsHovered(false);
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
          style={{
            objectFit: "cover",
            transition: "opacity 0.3s ease",
            opacity: isHovered && previewVideoUrl && !videoError ? 0 : 1,
          }}
          priority={false}
        />

        {/* Preview Video */}
        {previewVideoUrl && !videoError && (
          <video
            ref={videoRef}
            src={previewVideoUrl}
            muted
            loop
            playsInline
            onError={() => setVideoError(true)}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              opacity: isHovered ? 1 : 0,
              transition: "opacity 0.3s ease",
            }}
          />
        )}

        {/* Hover Overlay Info */}
        <div className="game-card-info">
          <p style={{
            fontWeight: 700,
            fontSize: "0.85rem",
            color: "white",
            lineHeight: 1.3,
            marginBottom: "0.25rem",
          }}>
            {titleKo || title}
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            {categoryName && (
              <span style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.65)" }}>
                {categoryName}
              </span>
            )}
            {plays > 0 && (
              <>
                <span style={{ color: "rgba(255,255,255,0.3)", fontSize: "0.65rem" }}>·</span>
                <span style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.65)" }}>
                  {formatPlays(plays)} 플레이
                </span>
              </>
            )}
            {rating > 0 && (
              <>
                <span style={{ color: "rgba(255,255,255,0.3)", fontSize: "0.65rem" }}>·</span>
                <span style={{ fontSize: "0.7rem", color: "#fbbf24" }}>
                  ★ {rating.toFixed(1)}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Play Icon on Hover */}
        {isHovered && (
          <div style={{
            position: "absolute",
            top: "50%", left: "50%",
            transform: "translate(-50%, -50%)",
            width: 48, height: 48,
            background: "rgba(108, 99, 255, 0.9)",
            borderRadius: "50%",
            display: "flex", alignItems: "center", justifyContent: "center",
            backdropFilter: "blur(4px)",
            boxShadow: "0 0 24px rgba(108, 99, 255, 0.5)",
            animation: "fadeInScale 0.2s ease",
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        )}


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
