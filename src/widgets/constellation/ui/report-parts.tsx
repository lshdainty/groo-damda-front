import { useRef, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight, Telescope } from "lucide-react";
import { Badge } from "@/shared/ds/badge";
import { Button } from "@/shared/ds/button";
import { List, ListItem } from "@/shared/ds/list";
import { Skeleton } from "@/shared/ds/skeleton";
import { cn } from "@/shared/lib/cn";
import { useWeekdayFit, WeekdayProbe } from "@/shared/ds/date-picker";
import {
  constellationColorVar,
  constellationName,
} from "@/features/constellation";
import type { TodoPriority } from "@/entities/todo";
import { PRIO_COLOR, PRIO_ORDER, WEIGHT } from "../lib/week";
import type { ReportModel } from "../model/use-report-model";
import { ConstellationSVG } from "./ConstellationSVG";
import {
  HeadNote,
  SectionBody,
  SectionHead,
  type Place,
} from "./section-parts";

/*
 * 관측 리포트의 구역 부품(I-11 16 ~ 21) — 폰 흰 면(band)과 데스크톱 카드(card)가 같은 내용을 같은 부품으로 그린다.
 * 흰 면 안은 구역 제목 위 20 · 좌우 24 · 제목 ↔ 본문 8, 본문 아래 16 — 앞 구역 끝 16 + 다음 제목 위 20 = 36(T8). 테두리 카드 0.
 * 카드 안은 ds Card 머리(위 24 · 좌우 24 · 아래 8)와 본문 24 그대로다.
 */
// ── 주 고르기 · 날 줄 · 날짜 줄 (16) ─────────────────────────────────
/**
 * 주 고르기 + 날 줄 7칸 + 날짜 줄 — 페이지를 조절하는 줄이라 첫 내용(관측 결과)과 한 덩어리다(위 4, 날짜 줄 아래 16 은 결과가 준다).
 * 갈 수 없는 쪽은 Button disabled(fg-disabled), 오는 날은 눌리지 않고 fg-neutral-subtle · 500 — 흐리게 하지 않는다.
 */
export function WeekPicker({ m, place }: { m: ReportModel; place: Place }) {
  const { t } = useTranslation("constellation");
  // 7일 띠 요일 — ds 요일 글(영어 두 글자, 칸에 들지 않으면 한 글자 — groo-design #256) · 요일 · 날짜 숫자는 글자 크기 설정을 따르지 않는다(#260)
  const weekdayRef = useRef<HTMLDivElement>(null);
  const weekday = useWeekdayFit(weekdayRef);
  return (
    <div className={cn(place === "band" && "px-x6 pt-x1")}>
      <div className="flex items-center justify-center gap-x1">
        <Button
          type="button"
          variant="ghost"
          layout="iconOnly"
          aria-label={t("report.prevWeek")}
          disabled={!m.canPrev}
          onClick={m.prevWeek}
        >
          <ChevronLeft aria-hidden />
        </Button>
        <span className="min-w-0 text-center text-t5 font-bold tabular-nums text-fg-neutral">
          {m.rangeLabel}
        </span>
        <Button
          type="button"
          variant="ghost"
          layout="iconOnly"
          aria-label={t("report.nextWeek")}
          disabled={!m.canNext}
          onClick={m.nextWeek}
        >
          <ChevronRight aria-hidden />
        </Button>
      </div>
      <div
        ref={weekdayRef}
        className="-mx-x3 mt-x2 grid grid-cols-[repeat(7,minmax(0,1fr))]"
      >
        {m.days.map((ds) => {
          const future = ds > m.todayISO;
          const isTodayCell = ds === m.todayISO;
          const picked = m.sel === ds;
          const dow = new Date(`${ds}T00:00:00`).getDay();
          return (
            <button
              key={ds}
              type="button"
              data-day={ds}
              disabled={future}
              aria-pressed={picked}
              aria-current={isTodayCell ? "date" : undefined}
              aria-label={m.dayName(ds)}
              onClick={() => m.setSel(ds)}
              className="relative flex min-h-[44px] min-w-0 cursor-pointer flex-col items-center gap-x1 border-0 bg-transparent p-0 font-sans disabled:cursor-default"
            >
              <span
                aria-hidden
                className={cn(
                  "whitespace-nowrap text-t3-static",
                  isTodayCell
                    ? "font-bold text-fg-brand"
                    : "text-fg-neutral-subtle",
                )}
              >
                {isTodayCell ? t("report.today") : weekday.weekdays[dow]}
              </span>
              {!isTodayCell && (
                <WeekdayProbe>
                  <span className="text-t3-static">{weekday.full[dow]}</span>
                </WeekdayProbe>
              )}
              <span
                aria-hidden
                className={cn(
                  "grid aspect-square min-h-x9 min-w-x9 place-items-center rounded-full p-[0.125rem] tabular-nums text-t5-static",
                  picked
                    ? "bg-bg-brand-solid font-bold text-static-white"
                    : future
                      ? "font-medium text-fg-neutral-subtle"
                      : "font-bold text-fg-neutral",
                )}
              >
                {Number(ds.slice(8))}
              </span>
            </button>
          );
        })}
      </div>
      <div className="mt-x4 flex flex-wrap items-baseline justify-between gap-x-x2">
        <span className="whitespace-nowrap text-t5 font-bold tabular-nums text-fg-neutral">
          {m.dateLabel}
        </span>
        {m.isToday && (
          <span className="ml-auto text-right text-t3 tabular-nums text-fg-neutral-subtle">
            {t("report.asOf", { time: m.asOf })}
          </span>
        )}
      </div>
    </div>
  );
}

// ── 관측 결과 + 도장 (17) ────────────────────────────────────────────
export function ResultSection({ m, place }: { m: ReportModel; place: Place }) {
  const { t, i18n } = useTranslation("constellation");
  const streak = m.todayQ.data?.streak ?? 0;
  const grown = m.grownEntry;
  let value: ReactNode;
  if (m.isToday) {
    value = t("report.resultProgress", {
      name: m.todayName,
      lit: Math.min(m.pts, m.goal),
      goal: m.goal,
    });
  } else if (grown) {
    value = (
      <span className="inline-flex items-start gap-x1_5">
        <span
          aria-hidden
          className="mt-x0_5 shrink-0"
          style={{ color: constellationColorVar(grown.constellation.colorKey) }}
        >
          <ConstellationSVG
            starMap={grown.constellation.starMap}
            size={20}
            linesOnly
          />
        </span>
        <span className="min-w-0">
          {t("report.resultCollected", {
            name: constellationName(grown.constellation, i18n.language),
          })}
        </span>
      </span>
    );
  } else if (m.selSky?.status === "WITHERED") {
    value = (
      <span className="text-fg-neutral-subtle">
        {m.selSky.guardUsed
          ? t("report.resultWitheredGuard")
          : t("report.resultWithered")}
      </span>
    );
  } else {
    value = (
      <span className="text-fg-neutral-subtle">{t("report.resultRest")}</span>
    );
  }
  return (
    <div className={cn(place === "band" ? "px-x6 pb-x4 pt-x4" : "pt-x4")}>
      <div className="flex items-center gap-x3">
        <span
          aria-hidden
          className="grid size-x8 shrink-0 place-items-center rounded-r2_5 bg-bg-neutral-weak text-fg-neutral-muted"
        >
          <Telescope className="size-x5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="m-0 text-t3 text-fg-neutral-subtle">
            {t("report.result")}
          </p>
          <p className="m-0 break-keep text-t5 font-bold text-fg-neutral [overflow-wrap:break-word]">
            {value}
          </p>
        </div>
        {m.isToday && streak > 0 && (
          <span
            role="img"
            aria-label={t("report.stampName", { count: streak })}
            data-slot="report-stamp"
            className="grid aspect-square min-h-[4.5rem] min-w-[4.5rem] shrink-0 -rotate-[8deg] place-content-center rounded-full bg-bg-critical-weak p-[0.75rem] text-center text-fg-critical-contrast shadow-[inset_0_0_0_2px_var(--color-stroke-critical-solid)]"
          >
            <span aria-hidden className="text-t4 font-bold">
              {t("report.stampDays", { count: streak })}
            </span>
            <span aria-hidden className="text-t1 font-bold">
              {t("report.stampLabel")}
            </span>
          </span>
        )}
      </div>
    </div>
  );
}

// ── 별빛 모으기 — 지표 둘(18) ────────────────────────────────────────
function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-t3 font-medium text-fg-neutral-subtle">{label}</dt>
      <dd className="m-0 mt-x1 text-t9 font-bold tabular-nums text-fg-neutral">
        {value}
      </dd>
    </div>
  );
}

/** 폰은 지표 한 줄에 하나(card.md), 데스크톱은 나란히(사이 24) */
export function StarlightSection({
  m,
  place,
}: {
  m: ReportModel;
  place: Place;
}) {
  const { t } = useTranslation("constellation");
  return (
    <section>
      <SectionHead
        place={place}
        top="5"
        title={t("report.starlight")}
        aside={
          <Badge variant="weak" tone="positive">
            {m.pct >= 100
              ? t("report.pctBang", { pct: m.pct })
              : t("report.pct", { pct: m.pct })}
          </Badge>
        }
      />
      <SectionBody place={place} bottom="4" top="1">
        <dl
          className={cn(
            "m-0 grid gap-x4",
            place === "card" && "grid-cols-[repeat(2,minmax(0,1fr))] gap-x6",
          )}
        >
          <Metric
            label={t("report.earned")}
            value={t("report.earnedCount", { count: m.pts })}
          />
          <Metric
            label={t("report.doneTodos")}
            value={t("report.doneCount", { count: m.doneCount })}
          />
        </dl>
      </SectionBody>
    </section>
  );
}

// ── 별빛 분석 — 범례 + 요일 막대 (19) ────────────────────────────────
export function AnalysisSection({
  m,
  place,
}: {
  m: ReportModel;
  place: Place;
}) {
  const { t } = useTranslation("constellation");
  const { t: tTodo } = useTranslation("todo");
  const memoSel = m.memoOf(m.sel);
  const legend: {
    key: string;
    color: string;
    label: string;
    weight: string;
  }[] = [
    ...PRIO_ORDER.map((k) => ({
      key: k,
      color: PRIO_COLOR[k],
      label: t("report.legendDone", {
        label: tTodo(`prio.${k}`),
        count: m.selDone[k],
      }),
      weight: `+${WEIGHT[k]}`,
    })),
    {
      key: "MEMO",
      color: PRIO_COLOR.MEMO,
      label: t("report.legendMemo"),
      weight: `+${memoSel}`,
    },
  ];
  return (
    <section>
      <SectionHead place={place} title={t("report.analysis")} top="5" />
      <SectionBody place={place} bottom="4" top="1">
        <ul className="m-0 mb-x4 flex list-none flex-col gap-x1_5 p-0">
          {legend.map((l) => (
            <li key={l.key} className="flex items-baseline gap-x2">
              <i
                aria-hidden
                className="size-x2_5 shrink-0 translate-y-[1px] self-center rounded-r0_5"
                style={{ background: l.color }}
              />
              <span className="min-w-0 text-t4 text-fg-neutral">{l.label}</span>
              <span className="text-t3 tabular-nums text-fg-neutral-subtle">
                {l.weight}
              </span>
            </li>
          ))}
        </ul>
        <div
          role="img"
          aria-label={t("report.barsName")}
          className="grid grid-cols-[repeat(7,minmax(0,1fr))] gap-x1"
        >
          {m.days.map((ds) => {
            const total = ds > m.todayISO ? 0 : m.ptsOf(ds);
            const done = m.doneByDay.get(ds);
            const memoRest = m.memoOf(ds);
            const pieces: { key: string; flex: number; color: string }[] = [
              ...PRIO_ORDER.flatMap((k: TodoPriority) =>
                done && done[k] > 0
                  ? [
                      {
                        key: k,
                        flex: done[k] * WEIGHT[k],
                        color: PRIO_COLOR[k],
                      },
                    ]
                  : [],
              ),
              ...(memoRest > 0
                ? [{ key: "MEMO", flex: memoRest, color: PRIO_COLOR.MEMO }]
                : []),
            ];
            return (
              <div key={ds} className="flex min-w-0 flex-col items-center">
                <div
                  className={cn(
                    "flex w-full items-end justify-center border-b border-solid border-stroke-neutral-subtle",
                    place === "card" ? "h-[140px]" : "h-[120px]",
                  )}
                >
                  <div
                    className="flex w-x5 flex-col-reverse overflow-hidden rounded-t-r1"
                    style={{
                      height: total
                        ? `${Math.max(8, (total / m.weekMax) * 100)}%`
                        : 0,
                    }}
                  >
                    {pieces.map((p) => (
                      <span
                        key={p.key}
                        className="min-h-[2px]"
                        style={{ flex: p.flex, background: p.color }}
                      />
                    ))}
                  </div>
                </div>
                {/* 요일 막대 아래 요일 원 — 그림 안 글이라 글자 크기 설정을 따르지 않는다(groo-design #261) */}
                <span
                  className={cn(
                    "mt-x2 grid min-h-x7 min-w-x7 place-items-center rounded-full text-t3-static",
                    m.sel === ds
                      ? "bg-bg-brand-solid font-bold text-static-white"
                      : "text-fg-neutral-subtle",
                  )}
                >
                  {m.dowOf(ds)}
                </span>
              </div>
            );
          })}
        </div>
      </SectionBody>
    </section>
  );
}

// ── 못다 켠 별 — List (20) ───────────────────────────────────────────
export function MissedSection({ m, place }: { m: ReportModel; place: Place }) {
  const { t } = useTranslation("constellation");
  const { t: tTodo } = useTranslation("todo");
  // 오늘이 아닌데 없으면 구역을 그리지 않는다
  if (m.missed.length === 0 && !m.isToday) return null;
  return (
    <section>
      <SectionHead
        place={place}
        top="5"
        title={t("report.missed")}
        aside={
          m.missed.length > 0 ? (
            <HeadNote>
              {t("report.missedCount", { count: m.missed.length })}
            </HeadNote>
          ) : undefined
        }
      />
      {m.missed.length === 0 ? (
        <p
          className={cn(
            "m-0 text-t4 text-fg-neutral-muted",
            place === "band" ? "px-x6 pb-x4 pt-x1" : "px-x6 pb-x6 pt-x1",
          )}
        >
          {t("report.missedNone")}
        </p>
      ) : (
        <List className={cn(place === "band" && "pb-x2")}>
          {m.missed.map((td) => (
            <ListItem
              key={td.rowId}
              title={td.title}
              detail={t("report.missedWeight", { count: WEIGHT[td.priority] })}
              align="top"
              suffix={
                <Badge
                  variant="weak"
                  tone={td.priority === "HIGH" ? "critical" : "neutral"}
                >
                  {tTodo(`prio.${td.priority}`)}
                </Badge>
              }
            />
          ))}
        </List>
      )}
    </section>
  );
}

/** 불러오는 동안 — 틀(주 · 날 줄)은 지금 날짜로 그리고, 관측 결과 · 지표 · 막대 · 줄 자리만 스켈레톤 */
export function ReportSkeleton({ place }: { place: Place }) {
  const pad = place === "band" ? "px-x6" : "";
  return (
    <div aria-hidden data-slot="report-skeleton">
      <div className={cn("flex items-center gap-x3 pb-x4 pt-x4", pad)}>
        <Skeleton radius="12" className="size-8 shrink-0" />
        <div className="min-w-0 flex-1">
          <Skeleton text="t3" className="w-1/4" />
          <Skeleton text="t5" className="mt-x1 w-2/3" />
        </div>
      </div>
      <div className={cn("pt-x5", pad)}>
        <Skeleton text="t5" className="w-1/3" />
        <Skeleton text="t9" className="mt-x3 w-1/4" />
        <Skeleton text="t9" className="mt-x4 w-1/4" />
      </div>
      <div className={cn("pt-x5", pad)}>
        <Skeleton text="t5" className="w-1/3" />
        <Skeleton className="mt-x3 h-[120px] w-full" />
      </div>
    </div>
  );
}
