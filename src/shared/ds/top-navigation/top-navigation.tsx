import * as React from "react";
import { ChevronLeft, Menu, X } from "lucide-react";

import { cn } from "@/shared/lib/cn";
import { useLeaveConfirm } from "@/shared/ds/alert-dialog";
import { Button, type ButtonProps } from "@/shared/ds/button";
import { NotificationBadge } from "@/shared/ds/notification-badge";

import {
  hasPreviousEntry,
  ProductContext,
  TypeContext,
} from "./top-navigation-context";
import {
  ACTIONS,
  ICON_BUTTON,
  measurePress,
  ROOT,
  ROOT_LEFT,
  ROW,
  SEARCH,
  SEARCH_TYPE,
  SCREEN_ACTIONS,
  SCREEN_DESCRIPTION,
  SCREEN_TITLE,
  SCREEN_TITLE_ROW,
  TEXT_BUTTON,
  TITLE,
  TITLE_TYPE,
  type TopNavigationType,
} from "./top-navigation-variants";
import { useDsText } from "@/shared/ds/i18n";

/*
 * Groo Top Navigation — 구조는 SEED Top Navigation(Root · Standard, 2026-10-04). 수치 원본은 groo-design
 * specs/components/top-navigation.yaml(값은 src/shared/ds/spec/top-navigation.json). recipes/shadcn/components/ui/top-navigation.tsx 를 첫 판으로 가져왔다.
 * 데스크톱 머리(desktop)는 SEED 에 컴포넌트가 없어 groo 가 같은 규칙으로 더했다.
 *
 *   TopNavigation               바(<header> — main 밖, banner). type "root"(탭 첫 화면) · "standard"(기본 — 그 아래 화면 · HR 폰) ·
 *                               "desktop"(768 이상 Desk 의 머리 — 제목은 본문 ScreenTitle). 자식은 아래 부품을 차례대로
 *   TopNavigationBackButton     ← "뒤로" — 앱 안에 앞 화면이 있으면 history.back(), 없으면 fallbackHref(그 화면의 상위 화면 주소, 필수)로
 *                               지금 주소를 고쳐 간다(location.replace). onClick 을 주면 그것만 부른다(라우터를 쓰는 셸이 navigate 로 옮긴다)
 *   TopNavigationCloseButton    ✕ "닫기" — onClick 필수(흐름의 처음 자리로). dirty 면 닫기 전에 "작성한 내용이 사라져요" 를 묻는다
 *   TopNavigationMenuButton     ☰ "주 메뉴" — aria-haspopup="dialog", aria-expanded · aria-controls 는 부르는 쪽이 준다(HR 폰의 주 메뉴 Side Panel)
 *   TopNavigationTitle          제목 <h1 tabIndex={-1} data-screen-title> — 한 줄 말줄임. desktop 에서는 그리지 않는다(본문 ScreenTitle)
 *   TopNavigationActions        오른쪽 자리 — TopNavigationIconButton 3개까지(2개 권장) 또는 TopNavigationTextButton 하나,
 *                               desktop 이면 맨 앞에 TopNavigationPrimaryButton 하나
 *   TopNavigationIconButton     아이콘 버튼 — 상자 44 = 누르는 영역 · 아이콘 24. aria-label 필수. notification 은 벨의 알림 점(점만 —
 *                               이름에 "새 알림 있음" 을 넣는 것은 부르는 쪽). aria-pressed 를 주면 켜고 끄는 단추(금액 가리기) —
 *                               이름은 고정, 아이콘은 지금 상태를 넘긴다(가렸으면 eye-off)
 *   TopNavigationTextButton     글 버튼("완료" · "모두 읽음") — 오른쪽 자리에 하나, 아이콘 버튼과 섞지 않는다
 *   TopNavigationPrimaryButton  데스크톱 머리의 주 버튼 — Button brandSolid · small 그대로 + 오른쪽 8
 *   ScreenTitle                 데스크톱 본문 맨 위 제목 <h1 tabIndex={-1} data-screen-title> — text-screen-title 26 / 35 · 700, 머리 아래 20
 *                               description(제목 아래 16 / 22 · muted) · actions(Button small)를 주면 한 줄 제목 줄 — 제목 덩어리 왼쪽, 버튼 오른쪽 아래 끝
 *   TopNavigationProvider       product("그루 담다" · "그루 이음") — useScreenTitle(title) 가 문서 제목을 "{title} - {product}" 로 쓴다
 *   (top-navigation-context.ts) useScreenTitle · focusScreenTitle() — 셸이 화면을 옮긴 뒤 부른다: 본문 스크롤을 맨 위로, 보이는
 *                               [data-screen-title] 에 초점(링은 키보드로 왔을 때만)
 *
 * 바: 높이 56 — 폰 · 데스크톱 모든 화면이 같다. 위 안전 영역만큼 높아지고 내용은 그 아래 56 에 놓인다(바탕은 화면 끝까지).
 *   좌우 6 + 좌우 안전 영역(맨 끝 버튼 상자가 화면 끝에서 6 · 아이콘은 16). desktop 은 왼쪽이 본문 여백 32(layout-margin).
 *   바탕은 불투명한 bg-layer-default, 맨 위에 붙어(sticky) 스크롤해도 그 자리 — 선 · 그림자 · 숨김이 없다(결정 3 — SEED). z-sticky 50.
 * 제목: 왼쪽 정렬 · 700 · fg-neutral · 한 줄 말줄임, 오른쪽 자리 앞 8 을 늘 비운다(SEED titleMinGap). root 는 t8 22 / 30 · 화면 끝에서 16,
 *   standard 는 t6 18 / 24 · 화면 끝에서 56(6 + ← 44 + 6). 글자 크기 설정을 1.2배까지만 따른다(clamp — 바 높이는 56 그대로).
 * 아이콘 버튼: 상자 44 · 모서리 r2 8 · 아이콘 24 fg-neutral · 버튼끼리 붙는다(아이콘 중심 간격 44). 바탕은 누를 때 · 마우스를 올릴 때만
 *   bg-layer-default-pressed(불투명), 누르면 2px 거리 축소(44 → 0.955). 본문의 Button iconOnly(40 · 18)와 다른 부품이다.
 *   켜고 끄는 단추(aria-pressed)는 켬 선 2.5 · 끔 선 2 이고 색은 켬 · 끔 모두 fg-neutral 이다(Toggle 의 흐린 끔을 상단 바에서 쓰지 않는다 — 19B).
 *   알림 점은 Notification Badge small — 24 아이콘 상자의 x 17 ~ 23 · y 1 ~ 7, 점만(숫자는 맨 오른쪽 버튼에서 화면 밖으로 나간다).
 * 글 버튼: 높이 44 · 좌우 10 · 모서리 8 · t5 16 / 22 · 500(1.2배까지), 누름 · 호버 같은 바탕 + 2px 거리 축소(기준 max(44, 폭 ÷ 4, 24)).
 * 막힘: 아이콘 · 글 fg-disabled — 흐리게 하지 않는다. 키보드 포커스에만 버튼 상자 안쪽 2px 링(붙은 이웃 · 화면 끝에 걸리지 않게).
 * 모션: 바탕 색 150ms easing · 축소 150ms pressed-scale(모션 줄이기면 축소하지 않는다).
 *
 * 레시피와 다른 자리 — ① 문맥 · 훅 · 도우미(useScreenTitle · focusScreenTitle · hasPreviousEntry)는 top-navigation-context.ts, 클래스 · 상수는
 * top-navigation-variants.ts(컴포넌트 파일은 컴포넌트만 — 빠른 새로 고침). ② desktop 에서 TopNavigationTitle 을 쓰면 개발 경고 대신 조용히 그리지 않는다
 * (콘솔 규칙). ③ 손 메모이제이션 없음. ④ import 는 shared/ds 끼리(alert-dialog 의 useLeaveConfirm · button · notification-badge).
 */

export type { TopNavigationType } from "./top-navigation-variants";

// ── 바 ───────────────────────────────────────────────────────
export interface TopNavigationProps extends React.HTMLAttributes<HTMLElement> {
  /** root — 탭 첫 화면(큰 제목) · standard — 그 아래 화면(← + 제목, 기본) · desktop — 768 이상 Desk 의 머리(제목은 본문) */
  type?: TopNavigationType;
}

const TopNavigation = React.forwardRef<HTMLElement, TopNavigationProps>(
  ({ type = "standard", className, children, ...props }, ref) => (
    <TypeContext.Provider value={type}>
      <header
        ref={ref}
        data-slot="top-navigation"
        data-type={type}
        className={cn(ROOT, ROOT_LEFT[type], className)}
        {...props}
      >
        <div data-slot="top-navigation-row" className={ROW}>
          {children}
        </div>
      </header>
    </TypeContext.Provider>
  ),
);
TopNavigation.displayName = "TopNavigation";

// ── 제목 ─────────────────────────────────────────────────────
const TopNavigationTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => {
  const type = React.useContext(TypeContext);
  // 데스크톱 머리에는 제목을 두지 않는다 — 본문 맨 위 ScreenTitle 이 맡는다
  if (type === "desktop") return null;
  return (
    <h1
      ref={ref}
      tabIndex={-1}
      data-screen-title=""
      data-slot="top-navigation-title"
      className={cn(TITLE, TITLE_TYPE[type], className)}
      {...props}
    />
  );
});
TopNavigationTitle.displayName = "TopNavigationTitle";

// ── 검색칸 ───────────────────────────────────────────────────
export interface TopNavigationSearchProps extends React.HTMLAttributes<HTMLDivElement> {
  /** 보이지 않는 h1 — 화면 이름 대신 칸이 서므로 머리말은 보조 기술에만. 기본 "검색". desktop 에서는 두지 않는다(본문 h1) */
  title?: string;
}

/**
 * 검색칸 자리 — 자식은 Input 하나(size="medium" · prefixIcon 돋보기 · clearable).
 * standard 에서는 제목 자리(← 다음 6 ~ 오른쪽 자리 앞 8), desktop 에서는 머리 왼쪽 폭 360.
 */
const TopNavigationSearch = React.forwardRef<
  HTMLDivElement,
  TopNavigationSearchProps
>(({ title, className, children, ...props }, ref) => {
  const type = React.useContext(TypeContext);
  const dsT = useDsText();
  return (
    <div
      ref={ref}
      role="search"
      data-slot="top-navigation-search"
      className={cn(SEARCH, SEARCH_TYPE[type], className)}
      {...props}
    >
      {type !== "desktop" && (
        <h1 tabIndex={-1} data-screen-title="" className="sr-only">
          {title ?? dsT("topNavigation.searchTitle")}
        </h1>
      )}
      {children}
    </div>
  );
});
TopNavigationSearch.displayName = "TopNavigationSearch";

// ── 오른쪽 자리 ──────────────────────────────────────────────
const TopNavigationActions = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    data-slot="top-navigation-actions"
    className={cn(ACTIONS, className)}
    {...props}
  />
));
TopNavigationActions.displayName = "TopNavigationActions";

// ── 버튼 ─────────────────────────────────────────────────────
export interface TopNavigationIconButtonProps extends Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  "type" | "aria-label"
> {
  /** 이름 — "검색" · "알림" · "{화면 이름} 더보기". 알림 점이 있으면 "알림, 새 알림 있음" */
  "aria-label": string;
  /** 벨의 알림 점(Notification Badge small) — 점만, 이름에도 넣는다 */
  notification?: boolean;
}

const TopNavigationIconButton = React.forwardRef<
  HTMLButtonElement,
  TopNavigationIconButtonProps
>(({ notification = false, className, children, ...props }, ref) => (
  <button
    ref={ref}
    type="button"
    data-slot="top-navigation-icon-button"
    className={cn(ICON_BUTTON, className)}
    {...props}
  >
    {/* 아이콘 · 점은 장식 — 이름은 aria-label */}
    <NotificationBadge aria-hidden visible={notification}>
      {children}
    </NotificationBadge>
  </button>
));
TopNavigationIconButton.displayName = "TopNavigationIconButton";

const TopNavigationTextButton = React.forwardRef<
  HTMLButtonElement,
  Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "type">
>(({ className, onPointerDown, onKeyDown, ...props }, ref) => (
  <button
    ref={ref}
    type="button"
    data-slot="top-navigation-text-button"
    className={cn(TEXT_BUTTON, className)}
    onPointerDown={(e) => {
      measurePress(e.currentTarget);
      onPointerDown?.(e);
    }}
    onKeyDown={(e) => {
      if (e.key === " " || e.key === "Enter") measurePress(e.currentTarget);
      onKeyDown?.(e);
    }}
    {...props}
  />
));
TopNavigationTextButton.displayName = "TopNavigationTextButton";

// 데스크톱 머리의 주 버튼 — Button brandSolid small 그대로, 첫 아이콘 버튼 상자와 8
const TopNavigationPrimaryButton = React.forwardRef<
  HTMLButtonElement,
  Omit<ButtonProps, "variant" | "size">
>(({ className, ...props }, ref) => (
  <Button
    ref={ref}
    variant="brandSolid"
    size="small"
    data-slot="top-navigation-primary-button"
    className={cn("mr-x2", className)}
    {...props}
  />
));
TopNavigationPrimaryButton.displayName = "TopNavigationPrimaryButton";

// ── 왼쪽 버튼 ────────────────────────────────────────────────
export interface TopNavigationBackButtonProps extends Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  "type" | "children" | "aria-label"
> {
  /** 그 화면의 상위 화면 주소 — 앞 화면이 없으면(주소로 바로 · 알림 · 새 탭) 이 주소로 지금 주소를 고쳐 간다 */
  fallbackHref: string;
  /** 이름 — 기본 "뒤로" */
  "aria-label"?: string;
}

const TopNavigationBackButton = React.forwardRef<
  HTMLButtonElement,
  TopNavigationBackButtonProps
>(({ fallbackHref, onClick, "aria-label": ariaLabelProp, ...props }, ref) => {
  const dsT = useDsText();
  const ariaLabel = ariaLabelProp ?? dsT("topNavigation.back");
  return (
    <TopNavigationIconButton
      ref={ref}
      aria-label={ariaLabel}
      data-slot="top-navigation-back-button"
      onClick={(e) => {
        // onClick 을 주면 그것만 — 라우터를 쓰는 셸은 navigate(-1) · navigate(fallbackHref, { replace: true })
        if (onClick) {
          onClick(e);
          return;
        }
        if (hasPreviousEntry()) window.history.back();
        else window.location.replace(fallbackHref);
      }}
      {...props}
    >
      <ChevronLeft />
    </TopNavigationIconButton>
  );
});
TopNavigationBackButton.displayName = "TopNavigationBackButton";

export interface TopNavigationCloseButtonProps extends Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  "type" | "children" | "aria-label" | "onClick"
> {
  /** 흐름을 닫고 처음 자리로 — dirty 면 묻고 [나가기] 를 골랐을 때만 부른다 */
  onClick: () => void;
  /** 입력한 값이 있다 — 닫기 전에 "작성한 내용이 사라져요" 를 묻는다 */
  dirty?: boolean;
  /** 이름 — 기본 "닫기" */
  "aria-label"?: string;
}

const TopNavigationCloseButton = React.forwardRef<
  HTMLButtonElement,
  TopNavigationCloseButtonProps
>(({ onClick, dirty = false, "aria-label": ariaLabelProp, ...props }, ref) => {
  const dsT = useDsText();
  const ariaLabel = ariaLabelProp ?? dsT("common.close");
  const own = React.useRef<HTMLButtonElement | null>(null);
  const leave = useLeaveConfirm({ dirty, leave: onClick, contentRef: own });
  return (
    <>
      <TopNavigationIconButton
        ref={(node) => {
          own.current = node;
          if (typeof ref === "function") ref(node);
          else if (ref) ref.current = node;
        }}
        aria-label={ariaLabel}
        data-slot="top-navigation-close-button"
        onClick={() => leave.request()}
        {...props}
      >
        <X />
      </TopNavigationIconButton>
      {leave.node}
    </>
  );
});
TopNavigationCloseButton.displayName = "TopNavigationCloseButton";

export interface TopNavigationMenuButtonProps extends Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  "type" | "children" | "aria-label"
> {
  /** 이름 — 기본 "주 메뉴" */
  "aria-label"?: string;
}

// ☰ — 주 메뉴(왼쪽 Side Panel)를 연다. aria-expanded · aria-controls 는 부르는 쪽이 준다
const TopNavigationMenuButton = React.forwardRef<
  HTMLButtonElement,
  TopNavigationMenuButtonProps
>(({ "aria-label": ariaLabelProp, ...props }, ref) => {
  const dsT = useDsText();
  return (
    <TopNavigationIconButton
      ref={ref}
      aria-label={ariaLabelProp ?? dsT("sideNavigation.label")}
      aria-haspopup="dialog"
      data-slot="top-navigation-menu-button"
      {...props}
    >
      <Menu />
    </TopNavigationIconButton>
  );
});
TopNavigationMenuButton.displayName = "TopNavigationMenuButton";

// ── 데스크톱 본문 제목 ───────────────────────────────────────
interface ScreenTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
  /** 제목 아래 설명 — 16 / 22 · 400 · fg-neutral-muted. 길면 줄을 바꾸고 동작 버튼은 그 자리에 남는다 */
  description?: React.ReactNode;
  /** 그 화면의 동작 버튼(Button small neutralOutline) — 제목 덩어리 오른쪽, 아래 끝에 맞춘다 */
  actions?: React.ReactNode;
}

const ScreenTitle = React.forwardRef<HTMLHeadingElement, ScreenTitleProps>(
  ({ className, description, actions, ...props }, ref) => {
    const hasRow = description != null || actions != null;
    const heading = (
      <h1
        ref={ref}
        tabIndex={-1}
        data-screen-title=""
        data-slot="screen-title"
        className={cn(SCREEN_TITLE, hasRow && "mt-0", className)}
        {...props}
      />
    );
    // 설명 · 동작이 없으면 h1 하나 — 지금까지의 모양 그대로(둘러싼 상자가 줄을 맡는다)
    if (!hasRow) return heading;
    return (
      <div data-slot="screen-title-row" className={SCREEN_TITLE_ROW}>
        <div className="min-w-0">
          {heading}
          {description != null && (
            <p data-slot="screen-description" className={SCREEN_DESCRIPTION}>
              {description}
            </p>
          )}
        </div>
        {actions != null && (
          <div data-slot="screen-actions" className={SCREEN_ACTIONS}>
            {actions}
          </div>
        )}
      </div>
    );
  },
);
ScreenTitle.displayName = "ScreenTitle";

// ── 문서 제목 ────────────────────────────────────────────────
/** 서비스 이름 — 문서 제목의 뒤("{화면 제목} - 그루 담다"). 앱 맨 위에 한 번 둔다 */
function TopNavigationProvider({
  product,
  children,
}: {
  product: string;
  children?: React.ReactNode;
}) {
  return (
    <ProductContext.Provider value={product}>
      {children}
    </ProductContext.Provider>
  );
}
TopNavigationProvider.displayName = "TopNavigationProvider";

export {
  TopNavigation,
  TopNavigationBackButton,
  TopNavigationCloseButton,
  TopNavigationMenuButton,
  TopNavigationTitle,
  TopNavigationSearch,
  TopNavigationActions,
  TopNavigationIconButton,
  TopNavigationTextButton,
  TopNavigationPrimaryButton,
  ScreenTitle,
  TopNavigationProvider,
};
