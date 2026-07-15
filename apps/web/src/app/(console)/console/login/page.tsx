"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { login as authLogin, logout as authLogout } from "@/lib/auth";

export default function ConsoleLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // access = 메모리, refresh = httpOnly 쿠키. localStorage 저장 없음.
      const result = await authLogin(email, password);

      if (!result.ok) {
        setError(result.error || "로그인에 실패했습니다.");
        return;
      }

      // 역할 확인 (admin 또는 developer만 콘솔 접근 가능)
      if (!["admin", "developer"].includes(result.user?.role ?? "")) {
        // 권한 없는 세션은 즉시 폐기(쿠키/메모리 정리).
        await authLogout();
        setError("콘솔 접근 권한이 없습니다. 개발자 계정으로 로그인하세요.");
        return;
      }

      router.push("/console");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "var(--bg-primary)",
      padding: "1.5rem",
    }}>
      <div style={{ width: "100%", maxWidth: 400 }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <div style={{
            width: 56, height: 56,
            background: "linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))",
            borderRadius: 14,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "1.5rem", fontWeight: 800, color: "white",
            margin: "0 auto 1rem",
          }}>W</div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 800, marginBottom: "0.25rem" }}>
            WGP 콘솔
          </h1>
          <p style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>
            개발자/관리자 로그인
          </p>
        </div>

        {/* Form */}
        <div className="card" style={{ padding: "1.75rem" }}>
          <form onSubmit={handleLogin} id="login-form">
            <div style={{ marginBottom: "1rem" }}>
              <label className="label" htmlFor="email">이메일</label>
              <input
                id="email"
                type="email"
                required
                autoFocus
                className="input"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
              />
            </div>

            <div style={{ marginBottom: "1.5rem" }}>
              <label className="label" htmlFor="password">비밀번호</label>
              <input
                id="password"
                type="password"
                required
                className="input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
              />
            </div>

            {/* Error Message */}
            {error && (
              <div id="login-error" style={{
                marginBottom: "1rem",
                padding: "0.75rem 1rem",
                background: "rgba(248, 113, 113, 0.1)",
                border: "1px solid rgba(248, 113, 113, 0.3)",
                borderRadius: 8,
                fontSize: "0.8rem",
                color: "var(--accent-danger)",
                lineHeight: 1.5,
              }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              id="login-submit-btn"
              className="btn btn-primary"
              disabled={loading}
              style={{
                width: "100%",
                justifyContent: "center",
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? (
                <>
                  <div className="spinner" style={{ width: 16, height: 16, borderWidth: 1.5 }} />
                  로그인 중...
                </>
              ) : "로그인"}
            </button>
          </form>
        </div>

        {/* Back link */}
        <div style={{ textAlign: "center", marginTop: "1.25rem" }}>
          <Link href="/" style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
            ← 플랫폼으로 돌아가기
          </Link>
        </div>
      </div>
    </div>
  );
}
