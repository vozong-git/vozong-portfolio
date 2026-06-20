# Sound Engineer Portfolio

Kim, Bojong 포트폴리오 시스템. 따뜻한 라이트 테마(크림 배경 + 클로드 코랄 액센트). 방문자에게는 공개 포트폴리오를, 본인에게는 Google 로그인 기반 관리자 대시보드를 제공합니다.

- **인증**: Google OAuth 2.0 — `.env`에 등록한 **단일 관리자 계정만** 통과. 그 외 계정은 자동 거부.
- **저장소**: 업로드한 앨범 커버 / 공연 포스터는 **본인 Google Drive의 `portfolio_image` 폴더**에 적재 (오디오 레퍼런스는 `portfolio_audio`).
- **스택**: Node.js + Express + better-sqlite3 (단일 파일 DB, 무설정). Google Drive는 `drive.file` 최소 권한 스코프 사용 — 앱이 만든 파일만 보고 관리합니다.

```
server.js              Express 엔트리 (미들웨어/라우트 결합)
src/
  config.js            환경설정 로더
  db.js                SQLite 스키마 + 토큰 암호화(AES-256-GCM)
  auth.js              OAuth 라우트 · JWT 세션 · 관리자 가드
  drive.js             Drive 폴더 확보/업로드/스트리밍
  cache.js             썸네일 디스크 캐시
  routes/
    projects.js        프로젝트 CRUD · 슬림 리스트 직렬화 · 추천 태그
    upload.js          파일 업로드 → Drive
    assets.js          이미지 프록시 스트리밍(+썸네일 캐시) · 커버 지정 · 삭제
    contact.js         공개(난독화)/관리자(평문) 연락처
    backup.js          SQLite 백업 → Drive (admin 또는 토큰)
    youtube.js         "아티스트 곡명" → 영상 watch 링크 해석(+영구 캐시)
public/                프론트엔드 (index/login/admin/project-form/contact)
```

---

## 1. 사전 준비: Google Cloud OAuth 클라이언트 만들기

> 자격증명은 직접 발급/입력하셔야 합니다. 아래는 절차 안내입니다.

1. [Google Cloud Console](https://console.cloud.google.com) → 프로젝트 생성(또는 선택).
2. **APIs & Services → Library**에서 **Google Drive API** 를 *Enable*.
3. **APIs & Services → OAuth consent screen**
   - User Type: **External**
   - 앱 이름/지원 이메일 입력
   - Scopes에 `.../auth/userinfo.email`, `.../auth/userinfo.profile`, `.../auth/drive.file` 추가
   - **Test users**에 본인 Google 계정(=`ADMIN_EMAIL`) 추가
     (게시(Publish)하지 않고 Testing 상태로 두면 test users만 로그인 가능 — 단일 관리자에 적합)
4. **APIs & Services → Credentials → Create Credentials → OAuth client ID**
   - Application type: **Web application**
   - **Authorized redirect URIs** 에 다음을 정확히 추가:
     ```
     http://localhost:8080/api/auth/google/callback        (로컬)
     https://your-domain.com/api/auth/google/callback      (배포 시)
     ```
   - 생성 후 **Client ID / Client secret** 을 `.env`에 입력.

---

## 2. 환경설정

```bash
cp .env.example .env
```

`.env`에서 최소 다음 값을 채웁니다:

| 변수 | 설명 |
|---|---|
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | 위에서 발급한 OAuth 클라이언트 |
| `ADMIN_EMAIL` | **로그인을 허용할 본인 Google 계정** (이 계정만 관리자) |
| `BASE_URL` | 서버 공개 URL (redirect URI와 일치, 끝 슬래시 없음) |
| `SESSION_SECRET` / `TOKEN_ENC_KEY` | 랜덤 문자열 — 아래 명령으로 생성 |
| `DRIVE_IMAGE_FOLDER` | 기본 `portfolio_image` |

랜덤 시크릿 생성:
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

---

## 3. 설치 및 실행

```bash
npm install
npm start          # → http://localhost:8080  (start 전 prestart가 CSS를 자동 빌드)
# 개발 모드(파일 변경 감지): npm run dev
# CSS만 수동 빌드: npm run build:css   /   감시 빌드: npm run watch:css
```

> CSS는 Tailwind CLI로 로컬 빌드합니다(Play-CDN 제거). 소스는 `src/styles/app.css` +
> `tailwind.config.js`, 산출물은 `public/assets/app.css`(gitignore, `prestart`로 생성).
> 디자인 토큰을 바꾸려면 `tailwind.config.js`를 수정하고 `npm run build:css`를 다시 실행하세요.

1. 브라우저로 `BASE_URL` 접속 → 공개 포트폴리오 표시 (비어 있음).
2. `/login.html` → **Sign in with Google** → 본인 계정으로 인증.
   - 최초 로그인 시 Drive 권한에 동의하면 refresh token이 저장되어 이후 업로드/이미지 서빙에 사용됩니다.
   - `ADMIN_EMAIL` 과 다른 계정은 즉시 거부됩니다.
3. `/admin.html` 대시보드 → **Quick Add** → 프로젝트 등록 + 이미지 업로드.
   - 첫 업로드 이미지가 자동으로 커버가 됩니다 (편집 화면에서 ⭐로 변경 가능).
   - 업로드된 이미지는 본인 Drive `portfolio_image` 폴더에 생성됩니다.
4. 프로젝트 상태를 **PUBLISHED** 로 바꾸면 공개 포트폴리오(`/`)에 노출됩니다.

사이드바 하단의 **Drive linked / not linked** 표시로 연동 상태를 확인할 수 있습니다.

---

## 3.5 배포 (Render)

> ✅ **운영 중**: <https://vozong-portfolio.onrender.com> — Render **Starter + Persistent Disk**(Singapore), GitHub `vozong-git/vozong-portfolio`(main) Blueprint 자동배포.
> 안정성을 위해 `app.listen('0.0.0.0')`(포트 즉시 감지·무중단 재배포), 전역 에러 핸들러, 업로드 디스크 스트리밍(OOM 방지)이 적용돼 있습니다.

SQLite 파일 DB를 쓰므로 **영속 디스크(Persistent Disk)** 가 필요합니다 → Render **Starter(유료)** 플랜.
저장소에 포함된 `render.yaml`(Blueprint)이 web 서비스 + 디스크 + 환경변수를 정의합니다.

1. **Blueprint 연결**: Render Dashboard → **New → Blueprint** → 이 GitHub 저장소 연결 → `render.yaml` 자동 인식.
2. **시크릿 입력** (`sync:false` 항목, Render 대시보드에서):
   - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` — OAuth 클라이언트
   - `ADMIN_EMAIL` — 로그인 허용할 본인 구글 계정
   - (`SESSION_SECRET`·`TOKEN_ENC_KEY`는 Render가 자동 생성·고정. `BASE_URL`은 `RENDER_EXTERNAL_URL`에서 자동 도출 → 입력 불필요)
3. **첫 배포** → 서비스 URL 확인 (예: `https://vozong-portfolio.onrender.com`).
4. **Google Cloud Console → Credentials → OAuth 클라이언트**의 **Authorized redirect URIs**에 운영 URL 추가:
   ```
   https://<your-service>.onrender.com/api/auth/google/callback
   ```
5. 브라우저로 `https://<your-service>.onrender.com/login.html` → **Sign in with Google** → 동의.
   이제 `NODE_ENV=production`이라 쿠키가 `secure`로 발급되며, 디스크 덕분에 재배포해도 로그인·데이터가 유지됩니다.

> ⚠️ `TOKEN_ENC_KEY`를 바꾸면 저장된 Drive refresh token을 복호화할 수 없어 재로그인이 필요합니다.
> ⚠️ 동의화면은 **Testing** 상태 유지(1인 전용). 운영 도메인을 붙이면 redirect URI를 그 도메인으로 추가하세요.

---

## 4. API 레퍼런스

| Method & Path | 권한 | 설명 |
|---|---|---|
| `GET /api/auth/me` | public | 현재 세션 정보 |
| `GET /api/auth/google` | public | OAuth 시작 (Google로 리다이렉트) |
| `GET /api/auth/google/callback` | — | OAuth 콜백 (내부) |
| `POST /api/auth/logout` | public | 세션 종료 |
| `GET /api/projects` | public/admin | 목록(슬림: 스칼라+`cover_url`). 비관리자는 `published`만. 쿼리: `status`, `category`, `q`, `youtube=with\|without`(admin) |
| `GET /api/projects/tags` | **admin** | 최근 추천 태그(distinct) |
| `GET /api/projects/:id` | public/admin | 단건(전체 `assets` 포함) |
| `POST /api/projects` | **admin** | 생성 |
| `PATCH /api/projects/:id` | **admin** | 수정(부분) |
| `DELETE /api/projects/:id` | **admin** | 삭제(연결 Drive 파일도 정리) |
| `POST /api/upload` | **admin** | `multipart/form-data`: `project_id`, `files[]` → Drive 적재 |
| `GET /api/assets/:id/raw` | public | 이미지 프록시 스트리밍(`?thumb=`로 캐시 썸네일) |
| `PATCH /api/assets/:id/cover` | **admin** | 커버 지정 |
| `DELETE /api/assets/:id` | **admin** | 자산 삭제(Drive 포함) |
| `GET /api/contact` | public | 연락처(이메일/전화 base64 난독화) |
| `GET /api/contact/full` | **admin** | 연락처 평문(폼 프리필용) |
| `PUT /api/contact` | **admin** | 연락처 수정 |
| `GET /api/youtube/resolve` | public/admin | `?projectId=`(공개·캐시) / `?q=`(admin) → 영상 watch 링크 |
| `POST /api/backup` | admin 또는 `X-Backup-Token` | SQLite 백업 → Drive |
| `GET /api/health` | public | 상태 + `driveLinked` |

**프로젝트 카테고리**: `studio` · `live` · `playback` · `custom`
**상태**: `draft` · `published`

---

## 5. 보안 / 운영 메모

- 세션은 httpOnly·서명 JWT 쿠키. 프로덕션(`NODE_ENV=production`)에서는 `secure` 플래그가 켜지므로 **HTTPS 필수**.
- Drive refresh token은 SQLite에 **AES-256-GCM 암호화**되어 저장됩니다 (`TOKEN_ENC_KEY`로 파생).
- 업로드 허용 형식: 이미지(PNG/JPG/WEBP/GIF), 오디오(WAV/AIFF/MP3). 그 외 거부. 용량 한도 `MAX_UPLOAD_MB`(기본 100MB).
- Drive 파일은 공개로 만들지 않고 서버가 프록시 스트리밍하므로, 비공개 프로젝트의 자산은 비관리자에게 노출되지 않습니다.
- 리버스 프록시(nginx 등) 뒤에 둘 경우 `app.set('trust proxy', 1)`가 이미 설정되어 있습니다.

### PostgreSQL로 전환하려면
단일 관리자 규모에서는 SQLite로 충분하지만, 다중 인스턴스/대규모가 필요하면 `src/db.js`의 쿼리를 `pg` 또는 Prisma로 교체하면 됩니다. 라우트 계층은 DB 헬퍼만 의존하므로 영향 범위가 좁습니다.

---

## 6. 디자인 시스템

**따뜻한 라이트 테마** — 크림 배경(`#FAF9F5`) + **클로드 코랄 `#C15F3C`** 단일 액센트. 카테고리·태그는 중성 그레이로 통일. 폰트는 Hanken Grotesk(제목) / Inter(본문) / JetBrains Mono(스펙·수치).

디자인 토큰은 `tailwind.config.js`(의미론적 colors)에, 커스텀 효과(inner-glow·glow-bloom·console-grid·toast)는 `src/styles/app.css`에 정의합니다. 토큰 값만 바꾸면 전 페이지가 일괄 전환됩니다. 모든 페이지가 동일 사이드바와 토큰을 공유합니다.
