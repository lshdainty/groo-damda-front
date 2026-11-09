import * as React from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/shared/ds/button";
import { ChartTooltipContent } from "@/shared/ds/chart";
import { Divider } from "@/shared/ds/divider";
import { ListHeader } from "@/shared/ds/list";
import { ScrollAutoHide } from "@/shared/ds/scroll-auto-hide";
import { cn } from "@/shared/lib/index";
import { withCommaBreaks } from "@/shared/ds/i18n";
import { KRW, MINUS } from "@/shared/lib/groo/format";
import { MaskAmount, WonUnit } from "@/shared/lib/groo/hide-amounts";
import { wonPre } from "@/shared/lib/groo/hide-amounts-core";
import { useShellScroller } from "@/shared/lib/groo/shell-scroller";
import type { HideCardKey } from "@/shared/lib/groo/hide-amounts-cards";

/*
 * Groo Ledger — 모바일 "원장" 레이아웃 공용 컴포넌트.
 *
 * 가계부(ExpensePage → ExpenseMobile)·할일(TodoMobileLedger)·검색(SearchPage)이 함께 쓰는 캘린더 + 일별 리스트 통합 뷰의
 * 큰 틀(I-07 7 · 8 · 11 · 12 · 14 — ds 값). 위에서 아래로:
 *
 *   <LedgerShell ref={rootRef}>
 *     <LedgerBar>                                   늘 고정 — 달 이동 줄(sticky)
 *       <LedgerMonthNav> <MonthTitle/> <LedgerNavBtn/> … </LedgerMonthNav>   달 글은 shared/ui/groo/month-title.tsx
 *     </LedgerBar>
 *     <LedgerPin ref={pinRef}>                      ds Scroll Auto Hide — 달 줄 바로 아래에 붙고, 내리면 Keep 위만 숨는다
 *       <LedgerHead> <LedgerTotal/> <LedgerSub/> <LedgerSumBtn/> </LedgerHead>   숨는다(총액 · 지난달 비교 · 소비 요약)
 *       <LedgerKeep>                                남는다 — 주 달력 + 펼침 꺾쇠 + 아래 선
 *         <LedgerCalendar>
 *           <LedgerDow/> <LedgerWeek> <LedgerCell> <LedgerCellNum/> <LedgerCellMoney/>(금액) · <LedgerCellAmt/>(빈 자리 · 표시) …
 *           <LedgerExpand/> <LedgerCellTip/>
 *         </LedgerCalendar>
 *         <LedgerDivider/>
 *       </LedgerKeep>
 *     </LedgerPin>
 *     <LedgerList> <LedgerDayGroup day> <LedgerDayHead> <LedgerDayDate/> <LedgerDaySum/> … </LedgerList>
 *   </LedgerShell>
 *
 * - 페이지 전체를 조절하는 줄(달 이동 · 주 달력 · 꺾쇠)은 한 덩어리로 남는다 — 목록을 내리면 고른 날이 맨 위 날짜 묶음을 따라간다.
 *   총액 · 인사이트 · 요약만 Scroll Auto Hide 로 숨는다(07-21 고정 머리 + 총액 접힘을 Scroll Auto Hide 로 다시 — 10-23 에 머리 전체가
 *   숨어 주 달력까지 사라졌던 것을 되돌린다). 숨는 부분은 높이를 바꾸지 않고 옮기기만 해 짧은 목록에서도 깜빡이지 않는다.
 * - 페이지 인셋은 Shell(24)이 담당, 내부 요소 인셋 0. Bar · Pin 은 풀블리드(음수 여백).
 * - 행(row)은 도메인별로 다르므로 children 슬롯 — 화면이 소유.
 * - 스크롤 동작(스파이 · lock · 날 누름 이동)은 `use-ledger-scroll.ts` 의 `useLedgerScroll` 훅 공용.
 */

export const LedgerShell = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div">
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("px-global-gutter pb-x7", className)}
    {...props}
  />
));
LedgerShell.displayName = "LedgerShell";

/** Bar 높이를 셸에 적는 CSS 변수 — Pin 이 그만큼 아래에 붙는다 */
const BAR_HEIGHT_VAR = "--ledger-bar-h";

/**
 * 늘 고정되는 달 이동 줄 — sticky · 맨 위(top 은 위 상단 바 높이, 없으면 0), 바탕 `bg-layer-default` · z-3(Pin 의 숨는 부분이 이 아래로
 * 들어간다 — 스크롤 상자 안의 겹침 값). 제 높이를 셸에 CSS 변수로 적어 Pin 이 바로 아래에 붙게 한다.
 */
export function LedgerBar({
  className,
  top,
  style,
  ...props
}: React.ComponentProps<"div"> & { top?: number }) {
  const ref = React.useRef<HTMLDivElement>(null);
  React.useLayoutEffect(() => {
    const el = ref.current;
    const parent = el?.parentElement;
    if (!el || !parent) return;
    const write = () =>
      parent.style.setProperty(BAR_HEIGHT_VAR, `${el.offsetHeight}px`);
    write();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(write);
    ro.observe(el);
    return () => {
      ro.disconnect();
      parent.style.removeProperty(BAR_HEIGHT_VAR);
    };
  }, []);
  return (
    <div
      ref={ref}
      data-ledger-bar=""
      className={cn(
        "sticky z-3 -mx-global-gutter bg-bg-layer-default px-global-gutter pt-x2",
        className,
      )}
      style={{ top: top ?? 0, ...style }}
      {...props}
    />
  );
}

const LedgerKeepContext =
  React.createContext<React.RefObject<HTMLDivElement | null> | null>(null);

/**
 * 머리 — ds Scroll Auto Hide(sticky, 바탕 `bg-layer-default` · z-2 — 스크롤 상자 안의 겹침 값). Bar 바로 아래에 붙고(top = 상단 바 +
 * Bar 높이), 내리면 `LedgerKeep` 위 부분만 Bar 아래로 숨는다 — Keep(주 달력)은 남는다. Keep 이 없으면 전부 숨는다. 거르기 중에는 칩 줄이 Keep 이다(가계부 — 남는다).
 * 스크롤 상자는 셸의 본문 스크롤 주체(`useShellScroller` — 지금은 main)다 — 자식(ScrollAutoHide)의 효과가 부모보다 먼저 돌아 효과로 집으면 늦으므로, 읽는 순간 main 을 찾는 ref 를
 * 넘긴다. 처음 그릴 때 집으면 셸과 원장이 한 번에 그려질 때(새로 고침 · 바로 들어옴) main 이 아직 문서에 없어 null 로 굳어 머리가 숨지 않았다.
 */
export const LedgerPin = React.forwardRef<
  HTMLElement,
  Omit<React.ComponentProps<"div">, "ref"> & { top?: number }
>(({ className, top, style, ...props }, ref) => {
  const scroller = useShellScroller();
  const keepRef = React.useRef<HTMLDivElement>(null);
  return (
    <LedgerKeepContext.Provider value={keepRef}>
      <ScrollAutoHide
        ref={ref}
        scrollContainerRef={scroller}
        keepRef={keepRef}
        className={cn(
          "z-2 -mx-global-gutter bg-bg-layer-default px-global-gutter",
          className,
        )}
        style={{
          top: `calc(${top ?? 0}px + var(${BAR_HEIGHT_VAR}, 0px))`,
          ...style,
        }}
        {...props}
      />
    </LedgerKeepContext.Provider>
  );
});
LedgerPin.displayName = "LedgerPin";

/** 머리 안에서 숨지 않고 남는 부분(주 달력 + 꺾쇠 + 아래 선) — Pin 안에 하나. */
export function LedgerKeep({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const ref = React.useContext(LedgerKeepContext);
  return <div ref={ref} data-ledger-keep="" className={className} {...props} />;
}

/** 구분선 — ds Divider 한 줄. 기본은 풀블리드(핀 아래 경계), inset 이면 페이지 인셋 안(행 사이용). */
export function LedgerDivider({
  className,
  inset,
  ...props
}: React.ComponentProps<typeof Divider> & {
  inset?: boolean;
}) {
  return (
    <Divider
      className={cn(
        !inset &&
          "w-[calc(100%+2*var(--spacing-global-gutter))] -mx-global-gutter",
        className,
      )}
      {...props}
    />
  );
}

// ─── 월 네비 ────────────────────────────────────────────────

export function LedgerMonthNav({
  className,
  ...props
}: React.ComponentProps<"div">) {
  // 줄 끝 아이콘 단추는 상자를 오른쪽으로 번지게 해 아이콘(18)이 화면 여백 24 선에 닿는다 — (40 − 18) ÷ 2 = 11(앱 ledger_header.dart _bleedEnd 와 같은 원칙, I-29)
  return (
    <div
      className={cn(
        "flex items-center [&>button:last-child]:-mr-[11px]",
        className,
      )}
      {...props}
    />
  );
}

/** 월 이동 · 필터 · 추가 아이콘 단추 — Button ghost medium iconOnly(보이는 40 · 아이콘 18 · 누르는 44). 이름은 aria-label. 걸림은 부르는 쪽이 알림 점으로 알린다. */
export function LedgerNavBtn({
  type = "button",
  ...props
}: Omit<React.ComponentProps<typeof Button>, "variant" | "size" | "layout">) {
  return (
    <Button
      type={type}
      variant="ghost"
      size="medium"
      layout="iconOnly"
      {...props}
    />
  );
}

// ─── 헤드(총액/타이틀 + 우측 토글) ──────────────────────────

/**
 * 머리 — 단추가 머리 폭의 절반을 넘을 때만 아래 줄 오른쪽으로 내려간다(03G-029 A · 앱 LedgerTotalRow 와 같은 반 폭 판정, I-29 P8).
 * 왼쪽 묶음(첫 자식)의 기본 폭을 `절반 − 간격`으로 잡아, 단추 + 간격이 남은 절반에 안 들어갈 때(단추 > 절반)만 감는다.
 * 왼쪽 묶음의 글 길이는 판정에 들어가지 않는다 — 별빛 줄이 길다고 단추가 내려가지 않는다. 왼쪽 묶음은 `min-w-0 flex-auto`.
 */
export function LedgerHead({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-start gap-x3 pt-x2 [&>:first-child]:basis-[calc(50%-var(--spacing-x3))]",
        className,
      )}
      {...props}
    />
  );
}

/** 지표 — t9 24 / 32 · 700 · 고정폭 */
export function LedgerTotal({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "text-t9 font-bold tabular-nums text-fg-neutral",
        className,
      )}
      {...props}
    />
  );
}

/** 인사이트 한 줄 — t4 · 400 · fg-neutral-muted · 위 6 */
export function LedgerSub({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "mt-x1_5 text-t4 font-normal text-fg-neutral-muted",
        className,
      )}
      {...props}
    />
  );
}

/** 헤드 우측 토글 단추(소비 요약 / 밤하늘) — Button small neutralOutline. 펼침은 아래 내용과 aria-expanded 가 말한다(켜짐 틴트 없음). */
export function LedgerSumBtn({
  className,
  type = "button",
  ...props
}: Omit<React.ComponentProps<typeof Button>, "variant" | "size">) {
  return (
    <Button
      type={type}
      variant="neutralOutline"
      size="small"
      className={cn("ml-auto shrink-0", className)}
      {...props}
    />
  );
}

/** 헤드 아래 드롭 콘텐츠(밤하늘 히어로 등) — 카드 없이 위 12. */
export function LedgerDrop({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return <div className={cn("mt-x3", className)} {...props} />;
}

// ─── 캘린더 ─────────────────────────────────────────────────

/** 달력 영역 — 격자를 페이지 라인보다 8 바깥으로(셀 내용이 가운데 정렬이라 첫 · 끝 칸이 다른 요소와 같은 선에 선다) */
export const LedgerCalendar = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div">
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("relative -mx-x2 pt-x3", className)}
    {...props}
  />
));
LedgerCalendar.displayName = "LedgerCalendar";

/** 요일 줄 — t2 12 / 16 · 400 · fg-neutral-subtle, 일요일 fg-critical · 토요일 fg-brand */
export function LedgerDow({
  labels,
  className,
}: {
  labels: string[];
  className?: string;
}) {
  return (
    <div className={cn("grid grid-cols-7", className)}>
      {labels.map((d, i) => (
        <span
          key={i}
          className={cn(
            "pb-x2 pt-x1_5 text-center text-t2 font-normal",
            i === 0
              ? "text-fg-critical"
              : i === 6
                ? "text-fg-brand"
                : "text-fg-neutral-subtle",
          )}
        >
          {d}
        </span>
      ))}
    </div>
  );
}

export function LedgerWeek({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return <div className={cn("grid grid-cols-7", className)} {...props} />;
}

const cellClass =
  "group/cell flex min-h-x14 flex-col items-center gap-x1 rounded-r3 border-0 bg-transparent px-0 pb-x2 pt-x1 [-webkit-tap-highlight-color:transparent]";

/** 날짜 셀 — empty 면 안 눌리는 div(자리 채움 · 스켈레톤 — 안의 내용은 그린다), 아니면 누르는 button. */
export function LedgerCell({
  className,
  empty = false,
  selected = false,
  ...props
}: React.ComponentProps<"button"> & { empty?: boolean; selected?: boolean }) {
  if (empty)
    return <div className={cn(cellClass, className)}>{props.children}</div>;
  return (
    <button
      type="button"
      data-sel={selected}
      className={cn(
        cellClass,
        "cursor-pointer active:bg-bg-layer-default-pressed",
        className,
      )}
      {...props}
    />
  );
}

/**
 * 날 숫자 — 지난 날 · 오늘 fg-neutral, **오는 날 fg-neutral-subtle**(불투명도로 흐리지 않는다), 일요일 fg-critical · 토요일 fg-brand
 * (캘린더 정합). 고른 날은 짙은 원(`bg-neutral-inverted` + `fg-neutral-inverted`), 오늘은 옅은 원(`bg-neutral-weak`) + 700
 * (date-picker.md State — 브랜드 색으로 채우지 않는다. 고르면 고름이 이기고 700 은 남는다. 원은 앱과 같은 36 — 큰 글자에서는 글을 따라 늘어난다).
 */
export function LedgerCellNum({
  className,
  selected = false,
  today = false,
  dow,
  future = false,
  ...props
}: React.ComponentProps<"span"> & {
  selected?: boolean;
  /** 오늘 — 옅은 원 + 700 (고르면 짙은 원이 이기고 굵기만 남는다) */
  today?: boolean;
  /** 요일(0 = 일) — 주말 색 */
  dow?: number;
  /** 오는 날 */
  future?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex min-h-x9 min-w-x9 items-center justify-center rounded-full px-x1 text-t5 tabular-nums",
        selected
          ? "bg-bg-neutral-inverted font-bold text-fg-neutral-inverted"
          : cn(
              today ? "bg-bg-neutral-weak font-bold" : "font-medium",
              future
                ? "text-fg-neutral-subtle"
                : dow === 0
                  ? "text-fg-critical"
                  : dow === 6
                    ? "text-fg-brand"
                    : "text-fg-neutral",
            ),
        className,
      )}
      {...props}
    />
  );
}

/** 칸 빈 자리 · 한 글자 표시 — t1 11 · 700 · 고정폭. **금액에는 쓰지 않는다**(금액은 LedgerCellMoney — 말줄임 없음). 지출 fg-neutral · 수입 `tone="income"` fg-brand */
export function LedgerCellAmt({
  className,
  tone,
  ...props
}: React.ComponentProps<"span"> & { tone?: "expense" | "income" }) {
  return (
    <span
      className={cn(
        "num max-w-full overflow-hidden whitespace-nowrap text-t1 font-bold tabular-nums",
        "min-h-x3",
        tone === "income" ? "text-fg-brand" : "text-fg-neutral",
        className,
      )}
      {...props}
    />
  );
}

/**
 * 칸 금액(금액이 있는 날) — 원까지 쓴 금액이 **칸에 들어가면 그대로**, 안 들어가면 금액 대신 점 `•`(B3 2A).
 * 말줄임 `…` 는 쓰지 않는다 — 잘린 값은 틀린 값처럼 읽히므로 줄이지 않고 글을 뺀다(10-08 규칙).
 *
 * - 들어가는지는 **실제 폭**으로 잰다: 금액 글(점일 때도 눈에 안 보이게 남겨 둔다)의 폭 ↔ 칸 폭.
 *   자리수 규칙이 아니다 — 글자 200% 에서는 여섯 자리도 안 들어간다. ResizeObserver 가 칸 · 글 둘 다 지켜 폭 · 글자 크기가 바뀌면 다시 잰다.
 * - 점은 금액 글과 같은 줄(t1)이라 줄 높이가 안 바뀐다. 색은 지출 fg-neutral · 수입 fg-brand 그대로.
 * - 점은 aria-hidden — 금액은 부르는 쪽이 날 칸 이름(aria-label)에 원까지 넣는다. 금액 가림(MaskAmount)은 children 안에서 그대로 걸린다.
 */
export function LedgerCellMoney({
  className,
  tone,
  children,
}: {
  className?: string;
  tone?: "expense" | "income";
  children: React.ReactNode;
}) {
  const wrapRef = React.useRef<HTMLSpanElement>(null);
  const textRef = React.useRef<HTMLSpanElement>(null);
  const [fits, setFits] = React.useState(true);
  React.useLayoutEffect(() => {
    const wrap = wrapRef.current;
    const text = textRef.current;
    const cell = wrap?.parentElement;
    if (!wrap || !text || !cell) return;
    // 소수 폭까지 잰다(scrollWidth · clientWidth 는 정수로 반올림돼 0.4 넘침을 놓친다). 글 span 은 inline-block 이라야 폭이 잡힌다
    const measure = () =>
      setFits(
        text.getBoundingClientRect().width <=
          cell.getBoundingClientRect().width,
      );
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(cell);
    observer.observe(text);
    return () => observer.disconnect();
  }, []);
  return (
    <span
      ref={wrapRef}
      data-slot="ledger-cell-money"
      data-dot={!fits || undefined}
      className={cn(
        "num relative max-w-full overflow-hidden whitespace-nowrap text-t1 font-bold tabular-nums",
        "min-h-x3",
        tone === "income" ? "text-fg-brand" : "text-fg-neutral",
        className,
      )}
    >
      <span
        ref={textRef}
        aria-hidden={!fits || undefined}
        className={cn(
          "inline-block",
          !fits && "invisible absolute left-0 top-0",
        )}
      >
        {children}
      </span>
      {!fits && <span aria-hidden>{"\u2022"}</span>}
    </span>
  );
}

/** 주 1줄 ↔ 월 전체 토글 — Button ghost medium iconOnly. 이름은 부르는 쪽이 aria-label("월 달력") + aria-expanded 로. */
export function LedgerExpand({
  expanded = false,
  className,
  type = "button",
  ...props
}: Omit<React.ComponentProps<typeof Button>, "variant" | "size" | "layout"> & {
  expanded?: boolean;
}) {
  return (
    <div className="flex justify-center">
      <Button
        type={type}
        variant="ghost"
        size="medium"
        layout="iconOnly"
        aria-expanded={expanded}
        className={className}
        {...props}
      >
        {expanded ? <ChevronUp /> : <ChevronDown />}
      </Button>
    </div>
  );
}

/** 칸 툴팁 — chart 툴팁 값(머리 t2 · 줄 "■ 지출 …원" t3 · 떠 있는 표면 · 12 · s3). 줄 색 네모는 계열 색(chart-red · chart-blue). */
export function LedgerCellTip({
  left,
  top,
  title,
  rows,
}: {
  left: number;
  top: number;
  title: React.ReactNode;
  rows: { name: string; color: string; value: number; node: React.ReactNode }[];
}) {
  return (
    <div
      className="pointer-events-none absolute z-20"
      style={{ left, top, transform: "translate(-50%, calc(-100% - 8px))" }}
    >
      <ChartTooltipContent
        active
        label={title}
        payload={rows.map((r) => ({
          name: r.name,
          dataKey: r.name,
          value: r.value,
          color: r.color,
        }))}
        valueFormatter={(_, key) =>
          rows.find((r) => r.name === key)?.node ?? null
        }
      />
    </div>
  );
}

// ─── 일별 리스트 ────────────────────────────────────────────

export function LedgerList({
  className,
  ...props
}: React.ComponentProps<"div">) {
  // data-row-list — 거래 줄 맞춤의 목록 단위(groo.css): 두 줄 넘는 줄이 하나라도 있으면 목록의 줄 모두 위
  return <div data-row-list className={className} {...props} />;
}

/** 날짜 그룹 — day 를 주면 스크롤 스파이 · 날 누름 이동 앵커([data-ledger-day]). 머리 위 12 · 첫 묶음 4. */
export function LedgerDayGroup({
  day,
  className,
  ...props
}: React.ComponentProps<"div"> & { day?: string }) {
  return (
    <div
      data-ledger-day={day}
      className={cn(
        "[&_[data-slot=list-header]]:mt-x3 [&:first-child_[data-slot=list-header]]:mt-x1",
        className,
      )}
      {...props}
    />
  );
}

/**
 * 날짜 묶음 머리 — ds List Header mediumWeak(t4 14 / 19 · 500 · fg-neutral-subtle · 위아래 8). 오른쪽에 합계가 올 수 있어 div 로 두고
 * 날짜 글(LedgerDayDate)만 h2 다. `gutter` 는 **임시 인자** — 머리가 제 좌우 24 를 갖는가. 기본 false 는 호스트(가계부 · 할 일 ·
 * 검색)가 아직 바깥 24 를 쥐고 있어서다(I-06 의 거래 줄 `gutter` 와 같은 뜻 · 같은 걷는 때).
 */
export function LedgerDayHead({
  className,
  gutter = false,
  ...props
}: React.ComponentProps<typeof ListHeader> & { gutter?: boolean }) {
  return (
    <ListHeader
      as="div"
      className={cn(!gutter && "px-0", className)}
      {...props}
    />
  );
}

/** 날짜 글(h2) — 글색 · 글꼴은 머리(List Header, fg-neutral-subtle)가 부품에서 물려준다(list-variants 의 머리 안 제목 규칙). `relative`("오늘" · "어제")은 같은 머리말 안에 · 로 붙는다 */
export function LedgerDayDate({
  className,
  relative,
  children,
  ...props
}: React.ComponentProps<"h2"> & { relative?: React.ReactNode }) {
  return (
    <h2 className={className} {...props}>
      <span className="tabular-nums">{children}</span>
      {relative ? <>&nbsp;· {relative}</> : null}
    </h2>
  );
}

/** 그날 합계 — t4 · 500 · 고정폭. 색은 안의 span 이 정한다(지출 fg-neutral · 수입 fg-brand). */
export function LedgerDaySum({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      className={cn("text-t4 font-medium tabular-nums", className)}
      {...props}
    />
  );
}

/**
 * 그날 지출 · 수입 — 가계부 원장과 거래 검색의 날짜 머리 오른쪽이 같은 부품을 쓴다(I-wrap-b1 ε).
 * 지출 "−3,000원"(fg-neutral) · 수입 "+5,000원"(fg-brand)을 따로, 둘 다 있으면 사이 8. 금액은 자르지 않고(쉼표에서만 줄을 바꿀 수 있다)
 * 금액 가리기는 `card`(기본 가계부 거래 목록)를 따른다. 둘 다 0 이면 그리지 않는다.
 */
export function LedgerDayTotals({
  out,
  inn,
  card = "ledger.txList",
}: {
  /** 그날 지출 합 */
  out: number;
  /** 그날 수입 합 */
  inn: number;
  card?: HideCardKey;
}) {
  if (out <= 0 && inn <= 0) return null;
  return (
    <LedgerDaySum className="num" data-slot="ledger-day-totals">
      {out > 0 && (
        <span className="text-fg-neutral">
          <MaskAmount card={card} kind="expense">
            {MINUS}
            {wonPre()}
            {withCommaBreaks(KRW(out))}
          </MaskAmount>
          <WonUnit card={card} kind="expense" />
        </span>
      )}
      {inn > 0 && (
        <span className={cn("text-fg-brand", out > 0 && "ml-x2")}>
          <MaskAmount card={card} kind="income">
            +{wonPre()}
            {withCommaBreaks(KRW(inn))}
          </MaskAmount>
          <WonUnit card={card} kind="income" />
        </span>
      )}
    </LedgerDaySum>
  );
}

/** 리스트 하단 이전 달 이동 단추 — Button large neutralWeak 전체 폭 · 위 24. */
export function LedgerPrevBtn({
  className,
  type = "button",
  ...props
}: Omit<React.ComponentProps<typeof Button>, "variant" | "size">) {
  return (
    <Button
      type={type}
      variant="neutralWeak"
      size="large"
      className={cn("mt-x6 w-full", className)}
      {...props}
    />
  );
}
