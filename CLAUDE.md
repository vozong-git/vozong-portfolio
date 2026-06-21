# CLAUDE.md

사운드 엔지니어 포트폴리오 — 따뜻한 라이트 테마(크림 배경 + 클로드 코랄 액센트). Node.js/Express 백엔드 + 정적 프론트엔드. 관리자 1인 전용.

## 명령어

```bash
npm install            # 의존성 설치
cp .env.example .env   # 최초 1회, 이후 값 채우기 (§환경변수)
npm run build:css      # Tailwind CSS 빌드 → public/assets/app.css (watch: npm run watch:css)
npm start              # 서버 실행 (기본 PORT=8080, prestart가 CSS 자동 빌드)
node --check server.js # 문법 체크
```

테스트 러너·린터는 아직 없음. 변경 후에는 서버를 띄워 `curl`로 스모크 확인하는 방식.

## 환경변수 (.env)

| 키 | 설명 |
|---|---|
| `ADMIN_EMAIL` | **본인 구글 이메일**. 이 계정만 로그인 허용 |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google Cloud OAuth 클라이언트 |
| `SESSION_SECRET` | JWT 서명 키 (랜덤) |
| `TOKEN_ENC_KEY` | drive refresh token AES-256-GCM 암호화 키 파생용 (랜덤) |
| `BASE_URL` | 기본 `http://localhost:8080`. OAuth redirect 계산에 사용 |
| `DRIVE_IMAGE_FOLDER` | 기본 `portfolio_image` |
| `DRIVE_AUDIO_FOLDER` | 기본 `portfolio_audio` |
| `MAX_UPLOAD_MB` | 기본 100 |
| `YOUTUBE_API_KEY` | (선택) YouTube Data API v3 키. 상세페이지 "아티스트 곡명"→실제 영상 watch 링크 해석용. 없으면 검색 링크 폴백 |
| `SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET` | (현재 미사용·예약) Spotify 자동찾기는 앱 소유자 Premium 필요 제약으로 제거됨. spotify_url 컬럼·임베드·검증은 유지(수동 입력/추후 재도입용) |
| `BACKUP_TOKEN` / `ALERT_WEBHOOK` | cron 백업 트리거 공유 토큰 / (선택) 백업 실패 알림 Slack·Discord 웹훅 |
| `DB_PATH` | SQLite 파일 경로 |

Google Cloud 셋업(OAuth 클라이언트 생성 / Drive API 활성화 / 동의화면 테스트 사용자에 본인 계정 추가 / redirect URI `${BASE_URL}/api/auth/google/callback`)은 README.md 참고.

## 아키텍처

```
server.js          진입점. helmet CSP, rate limit, 라우트 마운트, 정적 서빙.
src/
  config.js        설정 로더, assertGoogleConfigured
  db.js            better-sqlite3. 스키마(projects/assets/contact/admin_state/yt_cache) + AES-256-GCM enc/dec + 마이그레이션(category CHECK 제거 등)
  auth.js          /me /google /google/callback /logout. JWT 발급/검증. requireAdmin 미들웨어
  drive.js         oauthClient, ensureFolder(image|audio), uploadFile, getFileStream, getThumbnail(Buffer), uploadBackup, deleteFile
  cache.js         썸네일 디스크 캐시(data/cache/thumbs, Render: /var/data/cache/thumbs). get/put/delThumb
  routes/
    projects.js    CRUD + 슬림 리스트 직렬화(스칼라+cover_url, N+1 제거) / 상세=전체(assets). 방문자=published만 / 관리자=status·category·q
    upload.js      POST /api/upload → Drive. 첫 이미지 자동 커버. drive 미연결 시 409
    assets.js      raw 스트림 프록시(+?thumb= 디스크 캐시: 120/160/200/320/400/640/800), PATCH /:id/cover, DELETE /:id
    contact.js     공개 GET(이메일/전화 base64 난독화) + 관리자 GET /full(평문) + PUT
    backup.js      POST /api/backup(admin 또는 X-Backup-Token, 상수시간 비교) → SQLite .backup() → Drive portfolio_backup
    youtube.js     GET /api/youtube/resolve — projectId(공개=캐시 온리, API 호출 안 함) / q=(관리자=API 검색). "아티스트 곡명"→영상 id. yt_cache: 양수 영구 캐시, 빈 결과(매칭 실패)는 7일 TTL 후 재해석. search.list=100 units(일 10k 한도)라 공개 경로는 할당량 미소비
    theme.js       GET /api/theme(공개: 현재+목록) / PUT(admin: 프리셋 변경). 별도로 server.js가 `/theme.js`(head 동기 로더)를 admin_state.theme에서 서빙
    releases.js    GET /api/releases/resolve?q=(admin) — "아티스트 제목"→Apple Music(iTunes Search, 키 불필요) 링크. 폼 자동찾기 전용. 공개 상세는 저장된 projects.apple_url/spotify_url을 임베드(API 호출 없음). CSP frame-src에 open.spotify.com·embed.music.apple.com 허용. (Spotify 자동찾기는 Premium 제약으로 제거)
scripts/
  backup.js        cron용 standalone 백업 러너
  trigger-backup.js Render cron이 web /api/backup을 HTTP 트리거(디스크 공유 불가). 실패 시 ALERT_WEBHOOK
  gen-og.js        og:image 생성(@resvg/resvg-js, og-fonts/ vendoring). npm run gen:og → public/assets/og.png
public/            정적 프론트(Tailwind CLI 빌드, Play-CDN 제거)
  index.html       공개 포트폴리오 (?project=<id> 딥링크로 상세 직접 열기)
  login.html       구글 로그인
  admin.html       대시보드(관리 테이블, publish 토글, 필터 sessionStorage 유지, 제목→상세 미리보기, 태그·유튜브(빨강)·애플뮤직(핑크) 아이콘, 통계 스트립). 미디어 필터=단일버튼 3상태 토글(ALL→있음→없음): YouTube `?youtube=with|without`, Apple `?apple=with|without`
  project-form.html 등록/수정 (?id= 수정모드). Save/Save&Next/Discard/Discard&Next, 날짜 자동포맷, YouTube 자동찾기, 데스크탑 sticky 액션패널
  contact.html / contact-form.html
  assets/{app.css(빌드 산출물·gitignore), common.js}
tailwind.config.js 디자인 토큰(라이트 팔레트) + content scan
src/styles/app.css Tailwind 입력(@tailwind + 커스텀 CSS: inner-glow/glow-bloom/console-grid/toast)
```

### 데이터 흐름 핵심
- **인증**: 로그인 OAuth 콜백에서 `email === ADMIN_EMAIL` 아니면 거부 → `/login.html?error=not_authorized`. 세션은 httpOnly 서명 JWT 쿠키(30일).
- **드라이브**: 로그인 토큰을 그대로 재사용(별도 서비스 계정 없음). 스코프 최소권한 `drive.file`. refresh token은 SQLite에 암호화 저장. 최초 로그인(consent) 후에야 드라이브 연결됨.
- **이미지**: 공개로 풀지 않음. 백엔드가 `/api/assets/:id/raw`로 프록시 스트리밍 → 비공개 유지 + 미발행 프로젝트 이미지 차단.

## 코딩 컨벤션 / 주의

- **server.js 라우트 순서 절대 주의**: admin 게이팅 미들웨어가 `express.static` **앞**에 와야 함. 뒤로 가면 `admin.html`이 정적 파일로 그냥 서빙되어 인증 우회됨. (과거 이 버그 한 번 잡음 — 리팩터 시 깨지 말 것)
- `drive.js`는 refresh token 없으면 `DRIVE_NOT_LINKED` throw → upload 라우트가 409 `drive_not_linked`로 변환.
- 업로드는 multer 2.x, **디스크 스토리지**(`os.tmpdir()`, 요청 후 임시파일 정리), image/audio MIME 화이트리스트. `drive.uploadFile`이 `fs.createReadStream`으로 **스트리밍 업로드**(메모리 OOM 방지 — 과거 memoryStorage였음).
- 이미지 안 보이면 대개 raw 프록시 또는 드라이브 미연결 문제. 공개 URL 아님을 기억.
- 비밀값(`.env`)·`node_modules`·`data/*.db`는 커밋/패키지 제외.

## 디자인 토큰 (따뜻한 라이트)

- 배경 크림 `#FAF9F5`(완전 흰색 아님), 본문 `#2A2824`/보조 `#6B6862`, 카드 `#FCFBF8`
- 액센트 **클로드 코랄 `#C15F3C`** (링크·활성·기본 버튼). 카테고리·태그는 중성 그레이로 통일(코랄이 유일 액센트)
- 폰트: Hanken Grotesk(제목) / Inter(본문) / JetBrains Mono(스펙·수치)
- **테마 토큰 = CSS 변수**: `src/styles/app.css`의 `:root`에 `--color-*`(R G B 채널, opacity `/n` 지원)로 정의, `tailwind.config.js`는 `rgb(var(--color-x) / <alpha>)`로 이름만 연결. 의미론적 토큰이라 값만 바꾸면 전 페이지 일괄 전환
- **다크모드**: `@media (prefers-color-scheme: dark)`로 OS 설정 자동 추종(수동 토글 없음). 서피스/텍스트는 라이트·다크 각각 공유, accent(primary*)만 프리셋별로 교체
- **테마 프리셋 4종**(accent): `ember`(코랄·기본)·`sage`·`dusk`·`plum`. `admin_state.theme`에 사이트 전역 저장 → `/theme.js`(각 페이지 `<head>`에서 동기 로드, FOUC 방지)가 `<html data-theme>` 설정. 어드민 사이드바 THEME 스와치로 변경(`PUT /api/theme`), 목록·검증은 `src/routes/theme.js`
- favicon(`public/favicon.svg`)·og(`public/assets/og.png`)도 코랄 톤

## 검증 상태

더미 자격증명으로 부팅해 확인 완료: health, published 필터(draft 숨김), 비인증 401, `/admin` 302, OAuth 리다이렉트(스코프·offline·consent·redirect_uri), 관리자 JWT로 생성/날짜검증400/업로드409/MIME400.

**검증 완료(실 자격증명, 2026-06-16)**: 실제 OAuth 토큰 교환·refresh token 암호화 저장(`driveLinked:true`), 이미지 업로드→Drive 적재→raw 프록시 스트리밍→삭제 end-to-end. (Safari는 localhost를 https로 강제 업그레이드하니 로그인은 Chrome/Firefox 권장.)

**프로덕션 검증(2026-06-16)**: Render 운영 URL에서 OAuth 로그인·`driveLinked:true`·가용성 안정(무중단 재배포, `x-render-routing: no-server` 해소) 확인. 디스크 스트리밍 업로드는 로컬 실 Drive로 end-to-end 검증.

## TODO (우선순위)

> 📌 **다음 작업 상세·우선순위는 [TODO.md](TODO.md) 참고** (1순위: 썸네일 서버 캐시 + SQLite 백업).

1. ~~Tailwind Play-CDN → 빌드 스텝 전환~~ ✅ 완료 (Tailwind CLI v3, `npm run build:css`, prestart 자동 빌드).
2. ~~실제 OAuth 클라이언트로 토큰 교환 + 드라이브 업로드 실동작 확인.~~ ✅ 완료 (2026-06-16, end-to-end 검증).
3. 오디오 업로드(`portfolio_audio`) 프론트 UI 마무리 — 백엔드는 이미 지원.
4. ~~배포~~ ✅ 완료 (2026-06-16). **Render Starter+Disk(Singapore)** 운영: **https://vozong-portfolio.onrender.com** (GitHub: vozong-git/vozong-portfolio, main 브랜치, Blueprint 자동배포). `config.js`가 `RENDER_EXTERNAL_URL`→`BASE_URL` 자동 도출, `.node-version`=22. **안정화**: `app.listen('0.0.0.0')`로 포트 즉시 감지(무중단 재배포), 전역 에러 핸들러, 업로드 디스크 스트리밍(OOM 방지), `MAX_UPLOAD_MB`=100. ⚠️ Render 서비스 slug(=URL)는 생성 후 불변 — 바꾸려면 서비스 재생성 필요.
5. (선택) 이미지 썸네일 생성으로 raw 프록시 대역폭 절감, 정렬·페이지네이션, SEO 메타.
