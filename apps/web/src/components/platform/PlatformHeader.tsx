"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, Suspense } from "react";

function PlatformHeaderInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    setSearchTerm(searchParams.get("search") || "");
  }, [searchParams]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      router.push(`/?search=${encodeURIComponent(searchTerm.trim())}`);
    } else {
      router.push("/");
    }
  };

  return (
    <header id="platform-header" className="platform-header">
      {/* Logo */}
      <Link href="/" id="header-logo" className="header-logo">
        <div className="header-logo-mark">W</div>
        <div style={{ lineHeight: 1.1 }}>
          <div className="header-logo-title">WGP</div>
          <div className="header-logo-sub text-gradient">공감</div>
        </div>
      </Link>

      {/* Search Bar — centered */}
      <form onSubmit={handleSearch} className="header-search-form">
        <input
          id="header-search"
          type="search"
          placeholder="게임 및 카테고리 검색"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="header-search"
        />
        <button type="submit" className="header-search-btn" aria-label="검색">
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
        </button>
      </form>

      {/* Right Icons */}
      <div className="header-actions">
        {/* Notification */}
        <button id="header-notif-btn" className="icon-btn" title="알림">
          <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
        </button>

        {/* Wishlist / Heart */}
        <button id="header-wishlist-btn" className="icon-btn icon-btn-heart" title="찜 목록">
          <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        </button>

        {/* Divider */}
        <div className="header-divider" />

        {/* Login / User Avatar */}
        <Link href="/console/login" id="header-user-btn" className="header-avatar" title="로그인 / 콘솔">
          <svg width="16" height="16" fill="none" stroke="white" strokeWidth={2} viewBox="0 0 24 24">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        </Link>
      </div>
    </header>
  );
}

export function PlatformHeader() {
  return (
    <Suspense fallback={null}>
      <PlatformHeaderInner />
    </Suspense>
  );
}
