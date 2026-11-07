import { measureTickWidth, niceTickLabels } from "@/shared/lib/groo/axisWidth";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ds/card";
import {
  Chart,
  ChartDataTable,
  ChartLegendTiles,
  ChartTooltip,
  ChartTooltipContent,
  chartAxisProps,
  chartGridProps,
  formatAxisWon,
} from "@/shared/ds/chart";
import { List, ListItem, ListTile } from "@/shared/ds/list";
import { Skeleton, LoadingRegion } from "@/shared/ds/skeleton";
import { cn } from "@/shared/lib/cn";
import {
  formatMonthDay,
  formatMonthTicks,
  formatYearMonth,
  parseLocalDate,
} from "@/shared/lib/date";
import { MINUS, toLocalIso } from "@/shared/lib/groo/format";
import { useHideAmounts } from "@/shared/lib/groo/hide-amounts-core";
import { useOpenHideAmountsSettings } from "@/shared/lib/groo/hide-amounts-nav";
import { MonthTitle } from "@/shared/ui/groo/month-title";
import { PageHead } from "@/shared/ui/groo/page-head";
import { dsMoney } from "@/shared/ds/i18n";
import { useDashboardSummary } from "@/features/dashboard";
import { useAssetSummary } from "@/features/asset";
import {
  useExpenses,
  useExpenseCategories,
  useRangeSummary,
  useExpenseBudgets,
} from "@/features/expense";
import { useRecurringTransactions } from "@/features/recurring-transaction";
import { expenseSum, type Expense } from "@/entities/expense";
import {
  BudgetBody,
  BudgetSkeleton,
  CategoryBody,
  CategorySkeleton,
  EmptyLine,
  EventRows,
  HeroCard,
  HomeHead,
  MonthNote,
  NetWorthFailure,
  OverdueBadge,
  RowsSkeleton,
  SectionFailure,
  TodayRows,
  TodayTotal,
  TodoRows,
} from "./home-parts";
import {
  categorySlices,
  colorSlices,
  computeBudgetItems,
  sixMonths,
  sixMonthsStart,
  useCurrentMonthKey,
} from "./home-shared";
import { MASK, useMasked, won, wonIn, wonOut } from "./home-money";

/**
 * 데스크톱 · 태블릿 홈(짝 2) — 같은 트리에서 폭만 다르다.
 * 1280 이상 2 : 1(`minmax(0, ·)` — 오른쪽 열 넘침 막기) · 칸 사이 24 · 쌓은 카드 8,
 * 768 ~ 1279 는 한 칸 최대 720 가운데, 1440 이상 본문 최대 1040 가운데(I-06 30 ~ 32).
 * 여백 — 위 20(spacing-nav-to-title) · 좌우 32(layout-margin) · 아래 56(spacing-screen-bottom).
 */
export function HomeDesktop() {
  const { t } = useTranslation("dashboard");
  const { t: tLayout } = useTranslation("layout");
  const { t: tc } = useTranslation("common");
  const navigate = useNavigate();
  // 여기서 바로 가리지 않는다 — 가릴 카드를 고르는 설정으로 보낸다.
  const handleHideToggle = useOpenHideAmountsSettings("home");
  const { key: initialKey } = useCurrentMonthKey();
  const [period, setPeriod] = useState(initialKey);
  const [periodY, periodM] = period.split("-").map(Number) as [number, number];

  const pad2 = (n: number) => String(n).padStart(2, "0");
  const periodStart = `${periodY}-${pad2(periodM)}-01`;
  const periodEnd = `${periodY}-${pad2(periodM)}-${pad2(new Date(periodY, periodM, 0).getDate())}`;

  const dashboardQ = useDashboardSummary();
  const assetSummaryQ = useAssetSummary(periodY, periodM);
  const monthlyQ = useRangeSummary(periodStart, periodEnd);
  // 고른 달까지 6개월 — 막대 · 전월 대비(고른 달이 최근 6개월 밖이어도 그 달의 전월과 비교)
  const trendQ = useRangeSummary(sixMonthsStart(periodY, periodM), periodEnd);
  // 오늘 쓴 돈은 달 고르기와 상관없이 늘 오늘이다
  const todayDStr = toLocalIso(new Date()).slice(0, 10);
  const recentQ = useExpenses({ startDate: todayDStr, endDate: todayDStr });
  const budgetsQ = useExpenseBudgets({ year: periodY, month: periodM });
  const categoriesQ = useExpenseCategories({ reference: true });
  const recurringQ = useRecurringTransactions();

  const summary = dashboardQ.data;
  const asset = assetSummaryQ.data;
  const monthly = monthlyQ.data;
  const income =
    monthly?.totalIncome ?? summary?.expenseSummary.monthlyIncome ?? 0;
  const expense =
    monthly?.totalExpense ?? summary?.expenseSummary.monthlyExpense ?? 0;
  const balance = income - expense;

  // 오늘 쓴 거래만
  const todayTx: Expense[] = (recentQ.data ?? [])
    .filter((e) => e.expenseDate?.slice(0, 10) === todayDStr)
    .sort((a, b) => b.expenseDate.localeCompare(a.expenseDate));
  // 서버 집계와 같은 규칙 — 환불·예정 제외.
  const todayTotal = expenseSum(todayTx);

  // 일평균 + 전월 대비 — 가계부 카드 요약 라인용
  const _today = new Date();
  const _isCurMonth =
    _today.getFullYear() === periodY && _today.getMonth() + 1 === periodM;
  const _daysInMonth = new Date(periodY, periodM, 0).getDate();
  const _dayOfMonth = _isCurMonth ? _today.getDate() : _daysInMonth;
  const dailyAvg = Math.round(expense / Math.max(1, _dayOfMonth));
  const { months: trendArr, prevExpense } = sixMonths(
    trendQ.data?.monthlyBuckets,
    periodY,
    periodM,
  );
  const savingsPct =
    prevExpense > 0 ? ((prevExpense - expense) / prevExpense) * 100 : 0;

  const slices = colorSlices(
    categorySlices(
      monthly?.categoryBreakdown,
      categoriesQ.data,
      t("uncategorized"),
    ),
    tc("others"),
  );
  const budgetItems = computeBudgetItems({
    budgets: budgetsQ.data ?? [],
    cats: categoriesQ.data ?? [],
    monthly,
    allLabel: t("all"),
  });

  const today0 = new Date();
  today0.setHours(0, 0, 0, 0);
  const upcomingPayments = (recurringQ.data ?? [])
    .filter(
      (r) =>
        r.isActive === "Y" &&
        r.expenseType === "EXPENSE" &&
        r.nextExecutionDate,
    )
    .map((r) => {
      const next = parseLocalDate(r.nextExecutionDate as string) ?? today0;
      const d = Math.max(
        0,
        Math.round((next.getTime() - today0.getTime()) / 86_400_000),
      );
      return {
        rowId: r.rowId,
        title: r.description || r.merchant || r.categoryName || "",
        amount: r.amount,
        d,
        dateLabel: formatMonthDay(next),
        nextIso: r.nextExecutionDate as string,
      };
    })
    .sort((a, b) => a.nextIso.localeCompare(b.nextIso))
    .slice(0, 3);

  const events = summary?.upcomingEvents.slice(0, 3) ?? [];
  const todos = summary?.recentTodos.slice(0, 4) ?? [];
  const summaryLoading = dashboardQ.data === undefined && !dashboardQ.isError;
  const summaryFailed = dashboardQ.isError && dashboardQ.data === undefined;
  const monthFailed = monthlyQ.isError && monthlyQ.data === undefined;
  const monthLoading = monthlyQ.data === undefined && !monthlyQ.isError;
  const overdue = summary?.todoSummary.overDueCount ?? 0;
  const todayLoading = recentQ.data === undefined && !recentQ.isError;
  const todayFailed = recentQ.isError && recentQ.data === undefined;
  const openToday = (e: Expense) => {
    const m = e.expenseDate?.slice(0, 7) ?? "";
    const params = new URLSearchParams();
    if (m) params.set("month", m);
    params.set("txId", String(e.rowId));
    navigate(`/desk/expense?${params.toString()}`);
  };
  const viewAll = t("viewAll");

  return (
    <div
      data-slot="home-desktop"
      className="px-[var(--layout-margin)] pb-screen-bottom pt-nav-to-title"
    >
      <div className="mx-auto w-full max-w-[var(--layout-max-low)] lg:max-w-[var(--layout-max-medium)]">
        <PageHead
          title={tLayout("home")}
          // 달 고르기 = 화면 제목 줄 오른쪽(사용자 10-23 Q2-B) — 순자산 · 수입 · 지출 · 카테고리 · 예산 · 오늘 쓴 돈(고른 달 · 늘 오늘)을
          // 바꾸는 페이지 조절 줄. 달 글 + 꺾쇠만(‹ › 없음 — 사용자 10-29), 누르면 연 | 월 휠. 휠은 미래 달도 굴러가고,
          // 미래 달에서 "완료" 하면 이번 달로 되돌린다(사용자 10-29 (가) — max)
          actions={
            <MonthTitle
              month={period}
              onChange={setPeriod}
              max={initialKey}
              className="text-t4"
            />
          }
        />
        <div className="grid grid-cols-1 gap-x2 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:gap-[var(--layout-gutter)]">
          <div className="flex min-w-0 flex-col gap-x2">
            {assetSummaryQ.isError && assetSummaryQ.data === undefined ? (
              <Card>
                <NetWorthFailure
                  title={t("loadFailed.netWorth")}
                  onRetry={() => void assetSummaryQ.refetch()}
                />
              </Card>
            ) : (
              <HeroCard
                data={{
                  loading: assetSummaryQ.data === undefined,
                  label: `${t("asset.netAsset")} · ${formatYearMonth(new Date(periodY, periodM - 1))}`,
                  netWorth: asset?.netWorth ?? 0,
                  totalAssets: asset?.totalAssets ?? 0,
                  totalDebt: asset?.totalDebt ?? 0,
                  // 지난달 순자산이 0 이면 증감률을 낼 수 없다 — 안내 글로 바꾼다(QA #20).
                  hasLastMonth: (asset?.lastMonthNetWorth ?? 0) !== 0,
                  changePercent: asset?.changePercent ?? 0,
                  changeAmount: asset?.changeAmount ?? 0,
                  showChangeAmount: true,
                  assetLabel: t("asset.assetTab"),
                  debtLabel: t("asset.debtTab"),
                  onHideSettings: handleHideToggle,
                }}
              />
            )}

            <Card>
              <CardHeader>
                <CardTitle>
                  {t("summary.monthIncomeExpense", { month: periodM })}
                </CardTitle>
              </CardHeader>
              <CardContent className="gap-0">
                {monthFailed ? (
                  <SectionFailure
                    title={t("loadFailed.month")}
                    onRetry={() => void monthlyQ.refetch()}
                  />
                ) : (
                  <IncomeExpenseChart
                    loading={monthLoading || trendQ.data === undefined}
                    trendFailed={trendQ.isError && trendQ.data === undefined}
                    onRetryTrend={() => void trendQ.refetch()}
                    income={income}
                    expense={expense}
                    trend={trendArr}
                    month={periodM}
                    note={
                      <MonthNote
                        prefix={<BalancePrefix balance={balance} />}
                        dailyAvg={dailyAvg}
                        prevExpense={prevExpense}
                        savingsPct={savingsPct}
                      />
                    }
                  />
                )}
              </CardContent>
            </Card>

            <Card body="list">
              <HomeHead
                title={t("expense.todaySpent")}
                suffix={
                  todayTotal > 0 ? <TodayTotal total={todayTotal} /> : undefined
                }
                action={{
                  label: viewAll,
                  onClick: () => navigate("/desk/expense"),
                }}
              />
              {todayFailed ? (
                <SectionFailure
                  title={t("loadFailed.today")}
                  onRetry={() => void recentQ.refetch()}
                />
              ) : todayLoading ? (
                <RowsSkeleton kind="tx" />
              ) : todayTx.length === 0 ? (
                <EmptyLine>{t("expense.noTodaySpent")}</EmptyLine>
              ) : (
                <TodayRows items={todayTx} onOpen={openToday} />
              )}
            </Card>
          </div>

          <div className="flex min-w-0 flex-col gap-x2">
            <Card>
              <HomeHead
                title={t("categoryTitle")}
                action={{
                  label: viewAll,
                  onClick: () => navigate("/desk/stats"),
                }}
              />
              <CardContent>
                {monthFailed ? (
                  <SectionFailure
                    title={t("loadFailed.category")}
                    onRetry={() => void monthlyQ.refetch()}
                  />
                ) : monthLoading ? (
                  <CategorySkeleton size={160} />
                ) : slices.length === 0 ? (
                  <EmptyLine>{t("categoryEmptyNow")}</EmptyLine>
                ) : (
                  <CategoryBody
                    slices={slices}
                    size={160}
                    center
                    month={periodM}
                    totalLabel={
                      periodY === _today.getFullYear() &&
                      periodM === _today.getMonth() + 1
                        ? t("summary.monthlyExpense")
                        : t("summary.monthExpenseN", { month: periodM })
                    }
                  />
                )}
              </CardContent>
            </Card>

            <Card>
              <HomeHead
                title={t("expense.budget")}
                action={{
                  label: t("manage"),
                  onClick: () => navigate("/desk/budget"),
                }}
              />
              <CardContent>
                {monthFailed || (budgetsQ.isError && !budgetsQ.data) ? (
                  <SectionFailure
                    title={t("loadFailed.budget")}
                    onRetry={() => {
                      void monthlyQ.refetch();
                      void budgetsQ.refetch();
                    }}
                  />
                ) : budgetsQ.data === undefined || monthLoading ? (
                  <BudgetSkeleton />
                ) : budgetItems.length === 0 ? (
                  <EmptyLine>{t("budget.empty")}</EmptyLine>
                ) : (
                  <BudgetBody items={budgetItems} />
                )}
              </CardContent>
            </Card>

            <Card body="list">
              <HomeHead title={t("payment.upcoming")} />
              {recurringQ.isError && recurringQ.data === undefined ? (
                <SectionFailure
                  title={t("loadFailed.payment")}
                  onRetry={() => void recurringQ.refetch()}
                />
              ) : recurringQ.data === undefined ? (
                <RowsSkeleton rows={3} kind="tx" />
              ) : upcomingPayments.length === 0 ? (
                <EmptyLine>{t("payment.empty")}</EmptyLine>
              ) : (
                <PaymentRows payments={upcomingPayments} />
              )}
            </Card>

            <Card body="list">
              <HomeHead
                title={t("todo.label")}
                suffix={
                  overdue > 0 ? <OverdueBadge count={overdue} /> : undefined
                }
                action={{
                  label: viewAll,
                  onClick: () => navigate("/desk/todo"),
                }}
              />
              {summaryFailed ? (
                <SectionFailure
                  title={t("loadFailed.todoCard")}
                  onRetry={() => void dashboardQ.refetch()}
                />
              ) : summaryLoading ? (
                <RowsSkeleton kind="dot" />
              ) : todos.length === 0 ? (
                <EmptyLine>{t("todo.empty")}</EmptyLine>
              ) : (
                <TodoRows
                  todos={todos}
                  todayStr={todayDStr}
                  onOpen={() => navigate("/desk/todo")}
                />
              )}
            </Card>

            <Card body="list">
              <HomeHead
                title={t("calendar.scheduled")}
                action={{
                  label: viewAll,
                  onClick: () => navigate("/desk/calendar"),
                }}
              />
              {summaryFailed ? (
                <SectionFailure
                  title={t("loadFailed.scheduled")}
                  onRetry={() => void dashboardQ.refetch()}
                />
              ) : summaryLoading ? (
                <RowsSkeleton kind="dot" />
              ) : events.length === 0 ? (
                <EmptyLine>{t("calendar.empty")}</EmptyLine>
              ) : (
                <EventRows
                  events={events}
                  onOpen={() => navigate("/desk/calendar")}
                />
              )}
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

function BalancePrefix({ balance }: { balance: number }) {
  const { t } = useTranslation("dashboard");
  const m = useMasked("home.monthExpense", "net");
  return (
    <>
      {t("balance")}{" "}
      <b className="font-bold tabular-nums text-fg-neutral">
        {m(balance >= 0 ? `+${dsMoney(balance)}` : MINUS + dsMoney(-balance))}
      </b>{" "}
      ·{" "}
    </>
  );
}

/** 수입 · 지출 — 지표 타일(ds ChartLegendTiles) → 막대 차트(ds Chart) → 아래 안내(I-06 17) */
function IncomeExpenseChart({
  loading,
  trendFailed,
  onRetryTrend,
  income,
  expense,
  trend,
  month,
  note,
}: {
  loading: boolean;
  trendFailed: boolean;
  onRetryTrend: () => void;
  income: number;
  expense: number;
  trend: {
    year: number;
    month: number;
    totalIncome: number;
    totalExpense: number;
  }[];
  month: number;
  note: React.ReactNode;
}) {
  const { t } = useTranslation("dashboard");
  const { t: tc } = useTranslation("common");
  const hidden = useHideAmounts("home.monthExpense");
  const mIn = useMasked("home.monthExpense", "income");
  const mOut = useMasked("home.monthExpense", "expense");
  const m = useMasked("home.monthExpense");
  const [off, setOff] = useState<ReadonlySet<string>>(new Set());
  // 월 눈금 — 한 해 안이면 "5월", 해가 섞이면 "2025. 12." (날짜 규칙)
  const tickLabels = formatMonthTicks(trend);
  const data = trend.map((x, i) => ({
    label: tickLabels[i]!,
    income: x.totalIncome,
    expense: x.totalExpense,
  }));
  const legendId = "home-income-expense-legend";
  const chartName = t("chart.incomeExpenseName", { month });
  return (
    <>
      <ChartLegendTiles
        id={legendId}
        items={[
          {
            key: "income",
            label: t("chart.income"),
            color: "blue",
            total: mIn(wonIn(income)),
          },
          {
            key: "expense",
            label: t("chart.expense"),
            color: "red",
            total: mOut(wonOut(expense)),
          },
        ]}
        hidden={off}
        onHiddenChange={setOff}
      />
      {trendFailed ? (
        <SectionFailure title={t("loadFailed.trend")} onRetry={onRetryTrend} />
      ) : loading ? (
        <LoadingRegion
          pending
          className="contents"
          fallback={
            <>
              <Skeleton className="h-[280px] w-full" radius="8" />
            </>
          }
        />
      ) : data.length === 0 ? (
        <EmptyLine>{tc("noData")}</EmptyLine>
      ) : (
        <>
          <Chart label={chartName} legendId={legendId} height={280}>
            <BarChart data={data} barGap={4}>
              <CartesianGrid {...chartGridProps} />
              <XAxis dataKey="label" {...chartAxisProps()} />
              <YAxis
                {...chartAxisProps()}
                width={measureTickWidth(
                  niceTickLabels(
                    data.flatMap((d) => [d.income, d.expense]),
                    (v) => (hidden ? MASK : formatAxisWon(v)),
                  ),
                )}
                // 금액 숨기기 시 축 · 툴팁 · 타일도 가린다
                tickFormatter={(v: number) =>
                  hidden ? MASK : formatAxisWon(v)
                }
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    valueFormatter={(v) => m(won(Number(v)))}
                  />
                }
              />
              {!off.has("income") && (
                <Bar
                  dataKey="income"
                  name={t("chart.income")}
                  fill="var(--color-chart-blue)"
                />
              )}
              {!off.has("expense") && (
                <Bar
                  dataKey="expense"
                  name={t("chart.expense")}
                  fill="var(--color-chart-red)"
                />
              )}
            </BarChart>
          </Chart>
          <ChartDataTable
            caption={chartName}
            columns={[
              t("chart.tableMonth"),
              t("chart.income"),
              t("chart.expense"),
            ]}
            rows={data.map((d) => [
              d.label,
              m(won(d.income)),
              m(won(d.expense)),
            ])}
          />
        </>
      )}
      {/* 차트 ↔ 안내 16 · 지표 타일 ↔ 차트 8(타일 아래 8 은 ds) — 카드 본문 기본 간격 12 를 0 으로 두고 직접 둔다 */}
      <div className="mt-x4">{note}</div>
    </>
  );
}

/** 예정된 결제 줄 — 앞 D-day 타일 40(7일 안 warning) · 제목 줄바꿈 · 설명 날짜 · 뒤 금액(누르지 않는다) */
function PaymentRows({
  payments,
}: {
  payments: {
    rowId: number;
    title: string;
    amount: number;
    d: number;
    dateLabel: string;
  }[];
}) {
  const { t } = useTranslation("dashboard");
  const m = useMasked("home.upcoming");
  return (
    <List>
      {payments.map((p) => (
        <ListItem
          key={p.rowId}
          title={p.title}
          detail={p.dateLabel}
          align="top"
          prefix={
            <ListTile
              className={cn(
                "text-t4 font-bold",
                p.d <= 7
                  ? "bg-bg-warning-weak text-fg-warning-contrast"
                  : "bg-bg-neutral-weak text-fg-neutral-muted",
              )}
            >
              {t("date:dday", { count: p.d })}
            </ListTile>
          }
          suffix={
            <span className="whitespace-nowrap font-bold tabular-nums text-fg-neutral">
              {m(wonOut(p.amount))}
            </span>
          }
        />
      ))}
    </List>
  );
}
