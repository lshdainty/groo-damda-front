import { useTranslation } from "react-i18next";
import { Card } from "@/shared/ds/card";
import { Skeleton } from "@/shared/ds/skeleton";
import { cn } from "@/shared/lib/cn";
import { MaskAmount, WonUnit } from "@/shared/lib/groo/hide-amounts";
import { useHideAmounts, wonPre } from "@/shared/lib/groo/hide-amounts-core";
import { KRW, MINUS, minusOf } from "@/shared/lib/groo/format";
import { getWeekDays } from "@/shared/lib/date";
import { CALENDAR_CELL_CARDS } from "@/pages/expense/model/mobile-consts";
import {
  BAR_OPACITY,
  barStep,
  maxDailyOut,
  monthGrid,
  type CalendarDay,
} from "@/pages/expense/model/calendar-model";
import { BandFailure } from "@/shared/ui/groo/band-parts";
import { MonthHead } from "@/shared/ui/groo/month-head";
import { MonthKv } from "./MonthKv";
import { useDayLabel } from "./use-day-label";

/**
 * 날마다 지출 세기 막대 — 장식이다(`aria-hidden`). 날 숫자 아래 3 · 20 × 4 · 모서리 2, 라이트 bg-brand-solid · 다크 fg-brand.
 * 지출이 없는 날은 자리만 비워 칸 높이가 날마다 같다. 금액 가리기를 켜면 막대도 숨긴다(Q4-A) — 자리는 남긴다.
 */
export function IntensityBar({
  step,
  hidden,
  className,
}: {
  step: number;
  hidden: boolean;
  className?: string;
}) {
  const visible = step >= 0 && !hidden;
  return (
    <i
      aria-hidden
      data-slot="intensity-bar"
      data-step={visible ? step : undefined}
      className={cn(
        "block h-x1 w-5 shrink-0 rounded-r0_5 bg-bg-brand-solid dark:bg-fg-brand",
        !visible && "invisible",
        className,
      )}
      style={visible ? { opacity: BAR_OPACITY[step] } : undefined}
    />
  );
}

/**
 * 작은 달력 카드 (1280 이상 왼쪽 칸, I-07 26) — 달 이동 · 요일 · 6주 42칸 · 범례 · 수입 · 지출 · 합계.
 * 날은 버튼이다 — 누르면 오른쪽 목록이 그 날 묶음으로 옮긴다(거래가 없는 날은 아무 일도 없다). 앞뒤 달 칸은 누르지 못한다.
 * 고른 날 표시는 두지 않는다(Q11-A) — 오늘만 알약.
 */
export function MiniCalendar({
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
  /** 날마다 막대를 못 받았다 — 범례 자리에서 말한다(빈 달력으로 보이지 않게) */
  failed?: boolean;
  onRetry?: () => void;
}) {
  const { t: tc } = useTranslation("common");
  const { t } = useTranslation("expense");
  const dayLabel = useDayLabel();
  const weeks = monthGrid(month);
  const max = maxDailyOut(byDay, month);
  const hidden = useHideAmounts(CALENDAR_CELL_CARDS, "expense");
  const dows = getWeekDays();
  return (
    <Card
      data-slot="mini-calendar"
      aria-label={t("calendar.miniLabel")}
      className="px-x6 pb-x3 pt-x3"
    >
      <MonthHead month={month} onChange={onPickMonth} />
      <div
        role="group"
        aria-label={t("calendar.miniLabel")}
        className="mt-x2 grid grid-cols-7"
      >
        {dows.map((d) => (
          <span
            key={d}
            aria-hidden
            className="pb-x1_5 text-center text-t2 text-fg-neutral-subtle"
          >
            {d}
          </span>
        ))}
        {weeks.flat().map((c) => (
          <DayCell
            key={c.ds}
            c={c}
            today={today}
            out={byDay[c.ds]?.out ?? 0}
            step={c.inMonth ? barStep(byDay[c.ds]?.out ?? 0, max) : -1}
            hidden={hidden}
            loading={loading}
            label={dayLabel(c.ds, hidden ? 0 : (byDay[c.ds]?.out ?? 0))}
            hasData={!!byDay[c.ds]}
            onPick={onPickDay}
          />
        ))}
      </div>
      {failed && onRetry && (
        <BandFailure
          title={tc("query.failedNamed", { name: t("calendar.failedName") })}
          onRetry={onRetry}
        />
      )}
      {!hidden && !failed && (
        <p className="mb-x1 mt-x2 flex flex-wrap items-center gap-x1 text-t2 text-fg-neutral-subtle">
          <IntensityBar step={1} hidden={false} className="w-3" />
          <IntensityBar step={4} hidden={false} className="w-3" />
          {t("calendar.legend")}
        </p>
      )}
      <div className="mt-x2 flex flex-col">
        <MonthKv
          label={t("income")}
          loading={summaryLoading}
          tone="income"
          value={
            <MaskAmount card="ledger.monthSummary" kind="income">
              +{wonPre()}
              {KRW(monthIn)}
            </MaskAmount>
          }
          unit={<WonUnit card="ledger.monthSummary" kind="income" />}
        />
        <MonthKv
          label={t("expense")}
          loading={summaryLoading}
          value={
            <MaskAmount card="ledger.monthSummary" kind="expense">
              {minusOf(monthOut)}
              {wonPre()}
              {KRW(Math.abs(monthOut))}
            </MaskAmount>
          }
          unit={<WonUnit card="ledger.monthSummary" kind="expense" />}
        />
        <MonthKv
          label={t("txDetail.sumLabel")}
          loading={summaryLoading}
          value={
            <MaskAmount card="ledger.monthSummary" kind="net">
              {monthIn - monthOut >= 0 ? "+" : MINUS}
              {wonPre()}
              {KRW(Math.abs(monthIn - monthOut))}
            </MaskAmount>
          }
          unit={<WonUnit card="ledger.monthSummary" kind="net" />}
        />
      </div>
    </Card>
  );
}

function DayCell({
  c,
  today,
  out,
  step,
  hidden,
  loading,
  label,
  hasData,
  onPick,
}: {
  c: CalendarDay;
  today: string;
  out: number;
  step: number;
  hidden: boolean;
  loading: boolean;
  label: string;
  hasData: boolean;
  onPick: (ds: string) => void;
}) {
  const isToday = c.inMonth && c.ds === today;
  const future = c.inMonth && c.ds > today;
  const num = (
    <span
      className={cn(
        "num flex min-h-x6 min-w-x7 items-center justify-center rounded-r3 px-x1 text-t3 font-medium",
        !c.inMonth && "font-normal text-fg-neutral-subtle",
        future && "text-fg-neutral-subtle",
        c.inMonth && !future && "text-fg-neutral",
        isToday && "bg-bg-neutral-weak font-bold",
      )}
    >
      {c.day}
    </span>
  );
  const bar =
    loading && c.inMonth ? (
      <Skeleton text="t1" className="w-x8" />
    ) : (
      <IntensityBar step={out > 0 ? step : -1} hidden={hidden} />
    );
  const base =
    "flex min-h-11 flex-col items-center justify-center gap-x0_5 border-0 bg-transparent p-0";
  if (!c.inMonth) {
    return (
      <span aria-hidden className={base}>
        {num}
        <IntensityBar step={-1} hidden={false} />
      </span>
    );
  }
  return (
    <button
      type="button"
      aria-label={label}
      data-day={c.ds}
      data-has-data={hasData ? "" : undefined}
      className={cn(
        base,
        "cursor-pointer rounded-r2 hover:bg-bg-layer-default-pressed focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-stroke-focus-ring",
      )}
      onClick={() => onPick(c.ds)}
    >
      {num}
      {bar}
    </button>
  );
}
