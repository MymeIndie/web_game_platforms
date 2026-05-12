"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, Suspense } from "react";

function PlatformHeaderInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [searchTerm, setSearchTerm] = useState("");
  const [isFocused, setIsFocused] = useState(false);

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
    <header
      id="platform-header"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        height: "var(--header-height)",
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        padding: "0 1rem",
        gap: "0.75rem",
        background: "#0f1117",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      {/* Logo */}
      <Link
        href="/"
        id="header-logo"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          flexShrink: 0,
          width: "calc(var(--sidebar-width) - 1rem)",
          textDecoration: "none",
        }}
      >
        <div
          style={{
            width: 34,
            height: 34,
            background: "linear-gradient(135deg, #6c63ff, #ff6584)",
            borderRadius: 9,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "1.05rem",
            fontWeight: 900,
            color: "white",
            flexShrink: 0,
            boxShadow: "0 2px 12px rgba(108,99,255,0.4)",
          }}
        >
          W
        </div>
        <div style={{ lineHeight: 1.1 }}>
          <div style={{ fontWeight: 900, fontSize: "0.95rem", letterSpacing: "-0.03em", color: "#f0f2ff" }}>
            WGP
          </div>
          <div style={{
            fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.05em",
            background: "linear-gradient(135deg, #6c63ff, #ff6584)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}>
            공감
          </div>
        </div>
      </Link>

      {/* Search Bar — centered */}
      <form
        onSubmit={handleSearch}
        style={{ flex: 1, maxWidth: 540, margin: "0 auto", position: "relative" }}
      >
        <input
          id="header-search"
          type="search"
          placeholder="게임 및 카테고리 검색"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          style={{
            width: "100%",
            height: 40,
            background: isFocused ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.07)",
            border: `1px solid ${isFocused ? "rgba(108,99,255,0.6)" : "rgba(255,255,255,0.08)"}`,
            borderRadius: 20,
            color: "#f0f2ff",
            fontSize: "0.875rem",
            padding: "0 2.75rem 0 1.25rem",
            outline: "none",
            transition: "all 0.2s",
            fontFamily: "inherit",
          }}
        />
        <button
          type="submit"
          style={{
            position: "absolute",
            right: "0.75rem",
            top: "50%",
            transform: "translateY(-50%)",
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "rgba(255,255,255,0.4)",
            display: "flex",
            alignItems: "center",
          }}
        >
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
        </button>
      </form>

      {/* Right Icons */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.25rem", flexShrink: 0 }}>
        {/* Notification */}
        <button
          id="header-notif-btn"
          style={{
            width: 36, height: 36,
            borderRadius: 8,
            background: "transparent",
            border: "none",
            cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "rgba(255,255,255,0.5)",
            transition: "all 0.15s",
            position: "relative",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; e.currentTarget.style.color = "white"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "rgba(255,255,255,0.5)"; }}
          title="알림"
        >
          <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
        </button>

        {/* Wishlist / Heart */}
        <button
          id="header-wishlist-btn"
          style={{
            width: 36, height: 36,
            borderRadius: 8,
            background: "transparent",
            border: "none",
            cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "rgba(255,255,255,0.5)",
            transition: "all 0.15s",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; e.currentTarget.style.color = "#f87171"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "rgba(255,255,255,0.5)"; }}
          title="찜 목록"
        >
          <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        </button>

        {/* Divider */}
        <div style={{ width: 1, height: 22, background: "rgba(255,255,255,0.1)", margin: "0 0.25rem" }} />

        {/* Login / User Avatar */}
        <Link
          href="/console/login"
          id="header-user-btn"
          style={{
            width: 32,
            height: 32,
            borderRadius: "50%",
            background: "linear-gradient(135deg, #6c63ff, #ff6584)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            transition: "transform 0.15s, box-shadow 0.15s",
            boxShadow: "0 2px 8px rgba(108,99,255,0.35)",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.08)"; e.currentTarget.style.boxShadow = "0 4px 16px rgba(108,99,255,0.5)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.boxShadow = "0 2px 8px rgba(108,99,255,0.35)"; }}
          title="로그인 / 콘솔"
        >
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
