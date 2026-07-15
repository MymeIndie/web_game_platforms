"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  fetchCategories,
  categoryEmoji,
  FALLBACK_CATEGORIES,
  type Category,
} from "@/lib/categories";

export function PlatformSidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  // 정적 폴백으로 시드 → 서버 렌더와 동일 → 하이드레이션 불일치 없음.
  // 마운트 후 API 로 갱신(카테고리 단일 소스 = DB).
  const [categories, setCategories] = useState<Category[]>(FALLBACK_CATEGORIES);

  useEffect(() => {
    let alive = true;
    fetchCategories({ next: undefined, cache: "no-store" } as RequestInit)
      .then((cats) => {
        if (alive && cats.length > 0) setCategories(cats);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  return (
    <aside
      id="platform-sidebar"
      className={`platform-sidebar${collapsed ? " collapsed" : ""}`}
    >
      {/* Hamburger toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="sidebar-toggle"
        aria-label="사이드바 접기/펼치기"
      >
        <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
        {!collapsed && <span className="sidebar-toggle-label">메뉴</span>}
      </button>

      {/* Category Nav */}
      <nav className="sidebar-nav">
        {/* 홈(전체) — 카테고리 아님, UI 전용 항목 */}
        <SidebarLink
          href="/"
          id="sidebar-cat-all"
          title="홈"
          icon="🏠"
          label="홈"
          active={pathname === "/"}
          collapsed={collapsed}
        />

        {categories.map((cat) => {
          const href = `/category/${cat.slug}`;
          return (
            <SidebarLink
              key={cat.slug}
              href={href}
              id={`sidebar-cat-${cat.slug}`}
              title={cat.nameKo || cat.name}
              icon={categoryEmoji(cat.slug)}
              label={cat.nameKo || cat.name}
              active={pathname === href}
              collapsed={collapsed}
            />
          );
        })}
      </nav>

      {/* Bottom: Console */}
      <div className="sidebar-footer">
        <Link href="/console" style={{ textDecoration: "none" }}>
          <div id="sidebar-console-link" className="sidebar-console" title="개발자 콘솔">
            <span className="sidebar-cat-icon">🛠</span>
            {!collapsed && <span style={{ whiteSpace: "nowrap" }}>개발자 콘솔</span>}
          </div>
        </Link>
      </div>
    </aside>
  );
}

function SidebarLink({
  href,
  id,
  title,
  icon,
  label,
  active,
  collapsed,
}: {
  href: string;
  id: string;
  title: string;
  icon: string;
  label: string;
  active: boolean;
  collapsed: boolean;
}) {
  return (
    <Link href={href} style={{ textDecoration: "none" }}>
      <div id={id} title={title} className={`sidebar-cat${active ? " active" : ""}`}>
        <span className="sidebar-cat-icon">{icon}</span>
        {!collapsed && <span className="sidebar-cat-label">{label}</span>}
      </div>
    </Link>
  );
}
