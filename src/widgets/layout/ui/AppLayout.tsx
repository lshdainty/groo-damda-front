import { LeaveGuardProvider } from "@/shared/ui/groo/leave-guard";
import { useEffect, useRef, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
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
import { AppTabBar } from "./AppTabBar";
import { useDeviceSize } from "@/shared/lib/groo/responsive";
import { SwipeActionsProvider } from "@/shared/ui/swipe-actions";
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
  const { pathname } = useLocation();
  useScreenTitle(t(screenTitleKey(pathname)));
  const last = useRef(pathname);
  useEffect(() => {
    if (last.current === pathname) return;
    last.current = pathname;
    // 새 화면이 그려진 다음 프레임에 — 제목(data-screen-title)이 DOM 에 있어야 초점이 간다
    const frame = requestAnimationFrame(() => focusScreenTitle());
    return () => cancelAnimationFrame(frame);
  }, [pathname]);
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

const Shell = () => {
  const size = useDeviceSize();
  const { t } = useTranslation(["layout", "calendar"]);
  const [addOpen, setAddOpen] = useState(false);
  const [calendarAddOpen, setCalendarAddOpen] = useState(false);
  const location = useLocation();
  const scrollRef = useRef<HTMLElement>(null);
  // 금액 가리기를 계정 설정과 맞춘다 — 아래 mobile 조기 반환보다 위여야 한다(훅 규칙).
  useHideCardsSync();
  // 서버 알림 도착 — 로그인 뒤 셸에서 한 번(폰 · 데스크톱 모두). 받으면 벨 점만 바뀐다(띠 없음, I-28 D5 B)
  useNotificationSSE();

  if (size === "mobile") {
    // + 가 여는 것과 그걸 부르는 이름은 한 자리에서 나온다 — 동작만 화면별로 갈리고
    // 이름이 굳어 있어 캘린더에서 낭독기가 "거래 추가" 를 읽었다(QA #159).
    const fab = fabFor(location.pathname);
    const floor = screenFloor(location.pathname);
    const handleAdd =
      fab.target === "event"
        ? () => setCalendarAddOpen(true)
        : () => setAddOpen(true);

    // 풀스크린 페이지 — 페이지가 자체 헤더(← 뒤로 + 타이틀)를 렌더 (앱과 동일).
    if (isFullscreenPath(location.pathname)) {
      return (
        <div className="m-app" data-screen-label="Mobile">
          <SkipLink />
          {/* 풀스크린도 띠 화면이다 — 바닥은 basement, 머리 바로 아래 흰 띠(I-01 결정 4B · I-05 74 · groo.css .m-fullscreen) */}
          <main
            id="main"
            tabIndex={-1}
            className="m-scroll m-fullscreen flex flex-col bg-bg-layer-basement outline-none"
          >
            <SwipeActionsProvider>
              <Outlet
                context={{ onAddTx: () => setAddOpen(true), mobile: true }}
              />
            </SwipeActionsProvider>
          </main>
          {addOpen && <AddTxSheet mobile onClose={() => setAddOpen(false)} />}
        </div>
      );
    }

    return (
      <div className="m-app m-app--page" data-screen-label="Mobile">
        <SkipLink />
        {/* 머리 · 가계부 탭은 main 밖이다(banner) — 본문만 스크롤한다 */}
        <MobileHeader />
        {isMoneyPath(location.pathname) && <MoneyTabs />}
        {/* flex flex-col — 페이지가 flex-1 로 main 전체 height 를 차지하도록 (viewport
            fit 패턴 지원). 자식 페이지가 자연 height 면 동일 동작 (변경 없음).
            아래 여백은 떠 있는 탭 바가 마지막 줄을 덮지 않게 한다(바가 줄어도 그대로). */}
        <main
          id="main"
          tabIndex={-1}
          ref={scrollRef}
          className={cn(
            "m-scroll flex flex-col outline-none",
            floor === "white" ? "bg-bg-layer-default" : "bg-bg-layer-basement",
          )}
          data-floor={floor}
          style={{ paddingBottom: BOTTOM_NAVIGATION_INSET }}
        >
          {/* 스와이프 그룹은 셸마다 하나 — "한 번에 한 행" 과 "스크롤하면 닫힘" 을 여기가 맡는다.
              화면마다 두면 리스트를 새로 붙일 때 빠뜨려 여러 행이 열린 채 남는다. */}
          <SwipeActionsProvider>
            {/* 띠 화면 — 머리 바로 아래 화면 폭 흰 띠(모서리 · 테두리 · 그림자 없음), 시작 틈 없음(I-05 74) */}
            <div
              className={cn(
                "flex flex-1 flex-col",
                floor === "strip" && "bg-bg-layer-default",
              )}
            >
              <Outlet
                context={{ onAddTx: () => setAddOpen(true), mobile: true }}
              />
            </div>
          </SwipeActionsProvider>
        </main>
        <TabMemory scrollRef={scrollRef} />
        <AppTabBar onAdd={handleAdd} addLabel={t(fab.labelKey)} />
        {addOpen && <AddTxSheet mobile onClose={() => setAddOpen(false)} />}
        {calendarAddOpen && (
          <CalendarEventAddForm onClose={() => setCalendarAddOpen(false)} />
        )}
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="flex h-svh">
        <SkipLink />
        <DesktopSidebar />
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-bg-layer-basement">
          <DesktopHeader onOpenAdd={() => setAddOpen(true)} />
          {/* flex flex-col — 페이지가 flex-1 로 scroll wrapper 전체 height 를 차지하도록
              (viewport fit 패턴 지원). 자식 페이지가 자연 height 면 동일 동작.
              relative — 본문 안의 absolute 요소(sr-only 등)가 기댈 자리를 여기로 잡는다. 없으면 위에 positioned 조상이 없는
              요소는 문서 첫 상자에 기대 본문 스크롤 높이만큼 문서를 늘려 창 스크롤이 하나 더 생긴다(카드 혜택 쪽 넘김의 sr-only). */}
          <main
            id="main"
            tabIndex={-1}
            className="relative flex-1 min-h-0 overflow-y-auto overflow-x-hidden flex flex-col bg-bg-layer-basement outline-none"
          >
            <Outlet
              context={{ onAddTx: () => setAddOpen(true), mobile: false }}
            />
          </main>
        </div>
      </div>
      {addOpen && (
        <AddTxSheet mobile={false} onClose={() => setAddOpen(false)} />
      )}
    </TooltipProvider>
  );
};
