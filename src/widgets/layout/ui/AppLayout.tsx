import { LeaveGuardProvider } from "@/shared/ui/groo/leave-guard";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Outlet, useLocation, useNavigationType } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { cn } from "@/shared/lib/utils";
import { BOTTOM_NAVIGATION_INSET } from "@/shared/ds/bottom-navigation";
import { TooltipProvider } from "@/shared/ds/tooltip";
import {
  TopNavigationProvider,
  focusScreenTitle,
  useScreenTitle,
} from "@/shared/ds/top-navigation";
import { DesktopHeader } from "./DesktopHeader";
import { DesktopSidebar } from "./DesktopSidebar";
import { MobileHeader } from "./MobileHeader";
import { MoneyTabs } from "./MoneyTabs";
import { TabMemory } from "./TabMemory";
import { enterScreen, restoreScreen, watchScreen } from "../lib/screen-memory";
import { AppTabBar } from "./AppTabBar";
import { useDeviceSize } from "@/shared/lib/groo/responsive";
import { useWideSurface } from "@/shared/ds/overlay";
import { isFixedBulkPath } from "@/shared/lib/groo/fixed-bulk-path";
import { SwipeActionsProvider } from "@/shared/ds/swipe-actions";
import { AddTxSheet } from "@/widgets/add-tx";
import { CalendarEventFormHost } from "@/widgets/calendar/ui/CalendarEventFormHost";
import { useHideCardsSync } from "@/features/hide-amounts";
import { useNotificationSSE } from "@/features/notification";
import {
  fabFor,
  isFullscreenPath,
  screenFloor,
  isMoneyPath,
  screenTitleKey,
} from "../model/shell";

/** 캘린더 일정 생성 폼 — AppLayout에서 + 버튼 클릭 시 마운트. */
const CalendarEventAddForm = ({ onClose }: { onClose: () => void }) => (
  <CalendarEventFormHost onClose={onClose} />
);

/**
 * 화면을 옮길 때의 셸 몫 — 문서 제목 "{제목} - 그루 담다" 와, 옮긴 뒤 본문을 맨 위로 + 제목에 초점.
 * TopNavigationProvider 안에 둔다(제품 이름을 거기서 읽는다). 처음 열 때는 초점을 훔치지 않는다.
 */
const ScreenEffects = () => {
  const { t } = useTranslation("layout");
  const { pathname, key } = useLocation();
  const navType = useNavigationType();
  useScreenTitle(t(screenTitleKey(pathname)));
  const last = useRef(pathname);
  const wide = useWideSurface();
  // 스크롤 · 누른 요소를 화면(location.key)마다 적어 둔다 — 뒤로 오면 돌려주려고(top-navigation.md:230)
  useEffect(() => watchScreen(), []);
  useLayoutEffect(() => {
    enterScreen(key);
  }, [key]);
  useEffect(() => {
    if (last.current === pathname) return;
    const from = last.current;
    last.current = pathname;
    // 1280 이상의 고정 정리(/desk/stats/fixed)는 주소만 있는 같은 화면 위 대화상자다 — 화면을 옮긴 게 아니므로 뒤 통계를 맨 위로
    // 보내지 않고 초점도 제목으로 옮기지 않는다(닫으면 초점은 Dialog 가 연 단추로 돌려놓는다, dialog.md:179)
    if (wide && (isFixedBulkPath(from) || isFixedBulkPath(pathname))) return;
    // 뒤로(POP) 왔다 — 떠날 때의 스크롤로 돌리고 누른 요소에 초점. 적어 둔 게 없으면(새로 고침 뒤 등) 앞으로 갈 때와 같다
    if (navType === "POP") {
      const stop = restoreScreen(key);
      if (stop) return stop;
    }
    // 새 화면이 그려진 다음 프레임에 — 제목(data-screen-title)이 DOM 에 있어야 초점이 간다
    const frame = requestAnimationFrame(() => focusScreenTitle());
    return () => cancelAnimationFrame(frame);
  }, [pathname, wide, key, navType]);
  return null;
};

export const AppLayout = () => (
  <TopNavigationProvider product="그루 담다">
    {/* 떠나기 가드 하나 — 세 갈래 셸(폰 풀스크린 · 폰 페이지 · 데스크톱) 모두 같은 가드를 본다(단계 5) */}
    <LeaveGuardProvider>
      <ScreenEffects />
      <Shell />
    </LeaveGuardProvider>
  </TopNavigationProvider>
);

/** 화면 맨 앞 "본문 바로가기" — 키보드 초점이 오면 보이고, 누르면 main 으로 간다(DESIGN.desk.md 랜드마크). */
const SkipLink = () => {
  const { t } = useTranslation("layout");
  return (
    <a
      href="#main"
      onClick={(e) => {
        e.preventDefault();
        document.getElementById("main")?.focus();
      }}
      className="sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:left-x4 focus-visible:top-x4 focus-visible:z-(--z-modal-content) focus-visible:rounded-r3 focus-visible:bg-bg-layer-floating focus-visible:px-x4 focus-visible:py-x3 focus-visible:text-t4 focus-visible:font-bold focus-visible:text-fg-neutral focus-visible:shadow-(--shadow-s3) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stroke-focus-ring"
    >
      {t("skipToMain")}
    </a>
  );
};

/**
 * 셸 한 트리(I-wrap-b2b 단계 6 — 사용자 결정 "A 셸만 지금").
 *
 * 예전에는 768 경계에서 세 벌의 다른 트리(폰 풀스크린 · 폰 페이지 · 데스크톱)를 돌려줘, 폰을 가로로 돌리면(390 → 844) 페이지 ·
 * 셸이 여는 시트가 통째로 다시 붙어 쓰던 값이 사라졌다. 지금은 `main > SwipeActionsProvider > div > Outlet` 과 셸이 여는
 * 시트(거래 · 일정)의 자리 · 종류가 폭과 상관없이 같다 — 사이드바 · 머리 · 돈 탭 · 탭 바만 폭에 따라 형제로 바뀐다.
 * 폭에 따라 다른 상자(데스크톱 본문 칸 · 폰 띠 바탕)는 클래스로만 바꾼다(필요 없으면 `contents` — 상자를 만들지 않는다).
 * 페이지 안의 mobile 갈림(16곳)은 이 단계가 아니다(B1 "폼은 갈림 밖").
 */
const Shell = () => {
  const size = useDeviceSize();
  const { t } = useTranslation(["layout", "calendar"]);
  const [addOpen, setAddOpen] = useState(false);
  const [calendarAddOpen, setCalendarAddOpen] = useState(false);
  const location = useLocation();
  const scrollRef = useRef<HTMLElement>(null);
  // 금액 가리기를 계정 설정과 맞춘다
  useHideCardsSync();
  // 서버 알림 도착 — 로그인 뒤 셸에서 한 번(폰 · 데스크톱 모두). 받으면 벨 점만 바뀐다(띠 없음, I-28 D5 B)
  useNotificationSSE();

  const mobile = size === "mobile";
  // 풀스크린 페이지 — 페이지가 자체 헤더(← 뒤로 + 타이틀)를 렌더 (앱과 동일)
  const fullscreen = mobile && isFullscreenPath(location.pathname);
  const pageShell = mobile && !fullscreen;
  // + 가 여는 것과 그걸 부르는 이름은 한 자리에서 나온다 — 동작만 화면별로 갈리고
  // 이름이 굳어 있어 캘린더에서 낭독기가 "거래 추가" 를 읽었다(QA #159).
  const fab = fabFor(location.pathname);
  const floor = screenFloor(location.pathname);
  const handleAdd =
    fab.target === "event"
      ? () => setCalendarAddOpen(true)
      : () => setAddOpen(true);
  useKeepFocusAcrossShell(fullscreen ? "fullscreen" : size);

  return (
    <TooltipProvider>
      <div
        className={
          mobile ? cn("m-app", pageShell && "m-app--page") : "flex h-svh"
        }
        data-screen-label={mobile ? "Mobile" : undefined}
      >
        <SkipLink />
        {!mobile && <DesktopSidebar />}
        <div
          className={
            mobile
              ? "contents"
              : "flex min-w-0 flex-1 flex-col overflow-hidden bg-bg-layer-basement"
          }
        >
          {!mobile && <DesktopHeader onOpenAdd={() => setAddOpen(true)} />}
          {/* 머리 · 가계부 탭은 main 밖이다(banner) — 본문만 스크롤한다 */}
          {pageShell && <MobileHeader />}
          {pageShell && isMoneyPath(location.pathname) && <MoneyTabs />}
          {/* 데스크톱: relative — 본문 안의 absolute 요소(sr-only 등)가 기댈 자리를 여기로 잡는다. 없으면 위에 positioned 조상이 없는
              요소는 문서 첫 상자에 기대 본문 스크롤 높이만큼 문서를 늘려 창 스크롤이 하나 더 생긴다(카드 혜택 쪽 넘김의 sr-only).
              폰 페이지: 아래 여백은 떠 있는 탭 바가 마지막 줄을 덮지 않게 한다(바가 줄어도 그대로).
              풀스크린도 띠 화면이다 — 바닥은 basement, 머리 바로 아래 흰 띠는 본문이 직접 칠한다(I-01 결정 4B · I-05 74 · I-wrap-b1 ε M1) */}
          <main
            id="main"
            tabIndex={-1}
            ref={scrollRef}
            className={
              !mobile
                ? "relative flex-1 min-h-0 overflow-y-auto overflow-x-hidden flex flex-col bg-bg-layer-basement outline-none"
                : fullscreen
                  ? "m-scroll m-fullscreen flex flex-col bg-bg-layer-basement outline-none"
                  : cn(
                      "m-scroll flex flex-col outline-none",
                      floor === "white"
                        ? "bg-bg-layer-default"
                        : "bg-bg-layer-basement",
                    )
            }
            data-floor={pageShell ? floor : undefined}
            style={
              pageShell ? { paddingBottom: BOTTOM_NAVIGATION_INSET } : undefined
            }
          >
            {/* 스와이프 그룹은 셸에 하나 — "한 번에 한 행" 과 "스크롤하면 닫힘" 을 여기가 맡는다(데스크톱은 행의 enabled 가 통과).
                화면마다 두면 리스트를 새로 붙일 때 빠뜨려 여러 행이 열린 채 남는다. */}
            <SwipeActionsProvider closeKey={location.pathname}>
              {/* 폰 페이지의 띠 화면 — 머리 바로 아래 화면 폭 흰 띠(모서리 · 테두리 · 그림자 없음), 시작 틈 없음(I-05 74).
                  그 밖에서는 상자를 만들지 않는다(contents) — 페이지는 main 의 flex 자식 그대로다 */}
              <div
                className={
                  pageShell
                    ? cn(
                        "flex flex-1 flex-col",
                        floor === "strip" && "bg-bg-layer-default",
                      )
                    : "contents"
                }
              >
                <Outlet context={{ onAddTx: () => setAddOpen(true), mobile }} />
              </div>
            </SwipeActionsProvider>
          </main>
        </div>
        {pageShell && <TabMemory scrollRef={scrollRef} />}
        {pageShell && (
          <AppTabBar onAdd={handleAdd} addLabel={t(fab.labelKey)} />
        )}
      </div>
      {/* 셸이 여는 시트 — 자리가 폭과 상관없이 같아 넘나들어도 쓰던 값 · 단계가 남는다(1280 미만은 시트, 이상은 대화상자) */}
      {addOpen && (
        <AddTxSheet mobile={mobile} onClose={() => setAddOpen(false)} />
      )}
      {calendarAddOpen && (
        <CalendarEventAddForm onClose={() => setCalendarAddOpen(false)} />
      )}
    </TooltipProvider>
  );
};

/**
 * 셸이 바뀔 때(폰 ↔ 데스크톱 · 풀스크린) 초점이 사라진 셸 부품(폰 머리 검색 · 탭 바 · 사이드바)에 있었으면 문서(body)로
 * 떨어진다 — 본문(main)으로 옮겨 다음 Tab 이 본문에서 시작하게 한다. 본문 · 시트 안 초점은 그대로 남아 건드리지 않는다.
 */
function useKeepFocusAcrossShell(shell: string) {
  const lastFocused = useRef<Element | null>(null);
  useEffect(() => {
    const onFocusIn = (e: FocusEvent) => {
      lastFocused.current = e.target as Element | null;
    };
    document.addEventListener("focusin", onFocusIn);
    return () => document.removeEventListener("focusin", onFocusIn);
  }, []);
  const lastShell = useRef(shell);
  useLayoutEffect(() => {
    if (lastShell.current === shell) return;
    lastShell.current = shell;
    const was = lastFocused.current;
    const active = document.activeElement;
    if (
      was != null &&
      !was.isConnected &&
      (active == null || active === document.body)
    )
      document.getElementById("main")?.focus({ preventScroll: true });
  }, [shell]);
}
