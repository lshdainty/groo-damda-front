import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/shared/ds/button";
import { Card } from "@/shared/ds/card";
import { Skeleton } from "@/shared/ds/skeleton";
import { cn } from "@/shared/lib/cn";
import { getWeekDays } from "@/shared/lib/date";
import { KRW, MINUS, minusOf } from "@/shared/lib/groo/format";
import { MaskAmount, WonUnit } from "@/shared/lib/groo/hide-amounts";
import { useHideAmounts, wonPre } from "@/shared/lib/groo/hide-amounts-core";
import { CALENDAR_CELL_CARDS } from "@/pages/expense/model/mobile-consts";
import {
  barStep,
  maxDailyOut,
  monthGrid,
  visibleWeekIndex,
  type CalendarDay,
} from "@/pages/expense/model/calendar-model";
import { IntensityBar } from "./MiniCalendar";
import { useDayLabel } from "./use-day-label";
import { BandFailure } from "@/shared/ui/groo/band-parts";
import { MonthHead } from "@/shared/ui/groo/month-head";

function Metric({
  label,
  loading,
  tone,
  children,
}: {
  label: string;
  loading: boolean;
  tone: "income" | "neutral";
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-x1">
      <span className="text-t3 font-medium text-fg-neutral-subtle">
        {label}
      </span>
      {loading ? (
        <Skeleton text="t7" className="w-24" />
      ) : (
        <span
          data-metric=""
          className={cn(
            "num whitespace-nowrap text-t7 font-bold",
            tone === "income" ? "text-fg-brand" : "text-fg-neutral",
          )}
        >
          {children}
        </span>
      )}
    </div>
  );
}

/**
 * 태블릿(768 ~ 1279) 요약 카드 (I-07 27) — 달 이동 · 수입 · 지출 · 합계 세 칸 · 주 달력(펼치면 그 달 6주).
 * 세 칸 값은 그 달 서버 요약 — 필터와 무관하다. 칸이 좁아 값이 넘치는 큰 글자에서는 칸이 위아래로 쌓인다.
 * 보이는 주 = 오늘이 든 주(다른 달이면 첫 주). 날을 누르면 목록이 그 날로 옮긴다.
 */
export function SummaryCard({
  month,
  onPickMonth,
  today,
  byDay,
  loading,
  monthIn,
  monthOut,
  summaryLoading,
  onPickDay,
  failed = false,
  onRetry,
}: {
  month: string;
  onPickMonth: (month: string) => void;
  today: string;
  byDay: Record<string, { out: number; inn: number }>;
  loading: boolean;
  monthIn: number;
  monthOut: number;
  summaryLoading: boolean;
  onPickDay: (ds: string) => void;
  /** 날마다 막대를 못 받았다 — 주 달력 아래에서 말한다 */
  failed?: boolean;
  onRetry?: () => void;
}) {
  const { t } = useTranslation("expense");
  const { t: tc } = useTranslation("common");
  const dayLabel = useDayLabel();
  const [expanded, setExpanded] = useState(false);
  const weeks = monthGrid(month);
  const max = maxDailyOut(byDay, month);
  const hidden = useHideAmounts(CALENDAR_CELL_CARDS, "expense");
  const shown = expanded
    ? weeks
    : [weeks[visibleWeekIndex(weeks, today)] ?? []];
  const dows = getWeekDays();
  return (
    <Card data-slot="summary-card" className="px-x6 pb-x6 pt-x4">
      <MonthHead month={month} onChange={onPickMonth} />
      <div className="mt-x3 grid grid-cols-[repeat(auto-fit,minmax(10.5rem,1fr))] gap-x6">
        <Metric label={t("income")} loading={summaryLoading} tone="income">
          <MaskAmount card="ledger.monthSummary" kind="income">
            +{wonPre()}
            {KRW(monthIn)}
          </MaskAmount>
          <WonUnit card="ledger.monthSummary" kind="income" />
        </Metric>
        <Metric label={t("expense")} loading={summaryLoading} tone="neutral">
          <MaskAmount card="ledger.monthSummary" kind="expense">
            {minusOf(monthOut)}
            {wonPre()}
            {KRW(Math.abs(monthOut))}
          </MaskAmount>
          <WonUnit card="ledger.monthSummary" kind="expense" />
        </Metric>
        <Metric
          label={t("txDetail.sumLabel")}
          loading={summaryLoading}
          tone="neutral"
        >
          <MaskAmount card="ledger.monthSummary" kind="net">
            {monthIn - monthOut >= 0 ? "+" : MINUS}
            {wonPre()}
            {KRW(Math.abs(monthIn - monthOut))}
          </MaskAmount>
          <WonUnit card="ledger.monthSummary" kind="net" />
        </Metric>
      </div>
      <div
        role="group"
        id="expense-week-strip"
        aria-label={t("txm.monthCalendar")}
        className="mt-x4 flex flex-col gap-y-x1"
      >
        <div aria-hidden className="grid grid-cols-7 gap-x1_5">
          {dows.map((d, i) => (
            <span
              key={d}
              className={cn(
                "text-center text-t3 text-fg-neutral-subtle",
                i === 0 && "text-fg-critical",
                i === 6 && "text-fg-brand",
              )}
            >
              {d}
            </span>
          ))}
        </div>
        {shown.map((w, wi) => (
          <div key={wi} className="grid grid-cols-7 gap-x1_5">
            {w.map((c) => (
              <WeekCell
                key={c.ds}
                c={c}
                today={today}
                step={c.inMonth ? barStep(byDay[c.ds]?.out ?? 0, max) : -1}
                out={byDay[c.ds]?.out ?? 0}
                hidden={hidden}
                loading={loading}
                label={dayLabel(c.ds, hidden ? 0 : (byDay[c.ds]?.out ?? 0))}
                onPick={onPickDay}
              />
            ))}
          </div>
        ))}
      </div>
      {failed && onRetry && (
        <BandFailure
          title={tc("query.failedNamed", { name: t("calendar.failedName") })}
          onRetry={onRetry}
        />
      )}
      <div className="-mb-x3 mt-x1 flex justify-center">
        <Button
          variant="ghost"
          size="medium"
          layout="iconOnly"
          aria-label={t("txm.monthCalendar")}
          aria-expanded={expanded}
          aria-controls="expense-week-strip"
          onClick={() => setExpanded((v) => !v)}
        >
          <ChevronDown
            className={cn("transition-transform", expanded && "rotate-180")}
          />
        </Button>
      </div>
    </Card>
  );
}

function WeekCell({
  c,
  today,
  step,
  out,
  hidden,
  loading,
  label,
  onPick,
}: {
  c: CalendarDay;
  today: string;
  step: number;
  out: number;
  hidden: boolean;
  loading: boolean;
  label: string;
  onPick: (ds: string) => void;
}) {
  const isToday = c.inMonth && c.ds === today;
  const future = c.inMonth && c.ds > today;
  const num = (
    <span
      className={cn(
        "num flex min-h-x9 min-w-x9 items-center justify-center rounded-full px-x1 text-t5 font-bold",
        (future || !c.inMonth) && "font-medium text-fg-neutral-subtle",
        c.inMonth && !future && "text-fg-neutral",
        isToday && "bg-bg-neutral-weak",
      )}
    >
      {c.day}
    </span>
  );
  const body = (
    <>
      {num}
      {loading && c.inMonth ? (
        <Skeleton text="t1" className="w-x8" />
      ) : (
        <IntensityBar step={c.inMonth && out > 0 ? step : -1} hidden={hidden} />
      )}
    </>
  );
  const base = "flex min-h-11 flex-col items-center justify-center gap-x1";
  if (!c.inMonth)
    return (
      <span aria-hidden className={base}>
        {body}
      </span>
    );
  return (
    <button
      type="button"
      aria-label={label}
      data-day={c.ds}
      data-has-data={out > 0 ? "" : undefined}
      className={cn(
        base,
        "cursor-pointer rounded-r2 border-0 bg-transparent p-0 hover:bg-bg-layer-default-pressed focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-stroke-focus-ring",
      )}
      onClick={() => onPick(c.ds)}
    >
      {body}
    </button>
  );
}
