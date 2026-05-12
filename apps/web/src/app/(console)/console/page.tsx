import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "대시보드 — WGP 콘솔",
};

export default async function ConsoleDashboard() {
  return (
    <div id="console-dashboard">
      <div style={{ marginBottom: "1.75rem" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 800, marginBottom: "0.25rem" }}>
          개발자 대시보드
        </h1>
        <p style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>
          게임을 관리하고 새 게임을 등록하세요.
        </p>
      </div>

      {/* Stats */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        gap: "1rem",
        marginBottom: "2rem",
      }}>
        {[
          { label: "전체 게임", value: "0", icon: "🎮", color: "var(--accent-primary)" },
          { label: "활성 게임", value: "0", icon: "✅", color: "var(--accent-success)" },
          { label: "처리 중", value: "0", icon: "⚙️",  color: "var(--accent-warning)" },
          { label: "총 플레이", value: "0", icon: "▶️", color: "var(--accent-secondary)" },
        ].map((stat) => (
          <div key={stat.label} className="card" id={`stat-${stat.label}`}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
              <span style={{ fontSize: "1.5rem" }}>{stat.icon}</span>
              <span style={{
                width: 8, height: 8, borderRadius: "50%",
                background: stat.color,
              }} />
            </div>
            <div style={{ fontSize: "1.875rem", fontWeight: 800, marginBottom: "0.25rem" }}>
              {stat.value}
            </div>
            <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div style={{ marginBottom: "2rem" }}>
        <h2 className="section-title">빠른 실행</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem" }}>
          {[
            { href: "/console/upload", label: "새 게임 등록", desc: "WebGL 게임 ZIP 업로드", icon: "⬆️" },
            { href: "/console/games",  label: "게임 목록",    desc: "등록된 게임 관리",     icon: "📋" },
            { href: "/",               label: "플랫폼 보기",  desc: "사용자 뷰 확인",       icon: "👁️" },
          ].map((action) => (
            <a key={action.href} href={action.href} id={`quick-action-${action.label}`}>
              <div className="card" style={{ cursor: "pointer" }}>
                <div style={{ fontSize: "2rem", marginBottom: "0.75rem" }}>{action.icon}</div>
                <div style={{ fontWeight: 700, marginBottom: "0.25rem" }}>{action.label}</div>
                <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>{action.desc}</div>
              </div>
            </a>
          ))}
        </div>
      </div>

      {/* API Status */}
      <div>
        <h2 className="section-title">시스템 상태</h2>
        <div className="card">
          <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
            {[
              { label: "API 서버", id: "status-api" },
              { label: "데이터베이스", id: "status-db" },
              { label: "COS 스토리지", id: "status-cos" },
            ].map((item) => (
              <div key={item.label} id={item.id} style={{
                display: "flex", alignItems: "center",
                justifyContent: "space-between",
              }}>
                <span style={{ fontSize: "0.875rem" }}>{item.label}</span>
                <span className="badge badge-pending">확인 중</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
