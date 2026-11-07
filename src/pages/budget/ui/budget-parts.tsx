import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";
import { Badge } from "@/shared/ds/badge";
import { Callout } from "@/shared/ds/callout";
import { CardContent } from "@/shared/ds/card";
import {
  Chart,
  ChartDataTable,
  ChartTooltip,
  ChartTooltipContent,
  chartAxisProps,
} from "@/shared/ds/chart";
import { List, ListItem, ListTile } from "@/shared/ds/list";
import { ResultSection } from "@/shared/ds/result-section";
import { Skeleton } from "@/shared/ds/skeleton";
import { Button } from "@/shared/ds/button";
import { cn } from "@/shared/lib/cn";
import { formatMonthShort } from "@/shared/lib/date";
import { getPaletteByColor } from "@/shared/lib/groo/chart-palette";
import { won, useMasked } from "@/shared/lib/groo/money-text";
import { MINUS, formatPercent } from "@/shared/lib/groo/format";
import type { HideCardKey } from "@/shared/lib/groo/hide-amounts-cards";
import {
  BandEmpty,
  BandFailure,
  BandHead,
  BarCaption,
  BigAmount,
  Desc,
  Eyebrow,
  HeadNote,
  KeyValueRows,
  BarredItem,
  KeyValueSkeleton,
  MeterBar,
  StackedAmount,
  StatGrid,
  type KeyValue,
} from "@/shared/ui/groo/band-parts";
import { Icon } from "@/shared/ui/groo/primitives";
import type { BudgetModel } from "./budget-model";

/*
 * 예산 화면의 구역 부품(I-08 8 ~ 13) — 폰 띠(band)와 데스크톱 카드(card)가 같은 내용을 같은 부품으로 그린다.
 * 띠 안은 구역이 제 좌우 24 를 갖고(band), 카드 안은 카드 본문(CardContent)이 24 를 갖는다.
 * 금액은 원까지 · 가리면 "••••". 막대에 주의 구간 색은 없다 — 넘치면 끝까지 fg-critical(알림 기준은 "여유" 셈에만).
 */

type Placement = "band" | "card";

/** 글 · 숫자 · 차트 구역의 본문 상자 — 띠는 좌우 24, 카드는 카드 본문 */
function Body({
  place,
  className,
  children,
}: {
  place: Placement;
  className?: string;
  children: ReactNode;
}) {
  return place === "band" ? (
    <div className={cn("px-x6 pb-x6", className)}>{children}</div>
  ) : (
    <CardContent className={cn("gap-0", className)}>{children}</CardContent>
  );
}

const KV_ROW = "[&_[data-slot=list-content]]:py-x2";

// ── 총 예산 ─────────────────────────────────────────────────────
/**
 * 총 예산 구역(8) — 눈썹 "{n}월 총 예산" · 설명 · 큰 숫자 + 막대 + 막대 아래 한 줄 · 지표 셋(폰 키-값 줄, 데스크톱 한 줄 세 칸) ·
 * 넘침 안내(Callout critical). 총 예산이 없으면 Callout neutral 안내.
 */
export function TotalSection({
  m,
  place,
}: {
  m: BudgetModel;
  place: Placement;
}) {
  const { t } = useTranslation("budget");
  const mask = useMasked("budget.header");
  if (m.coreFailed) {
    return (
      <Body place={place}>
        <BandFailure
          title={t("loadFailed.header")}
          onRetry={m.retryCore}
          band={false}
        />
      </Body>
    );
  }
  if (m.coreLoading) return <TotalSkeleton place={place} />;

  const left = m.totalLimit - m.totalSpent;
  const stats: KeyValue[] = [
    {
      key: "cap",
      name: t("totalCap"),
      value: mask(won(m.overallLimit)),
    },
    {
      key: "alloc",
      name: t("categoryAllocated"),
      value: mask(won(m.categoryLimitSum)),
    },
    {
      key: "assignable",
      name: t("manager.assignable"),
      value: mask((m.overAllocated ? MINUS : "+") + won(Math.abs(m.allocable))),
      tone: m.overAllocated ? "critical" : "brand",
    },
  ];
  return (
    <>
      <Body place={place} className={place === "band" ? "pb-0" : undefined}>
        <Eyebrow>{t("monthlyCap", { month: m.month })}</Eyebrow>
        <Desc className="mt-x1">{t("capHint")}</Desc>
        {m.overallBudget ? (
          <>
            <BigAmount
              className="mt-x3"
              value={mask(won(m.totalSpent))}
              limit={mask(won(m.totalLimit))}
            />
            <div className="mt-x4">
              <MeterBar
                label={t("monthlyCap", { month: m.month })}
                value={m.totalSpent}
                max={m.totalLimit}
                formatValue={(n) => mask(won(n))}
              />
              <BarCaption
                left={t("usedPct", {
                  percent: formatPercent(m.pct, "progress"),
                })}
                right={
                  left >= 0
                    ? t("remainingAmt", { amount: mask(won(left)) })
                    : t("overAmt", { amount: mask(won(-left)) })
                }
                critical={left < 0}
              />
            </div>
          </>
        ) : (
          <>
            <Callout tone="neutral" className="mt-x3">
              {t("capUnset")}
            </Callout>
            {m.categoryLimitSum > 0 && (
              <p className="m-0 mt-x2 text-t3 text-fg-neutral-subtle">
                {t("categorySumNow", {
                  amount: mask(won(m.categoryLimitSum)),
                })}
              </p>
            )}
          </>
        )}
      </Body>
      {m.overallBudget ? (
        <>
          {place === "band" ? (
            <KeyValueRows className={cn("mt-x3", KV_ROW)} items={stats} />
          ) : (
            <StatGrid items={stats} />
          )}
          {m.overAllocated && (
            <div className={cn(place === "band" ? "px-x6 pt-x3" : "pt-x3")}>
              <Callout tone="critical">
                {t("manager.overCap", {
                  amount: mask(won(m.categoryLimitSum - m.overallLimit)),
                })}
              </Callout>
            </div>
          )}
          <div
            className={
              place === "band"
                ? m.overAllocated
                  ? "pb-x6"
                  : "pb-x4"
                : undefined
            }
          />
        </>
      ) : (
        <div className={place === "band" ? "pb-x6" : undefined} />
      )}
    </>
  );
}

export function TotalSkeleton({ place }: { place: Placement }) {
  return (
    <Body place={place}>
      <div aria-hidden>
        <Skeleton text="t3" className="w-1/4" />
        <Skeleton text="t3" className="mt-x1 w-3/4" />
        <Skeleton text="t9" radius="8" className="mt-x3 w-1/2" />
        <Skeleton className="mt-x4 h-2 w-full" radius="full" />
        <Skeleton text="t3" className="mt-x2 w-1/2" />
        <div className="mt-x3">
          <KeyValueSkeleton rows={3} />
        </div>
      </div>
    </Body>
  );
}

// ── 지출 페이스 ─────────────────────────────────────────────────
/** 지출 페이스(10) — 머리 오른쪽 배지 · 막대 8 + 오늘 표시선 2 × 14 · 막대 아래 한 줄 · 키-값 둘(폰) / 두 칸(데스크톱) */
export function PaceSection({
  m,
  place,
}: {
  m: BudgetModel;
  place: Placement;
}) {
  const { t } = useTranslation("budget");
  const mask = useMasked("budget.pace");
  const head = (
    <BandHead
      title={t("spendingPace")}
      band={place === "band"}
      aside={
        m.coreLoading || m.coreFailed ? undefined : (
          <Badge
            variant="weak"
            size="medium"
            tone={m.onTrack ? "positive" : "warning"}
          >
            {m.onTrack ? t("paceNormal") : t("paceFast")}
          </Badge>
        )
      }
    />
  );
  if (m.coreFailed) {
    return (
      <>
        {head}
        <Body place={place}>
          <BandFailure title={t("loadFailed.pace")} onRetry={m.retryCore} />
        </Body>
      </>
    );
  }
  if (m.coreLoading) {
    return (
      <>
        {head}
        <Body place={place}>
          <div aria-hidden>
            <Skeleton className="h-2 w-full" radius="full" />
            <Skeleton text="t3" className="mt-x2 w-1/2" />
            <div className="mt-x3">
              <KeyValueSkeleton rows={2} />
            </div>
          </div>
        </Body>
      </>
    );
  }
  const elapsed = m.daysElapsedPct;
  const stats: KeyValue[] = [
    { key: "avg", name: t("dailyAvg"), value: mask(won(m.dailyActual)) },
    {
      key: "rec",
      name: t("recommendedDaily"),
      value: mask(won(m.dailyTarget)),
    },
  ];
  return (
    <>
      {head}
      <Body place={place} className={place === "band" ? "pb-0" : undefined}>
        <div className="relative">
          <MeterBar
            label={t("paceName")}
            value={m.totalSpent}
            max={Math.max(m.totalLimit, 0)}
            formatValue={(n) => mask(won(n))}
            valueText={t("paceValue", {
              used: formatPercent(m.pct, "progress"),
              elapsed: formatPercent(elapsed, "progress"),
            })}
          />
          {/* 오늘 표시선 2 × 14 — 막대 위로 3, 장식(aria-hidden) */}
          <span
            aria-hidden
            data-slot="pace-marker"
            className="pointer-events-none absolute -top-[3px] h-3.5 w-0.5 -translate-x-1/2 rounded-[1px] bg-fg-neutral"
            style={{ left: `${Math.min(100, Math.max(0, elapsed))}%` }}
          />
        </div>
        <BarCaption
          left={t("usedPct", { percent: formatPercent(m.pct, "progress") })}
          right={t("monthElapsed", {
            percent: formatPercent(elapsed, "progress"),
          })}
        />
      </Body>
      {place === "band" ? (
        <>
          <KeyValueRows className={cn("mt-x3", KV_ROW)} items={stats} />
          <div className="pb-x4" />
        </>
      ) : (
        <CardContent className="gap-0 pt-0">
          <StatGrid items={stats} />
        </CardContent>
      )}
    </>
  );
}

// ── 예산 현황 ───────────────────────────────────────────────────
/** 예산 현황(11) — 키-값 줄 둘("초과" · "여유", 값 "{n} 카테고리"). "여유" 의 셈은 알림 기준 이하인 카테고리 수 */
export function StatusSection({
  m,
  place,
}: {
  m: BudgetModel;
  place: Placement;
}) {
  const { t } = useTranslation("budget");
  const head = <BandHead title={t("status")} band={place === "band"} list />;
  if (m.coreFailed) {
    return (
      <>
        {head}
        <div className={place === "band" ? "pb-x6" : "px-x6 pb-x3"}>
          <BandFailure
            title={t("loadFailed.status")}
            onRetry={m.retryCore}
            band={place === "band"}
          />
        </div>
      </>
    );
  }
  if (m.coreLoading) {
    return (
      <>
        {head}
        <div className={place === "band" ? "pb-x4" : undefined}>
          <KeyValueSkeleton rows={2} />
        </div>
      </>
    );
  }
  const items: KeyValue[] = [
    {
      key: "over",
      name: t("over"),
      value: t("categoryCount", { count: m.overList.length }),
      tone: m.overList.length > 0 ? "critical" : "default",
    },
    {
      key: "healthy",
      name: t("healthy"),
      value: t("categoryCount", { count: m.healthyList.length }),
      tone: "brand",
    },
  ];
  return (
    <>
      {head}
      <KeyValueRows className={KV_ROW} items={items} />
      {place === "band" && <div className="pb-x4" />}
    </>
  );
}

// ── 카테고리별 예산 ─────────────────────────────────────────────
/** 카테고리별 예산 줄(12) — 타일 40 · 이름 줄바꿈 · 설명 · 뒤 두 줄 + 줄 아래 ProgressBar 8 */
export function CategorySection({
  m,
  place,
  onSettings,
}: {
  m: BudgetModel;
  place: Placement;
  onSettings: () => void;
}) {
  const { t } = useTranslation("budget");
  const mask = useMasked("budget.categories");
  const head = (
    <BandHead
      title={t("categoryBudgets")}
      band={place === "band"}
      list
      aside={
        m.listLoading || m.listFailed ? undefined : (
          <HeadNote>
            {t("countSet", { count: m.categoryBudgets.length })}
          </HeadNote>
        )
      }
    />
  );
  const tail = place === "band" ? "pb-0" : undefined;
  if (m.listFailed) {
    return (
      <>
        {head}
        <div className={place === "band" ? "pb-x6" : "px-x6 pb-x3"}>
          <BandFailure
            title={t("loadFailed.categories")}
            onRetry={m.retryList}
            band={place === "band"}
          />
        </div>
      </>
    );
  }
  if (m.listLoading) {
    return (
      <>
        {head}
        <div aria-hidden className={tail}>
          {[0, 1, 2, 3].map((i) => (
            <div key={i}>
              <div className="flex items-center gap-x3 px-x6 py-x3">
                <Skeleton radius="12" className="size-x10 shrink-0" />
                <div className="flex min-w-0 flex-1 flex-col gap-x0_5">
                  <Skeleton text="t5" className="w-1/2" />
                  <Skeleton text="t3" className="w-1/3" />
                </div>
                <Skeleton text="t5" className="w-x10 shrink-0" />
              </div>
              <div className="px-x6 pb-x3 pt-x1">
                <Skeleton className="h-2 w-full" radius="full" />
              </div>
            </div>
          ))}
        </div>
      </>
    );
  }
  if (m.categoryBudgets.length === 0) {
    return (
      <>
        {head}
        <div className={cn("px-x6", place === "band" ? "pb-x6" : "pb-x3")}>
          <BandEmpty>{t("noCategoryBudgets")}</BandEmpty>
          <div className="flex justify-center">
            <Button
              type="button"
              variant="ghost"
              ghostColor="neutralMuted"
              size="small"
              onClick={onSettings}
            >
              {t("goSetBudget")}
            </Button>
          </div>
        </div>
      </>
    );
  }
  return (
    <>
      {head}
      <List
        aria-label={t("categoryBudgets")}
        className={place === "band" ? "pb-x3" : undefined}
      >
        {m.categoryBudgets.map((b) => {
          const catId = b.categoryRowId as number;
          const cat = m.categoryMap.get(catId);
          const palette = getPaletteByColor(cat?.color);
          const name =
            cat?.categoryName ??
            b.categoryName ??
            t("manager.categoryFallback", { id: catId });
          const spent = m.spentByCategory.get(catId) ?? 0;
          const limit = b.budgetAmount;
          const over = spent > limit;
          return (
            <BarredItem
              key={b.rowId}
              row={
                <ListItem
                  as="div"
                  align="top"
                  prefix={
                    <ListTile
                      style={{ background: palette.bg, color: palette.color }}
                    >
                      <Icon name={cat?.icon ?? "tag"} size={20} />
                    </ListTile>
                  }
                  title={name}
                  detail={
                    <span className={over ? "text-fg-critical" : undefined}>
                      {over
                        ? t("overAmt", { amount: mask(won(spent - limit)) })
                        : t("remainingAmt", {
                            amount: mask(won(Math.max(0, limit - spent))),
                          })}
                    </span>
                  }
                  suffix={
                    <StackedAmount
                      main={mask(won(spent))}
                      sub={mask(won(limit))}
                      critical={over}
                    />
                  }
                />
              }
              bar={
                <MeterBar
                  label={t("budgetName", { name })}
                  value={spent}
                  max={limit}
                  formatValue={(n) => mask(won(n))}
                />
              }
            />
          );
        })}
      </List>
    </>
  );
}

// ── 최근 6개월 이행률 ───────────────────────────────────────────
/** 달 눈금 — 이번 달(고른 달)만 700 · fg-neutral, 나머지 subtle */
function MonthTick(props: {
  x?: number | string;
  y?: number | string;
  payload?: { value?: string; index?: number };
  activeIndex: number;
}) {
  const { x, y, payload, activeIndex } = props;
  const active = payload?.index === activeIndex;
  const yNum = typeof y === "number" ? y : Number(y ?? 0);
  return (
    <text
      x={x}
      y={yNum + 8}
      textAnchor="middle"
      fontSize={11}
      fontWeight={active ? 700 : 400}
      fill={
        active ? "var(--color-fg-neutral)" : "var(--color-fg-neutral-subtle)"
      }
    >
      {payload?.value}
    </text>
  );
}

type ComplianceDatum = {
  label: string;
  percent: number | null;
  limit: number;
  spent: number;
  year: number;
  month: number;
  active: boolean;
};

/** 막대 색 — 100% 넘음 chart red · 고른 달 chart blue · 지난 달 chart-blue-weak(같은 파랑의 옅은 단계 — v111) */
const complianceFill = (d: ComplianceDatum) =>
  d.percent != null && d.percent > 100
    ? "var(--color-chart-red)"
    : d.active
      ? "var(--color-chart-blue)"
      : "var(--color-chart-blue-weak)";

function ComplianceTip({
  active,
  payload,
  card,
}: {
  active?: boolean;
  payload?: { payload?: ComplianceDatum }[];
  card: HideCardKey;
}) {
  const { t } = useTranslation("budget");
  const mask = useMasked(card);
  const d = payload?.[0]?.payload;
  if (!active || !d || d.percent == null) return null;
  return (
    <ChartTooltipContent
      active
      label={d.label}
      payload={
        [
          {
            dataKey: "percent",
            name: t("vsLimit"),
            value: d.percent,
            color: complianceFill(d),
          },
          { dataKey: "spent", name: t("spent"), value: d.spent },
          { dataKey: "limit", name: t("limit"), value: d.limit },
        ] as never
      }
      valueFormatter={(v, key) =>
        key === "percent"
          ? formatPercent(Number(v), "progress")
          : mask(won(Number(v)))
      }
    />
  );
}

/**
 * 최근 6개월 이행률(13) — ds Chart 막대. 막대 위 % 글 t2 · 700, 100% 자리 가로 점선, 막대마다 색.
 * 예산이 없는 달은 막대 대신 빈 자리(Q3-B) — 0% 로 지킨 것처럼 보이지 않게.
 */
export function ComplianceSection({
  m,
  place,
}: {
  m: BudgetModel;
  place: Placement;
}) {
  const { t } = useTranslation("budget");
  const mask = useMasked("budget.compliance");
  const head = (
    <BandHead
      title={t("complianceTitle")}
      band={place === "band"}
      aside={<HeadNote>{t("vsLimitSpending")}</HeadNote>}
    />
  );
  if (m.complianceFailed) {
    return (
      <>
        {head}
        <Body place={place}>
          <BandFailure
            title={t("loadFailed.compliance")}
            onRetry={m.retryCompliance}
          />
        </Body>
      </>
    );
  }
  if (m.complianceLoading) {
    return (
      <>
        {head}
        <Body place={place}>
          <Skeleton className="h-[180px] w-full" radius="16" />
        </Body>
      </>
    );
  }
  const rows = m.complianceQ.data ?? [];
  const data: ComplianceDatum[] = rows.map((b) => ({
    label: formatMonthShort(b.month),
    percent: b.totalLimit > 0 ? b.compliancePercent : null,
    limit: b.totalLimit,
    spent: b.totalSpent,
    year: b.year,
    month: b.month,
    active: b.year === m.year && b.month === m.month,
  }));
  const activeIndex = data.findIndex((d) => d.active);
  const name = t("complianceName");
  return (
    <>
      {head}
      <Body place={place}>
        {data.length === 0 ? (
          <BandEmpty>{t("noComplianceData")}</BandEmpty>
        ) : (
          <>
            <Chart label={name} height={180}>
              <BarChart
                data={data}
                margin={{ top: 24, right: 8, left: 8, bottom: 0 }}
                barCategoryGap="25%"
              >
                <XAxis
                  dataKey="label"
                  {...chartAxisProps()}
                  tick={(p) => <MonthTick {...p} activeIndex={activeIndex} />}
                />
                <YAxis
                  hide
                  domain={[0, (dmax: number) => Math.max(100, dmax)]}
                />
                <ReferenceLine
                  y={100}
                  stroke="var(--color-stroke-neutral-weak)"
                  strokeDasharray="3 3"
                  ifOverflow="extendDomain"
                />
                <ChartTooltip
                  content={<ComplianceTip card="budget.compliance" />}
                />
                <Bar dataKey="percent" name={t("complianceRate")}>
                  {data.map((d) => (
                    <Cell
                      key={`${d.year}-${d.month}`}
                      fill={complianceFill(d)}
                    />
                  ))}
                  <LabelList
                    dataKey="percent"
                    position="top"
                    formatter={(v: unknown) =>
                      v == null ? "" : formatPercent(Number(v), "progress")
                    }
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      fill: "var(--color-fg-neutral)",
                    }}
                  />
                </Bar>
              </BarChart>
            </Chart>
            <ChartDataTable
              caption={name}
              columns={[
                t("complianceTable.month"),
                t("complianceTable.percent"),
                t("spent"),
                t("limit"),
              ]}
              rows={data.map((d) => [
                d.label,
                d.percent == null ? "-" : formatPercent(d.percent, "progress"),
                mask(won(d.spent)),
                mask(won(d.limit)),
              ])}
            />
          </>
        )}
      </Body>
    </>
  );
}

// ── 예산이 하나도 없을 때(Q3-B) ─────────────────────────────────
/** 이번 달 예산이 없다 — Result Section empty + 버튼 "예산 설정"(띠 ① 안 · 데스크톱 첫 카드) */
export function EmptyMonth({
  m,
  onSettings,
}: {
  m: BudgetModel;
  onSettings: () => void;
}) {
  const { t } = useTranslation("budget");
  return (
    <ResultSection
      kind="empty"
      size="medium"
      as="h2"
      icon={<Icon name="wallet" size={40} />}
      title={t("emptyMonthTitle", { month: m.month })}
      description={t("emptyMonthDesc")}
      primaryAction={{ label: t("manager.setBudget"), onClick: onSettings }}
      className="px-x6 [[data-slot=card]_&]:px-0"
    />
  );
}
