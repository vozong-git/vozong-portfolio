# TODO — 다음 작업 (이어서 하기)

> 새 세션에서: 이 디렉토리(`sound-portfolio`)에서 Claude Code를 열면 `CLAUDE.md`가 자동 로드됩니다.
> "TODO.md 보고 이어서 하자" 또는 "1순위(썸네일 캐시)부터 하자"라고 하면 됩니다.
> 진행 이력은 `git log --oneline`으로 확인.

마지막 작업일: 2026-06-16 · 프로덕션: <https://vozong-portfolio.onrender.com> (Render, autoDeploy 정상 — `git push`만 하면 ~1분 내 배포)

---

## 🔴 1순위 (데이터가 쌓인 지금 가장 가치 큼)

### 1. 썸네일 서버 캐시
- **문제**: 썸네일 응답이 `cf-cache-status: DYNAMIC`(CDN 캐시 안 됨) → 카드 1개당 Drive API를 매번 호출. 방문자 늘면 Drive 할당량·지연 위험.
- **위치**: `src/drive.js` `getThumbnail()`, `src/routes/assets.js` `?thumb=` 분기.
- **방향**: 썸네일 바이트를 서버에 캐시(메모리 LRU 또는 디스크 `/var/data/cache/{assetId}-{size}`). 캐시 히트 시 Drive 호출 생략. `getAccessToken()`도 캐시 가능(googleapis가 일부 자동).

### 2. SQLite 백업
- **문제**: 실데이터 136개가 Render 디스크의 단일 파일(`/var/data/portfolio.db`)뿐. 디스크 사고 시 전손.
- **방향**: 주기 백업을 Drive(`portfolio_backup` 폴더)에 업로드하는 엔드포인트/스크립트 + Render Cron Job. 또는 `better-sqlite3` `.backup()` → Drive 업로드. 최소 수동 백업 라우트(admin)라도.

---

## 🟡 2순위

### 3. Overview 지연 로딩 / 페이지네이션
- 136개를 한 번에 받아 렌더(현재 lazy-loading으로 완화). 더 늘면 첫 로딩 부담.
- **위치**: `public/index.html` `load()`, `src/routes/projects.js` GET. 카테고리별 "더 보기" 또는 `?limit/offset`.

### 4. og:image (소셜 공유 대표 이미지)
- 현재 og 텍스트 메타만 있음(title/description). 1200×630 PNG 자산 필요(디자인 또는 동적 생성).
- **위치**: `public/index.html` `<head>`.

### 5. Contact 이메일 스팸 보호
- 공개 `contact.html`에 이메일 노출 → 봇 수집. JS 난독화 또는 클릭 시 표시.
- **위치**: `public/contact.html`.

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
