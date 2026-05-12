"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const categories = [
  { slug: "all",         name: "홈",           icon: "🏠" },
  { slug: "action",      name: "액션",          icon: "⚡" },
  { slug: "adventure",   name: "어드벤처",      icon: "🧭" },
  { slug: "puzzle",      name: "퍼즐",          icon: "🧩" },
  { slug: "racing",      name: "레이싱",        icon: "🏎️" },
  { slug: "sports",      name: "스포츠",        icon: "🏆" },
  { slug: "shooter",     name: "슈터",          icon: "🎯" },
  { slug: "rpg",         name: "RPG",           icon: "⚔️" },
  { slug: "strategy",    name: "전략",          icon: "🧠" },
  { slug: "simulation",  name: "시뮬레이션",    icon: "⚙️" },
  { slug: "idle",        name: "방치형",        icon: "⏰" },
  { slug: "casual",      name: "캐주얼",        icon: "😊" },
  { slug: "multiplayer", name: "멀티플레이",    icon: "👥" },
];

export function PlatformSidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      id="platform-sidebar"
      style={{
        width: collapsed ? "56px" : "var(--sidebar-width)",
        background: "#1a1d27",
        borderRight: "1px solid rgba(255,255,255,0.06)",
        position: "fixed",
        top: "var(--header-height)",
        left: 0,
        bottom: 0,
        zIndex: 40,
        display: "flex",
        flexDirection: "column",
        overflowY: "auto",
        overflowX: "hidden",
        transition: "width 0.2s ease",
      }}
    >
      {/* Hamburger toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: collapsed ? "center" : "flex-start",
          gap: "0.625rem",
          padding: collapsed ? "0.75rem 0" : "0.75rem 1rem",
          background: "none",
          border: "none",
          cursor: "pointer",
          color: "rgba(255,255,255,0.5)",
          width: "100%",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          flexShrink: 0,
          transition: "all 0.2s",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.color = "white")}
        onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.5)")}
        aria-label="사이드바 접기/펼치기"
      >
        <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
        {!collapsed && (
          <span style={{ fontSize: "0.8rem", fontWeight: 600, whiteSpace: "nowrap" }}>
            메뉴
          </span>
        )}
      </button>

      {/* Category Nav */}
      <nav style={{ flex: 1, padding: "0.5rem 0" }}>
        {categories.map((cat) => {
          const href = cat.slug === "all" ? "/" : `/category/${cat.slug}`;
          const isActive =
            cat.slug === "all" ? pathname === "/" : pathname === href;

          return (
            <Link key={cat.slug} href={href} style={{ textDecoration: "none" }}>
              <div
                id={`sidebar-cat-${cat.slug}`}
                title={cat.name}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.75rem",
                  padding: collapsed ? "0.6rem 0" : "0.55rem 1rem",
                  justifyContent: collapsed ? "center" : "flex-start",
                  borderRadius: 0,
                  color: isActive ? "#fff" : "rgba(255,255,255,0.55)",
                  background: isActive ? "rgba(108,99,255,0.18)" : "transparent",
                  borderLeft: isActive ? "3px solid #6c63ff" : "3px solid transparent",
                  cursor: "pointer",
                  transition: "all 0.15s",
                  fontSize: "0.875rem",
                  fontWeight: isActive ? 600 : 400,
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.06)";
                    (e.currentTarget as HTMLElement).style.color = "white";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    (e.currentTarget as HTMLElement).style.background = "transparent";
                    (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.55)";
                  }
                }}
              >
                <span style={{ fontSize: "1rem", flexShrink: 0, lineHeight: 1 }}>
                  {cat.icon}
                </span>
                {!collapsed && (
                  <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {cat.name}
                  </span>
                )}
              </div>
            </Link>
          );
        })}
      </nav>

      {/* Bottom: Console */}
      <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", padding: "0.5rem 0" }}>
        <Link href="/console" style={{ textDecoration: "none" }}>
          <div
            id="sidebar-console-link"
            title="개발자 콘솔"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
              padding: collapsed ? "0.6rem 0" : "0.55rem 1rem",
              justifyContent: collapsed ? "center" : "flex-start",
              color: "rgba(255,255,255,0.4)",
              cursor: "pointer",
              fontSize: "0.8rem",
              transition: "color 0.15s",
            }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = "white")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.4)")}
          >
            <span style={{ fontSize: "1rem", flexShrink: 0 }}>🛠</span>
            {!collapsed && <span style={{ whiteSpace: "nowrap" }}>개발자 콘솔</span>}
          </div>
        </Link>
      </div>
    </aside>
  );
}
