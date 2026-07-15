"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ensureAuth, getCurrentUser, logout as authLogout } from "@/lib/auth";

const navItems = [
  { href: "/console",        label: "대시보드",  icon: "📊" },
  { href: "/console/games",  label: "게임 관리", icon: "🎮" },
  { href: "/console/upload", label: "게임 등록", icon: "⬆️" },
];

export default function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [username, setUsername] = useState("");
  // 인증 확인 전에는 보호 콘텐츠를 그리지 않는다(플래시 방지).
  const [authState, setAuthState] = useState<"checking" | "authed">("checking");

  // 로그인 페이지는 레이아웃 없이 그대로 렌더
  const isLoginPage = pathname === "/console/login";

  useEffect(() => {
    if (isLoginPage) return;
    let active = true;

    // 이미 이번 세션에서 검증된 사용자(메모리)면 재검증 생략 → 페이지 이동 시 스피너 플래시 방지.
    const cached = getCurrentUser();
    if (cached && ["admin", "developer"].includes(cached.role)) {
      setUsername(cached.username || "관리자");
      setAuthState("authed");
      return;
    }

    setAuthState("checking");

    // 메모리 access 토큰(없으면 refresh 쿠키로 재발급) → /me 로 세션 검증.
    ensureAuth().then((user) => {
      if (!active) return;
      if (!user || !["admin", "developer"].includes(user.role)) {
        router.replace("/console/login");
        return;
      }
      setUsername(user.username || "관리자");
      setAuthState("authed");
    });

    return () => {
      active = false;
    };
  }, [isLoginPage, pathname, router]);

  const handleLogout = async () => {
    // 쿠키(refresh) 자동 전송으로 서버 세션 폐기 + 메모리 정리.
    await authLogout();
    router.replace("/console/login");
  };

  // 로그인 페이지는 레이아웃 없이 children만 렌더
  if (isLoginPage) {
    return <>{children}</>;
  }

  // 세션 확인 중에는 스피너만 노출(미인증 콘텐츠 플래시 차단)
  if (authState === "checking") {
    return (
      <div style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bg-primary)",
      }}>
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      {/* Console Sidebar */}
      <aside id="console-sidebar" style={{
        width: 220,
        background: "var(--bg-secondary)",
        borderRight: "1px solid var(--border-subtle)",
        position: "fixed",
        top: 0, left: 0, bottom: 0,
        display: "flex",
        flexDirection: "column",
        zIndex: 40,
      }}>
        {/* Logo */}
        <div style={{
          padding: "1.25rem",
          borderBottom: "1px solid var(--border-subtle)",
        }}>
          <Link href="/console" style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
            <div style={{
              width: 34, height: 34,
              background: "linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))",
              borderRadius: 8,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "1rem", fontWeight: 800, color: "white",
            }}>W</div>
            <div>
              <div style={{ fontWeight: 800, fontSize: "0.9rem", lineHeight: 1 }}>WGP 콘솔</div>
              <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>Developer Console</div>
            </div>
          </Link>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: "0.75rem 0.5rem" }}>
          {navItems.map((item) => {
            const isActive = item.href === "/console"
              ? pathname === "/console"
              : pathname.startsWith(item.href);
            return (
              <Link key={item.href} href={item.href}>
                <div
                  id={`console-nav-${item.label}`}
                  className={`sidebar-item ${isActive ? "active" : ""}`}
                >
                  <span style={{ fontSize: "1.1rem" }}>{item.icon}</span>
                  <span>{item.label}</span>
                </div>
              </Link>
            );
          })}
        </nav>

        {/* Footer — 로그아웃 + 사용자명 */}
        <div style={{
          padding: "1rem 1.25rem",
          borderTop: "1px solid var(--border-subtle)",
          fontSize: "0.75rem",
          color: "var(--text-muted)",
          display: "flex",
          flexDirection: "column",
          gap: "0.625rem",
        }}>
          {username && (
            <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", fontWeight: 600 }}>
              👤 {username}
            </div>
          )}
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
            ← 플랫폼으로
          </Link>
          <button
            id="console-logout-btn"
            onClick={handleLogout}
            style={{
              background: "none", border: "none", cursor: "pointer",
              color: "var(--accent-danger)", fontSize: "0.75rem",
              textAlign: "left", padding: 0,
            }}
          >
            로그아웃
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div style={{ flex: 1, marginLeft: 220, display: "flex", flexDirection: "column" }}>
        {/* Top Header */}
        <header style={{
          height: "var(--header-height)",
          background: "var(--bg-secondary)",
          borderBottom: "1px solid var(--border-subtle)",
          display: "flex",
          alignItems: "center",
          padding: "0 1.5rem",
          gap: "1rem",
          position: "sticky", top: 0, zIndex: 30,
        }}>
          <div style={{ flex: 1 }} />
          <Link href="/console/upload" className="btn btn-primary btn-sm" id="header-upload-btn">
            + 게임 등록
          </Link>
        </header>

        {/* Page Content */}
        <main style={{ flex: 1, padding: "1.5rem" }}>
          {children}
        </main>
      </div>
    </div>
  );
}
