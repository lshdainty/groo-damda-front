<p align="center">
  <img src="https://img.shields.io/badge/%EA%B7%B8%EB%A3%A8_%EB%8B%B4%EB%8B%A4-61DAFB?style=for-the-badge&logo=react&logoColor=white" alt="그루 담다" />
</p>

<h1 align="center">그루 담다 Frontend</h1>

<p align="center">
  <strong>개인 생산성/라이프 로그 관리를 위한 Desk 프론트엔드</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white" alt="React" />
  <img src="https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white" alt="Vite" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=white" alt="Tailwind CSS" />
</p>

---

## 소개

**그루 담다 Frontend**는 [그루](https://github.com/lshdainty/groo) 서비스의 Desk 프론트엔드입니다.

가계부, 자산, 예산, 통계, 할 일, 캘린더, 메모, 더치페이 등 생산성/자산 관리 기능 UI를 제공합니다.

주요 기능:

- **가계부** — 거래 내역 관리, 반복 거래, 거래 프리셋, 데이터 가져오기/내보내기(CSV·Excel)
- **통계·분석** — 카테고리 / 추이 / 비교
- **예산 관리** — 카테고리별 예산 설정·집행 현황
- **자산·증권** — 자산 관리, 토스 연동 보유 종목 시세 반영(Pro 구독)
- **카드 혜택** — 카드 실적·혜택 관리
- **할 일** — 프로젝트/태그, 완료 시 별자리 수집 게이미피케이션
- **캘린더 · 메모 · 더치페이**
- **다국어(ko/en) · 다크 모드**

> `main` 브랜치 기준으로 개발합니다.

---

## 기술 스택

| Category | Technology |
|----------|------------|
| **Language** | ![TypeScript](https://img.shields.io/badge/TypeScript_5.9-3178C6?style=flat-square&logo=typescript&logoColor=white) |
| **Framework** | ![React](https://img.shields.io/badge/React_19-61DAFB?style=flat-square&logo=react&logoColor=black) |
| **Build Tool** | ![Vite](https://img.shields.io/badge/Vite_8-646CFF?style=flat-square&logo=vite&logoColor=white) |
| **Styling** | ![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS_4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white) |
| **Server State** | ![React Query](https://img.shields.io/badge/React_Query_5-FF4154?style=flat-square&logo=reactquery&logoColor=white) |
| **Routing** | ![React Router](https://img.shields.io/badge/React_Router_7-CA4245?style=flat-square&logo=reactrouter&logoColor=white) |
| **Form** | ![React Hook Form](https://img.shields.io/badge/React_Hook_Form-EC5990?style=flat-square&logo=reacthookform&logoColor=white) ![Zod](https://img.shields.io/badge/Zod_4-3E67B1?style=flat-square&logo=zod&logoColor=white) |
| **UI Primitives** | ![Radix UI](https://img.shields.io/badge/Radix_UI-161618?style=flat-square&logo=radixui&logoColor=white) ![Lucide](https://img.shields.io/badge/Lucide-F56565?style=flat-square) |
| **Chart** | ![Recharts](https://img.shields.io/badge/Recharts_3-22B5BF?style=flat-square) ![Lightweight Charts](https://img.shields.io/badge/Lightweight_Charts_5-2962FF?style=flat-square) |
| **Editor** | ![Tiptap](https://img.shields.io/badge/Tiptap_3-000000?style=flat-square) |
| **DnD** | ![dnd-kit](https://img.shields.io/badge/dnd--kit-EF4444?style=flat-square) |
| **HTTP Client** | ![Axios](https://img.shields.io/badge/Axios-5A29E4?style=flat-square&logo=axios&logoColor=white) |
| **i18n** | ![i18next](https://img.shields.io/badge/i18next-26A69A?style=flat-square&logo=i18next&logoColor=white) |

---

## 프로젝트 구조

```text
src/
├── app/                 # 앱 초기화, 라우터, Provider
├── entities/            # 도메인 엔티티 API/모델
├── features/            # 기능 단위 모듈 (expense, todo, stock, import/export 등)
├── pages/               # 라우트 페이지
├── shared/              # 공용 API/설정/훅/UI(디자인 시스템 컴포넌트)/유틸
├── widgets/             # 화면 조합 위젯 (layout, sidebar, calendar-view 등)
├── locales/             # 다국어 리소스 (ko, en) — i18n:generate 산출물 (gitignore)
├── main.tsx             # 엔트리포인트
└── index.css            # 전역 스타일
```

---

## 시작하기

### 요구사항

- **Node.js**: 20.19+ (또는 22.12+)
- **npm** (또는 yarn, pnpm)

### 설치 및 실행

```bash
# 의존성 설치
npm install

# 개발 서버 실행 (predev 훅으로 i18n:generate 자동 실행)
npm run dev

# 프로덕션 빌드 (타입 체크 포함) — 배포·CI 와 같은 명령
npm run build

# 빌드된 앱 프리뷰
npm run preview

# 린트 검사
npm run lint

# 다국어 파일 생성
npm run i18n:generate
```

기본 포트: `3002`

### 환경 변수

```bash
# .env (.env.example 참고)
VITE_BASE_URL="http://localhost:8002"   # 백엔드 API 서버 origin
VITE_API_URL="/api"                     # API 경로 prefix
VITE_SSO_URL="http://localhost:3000"    # SSO 프론트 base URL (OAuth2 Authorization Code + PKCE)
```

앱은 `VITE_BASE_URL + VITE_API_URL` 조합으로 API 주소를 구성합니다.

### 다국어(i18n)

- `i18n/translations.csv`가 번역의 **단일 마스터**입니다.
- `src/locales/*.json`(ko/en)은 `npm run i18n:generate` 산출물이며 gitignore 대상입니다 — JSON을 직접 수정하지 말고 CSV 수정 후 generate 하세요.
- `dev`/`build` 실행 시 pre 훅으로 자동 생성됩니다.

---

## 주요 화면

- `dashboard` — 대시보드 (위젯 그리드)
- `expense` — 가계부
- `stats` — 통계·분석 (카테고리/추이/비교)
- `budget` — 예산
- `asset` — 자산
- `stocks` — 증권 (토스 연동, Pro)
- `card-benefit` — 카드 혜택
- `calendar` — 캘린더
- `todo` — 할 일 (별자리 수집)
- `memo` — 메모
- `dutch-pay` — 더치페이
- `search` — 통합 검색
- `notifications` — 알림
- `settings` — 설정
- `more` — 더보기
- `login` / `auth-callback` — SSO 로그인 (OAuth2 + PKCE)

---

## 관련 저장소

| Repository | Description |
|------------|-------------|
| [그루](https://github.com/lshdainty/groo) | 통합 레포지토리 (서비스 소개) |
| [porest-desk-back](https://github.com/lshdainty/groo-damda-back) | Desk 백엔드 |
| [porest-desk-app](https://github.com/lshdainty/groo-damda-app) | Desk 모바일 앱 (Flutter) |
| [groo-core](https://github.com/lshdainty/groo-core) | 공통 라이브러리 |
| [porest-sso-back](https://github.com/lshdainty/groo-sso-back) | SSO 백엔드 |
| [porest-sso-front](https://github.com/lshdainty/groo-sso-front) | SSO 프론트엔드 |

---

<p align="center">
  Made with ❤️ by <a href="https://github.com/lshdainty">lshdainty</a>
</p>
