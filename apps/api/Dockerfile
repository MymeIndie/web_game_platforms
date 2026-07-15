# ── Multi-Stage Dockerfile for wgp-api ──────────────────────

# Stage 1: Base
FROM node:22-alpine AS base
RUN apk add --no-cache wget
WORKDIR /app
COPY package.json pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/
# lockfile이 있으면 복사 (없어도 오류 없음)
COPY pnpm-lock.yaml* ./
RUN npm install -g pnpm@10 && pnpm install --no-frozen-lockfile --shamefully-hoist

# Stage 2: Build
FROM base AS builder
COPY apps/api/ ./apps/api/
COPY packages/shared/ ./packages/shared/
RUN pnpm --filter @wgp/shared build 2>/dev/null || true
RUN pnpm --filter @wgp/api build

# Stage 3: Development (with hot-reload via tsx watch)
FROM base AS development
COPY apps/api/ ./apps/api/
COPY packages/shared/ ./packages/shared/
# tsx를 전역으로 설치하여 경로 문제 없이 실행
RUN npm install -g tsx
EXPOSE 3001
CMD ["tsx", "watch", "apps/api/src/index.ts"]

# Stage 4: Production
FROM node:22-alpine AS production
RUN apk add --no-cache wget
WORKDIR /app
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=builder /app/apps/api/package.json ./
# 마이그레이션 파일(migrate 서비스 + 부팅 전 스키마 적용용)
COPY --from=builder /app/apps/api/migrations ./migrations
RUN mkdir -p /tmp/wgp-extract
EXPOSE 3000
CMD ["node", "dist/index.js"]
