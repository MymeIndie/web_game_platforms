# wgp-gonggam 해야 할 일

## 🔴 지금 당장 (로컬 개발)

### 1. COS SecretId 오타 수정
파일: `.env.development` 27번 줄
```
현재: COS_SECRET_ID=IKID...   ← 오타(I로 시작)
수정: COS_SECRET_ID=AKID...   ← 정상은 A로 시작 (실제 값은 텐센트 콘솔에서, 레포에 커밋 금지)
```
> 텐센트 콘솔에서 정확한 값 복사 필수

---

### 2. apps/web/.env.local 파일 생성
파일: `apps/web/.env.local` (없으면 생성)
```env
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_CDN_URL=https://<버킷명>.cos.ap-seoul.myqcloud.com
NEXT_PUBLIC_SITE_URL=http://localhost:3002
```
> 이 파일 없으면 로그인 시 "서버에 연결할 수 없습니다" 에러 발생

---

### 3. Docker api-dev 컨테이너 실행
```powershell
cd C:\Users\admin\Desktop\web
docker-compose up -d api-dev
```
확인:
```powershell
curl http://localhost:3001/health
# 결과: {"status":"ok"}
```

---

### 4. 텐센트 COS — CORS 설정
텐센트 콘솔 > COS > 버킷 `wgp-gonggam-dev-*` > 보안관리 > CORS 설정

| 항목 | 값 |
|------|-----|
| 출처(Origin) | `http://localhost:3002` |
| 허용 메서드 | GET, PUT, POST, DELETE, HEAD |
| 허용 헤더 | `*` |
| 노출 헤더 | `ETag` |
| 유효 기간 | 600 |

> CORS 없으면 파일 업로드 시 브라우저에서 차단됨

---

## 🟡 개발 완료 후 (배포 전)

### 5. .env.production 실제 값 입력
파일: `.env.production`
```env
JWT_SECRET=랜덤_64자_이상_문자열  ← 반드시 변경
COS_SECRET_ID=AKID...            ← Prod 계정 키
COS_SECRET_KEY=...
COS_BUCKET=wgp-gonggam-prod-...  ← Prod 전용 버킷
DB_PASSWORD=안전한_비밀번호       ← 변경
```

---

### 6. Prod COS 버킷 생성
텐센트 콘솔 > COS > 버킷 만들기
- 이름: `wgp-gonggam-prod-<appid>` (실제 AppId 는 콘솔 값)
- 리전: 서울 (ap-seoul)
- 접근 권한: 비공개 읽기/쓰기
- CORS 설정: Prod 도메인으로 동일하게

---

### 7. GitHub 저장소 생성 + Push
```powershell
cd C:\Users\admin\Desktop\web
git init
git add .
git commit -m "init: wgp-gonggam platform"
git remote add origin https://github.com/[계정]/wgp-gonggam.git
git push -u origin main
```
> `.gitignore`에 `.env.*` 포함 여부 확인 필수

---

## 🟢 프로덕션 배포

### 8. 텐센트 Lighthouse 서버 준비
- 최소 사양: 4GB RAM, 50GB 스토리지
- OS: Ubuntu 22.04
- Docker + Docker Compose 설치
- 방화벽: 포트 80, 8001 오픈

---

### 9. 서버에 배포
```bash
git clone [저장소URL] /opt/wgp
cd /opt/wgp
cp .env.production .env.production.local  # 실제 값 입력
docker-compose up -d --build
```

---

### 10. Cloudflare Pages 연결
Cloudflare 대시보드 > Pages > 새 프로젝트 > GitHub 연결

| 설정 | 값 |
|------|----|
| 빌드 명령 | `pnpm --filter @wgp/web build` |
| 출력 디렉토리 | `apps/web/.next` |
| Node 버전 | `22` |

환경변수 추가:
```
NEXT_PUBLIC_API_URL=http://서버IP:8001
NEXT_PUBLIC_CDN_URL=https://버킷.cos.ap-seoul.myqcloud.com
NEXT_PUBLIC_SITE_URL=https://wgp-gonggam.pages.dev
```

---

## 📋 전체 체크리스트

### 로컬 개발
- [ ] COS_SECRET_ID `IKID` → `AKID` 수정
- [ ] `apps/web/.env.local` 생성
- [ ] `docker-compose up -d api-dev` 실행
- [ ] `curl http://localhost:3001/health` 확인
- [ ] 텐센트 COS Dev 버킷 CORS 설정
- [ ] 로그인 테스트 (admin@wgp-gonggam.com / Admin1234!)
- [ ] 게임 업로드 테스트

### 배포
- [ ] `.env.production` 실제 값 입력
- [ ] Prod COS 버킷 생성 + CORS 설정
- [ ] GitHub 저장소 생성 + Push
- [ ] Lighthouse 서버 Docker 설치
- [ ] 서버 `docker-compose up -d --build`
- [ ] Cloudflare Pages GitHub 연결
- [ ] 도메인 연결 (선택)

---

## 🚨 주의사항

> **`.env.development`, `.env.production`은 절대 GitHub에 올리지 마세요.**  
> `.gitignore`에 아래 내용이 있는지 반드시 확인:
> ```
> .env.development
> .env.production
> apps/web/.env.local
> ```
