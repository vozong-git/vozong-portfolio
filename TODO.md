# TODO — 다음 작업 (이어서 하기)

> 새 세션에서: 이 디렉토리(`sound-portfolio`)에서 Claude Code를 열면 `CLAUDE.md`가 자동 로드됩니다.
> "TODO.md 보고 이어서 하자" 또는 "1순위(썸네일 캐시)부터 하자"라고 하면 됩니다.
> 진행 이력은 `git log --oneline`으로 확인.

마지막 작업일: 2026-06-16 · 프로덕션: <https://vozong-portfolio.onrender.com> (Render, autoDeploy 정상 — `git push`만 하면 ~1분 내 배포)

---

## ✅ 1순위 — 완료 (2026-06-17)

### 1. 썸네일 서버 캐시 ✅
- 디스크 캐시 도입: `src/cache.js`(`data/cache/thumbs/{assetId}-{size}.jpg`, Render는 `/var/data/cache/thumbs`).
- `src/drive.js` `getThumbnail()`이 web stream → **Buffer 반환**으로 변경(캐시 저장 가능).
- `src/routes/assets.js` `?thumb=` 분기: 캐시 HIT 시 Drive 호출 생략(`X-Thumb-Cache: HIT/MISS` 헤더), `Cache-Control: max-age=31536000, immutable`. 자산 삭제 시 `cache.delThumb()`로 무효화.
- 검증: 캐시 put/get/del 단위 테스트 통과.

### 2. SQLite 백업 ✅
- `better-sqlite3` `.backup()` → Drive `portfolio_backup` 폴더 업로드, 14개 초과분 자동 정리.
- `src/routes/backup.js`: `POST /api/backup`(admin) + `runBackup()` 공유 함수. admin 대시보드에 **Backup DB 버튼** 추가.
- `scripts/backup.js`: cron용 standalone 러너(`node scripts/backup.js`).
- 검증: 로컬에서 실 Drive로 업로드 end-to-end 성공(fileId 반환).
- **남은 운영 작업**: Render Cron Job 등록(`node scripts/backup.js`, 예: 매일 1회) — 같은 env/디스크 공유 필요.

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
