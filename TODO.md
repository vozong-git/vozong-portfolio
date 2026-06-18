# TODO — 다음 작업 (이어서 하기)

> 새 세션에서: 이 디렉토리(`sound-portfolio`)에서 Claude Code를 열면 `CLAUDE.md`가 자동 로드됩니다.
> "TODO.md 보고 이어서 하자" 또는 "1순위(썸네일 캐시)부터 하자"라고 하면 됩니다.
> 진행 이력은 `git log --oneline`으로 확인.

마지막 작업일: 2026-06-18 · 프로덕션: <https://vozong-portfolio.onrender.com> (Render, autoDeploy 정상 — `git push`만 하면 ~1분 내 배포) · 운영 프로젝트 ~436개

---

## ✅ 2026-06-18 — 2순위 + 메인터넌스 패스
- **#5 Contact 스팸 보호**·**#3 리스트 성능(슬림 페이로드+N+1 제거)**·**#4 og:image**(resvg 프리빌트, `npm run gen:og`) 완료 — 아래 각 항목 참고.
- **보안: 관리자 게이트 우회 차단** — `express.static` extensions 때문에 `/project-form`·`/contact-form` 맨파일명이 인증 없이 서빙되던 것 차단(게이트에 alias 전부 등록 + robots.txt). 데이터 유출은 없었음(API requireAdmin).
- **백업 하드닝** — `BACKUP_TOKEN` 상수시간 비교(sha256+timingSafeEqual), 실패 시 `ALERT_WEBHOOK`(Slack/Discord) 통지. render.yaml에 `ALERT_WEBHOOK`(sync:false) 추가 — **대시보드에서 채우면 활성화**.
- **의존성: googleapis 144→173** — npm audit 0 vulnerabilities. OAuth·Drive end-to-end 재검증.
- **문구 변경**: "Senior Technical Director" → "Senior Sound Engineer" (정적 HTML·meta·og 이미지). ⚠️ **라이브 contact 헤드라인은 DB 저장값** → 관리자 `Edit Contact` 폼에서 직접 수정 필요(아직 "Technical Director"로 남아있을 수 있음).
- **YouTube watch 직링크 해석** — 검색 결과 페이지의 인라인 플레이어가 임베드 비허용 공연 영상에서 오류 나던 문제. `GET /api/youtube/resolve?projectId=`가 "아티스트 곡명"을 YouTube Data API로 상위 영상에 매칭→watch 직링크 반환. 상세보기 버튼이 "검색"→"보기"로 자동 업그레이드. `yt_cache` 테이블에 영구 캐시(프로젝트당 API 1회). **Render env `YOUTUBE_API_KEY` 설정 완료**, 프로덕션 검증 OK(438/437/431 정확 매칭·캐시 적중). 키 없으면 검색 링크로 폴백. 저장된 `youtube_url`은 임베드+watch 폴백 링크 표시.
- **Live Tune 카테고리 추가** (2026-06-18) — Playback 유지 + Live Tune 신규. nav·Overview·admin 필터·수정폼·`CATEGORIES` 반영. **db `projects.category` CHECK 제약 제거**(FK 안전 테이블 재빌드, 436개 무손실 검증)→ 이후 카테고리 변경은 `routes/projects.js CATEGORIES`만 고치면 됨(DB 마이그레이션 불필요). 죽은 `master`도 함께 정리됨.
- **수정폼 "영상 자동 찾기" 버튼** (2026-06-18) — 아티스트+제목→실제 영상 해석, URL칸 자동 채움+썸네일 확인→저장 시 상세에서 임베드. `/api/youtube/resolve`에 admin 전용 `?q=` 모드 추가, CSP img-src에 `i.ytimg.com`/`img.youtube.com` 허용.
- (보류) 메이저 업글 express5/helmet8/express-rate-limit8/tailwind4, CSP nonce화.

---

## ✅ 1순위 — 완료 (2026-06-17)

### 1. 썸네일 서버 캐시 ✅
- 디스크 캐시 도입: `src/cache.js`(`data/cache/thumbs/{assetId}-{size}.jpg`, Render는 `/var/data/cache/thumbs`).
- `src/drive.js` `getThumbnail()`이 web stream → **Buffer 반환**으로 변경(캐시 저장 가능).
- `src/routes/assets.js` `?thumb=` 분기: 캐시 HIT 시 Drive 호출 생략(`X-Thumb-Cache: HIT/MISS` 헤더), `Cache-Control: max-age=31536000, immutable`. 자산 삭제 시 `cache.delThumb()`로 무효화.
- 검증: 캐시 put/get/del 단위 테스트 통과.

### 2. SQLite 백업 ✅ (자동 cron 가동 중)
- `better-sqlite3` `.backup()` → Drive `portfolio_backup` 폴더 업로드, 14개 초과분 자동 정리.
- `src/routes/backup.js`: `POST /api/backup`(admin **또는** `X-Backup-Token` 헤더) + `runBackup()` 공유 함수. admin 대시보드에 **Backup DB 버튼**.
- **Render Cron Job 등록 완료**: `render.yaml`에 `vozong-portfolio-backup` cron(매일 18:00 UTC=03:00 KST). 디스크 공유 불가라 직접 DB를 안 열고 `scripts/trigger-backup.js`가 web의 `/api/backup`을 HTTP 호출(공유 `BACKUP_TOKEN`, `envVarGroups: backup-secrets`).
- 검증: cron Trigger Run 성공 → Drive에 128KB 실DB 백업 적재 확인(2026-06-17). 이후 매일 자동.

### ✅ 오늘 추가로 완료한 UX/디자인 (2026-06-17)
- **Overview 카테고리 필터**: 상태(ALL/PUBLISHED/DRAFT) + 타입(STUDIO WORK/PLAYBACK/LIVE SOUND) 탭 조합. (`public/admin.html`, 백엔드 `?category=` 기존 지원)
- **제안 Tags**: `GET /api/projects/tags`(최근 distinct 5개). 폼 진입 시 버튼 없이 자동 표시, 칩 클릭으로 추가(반복 가능). (`src/routes/projects.js`, `public/project-form.html`)
- **status 기본값 PUBLISHED**: 신규 등록 시 기본 발행. (수정 모드는 기존 값 유지)
- **파일명 자동 인식**: Media Ingestion에 이미지 추가 시 `yyyy.mm.dd 아티스트 - 곡제목.jpg` 파싱 → 빈 Title/Artist/Date 자동 채움(기존 입력 보존). (`public/project-form.html` `parseFileName`/`autofillFromName`)
- **커버 레터박스 블러 채우기**: 상세 보기 메인 이미지 빈 프레임을 같은 이미지 블러 배경으로 채움(`object-contain` 전경 유지). (`public/index.html` `detailView`)
- **유튜브 검색 버튼**: `youtube_url` 없을 때 `아티스트 곡제목` YouTube 검색을 새 탭으로 여는 버튼. (`public/index.html`)

---

## 🟡 2순위 (다음 세션 후보)

### 3. Overview 지연 로딩 / 페이지네이션 — ⏩ 핵심 비용은 해소 (2026-06-18)
- **리스트 직렬화 슬림화 + N+1 제거**: `GET /api/projects`가 리스트엔 스칼라 필드 + `cover_url`만 반환(전체 `assets` 배열·`description`·`specs` 제외). 커버 id는 **단일 SQL 서브쿼리**로 뽑아 기존 프로젝트당 assets 쿼리(436개면 ~437쿼리)를 1쿼리로 축소. 페이로드도 대폭 감소. 상세는 `/:id`가 계속 전체 반환.
- 검증: 리스트 응답 `assets` 없음·`cover_url` 존재, `/:id` 전체(assets·description) 유지 확인.
- (남은 옵션) Overview가 전 카테고리를 한 화면에 펼치는 구조라 offset 페이지네이션은 UX와 충돌 → 슬림 페이로드로 첫 로딩 비용 대부분 해소돼 보류. 필요 시 카테고리별 "더 보기"(클라 슬라이스) 추가 가능.

### ~~4. og:image (소셜 공유 대표 이미지)~~ ✅ (2026-06-18)
- **프리빌트 래스터화로 생성**: `@resvg/resvg-js`(컴파일 없는 프리빌트)로 Studio Noir 1200×630 PNG → `public/assets/og.png`. 생성기 `scripts/gen-og.js`(`npm run gen:og`), 브랜드 폰트는 `scripts/og-fonts/`에 vendoring(Hanken Grotesk 700/400, JetBrains Mono). 웨이브폼(favicon 4-bar 모티프 확장)+액센트 바+콘솔 그리드 디자인.
- **런타임 무부하**: PNG를 커밋하고 서버는 런타임 래스터화 안 함. resvg는 `optionalDependencies`라 설치 실패해도 배포 안 깨짐(프로덕션은 resvg/폰트 불필요).
- `index.html <head>`에 og:image(절대 URL)·width/height/type/alt·og:url + twitter `summary_large_image` 태그 추가.
- 검증: 로컬에서 `/assets/og.png` 200·image/png, 서빙 HTML에 메타 태그 확인. PNG 렌더 육안 확인.

### ~~5. Contact 이메일 스팸 보호~~ ✅ (2026-06-18)
- 공개 `GET /api/contact`가 email/phone을 **base64로 난독화**해 반환(평문 `@`·숫자 제거 → 이메일 정규식 스크레이퍼 무력화). headline/location은 비민감이라 평문 유지.
- `contact.html`: **클릭하기 전엔 DOM에 평문 없음**("이메일 보기/전화번호 보기" → 클릭 시 디코드·mailto/tel 링크 생성, 재클릭으로 실행).
- 관리자 폼 프리필용 평문은 `GET /api/contact/full`(requireAdmin)로 분리. `contact-form.html`이 이를 사용.
- 검증: 공개 응답에 평문 이메일 없음 / `/full` 무인증 401 확인.

---

## 🟢 낮음 / 보류
- `src/db.js` projects category CHECK에 `'master'` 잔존(무해, 생성은 차단됨) — 정리 시 테이블 재생성 마이그레이션 필요(리스크>가치).
- 오디오 업로드 UI — 저작권상 YouTube 링크 위주라 보류. 활성화하려면 Render env `DRIVE_AUDIO_FOLDER=portfolio_audio` + 폼 음원 미리듣기.
- 모니터링/로깅(에러 추적), 이미지 EXIF 회전 등.

---

## 참고 (운영)
- 배포: `git push` → 자동배포. (수동: Render → Manual Deploy)
- 로컬 실행: `npm start` (prestart가 CSS 빌드). `.env`에 실 자격증명 있음(gitignore).
- 로컬 Node 26이라 `sharp`/네이티브 모듈 빌드 주의 — 썸네일은 `sharp` 없이 Drive thumbnailLink 방식으로 구현됨.
