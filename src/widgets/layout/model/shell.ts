/**
 * 내비게이션 틀의 임시 선택 — **한 곳**에 모아 둔다(디자인 세션에 Q-017 로 물어 둔 자리).
 * 답이 오면 이 파일만 고친다. 틀 컴포넌트(AppLayout · MobileHeader · AppTabBar · DesktopHeader · DesktopSidebar)는
 * 여기 값을 읽을 뿐 경로 · 순서를 따로 들지 않는다.
 *
 *  1. 가계부 묶음 — 경로는 그대로(/desk/expense · asset · stats · budget). 탭 바에는 넷 모두 "가계부" 가 현재,
 *     화면 위에 Line Tabs 넷(MONEY_TABS). 옛 money 모드(← 가 낀 탭 바)는 없다.
 *  2. root 머리 오른쪽 — 홈 = 검색 + 알림, 가계부 · 캘린더 · 전체 = 검색(rootActionsFor).
 *  3. 데스크톱 머리 — 검색칸 · 테마 토글 · 금액 가리기 눈을 걷고 왼쪽을 비운다. 오른쪽은 "내역 추가" 주 버튼 + 알림 · 설정
 *     (DesktopHeader — 알림은 1280 이상 Popover · 미만 Bottom Sheet, 테마는 설정 > 표시 설정).
 *  4. 증권 부모 — 연결 증권사가 둘 이상이면 펼치기 전용(하위 = 증권사), 아니면 /desk/stocks 링크. 구독이 없으면 숨김(DesktopSidebar).
 *  5. 틀 경계는 768(탭 바 ↔ 사이드바)과 1280(사이드바 펼침 ↔ 접힘 — Side Navigation 이 스스로 정한다). 홈 2단(HomeDesktop 격자)의 문턱도 1280 이다(17-6 A). 그 밖 화면의 1100 분기는 그대로.
 */
import { ChartPie, FilePen, ReceiptText, Wallet } from "lucide-react";
import type { ComponentType } from "react";

import { NAV } from "./nav";

/** 가계부 묶음 — 위 Line Tabs 의 칸(순서 = 화면 순서). labelKey 는 layout ns */
export const MONEY_TABS: {
  path: string;
  labelKey: string;
  icon: ComponentType;
}[] = [
  { path: "/desk/expense", labelKey: "expense", icon: ReceiptText },
  { path: "/desk/asset", labelKey: "asset", icon: Wallet },
  { path: "/desk/stats", labelKey: "stats", icon: ChartPie },
  { path: "/desk/budget", labelKey: "budget", icon: FilePen },
];
export const MONEY_PATHS = MONEY_TABS.map((t) => t.path);

/** 모바일 풀스크린 — 전역 머리 · 탭 바 없이 화면이 자기 ← 머리를 그린다(다음 PR 에서 TopNavigation 으로) */
export const FULLSCREEN_PATHS = [
  "/desk/memo",
  "/desk/todo",
  "/desk/dutch-pay",
  "/desk/card-benefit",
  "/desk/stocks",
  "/desk/settings",
  "/desk/notifications",
];

const under = (pathname: string, path: string) =>
  pathname === path || pathname.startsWith(`${path}/`);

/**
 * 자산 상세 페이지 주소(`/desk/asset/:assetId`, I-17 34) — 가계부 묶음(위 Line Tabs · 머리 제목 "가계부")이 아니다.
 * 폰은 셸 머리 · 탭 바 없이 페이지가 제 상단 바를 그리고(풀스크린), 바탕은 흰 면 하나(white)다. `/desk/asset` 자체는 그대로 묶음이다.
 */
export const isAssetDetailPath = (pathname: string) =>
  /^\/desk\/asset\/[^/]+\/?$/.test(pathname);

export const isMoneyPath = (pathname: string) =>
  !isAssetDetailPath(pathname) && MONEY_PATHS.some((p) => under(pathname, p));
export const isFullscreenPath = (pathname: string) =>
  isAssetDetailPath(pathname) ||
  FULLSCREEN_PATHS.some((p) => under(pathname, p));

/**
 * 폰 화면 바탕 종류(02-005 C · layout "화면 바탕") — 바닥은 늘 basement 이고 그 위에 놓는 것이 갈린다.
 *  bands = 구역마다 화면 폭 흰 띠, 띠 사이 8 만(시작 · 끝 틈 없음 — I-05 74) — 화면이 ScreenBands 로 직접 그린다(홈 · 자산 · 통계 · 예산,
 *          2026-10-21 I-01 결정 3 — 폰에는 카드 화면이 없다. 데스크톱은 같은 구역을 카드로)
 *  strip = 머리 바로 아래 화면 폭 흰 띠(검색 …) — 셸이 띠 하나를 깐다
 *  white = 화면 전체가 흰 층(가계부 거래 목록 · 캘린더 · 전체)
 */
export type ScreenFloor = "bands" | "strip" | "white";
export function screenFloor(pathname: string): ScreenFloor {
  // 자산 상세는 흰 면 하나(I-17 4-A) — 아래 `/desk/asset` 띠 판정보다 먼저 가른다
  if (isAssetDetailPath(pathname)) return "white";
  if (
    pathname === "/desk" ||
    under(pathname, "/desk/asset") ||
    under(pathname, "/desk/stats") ||
    under(pathname, "/desk/budget") ||
    // 증권도 띠 화면이다 — 내 투자 · 시장 · 종목 띠(I-13 5, 폰 풀스크린)
    under(pathname, "/desk/stocks")
  )
    return "bands";
  // 가계부 거래 · 전체는 화면 전체가 흰 층(I-12 2-B — 전체는 흰 면 하나). 캘린더도 같다 — 폰 달력은 "흰 면 하나"(I-09 1-A)라
  // 격자 아래부터 탭 바 뒤까지 흰 면이 이어진다(앱과 같게, 사용자 10-29 — 예전엔 strip 이라 격자 아래가 회색 바닥으로 끊겼다)
  if (
    under(pathname, "/desk/expense") ||
    under(pathname, "/desk/calendar") ||
    pathname === "/desk/more"
  )
    return "white";
  return "strip";
}

/** 탭 바의 칸 — 가계부는 묶음 넷이 모두 "현재" */
export const isHomeTab = (pathname: string) => pathname === "/desk";
export const isExpenseTab = isMoneyPath;
export const isCalendarTab = (pathname: string) =>
  under(pathname, "/desk/calendar");
export const isAllTab = (pathname: string) => under(pathname, "/desk/more");

export type RootAction = "search" | "notifications";
/** root 머리 오른쪽 — 홈 = 검색 + 알림, 그 밖 = 검색 */
export const rootActionsFor = (pathname: string): RootAction[] =>
  pathname === "/desk" ? ["search", "notifications"] : ["search"];

// 화면 제목 — layout ns 키. 문서 제목("{제목} - 그루 담다") · root 머리 제목이 함께 쓴다
const TITLE_KEYS: Record<string, string> = {
  "/desk": "home",
  "/desk/calendar": "calendar",
  "/desk/more": "all",
  "/desk/search": "search",
  "/desk/settings": "settings",
  "/desk/notifications": "notifications",
  // 할 일 아래 깊은 화면 — 사이드바 지금 항목은 "할 일" 그대로(under), 문서 제목만 화면 이름이다(I-11 3)
  "/desk/todo/night-sky": "nightSky",
  "/desk/todo/night-sky/report": "forestReport",
};

export function screenTitleKey(pathname: string): string {
  // 자산 상세 — 사이드바 지금 항목은 "자산" 그대로(under), 문서 제목만 "자산 상세"(I-17 34)
  if (isAssetDetailPath(pathname)) return "assetDetail";
  // 가계부 묶음 넷은 머리 제목이 모두 "가계부" — 칸 이름은 위 Line Tabs 가 말한다(17-1)
  if (isMoneyPath(pathname)) return "expense";
  if (TITLE_KEYS[pathname]) return TITLE_KEYS[pathname];
  // 증권 아래 페이지 — 포트폴리오 구성(정적 주소가 먼저) · 종목 상세(I-13 17). 사이드바 지금 항목은 그대로 "증권"
  if (/^\/desk\/stocks\/[^/]+\/portfolio$/.test(pathname))
    return "stockPortfolio";
  if (/^\/desk\/stocks\/[^/]+\/[^/]+$/.test(pathname)) return "stockDetail";
  const nav = NAV.find((n) => n.path !== "/desk" && under(pathname, n.path));
  return nav?.labelKey ?? "home";
}

/** `+` 가 여는 것과 이름 — 캘린더만 일정, 나머지는 거래(fab.ts) */
export { fabFor } from "./fab";
