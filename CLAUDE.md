# CLAUDE.md

사운드 엔지니어 포트폴리오 — Studio Noir 테마. Node.js/Express 백엔드 + 정적 프론트엔드. 관리자 1인 전용.

## 명령어

```bash
npm install            # 의존성 설치
cp .env.example .env   # 최초 1회, 이후 값 채우기 (§환경변수)
npm start              # 서버 실행 (기본 PORT=3000)
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
| `BASE_URL` | 기본 `http://localhost:3000`. OAuth redirect 계산에 사용 |
| `DRIVE_IMAGE_FOLDER` | 기본 `portfolio_image` |
| `DRIVE_AUDIO_FOLDER` | 기본 `portfolio_audio` |
| `MAX_UPLOAD_MB` | 기본 500 |
| `DB_PATH` | SQLite 파일 경로 |

Google Cloud 셋업(OAuth 클라이언트 생성 / Drive API 활성화 / 동의화면 테스트 사용자에 본인 계정 추가 / redirect URI `${BASE_URL}/api/auth/google/callback`)은 README.md 참고.

## 아키텍처

```
server.js          진입점. helmet CSP, rate limit, 라우트 마운트, 정적 서빙.
src/
  config.js        설정 로더, assertGoogleConfigured
  db.js            better-sqlite3. 스키마(projects/assets/timeline/admin_state) + AES-256-GCM enc/dec
  auth.js          /me /google /google/callback /logout. JWT 발급/검증. requireAdmin 미들웨어
  drive.js         oauthClient, ensureFolder(image|audio), uploadBuffer, getFileStream, deleteFile
  routes/
    projects.js    CRUD + 직렬화(cover_url, assets). 방문자=published만 / 관리자=status·category·q 필터
    upload.js      POST /api/upload → Drive. 첫 이미지 자동 커버. drive 미연결 시 409
    assets.js      raw 스트림 프록시, PATCH /:id/cover, DELETE /:id
    timeline.js    Live Sound 타임라인 CRUD
public/            정적 프론트(빌드 스텝 없음, Tailwind Play-CDN)
  index.html       공개 포트폴리오
  login.html       구글 로그인
  admin.html       대시보드(관리 테이블, publish 토글, 필터, drive 연결 상태)
  project-form.html 등록/수정 (?id= 수정모드)
  contact.html
  assets/{theme.js, base.css, common.js}
```

### 데이터 흐름 핵심
- **인증**: 로그인 OAuth 콜백에서 `email === ADMIN_EMAIL` 아니면 거부 → `/login.html?error=not_authorized`. 세션은 httpOnly 서명 JWT 쿠키(30일).
- **드라이브**: 로그인 토큰을 그대로 재사용(별도 서비스 계정 없음). 스코프 최소권한 `drive.file`. refresh token은 SQLite에 암호화 저장. 최초 로그인(consent) 후에야 드라이브 연결됨.
- **이미지**: 공개로 풀지 않음. 백엔드가 `/api/assets/:id/raw`로 프록시 스트리밍 → 비공개 유지 + 미발행 프로젝트 이미지 차단.

## 코딩 컨벤션 / 주의

- **server.js 라우트 순서 절대 주의**: admin 게이팅 미들웨어가 `express.static` **앞**에 와야 함. 뒤로 가면 `admin.html`이 정적 파일로 그냥 서빙되어 인증 우회됨. (과거 이 버그 한 번 잡음 — 리팩터 시 깨지 말 것)
- `drive.js`는 refresh token 없으면 `DRIVE_NOT_LINKED` throw → upload 라우트가 409 `drive_not_linked`로 변환.
- 업로드는 multer 2.x, 메모리 스토리지, image/audio MIME 화이트리스트.
- 이미지 안 보이면 대개 raw 프록시 또는 드라이브 미연결 문제. 공개 URL 아님을 기억.
- 비밀값(`.env`)·`node_modules`·`data/*.db`는 커밋/패키지 제외.

## 디자인 토큰 (Studio Noir)

- 액센트 Electric Blue `#00daf3`, 다크 슬레이트 팔레트
- 폰트: Hanken Grotesk(제목) / Inter(본문) / JetBrains Mono(스펙·수치)
- 무드: K-스타일 랙마운트 콘솔(console-grid, inner-glow)
- 토큰은 `public/assets/theme.js`(Tailwind config) + `base.css`에 정의

## 검증 상태

더미 자격증명으로 부팅해 확인 완료: health, published 필터(draft 숨김), 비인증 401, `/admin` 302, OAuth 리다이렉트(스코프·offline·consent·redirect_uri), 관리자 JWT로 생성/날짜검증400/업로드409/MIME400.

**미검증(실 자격증명 필요)**: 실제 OAuth 토큰 교환, 실제 드라이브 업로드.

## TODO (우선순위)

1. **Tailwind Play-CDN → 빌드 스텝 전환** (PostCSS/CLI). 프로덕션 비권장이라 1순위.
2. 실제 OAuth 클라이언트로 토큰 교환 + 드라이브 업로드 실동작 확인.
3. 오디오 업로드(`portfolio_audio`) 프론트 UI 마무리 — 백엔드는 이미 지원.
4. 배포(HTTPS, 실 도메인으로 `BASE_URL`·redirect URI 갱신).
5. (선택) 이미지 썸네일 생성으로 raw 프록시 대역폭 절감, 정렬·페이지네이션, SEO 메타.
