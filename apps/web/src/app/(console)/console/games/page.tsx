"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { apiJson, authFetch } from "@/lib/auth";

interface Game {
  id: string;
  title: string;
  titleKo?: string;
  categoryNameKo?: string;
  status: "pending" | "processing" | "active" | "inactive";
  plays: number;
  rating: number;
  createdAt: string;
}

export default function GamesManagePage() {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [total, setTotal] = useState(0);

  const fetchGames = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: "50",
        ...(statusFilter !== "all" && { status: statusFilter }),
        ...(search && { search }),
      });
      const data = await apiJson<{ items: Game[]; total: number }>(`/api/games?${params}`);
      setGames(data?.items || []);
      setTotal(data?.total || 0);
    } catch {
      console.error("Failed to fetch games");
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => {
    fetchGames();
  }, [fetchGames]);

  const handleStatusChange = async (gameId: string, newStatus: string) => {
    try {
      const res = await authFetch(`/api/games/${gameId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) fetchGames();
    } catch {
      alert("상태 변경 실패");
    }
  };

  const handleDelete = async (gameId: string, title: string) => {
    if (!confirm(`"${title}" 게임을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`)) return;
    try {
      const res = await authFetch(`/api/games/${gameId}`, { method: "DELETE" });
      if (res.ok) fetchGames();
      else alert("삭제 실패");
    } catch {
      alert("삭제 실패");
    }
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" });

  return (
    <div id="games-manage-page">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.75rem" }}>
        <div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 800, marginBottom: "0.25rem" }}>게임 관리</h1>
          <p style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>
            총 {total}개의 게임
          </p>
        </div>
        <Link href="/console/upload" className="btn btn-primary" id="games-add-btn">
          + 게임 등록
        </Link>
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: "1.25rem", padding: "1rem" }}>
        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
          <input
            id="games-search"
            type="search"
            placeholder="게임 이름 검색..."
            className="input"
            style={{ maxWidth: 280 }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            id="games-status-filter"
            className="select"
            style={{ maxWidth: 160 }}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">전체 상태</option>
            <option value="active">활성</option>
            <option value="pending">대기</option>
            <option value="processing">처리중</option>
            <option value="inactive">비활성</option>
          </select>
          <button className="btn btn-secondary btn-sm" onClick={fetchGames} id="games-refresh-btn">
            새로고침
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: "3rem", textAlign: "center" }}>
            <div className="spinner" style={{ margin: "0 auto" }} />
          </div>
        ) : games.length === 0 ? (
          <div style={{ padding: "3rem", textAlign: "center", color: "var(--text-muted)" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>🎮</div>
            <p style={{ fontWeight: 600, marginBottom: "0.375rem" }}>등록된 게임이 없습니다</p>
            <p style={{ fontSize: "0.875rem" }}>게임을 등록하여 플랫폼에 퍼블리싱하세요.</p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{
                  background: "var(--bg-tertiary)",
                  borderBottom: "1px solid var(--border-subtle)",
                }}>
                  {["게임명", "카테고리", "상태", "플레이", "평점", "등록일", ""].map((h) => (
                    <th key={h} style={{
                      padding: "0.75rem 1rem",
                      textAlign: "left",
                      fontSize: "0.75rem",
                      fontWeight: 700,
                      color: "var(--text-muted)",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      whiteSpace: "nowrap",
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {games.map((game, idx) => (
                  <tr key={game.id} id={`game-row-${game.id}`} style={{
                    borderBottom: idx < games.length - 1 ? "1px solid var(--border-subtle)" : "none",
                    transition: "background 0.15s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-hover)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <td style={{ padding: "0.875rem 1rem" }}>
                      <div style={{ fontWeight: 600, fontSize: "0.875rem" }}>
                        {game.titleKo || game.title}
                      </div>
                      {game.titleKo && (
                        <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{game.title}</div>
                      )}
                    </td>
                    <td style={{ padding: "0.875rem 1rem" }}>
                      <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                        {game.categoryNameKo || "—"}
                      </span>
                    </td>
                    <td style={{ padding: "0.875rem 1rem" }}>
                      <select
                        value={game.status}
                        onChange={(e) => handleStatusChange(game.id, e.target.value)}
                        className={`badge badge-${game.status}`}
                        style={{ background: "transparent", border: "none", cursor: "pointer", padding: "0.2rem 0.4rem" }}
                        id={`game-status-${game.id}`}
                      >
                        <option value="active">활성</option>
                        <option value="inactive">비활성</option>
                        <option value="pending">대기</option>
                      </select>
                    </td>
                    <td style={{ padding: "0.875rem 1rem", fontSize: "0.875rem", color: "var(--text-secondary)" }}>
                      {game.plays.toLocaleString()}
                    </td>
                    <td style={{ padding: "0.875rem 1rem", fontSize: "0.875rem", color: "#fbbf24" }}>
                      {game.rating > 0 ? `★ ${Number(game.rating).toFixed(1)}` : "—"}
                    </td>
                    <td style={{ padding: "0.875rem 1rem", fontSize: "0.8rem", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                      {formatDate(game.createdAt)}
                    </td>
                    <td style={{ padding: "0.875rem 1rem" }}>
                      <div style={{ display: "flex", gap: "0.5rem" }}>
                        <Link
                          href={`/play/${game.id}`}
                          className="btn btn-secondary btn-sm"
                          id={`game-play-${game.id}`}
                        >▶</Link>
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => handleDelete(game.id, game.titleKo || game.title)}
                          id={`game-delete-${game.id}`}
                        >삭제</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
