"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const navItems = [
  { href: "/console",        label: "대시보드",  icon: "📊" },
  { href: "/console/games",  label: "게임 관리", icon: "🎮" },
  { href: "/console/upload", label: "게임 등록", icon: "⬆️" },
];

export default function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [username, setUsername] = useState("");

  // 로그인 페이지는 레이아웃 없이 그대로 렌더
  const isLoginPage = pathname === "/console/login";

  useEffect(() => {
    if (isLoginPage) return;

    const token = localStorage.getItem("wgp_access_token");
    if (!token) {
      router.replace("/console/login");
      return;
    }
    setUsername(localStorage.getItem("wgp_username") || "관리자");
  }, [isLoginPage, router]);

  const handleLogout = async () => {
    const token = localStorage.getItem("wgp_access_token");
    const refreshToken = localStorage.getItem("wgp_refresh_token");
    if (token && refreshToken) {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
      try {
        await fetch(`${API_URL}/api/auth/logout`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ refreshToken }),
        });
      } catch (err) {
        console.error("Logout failed:", err);
      }
    }
    localStorage.removeItem("wgp_access_token");
    localStorage.removeItem("wgp_refresh_token");
    localStorage.removeItem("wgp_role");
    localStorage.removeItem("wgp_username");
    router.replace("/console/login");
  };

  // 로그인 페이지는 레이아웃 없이 children만 렌더
  if (isLoginPage) {
    return <>{children}</>;
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
