import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Pie, PieChart } from "recharts";
import { Eye, EyeOff, Wallet } from "lucide-react";
import {
  Card,
  CardAction,
  CardHeader,
  CardHeroAmount,
  CardHeroLabel,
  CardTitle,
  Delta,
} from "@/shared/ds/card";
import {
  Chart,
  ChartDataTable,
  ChartDonutCenter,
  ChartDonutLegend,
  ChartTooltip,
  ChartTooltipContent,
  chartDonutRadii,
  type ChartColor,
} from "@/shared/ds/chart";
import { Checkmark } from "@/shared/ds/checkbox";
import { dsMoney, useDsText, withCommaBreaks } from "@/shared/ds/i18n";
import { List, ListButtonItem, ListItem } from "@/shared/ds/list";
import { Progress } from "@/shared/ds/progress";
import { ResultSection } from "@/shared/ds/result-section";
import { toggleVariants } from "@/shared/ds/toggle";
import { Badge } from "@/shared/ds/badge";
import { Skeleton, LoadingRegion } from "@/shared/ds/skeleton";
import { cn } from "@/shared/lib/cn";
import { formatDateSmart } from "@/shared/lib/date";
import {
  MINUS,
  formatChangeRate,
  formatPercent,
} from "@/shared/lib/groo/format";
import { getPaletteByColor } from "@/shared/lib/groo/chart-palette";
import { useHideAmounts } from "@/shared/lib/groo/hide-amounts-core";
import { ExpenseRow, type Expense } from "@/entities/expense";
import type { DashboardSummary } from "@/features/dashboard";
import type { HomeSlice } from "./home-shared";
import { useMasked, won, wonIn, wonOut } from "./home-money";

/*
 * 홈의 구역 부품 — 폰 띠 · 데스크톱 카드가 같은 내용을 같은 부품으로 그린다(I-06 짝 1 · 짝 2).
 * 금액은 글로 만들어 ds 부품에 넘긴다(쉼표 뒤 줄바꿈 · 원까지) — 가리면 "••••".
 */

// ── 머리 ───────────────────────────────────────────────────────
/**
 * 구역 머리 = ds Card 머리 값(I-06 9) — 제목 t5 700, 동작 글 버튼 "전체 보기"(꺾쇠 없음 · 이름 "{제목} 전체 보기").
 * 덧붙임(연체 배지 · 오늘 합계)은 제목 heading 밖에 둔다. 띠(폰)는 카드 문맥이 없어 머리 여백을 직접 준다.
 */
export function HomeHead({
  title,
  suffix,
  action,
  band,
  list = false,
}: {
  title: string;
  suffix?: ReactNode;
  action?: { label: string; onClick: () => void };
  /** 폰 띠 안 — 카드 문맥이 없으니 머리 여백(위 24 · 좌우 24)을 준다 */
  band?: boolean;
  /** 목록 구역(머리 아래 4) · 글 · 숫자 · 차트 구역(머리 아래 8) */
  list?: boolean;
}) {
  const { t } = useTranslation("dashboard");
  const titleEl = <CardTitle>{title}</CardTitle>;
  return (
    <CardHeader
      className={band ? cn("px-x6 pt-x6", list ? "pb-x1" : "pb-x2") : undefined}
    >
      {suffix != null ? (
        <div className="flex min-w-0 flex-wrap items-baseline gap-x1_5">
          {titleEl}
          {suffix}
        </div>
      ) : (
        titleEl
      )}
      {action && (
        <CardAction
          onClick={action.onClick}
          aria-label={t("viewAllOf", { title })}
        >
          {action.label}
        </CardAction>
      )}
    </CardHeader>
  );
}

// ── 실패 · 비었음 · 불러오는 중 ─────────────────────────────────
/** 구역 안 실패 — Result Section medium failure + "다시 시도"(I-06 33). 서버 오류 원문은 그리지 않는다 */
export function SectionFailure({
  title,
  onRetry,
  band,
  className,
}: {
  title: string;
  onRetry: () => void;
  band?: boolean;
  className?: string;
}) {
  const dsT = useDsText();
  const { t } = useTranslation("dashboard");
  return (
    <ResultSection
      kind="failure"
      size="medium"
      as="h3"
      title={title}
      description={t("loadFailedDesc")}
      primaryAction={{ label: dsT("common.retry"), onClick: onRetry }}
      className={cn(band && "px-x6", "[[data-slot=card]_&]:px-0", className)}
    />
  );
}

/** 빈 글 — R9 혼자 서는 안내(t4 · fg-neutral-subtle, 결정 4B) 가운데 한 줄, 위아래 12 */
export function EmptyLine({ children }: { children: ReactNode }) {
  return (
    <p className="m-0 py-x3 text-center text-t4 text-fg-neutral-subtle">
      {children}
    </p>
  );
}

/**
 * 목록 줄 스켈레톤 — 실제 줄과 같은 높이(List 한 줄 46 · 두 줄 66, I-06 33).
 * plain = 글 한 줄(이번 달 가계부 키-값), dot = 앞 원 20 + 제목 + 값(일정 · 할 일), tx = 앞 타일 40 + 제목 · 설명 + 금액(오늘 쓴 돈 · 결제).
 */
export function RowsSkeleton({
  rows = 2,
  kind = "plain",
}: {
  rows?: number;
  kind?: "plain" | "dot" | "tx";
}) {
  return (
    <LoadingRegion
      pending
      className="contents"
      fallback={
        <>
          {Array.from({ length: rows }, (_, i) => (
            <div key={i} className="flex items-center gap-x3 px-x6 py-x3">
              {kind === "dot" && (
                <Skeleton radius="full" className="size-x5 shrink-0" />
              )}
              {kind === "tx" && (
                <Skeleton radius="12" className="size-x10 shrink-0" />
              )}
              {kind === "tx" ? (
                <div className="flex min-w-0 flex-1 flex-col gap-x0_5">
                  <Skeleton text="t5" className="w-3/4" />
                  <Skeleton text="t3" className="w-1/2" />
                </div>
              ) : (
                <Skeleton
                  text="t5"
                  className={kind === "plain" ? "w-3/4" : "min-w-0 flex-1"}
                />
              )}
              {kind !== "plain" && (
                <Skeleton text="t5" className="w-x10 shrink-0" />
              )}
            </div>
          ))}
        </>
      }
    />
  );
}

// ── 순자산 ─────────────────────────────────────────────────────
export type HeroData = {
  loading: boolean;
  label: string;
  netWorth: number;
  totalAssets: number;
  totalDebt: number;
  hasLastMonth: boolean;
  changePercent: number;
  changeAmount: number;
  /** 데스크톱만 — 변화액 글을 Delta 뒤에 둔다 */
  showChangeAmount: boolean;
  assetLabel: string;
  debtLabel: string;
  onHideSettings: () => void;
};

// 채움 위 스켈레톤 — 흰 18%(ds Skeleton 에 채움 위 톤이 없어 지금 앱 값을 둔다)
const HERO_SKELETON =
  "!bg-[color-mix(in_srgb,var(--color-static-white)_18%,transparent)]";
const HERO_LINE =
  "border-[color-mix(in_srgb,var(--color-static-white)_14%,transparent)]";

/**
 * 순자산 = ds Card hero(I-06 11 ~ 15). 폰은 모서리 0 띠(.screen-bands 가 hero 를 흰 띠로 칠하지 않는다),
 * 데스크톱은 카드(모서리 16 · 여백 24).
 */
export function HeroCard({ data, band }: { data: HeroData; band?: boolean }) {
  const { t } = useTranslation("dashboard");
  const hiddenNet = useHideAmounts("home.netWorth");
  const m = useMasked("home.netWorth");
  const dir =
    data.changeAmount > 0 ? "up" : data.changeAmount < 0 ? "down" : "flat";
  return (
    <Card variant="hero" className={cn(band && "rounded-none")}>
      <div className="flex items-center justify-between gap-x2">
        <CardHeroLabel className="flex min-w-0 items-center gap-x1_5">
          <Wallet aria-hidden size={16} />
          {data.label}
        </CardHeroLabel>
        {/* 금액 가리기 설정 단추 — 설정으로 가는 버튼이라 Toggle 이 아니다(toggle.md:102 aria-pressed 없음). 채움 위 톤 */}
        <button
          type="button"
          aria-label={t("hideAmountsSettings")}
          onClick={data.onHideSettings}
          className={cn(toggleVariants({ tone: "inverted" }), "-my-x2 -mr-x2")}
        >
          {hiddenNet ? (
            <EyeOff aria-hidden size={20} />
          ) : (
            <Eye aria-hidden size={20} />
          )}
        </button>
      </div>
      {data.loading ? (
        <LoadingRegion
          pending
          className="contents"
          noteClassName="text-static-white"
          fallback={
            <>
              <Skeleton
                text="t12"
                radius="8"
                className={cn("mt-x1_5 w-3/4", HERO_SKELETON)}
              />
              <Skeleton
                text="t3"
                className={cn("mt-x1 w-1/2", HERO_SKELETON)}
              />
              <div
                className={cn(
                  "mt-x5 grid grid-cols-2 border-t pt-x4",
                  HERO_LINE,
                )}
              >
                <Skeleton text="t5" className={cn("w-2/3", HERO_SKELETON)} />
                <Skeleton
                  text="t5"
                  className={cn("ml-x4 w-2/3", HERO_SKELETON)}
                />
              </div>
            </>
          }
        />
      ) : (
        <>
          <CardHeroAmount>{m(won(data.netWorth))}</CardHeroAmount>
          <div className="mt-x1 flex flex-wrap items-baseline gap-x1_5 text-t3 text-static-white">
            {data.hasLastMonth ? (
              <>
                <Delta
                  direction={dir}
                  value={formatChangeRate(data.changePercent, { sign: "none" })}
                  text={t("lastMonthThan")}
                />
                {data.showChangeAmount && data.changeAmount !== 0 && (
                  <span className="tabular-nums">
                    ({m(won(Math.abs(data.changeAmount)))})
                  </span>
                )}
              </>
            ) : (
              // 지난달 기록이 없으면 변화액도 '변화' 가 아니라 그냥 현재 순자산이라 같이 숨긴다.
              t("noLastMonth")
            )}
          </div>
          <div
            className={cn("mt-x5 grid grid-cols-2 border-t pt-x4", HERO_LINE)}
          >
            <HeroCell label={data.assetLabel}>
              {m(won(data.totalAssets))}
            </HeroCell>
            <HeroCell
              label={data.debtLabel}
              className={cn("border-l pl-x4", HERO_LINE)}
            >
              {m(wonOut(data.totalDebt))}
            </HeroCell>
          </div>
        </>
      )}
    </Card>
  );
}

function HeroCell({
  label,
  children,
  className,
}: {
  label: string;
  children: string;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0 pr-x4 last:pr-0", className)}>
      <CardHeroLabel>{label}</CardHeroLabel>
      <div className="mt-x1 text-t5 font-bold tabular-nums text-static-white">
        {withCommaBreaks(children)}
      </div>
    </div>
  );
}

/** 순자산 실패 — 채움 위가 아니라 흰 면 + 머리 "순자산"(ds Result Section 은 채움 위 톤이 없다 — 색을 덮지 않는다) */
export function NetWorthFailure({
  title,
  onRetry,
  band,
}: {
  title: string;
  onRetry: () => void;
  band?: boolean;
}) {
  const { t } = useTranslation("dashboard");
  return (
    <>
      <HomeHead band={band} title={t("asset.netAsset")} />
      <div className={band ? "pb-x6" : undefined}>
        <SectionFailure band={band} title={title} onRetry={onRetry} />
      </div>
    </>
  );
}

// ── 이번 달 안내 ───────────────────────────────────────────────
/** 안내 한 줄 — R9(t3 · 400 · fg-neutral-subtle), 금액 · 비율만 700 · fg-neutral. 색으로 좋고 나쁨을 말하지 않는다 */
export function MonthNote({
  prefix,
  dailyAvg,
  prevExpense,
  savingsPct,
}: {
  /** 데스크톱 — 잔액 앞붙이 "잔액 +1,000원 · " */
  prefix?: ReactNode;
  dailyAvg: number;
  prevExpense: number;
  savingsPct: number;
}) {
  const { t } = useTranslation("dashboard");
  const m = useMasked("home.monthExpense", "expense");
  return (
    <p className="m-0 text-t3 text-fg-neutral-subtle">
      {prefix}
      {t("avg.dailyAverage")}{" "}
      <b className="font-bold tabular-nums text-fg-neutral">
        {m(won(dailyAvg))}
      </b>{" "}
      {t("avg.spent")}
      {prevExpense > 0 && (
        <>
          {" "}
          {t("avg.vsPrev")}{" "}
          <b className="font-bold tabular-nums text-fg-neutral">
            {formatChangeRate(Math.abs(savingsPct), { sign: "none" })}
          </b>{" "}
          {savingsPct > 0
            ? t("avg.saving")
            : savingsPct < 0
              ? t("avg.spentMore")
              : t("avg.same")}
        </>
      )}
    </p>
  );
}

/** 폰 "이번 달 가계부" — 키-값 두 줄(수입 fg-brand + "+", 지출 fg-neutral + U+2212) */
export function MonthRows({
  income,
  expense,
}: {
  income: number;
  expense: number;
}) {
  const { t } = useTranslation("dashboard");
  const mIn = useMasked("home.monthExpense", "income");
  const mOut = useMasked("home.monthExpense", "expense");
  return (
    <List className="[&_[data-slot=list-content]]:py-x2">
      <ListItem
        title={t("chart.income")}
        suffix={
          <span className="whitespace-nowrap font-bold tabular-nums text-fg-brand">
            {mIn(wonIn(income))}
          </span>
        }
      />
      <ListItem
        title={t("chart.expense")}
        suffix={
          <span className="whitespace-nowrap font-bold tabular-nums text-fg-neutral">
            {mOut(wonOut(expense))}
          </span>
        }
      />
    </List>
  );
}

// ── 카테고리 도넛 ──────────────────────────────────────────────
/** 글 폭이 limit 이하인가 — 잰 글 요소의 크기가 바뀔 때만 상태로 옮긴다(ResizeObserver 콜백) */
function useFitLimit(limit: number) {
  const ref = useRef<HTMLSpanElement>(null);
  const [fits, setFits] = useState(true);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(() =>
      setFits(el.getBoundingClientRect().width <= limit),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [limit]);
  return [ref, fits] as const;
}

export type ColoredSlice = HomeSlice & { color: ChartColor; fill: string };

/**
 * 카테고리 도넛 = ds Chart 도넛 + 목록 범례(I-06 18 ~ 20). 폰은 가운데 글 없이 늘 목록 위 합계 줄(2A),
 * 데스크톱은 가운데에 들어갈 때만 가운데, 안 들면 합계 줄.
 */
export function CategoryBody({
  slices,
  size,
  center,
  month,
  totalLabel,
}: {
  slices: ColoredSlice[];
  size: number;
  /** 합계 라벨 — 이번 달이면 "이번 달 지출", 아니면 "{n}월 지출" */
  totalLabel?: string;
  /** 데스크톱 — 가운데 합계를 시도한다 */
  center: boolean;
  month: number;
}) {
  const { t } = useTranslation("dashboard");
  const m = useMasked("home.categoryDonut");
  const [dsFits, setDsFits] = useState(true);
  const total = slices.reduce((a, s) => a + s.amount, 0);
  const totalText = m(won(total));
  // 가운데 합계 판정 = 결정 2A "금액 글 폭 ≤ 구멍 − 16"(ds 판정 101.1 이 아니라 화면이 직접 쓴다 — 폭 100 ~ 101.1 의 금액에서 갈린다)
  const hole = chartDonutRadii(size).innerRadius * 2;
  const [measureRef, decisionFits] = useFitLimit(hole - 16);
  const showCenter = center && decisionFits;
  const showRow = !showCenter || !dsFits;
  const legendId = `home-cat-legend-${size}`;
  const pct = (v: number) => formatPercent((v / total) * 100, "share");
  return (
    <div className="relative flex flex-col">
      {center && (
        <span
          ref={measureRef}
          aria-hidden
          className="pointer-events-none invisible absolute whitespace-nowrap text-t5 font-bold tabular-nums"
        >
          {totalText}
        </span>
      )}
      <Chart
        label={t("chart.categoryName", { month, total: totalText })}
        legendId={legendId}
        height={size}
      >
        <PieChart>
          <Pie
            data={slices}
            dataKey="amount"
            nameKey="name"
            {...chartDonutRadii(size)}
          />
          <ChartTooltip
            content={
              <ChartTooltipContent valueFormatter={(v) => m(won(Number(v)))} />
            }
          />
        </PieChart>
        {showCenter && (
          <ChartDonutCenter
            label={totalLabel ?? t("summary.monthlyExpense")}
            amount={totalText}
            onFitChange={setDsFits}
          />
        )}
      </Chart>
      {showRow && (
        <div
          data-slot="home-donut-total"
          className="mt-x4 flex items-baseline justify-between gap-x3"
        >
          <span className="text-t3 text-fg-neutral-subtle">
            {totalLabel ?? t("summary.monthlyExpense")}
          </span>
          <span className="min-w-0 text-end text-t5 font-bold tabular-nums text-fg-neutral">
            {withCommaBreaks(totalText)}
          </span>
        </div>
      )}
      <ChartDonutLegend
        id={legendId}
        className="mt-x4"
        items={slices.map((s) => ({
          key: s.id,
          label: s.name,
          color: s.color,
          percent: pct(s.amount),
          amount: m(won(s.amount)),
        }))}
      />
      <ChartDataTable
        caption={t("chart.categoryName", { month, total: totalText })}
        columns={[
          t("chart.tableCategory"),
          t("chart.tablePercent"),
          t("expense.actual"),
        ]}
        rows={slices.map((s) => [s.name, pct(s.amount), m(won(s.amount))])}
      />
    </div>
  );
}

export function CategorySkeleton({ size }: { size: number }) {
  return (
    <LoadingRegion
      pending
      className="contents"
      fallback={
        <>
          <div className="flex flex-col">
            <div className="flex justify-center">
              <Skeleton radius="full" style={{ width: size, height: size }} />
            </div>
            {/* 범례 줄 높이 = 실제 줄(min-h-11 — 44) */}
            <div className="mt-x4 flex flex-col">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="flex min-h-11 items-center gap-x2">
                  <Skeleton radius="4" className="size-2.5 shrink-0" />
                  <Skeleton text="t4" className="min-w-0 flex-1" />
                  <Skeleton text="t4" className="w-x10 shrink-0" />
                </div>
              ))}
            </div>
          </div>
        </>
      }
    />
  );
}

// ── 예산 ───────────────────────────────────────────────────────
export type BudgetItem = {
  rowId: number;
  categoryName: string;
  isAll: boolean;
  budgetAmount: number;
  spent: number;
};

/** 예산 줄 = ds Progress limit(I-06 22) — 카테고리 타일 · 주의 구간 색 없음, 넘치면 끝까지 fg-critical + "N원 초과" */
export function BudgetBody({ items }: { items: BudgetItem[] }) {
  const { t } = useTranslation("dashboard");
  const m = useMasked("home.budget");
  return (
    <div className="flex flex-col gap-x5">
      {items.map((b) => (
        <Progress
          key={b.rowId}
          label={
            b.isAll ? t("allBudget") : t("budgetName", { name: b.categoryName })
          }
          value={b.spent}
          max={b.budgetAmount}
          formatValue={(v) => m(won(v))}
        />
      ))}
    </div>
  );
}

export function BudgetSkeleton() {
  return (
    <LoadingRegion
      pending
      className="contents"
      fallback={
        <>
          <div className="flex flex-col gap-x5">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex flex-col gap-x1_5">
                <Skeleton text="t4" className="w-1/3" />
                <Skeleton className="h-2 w-full" radius="full" />
                <Skeleton text="t2" className="w-1/2" />
              </div>
            ))}
          </div>
        </>
      }
    />
  );
}

// ── 목록 줄: 일정 · 할 일 · 오늘 쓴 돈 ────────────────────────────
// 앞 붙이개를 제목 첫 줄 가운데에 둔다 — 높이 = 제목 한 줄(t5 줄 높이). 한 줄 · 위 맞춤 어느 쪽이든 같다
const PREFIX_LINE = "inline-flex h-[var(--text-t5--line-height)] items-center";

/**
 * 제목이 두 줄을 넘는 줄이 하나라도 있으면 그 목록은 위 맞춤(list.md:50 — 한 목록 안 맞춤을 섞지 않는다).
 * 줄 폭에 따라 달라지므로 그린 뒤 잰다(ResizeObserver 콜백에서만 상태로 옮긴다).
 */
function useTopAlign() {
  const ref = useRef<HTMLUListElement>(null);
  const [top, setTop] = useState(false);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      const over = Array.from(
        el.querySelectorAll<HTMLElement>("[data-slot=list-title]"),
      ).some((title) => {
        const line = parseFloat(getComputedStyle(title).lineHeight);
        return Number.isFinite(line) && title.offsetHeight > line * 2 + 1;
      });
      setTop(over);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, top ? ("top" as const) : ("center" as const)] as const;
}

/** 다가오는 일정 줄 — 앞 점 8(캘린더 색), 제목 줄바꿈, 뒤 "오늘" · "내일" · "D-n"(사흘 안 fg-warning — 곧 문제가 될 것, 넘침은 critical) */
export function EventRows({
  events,
  onOpen,
}: {
  events: DashboardSummary["upcomingEvents"];
  onOpen: () => void;
}) {
  const { t } = useTranslation("dashboard");
  const [ref, align] = useTopAlign();
  return (
    <List ref={ref}>
      {events.map((ev) => (
        <ListButtonItem
          key={ev.rowId}
          title={ev.title}
          align={align}
          prefix={
            <span className={PREFIX_LINE}>
              <span
                aria-hidden
                className="mx-x1 size-x2 rounded-full"
                style={{
                  background: ev.color
                    ? getPaletteByColor(ev.color).color
                    : "var(--color-fg-brand)",
                }}
              />
            </span>
          }
          suffix={
            <span
              className={cn(
                "whitespace-nowrap tabular-nums",
                ev.daysUntil <= 3 && "text-fg-warning",
              )}
            >
              {ev.daysUntil === 0
                ? t("schedule.today")
                : ev.daysUntil === 1
                  ? t("schedule.tomorrow")
                  : t("date:dday", { count: ev.daysUntil })}
            </span>
          }
          onClick={onOpen}
        />
      ))}
    </List>
  );
}

/**
 * 최근 할 일 줄 — 앞 칸은 할 일 화면과 같은 square neutral Checkbox 모양의 표시용(누르면 줄 전체가 할 일로 간다 — 체크가 아니다), 완료는 체크 + 취소선,
 * 뒤 마감 "MM-DD"(지난 것 fg-critical).
 */
export function TodoRows({
  todos,
  todayStr,
  onOpen,
}: {
  todos: DashboardSummary["recentTodos"];
  todayStr: string;
  onOpen: () => void;
}) {
  const [ref, align] = useTopAlign();
  return (
    <List ref={ref}>
      {todos.map((td) => {
        const done = td.status === "COMPLETED";
        const isOver =
          !done && !!td.dueDate && td.dueDate.slice(0, 10) < todayStr;
        return (
          <ListButtonItem
            key={td.rowId}
            title={
              <span
                className={done ? "text-fg-disabled line-through" : undefined}
              >
                {td.title}
              </span>
            }
            align={align}
            prefix={
              <span className={PREFIX_LINE}>
                <Checkmark
                  aria-hidden
                  tabIndex={-1}
                  size="large"
                  shape="square"
                  tone="neutral"
                  checked={done}
                  className={cn(
                    "pointer-events-none",
                    isOver &&
                      "data-[state=unchecked]:border-stroke-critical-solid",
                  )}
                />
              </span>
            }
            suffix={
              td.dueDate ? (
                <span
                  className={cn(
                    "whitespace-nowrap tabular-nums",
                    isOver && "text-fg-critical",
                  )}
                >
                  {formatDateSmart(td.dueDate.slice(0, 10))}
                </span>
              ) : undefined
            }
            onClick={onOpen}
          />
        );
      })}
    </List>
  );
}

/** 오늘 쓴 돈 줄 — 공용 거래 줄(I-06 28), 금액은 홈 카드(`home.todaySpend`)로 가린다(29) */
export function TodayRows({
  items,
  onOpen,
}: {
  items: Expense[];
  onOpen: (e: Expense) => void;
}) {
  return (
    <div data-row-list>
      {items.map((e) => (
        <ExpenseRow
          key={e.rowId}
          expense={e}
          maskCard="home.todaySpend"
          gutter
          onClick={onOpen}
        />
      ))}
    </div>
  );
}

/** 오늘 합계 — 머리 덧붙임(R13 줄 금액) */
export function TodayTotal({ total }: { total: number }) {
  const m = useMasked("home.todaySpend");
  return (
    <span className="min-w-0 max-w-full text-t5 font-bold tabular-nums text-fg-neutral">
      {withCommaBreaks(m(MINUS + dsMoney(total)))}
    </span>
  );
}

/** 최근 할 일 머리 덧붙임 — 연체 배지(ds Badge weak critical medium). 읽는 글은 "연체 23건" */
export function OverdueBadge({ count }: { count: number }) {
  const { t } = useTranslation("dashboard");
  return (
    <Badge variant="weak" tone="critical" size="medium">
      <span aria-hidden>{t("todo.overdueBadge", { count })}</span>
      <span className="sr-only">{t("todo.overdueSr", { count })}</span>
    </Badge>
  );
}
