"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import Link from "next/link";
import { apiJson } from "@/lib/auth";
import { fetchCategories, type Category } from "@/lib/categories";

const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB per chunk

interface UploadState {
  stage: "idle" | "creating" | "uploading" | "processing" | "done" | "error";
  progress: number;
  message: string;
  gameId?: string;
  error?: string;
}

interface GameFormData {
  title: string;
  titleKo: string;
  description: string;
  descriptionKo: string;
  categoryId: string;
  tags: string;
  width: string;
  height: string;
}

// 우리 API 호출은 lib/auth 의 apiJson(메모리 Bearer + 401 재발급 인터셉트)으로 일원화.
// 프리사인 URL 로의 직접 PUT(COS/R2)만 raw fetch 유지(인증/쿠키 불필요).
async function uploadFileMultipart(
  file: File,
  gameId: string,
  onProgress: (percent: number) => void
): Promise<string> {
  // 1. Initiate multipart upload
  const { uploadId, key } = await apiJson<{ uploadId: string; key: string }>("/api/upload/initiate", {
    method: "POST",
    body: JSON.stringify({
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type || "application/zip",
      gameId,
    }),
  });

  // 2. Upload chunks
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
  const parts: { PartNumber: number; ETag: string }[] = [];

  for (let i = 0; i < totalChunks; i++) {
    const start = i * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, file.size);
    const chunk = file.slice(start, end);
    const partNumber = i + 1;

    // Get presigned URL for this chunk
    const { presignedUrl } = await apiJson<{ presignedUrl: string }>(
      `/api/upload/part-url?key=${encodeURIComponent(key)}&uploadId=${uploadId}&partNumber=${partNumber}`
    );

    // Upload chunk directly to COS
    const uploadRes = await fetch(presignedUrl, {
      method: "PUT",
      body: chunk,
      headers: { "Content-Type": "application/octet-stream" },
    });

    if (!uploadRes.ok) throw new Error(`Chunk ${partNumber} upload failed`);

    const etag = uploadRes.headers.get("ETag") || uploadRes.headers.get("etag") || `"chunk-${partNumber}"`;
    parts.push({ PartNumber: partNumber, ETag: etag });
    onProgress(Math.round((partNumber / totalChunks) * 100));
  }

  // 3. Complete multipart upload
  await apiJson("/api/upload/complete", {
    method: "POST",
    body: JSON.stringify({ key, uploadId, parts, gameId }),
  });

  return key;
}

export default function UploadPage() {
  const zipInputRef = useRef<HTMLInputElement>(null);
  const thumbInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<GameFormData>({
    title: "", titleKo: "", description: "", descriptionKo: "",
    categoryId: "1", tags: "", width: "1280", height: "720",
  });
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [thumbFile, setThumbFile] = useState<File | null>(null);
  const [thumbPreview, setThumbPreview] = useState<string | null>(null);
  const [uploadState, setUploadState] = useState<UploadState>({
    stage: "idle", progress: 0, message: "",
  });
  const [isDragOver, setIsDragOver] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    let active = true;
    fetchCategories().then((cats) => {
      if (active) setCategories(cats);
    });
    return () => {
      active = false;
    };
  }, []);

  const handleFormChange = useCallback((
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  }, []);

  const handleThumbChange = useCallback((file: File) => {
    setThumbFile(file);
    const url = URL.createObjectURL(file);
    setThumbPreview(url);
  }, []);

  const handleZipDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file?.name.endsWith(".zip")) setZipFile(file);
  }, []);

  const formatFileSize = (bytes: number) => {
    if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
    if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
    return `${(bytes / 1024).toFixed(0)} KB`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!zipFile) {
      alert("게임 ZIP 파일을 선택해주세요.");
      return;
    }

    try {
      // Step 1: Create game record
      setUploadState({ stage: "creating", progress: 0, message: "게임 정보를 저장하는 중..." });
      const game = await apiJson<{ id: string }>("/api/games", {
        method: "POST",
        body: JSON.stringify({
          title: form.title,
          titleKo: form.titleKo || undefined,
          description: form.description,
          descriptionKo: form.descriptionKo || undefined,
          categoryId: parseInt(form.categoryId),
          tags: form.tags ? form.tags.split(",").map(t => t.trim()).filter(Boolean) : [],
          width: parseInt(form.width) || 1280,
          height: parseInt(form.height) || 720,
        }),
      });

      // Step 2: Upload ZIP via multipart
      setUploadState({ stage: "uploading", progress: 0, message: "ZIP 파일 업로드 중...", gameId: game.id });

      await uploadFileMultipart(zipFile, game.id, (percent) => {
        setUploadState(prev => ({
          ...prev,
          progress: percent,
          message: `업로드 중... ${percent}% (${formatFileSize(zipFile.size * percent / 100)} / ${formatFileSize(zipFile.size)})`,
        }));
      });

      // Step 3: Poll for processing status
      setUploadState({ stage: "processing", progress: 100, message: "압축 해제 및 배포 중...", gameId: game.id });

      let attempts = 0;
      const pollStatus = async () => {
        attempts++;
        try {
          const status = await apiJson<{ status: string }>(`/api/games/${game.id}/status`);
          if (status.status === "active") {
            setUploadState({
              stage: "done", progress: 100,
              message: "게임이 성공적으로 등록되었습니다! 🎉",
              gameId: game.id,
            });
          } else if (status.status === "inactive" && attempts > 5) {
            setUploadState({
              stage: "error", progress: 0,
              message: "압축 해제 중 오류가 발생했습니다.",
              error: "처리 실패. 관리자에게 문의하세요.",
            });
          } else if (attempts < 60) {
            setTimeout(pollStatus, 5000);
          }
        } catch {
          if (attempts < 60) setTimeout(pollStatus, 5000);
        }
      };
      setTimeout(pollStatus, 3000);

    } catch (err) {
      setUploadState({
        stage: "error", progress: 0,
        message: "오류가 발생했습니다.",
        error: (err as Error).message,
      });
    }
  };

  const isUploading = uploadState.stage === "uploading" || uploadState.stage === "creating" || uploadState.stage === "processing";

  return (
    <div id="upload-page" style={{ maxWidth: 800 }}>
      <div style={{ marginBottom: "1.75rem" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 800, marginBottom: "0.25rem" }}>
          새 게임 등록
        </h1>
        <p style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>
          WebGL 게임 ZIP 파일을 업로드하면 자동으로 압축 해제 후 배포됩니다.
        </p>
      </div>

      {/* Upload Status */}
      {uploadState.stage !== "idle" && (
        <div id="upload-status" className="card" style={{ marginBottom: "1.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.875rem" }}>
            {uploadState.stage === "done" ? (
              <span style={{ fontSize: "1.5rem" }}>✅</span>
            ) : uploadState.stage === "error" ? (
              <span style={{ fontSize: "1.5rem" }}>❌</span>
            ) : (
              <div className="spinner" />
            )}
            <div>
              <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>
                {uploadState.stage === "creating" && "게임 정보 생성 중"}
                {uploadState.stage === "uploading" && "파일 업로드 중"}
                {uploadState.stage === "processing" && "게임 처리 중"}
                {uploadState.stage === "done" && "등록 완료!"}
                {uploadState.stage === "error" && "오류 발생"}
              </div>
              <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                {uploadState.message}
              </div>
            </div>
          </div>

          {uploadState.stage === "uploading" && (
            <div className="progress-bar">
              <div className="progress-bar-fill" style={{ width: `${uploadState.progress}%` }} />
            </div>
          )}

          {uploadState.error && (
            <div style={{
              marginTop: "0.75rem", padding: "0.625rem 0.875rem",
              background: "rgba(248, 113, 113, 0.1)",
              border: "1px solid rgba(248, 113, 113, 0.3)",
              borderRadius: 8,
              fontSize: "0.8rem", color: "var(--accent-danger)",
            }}>
              {uploadState.error}
            </div>
          )}

          {uploadState.stage === "done" && uploadState.gameId && (
            <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.875rem" }}>
              <a href={`/play/${uploadState.gameId}`} className="btn btn-primary btn-sm">
                🎮 게임 플레이
              </a>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setUploadState({ stage: "idle", progress: 0, message: "" });
                  setZipFile(null);
                  setThumbFile(null);
                  setThumbPreview(null);
                  setForm({
                    title: "", titleKo: "", description: "", descriptionKo: "",
                    categoryId: "1", tags: "", width: "1280", height: "720",
                  });
                }}
              >
                + 다른 게임 등록
              </button>
            </div>
          )}
        </div>
      )}

      {/* Form */}
      {(uploadState.stage === "idle" || uploadState.stage === "error") && (
        <form onSubmit={handleSubmit} id="game-upload-form">
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>

            {/* Game Info */}
            <div className="card">
              <h2 className="section-title">게임 정보</h2>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <div>
                  <label className="label" htmlFor="title">게임 이름 (영문) *</label>
                  <input
                    id="title" name="title" required
                    className="input" placeholder="My Awesome Game"
                    value={form.title} onChange={handleFormChange}
                  />
                </div>
                <div>
                  <label className="label" htmlFor="titleKo">게임 이름 (한국어)</label>
                  <input
                    id="titleKo" name="titleKo"
                    className="input" placeholder="내 멋진 게임"
                    value={form.titleKo} onChange={handleFormChange}
                  />
                </div>
                <div style={{ gridColumn: "1 / -1" }}>
                  <label className="label" htmlFor="description">설명 (영문)</label>
                  <textarea
                    id="description" name="description"
                    className="input" rows={3}
                    placeholder="Describe your game..."
                    value={form.description} onChange={handleFormChange}
                    style={{ resize: "vertical" }}
                  />
                </div>
                <div style={{ gridColumn: "1 / -1" }}>
                  <label className="label" htmlFor="descriptionKo">설명 (한국어)</label>
                  <textarea
                    id="descriptionKo" name="descriptionKo"
                    className="input" rows={3}
                    placeholder="게임 설명을 입력하세요..."
                    value={form.descriptionKo} onChange={handleFormChange}
                    style={{ resize: "vertical" }}
                  />
                </div>
                <div>
                  <label className="label" htmlFor="categoryId">카테고리 *</label>
                  <select
                    id="categoryId" name="categoryId" required
                    className="select"
                    value={form.categoryId} onChange={handleFormChange}
                  >
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>
                        {cat.nameKo === cat.name ? cat.name : `${cat.nameKo} (${cat.name})`}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor="tags">태그 (쉼표 구분)</label>
                  <input
                    id="tags" name="tags"
                    className="input" placeholder="action, adventure, multiplayer"
                    value={form.tags} onChange={handleFormChange}
                  />
                </div>
                <div>
                  <label className="label" htmlFor="width">해상도 너비 (px)</label>
                  <input
                    id="width" name="width" type="number"
                    className="input" placeholder="1280"
                    value={form.width} onChange={handleFormChange}
                  />
                </div>
                <div>
                  <label className="label" htmlFor="height">해상도 높이 (px)</label>
                  <input
                    id="height" name="height" type="number"
                    className="input" placeholder="720"
                    value={form.height} onChange={handleFormChange}
                  />
                </div>
              </div>
            </div>

            {/* Thumbnail */}
            <div className="card">
              <h2 className="section-title">썸네일 이미지</h2>
              <div style={{ display: "flex", gap: "1.25rem", alignItems: "flex-start" }}>
                {thumbPreview && (
                  <div style={{
                    width: 180, flexShrink: 0,
                    borderRadius: 8, overflow: "hidden",
                    border: "1px solid var(--border-subtle)",
                    aspectRatio: "16 / 9",
                    position: "relative",
                  }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={thumbPreview} alt="썸네일 미리보기"
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  </div>
                )}
                <div style={{ flex: 1 }}>
                  <input
                    ref={thumbInputRef}
                    type="file"
                    accept="image/*"
                    style={{ display: "none" }}
                    id="thumb-input"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleThumbChange(file);
                    }}
                  />
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => thumbInputRef.current?.click()}
                    id="thumb-select-btn"
                  >
                    📷 이미지 선택
                  </button>
                  <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.5rem" }}>
                    권장: 16:9 비율, 최소 640×360px (PNG/JPG/WebP)
                  </p>
                  {thumbFile && (
                    <p style={{ fontSize: "0.8rem", color: "var(--accent-success)", marginTop: "0.375rem" }}>
                      ✅ {thumbFile.name} ({formatFileSize(thumbFile.size)})
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* ZIP Upload */}
            <div className="card">
              <h2 className="section-title">게임 파일 (ZIP) *</h2>
              <div
                id="zip-dropzone"
                onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleZipDrop}
                onClick={() => zipInputRef.current?.click()}
                style={{
                  border: `2px dashed ${isDragOver ? "var(--accent-primary)" : "var(--border-subtle)"}`,
                  borderRadius: 12,
                  padding: "2.5rem",
                  textAlign: "center",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                  background: isDragOver ? "rgba(108, 99, 255, 0.05)" : "transparent",
                }}
              >
                <input
                  ref={zipInputRef}
                  type="file"
                  accept=".zip"
                  style={{ display: "none" }}
                  id="zip-input"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) setZipFile(file);
                  }}
                />
                {zipFile ? (
                  <div>
                    <div style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>📦</div>
                    <div style={{ fontWeight: 700, marginBottom: "0.25rem" }}>{zipFile.name}</div>
                    <div style={{ fontSize: "0.875rem", color: "var(--text-muted)" }}>
                      {formatFileSize(zipFile.size)}
                    </div>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{ marginTop: "0.875rem" }}
                      onClick={(e) => { e.stopPropagation(); setZipFile(null); }}
                      id="zip-clear-btn"
                    >
                      파일 변경
                    </button>
                  </div>
                ) : (
                  <div>
                    <div style={{ fontSize: "3rem", marginBottom: "0.75rem" }}>📁</div>
                    <div style={{ fontWeight: 600, marginBottom: "0.375rem" }}>
                      ZIP 파일을 드래그하거나 클릭하여 선택
                    </div>
                    <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                      1GB 이상 파일도 청크 단위로 안전하게 업로드됩니다
                    </div>
                  </div>
                )}
              </div>

              <div style={{
                marginTop: "0.875rem", padding: "0.75rem 1rem",
                background: "rgba(108, 99, 255, 0.08)",
                border: "1px solid rgba(108, 99, 255, 0.2)",
                borderRadius: 8,
                fontSize: "0.8rem", color: "var(--text-secondary)", lineHeight: 1.6,
              }}>
                <strong>📋 업로드 요구사항:</strong><br />
                • ZIP 루트에 <code>index.html</code>이 있어야 합니다<br />
                • Unity WebGL 빌드: Build/, TemplateData/ 폴더 포함<br />
                • 5MB 청크 단위 Presigned URL 방식으로 대용량도 안전하게 전송
              </div>
            </div>

            {/* Submit */}
            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
              <Link href="/console/games" className="btn btn-secondary">취소</Link>
              <button
                type="submit"
                className="btn btn-primary"
                id="submit-btn"
                disabled={isUploading || !zipFile}
                style={{ opacity: isUploading || !zipFile ? 0.6 : 1 }}
              >
                {isUploading ? "업로드 중..." : "🚀 게임 등록 시작"}
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
