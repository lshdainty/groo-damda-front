import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ScreenBands } from "@/shared/ui/groo/screen-bands";
import { useDashboardSummary } from "@/features/dashboard";
import { useAssetSummary } from "@/features/asset";
import {
  useExpenses,
  useExpenseCategories,
  useRangeSummary,
  useExpenseBudgets,
} from "@/features/expense";
import { expenseSum, type Expense } from "@/entities/expense";
import { toLocalIso } from "@/shared/lib/groo/format";
import {
  BudgetBody,
  BudgetSkeleton,
  CategoryBody,
  CategorySkeleton,
  EmptyLine,
  EventRows,
  HeroCard,
  HomeHead,
  NetWorthFailure,
  MonthNote,
  MonthRows,
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
  useCurrentMonthKey,
} from "./home-shared";
import { useOpenHideAmountsSettings } from "@/shared/lib/groo/hide-amounts-nav";
import { useMonthNote } from "./use-month-note";

/**
 * 폰 홈 — **구역마다 따로 띠**(사용자 10-23): 순자산 · 이번 달 가계부 · 카테고리 · 예산 · 다가오는 일정 · 최근 할 일 · 오늘 쓴 돈.
 * 띠 사이 8, 머리 아래 · 마지막 아래 틈 0. 띠 안은 카드 안과 같은 값(머리 위 24 · 글 구역 아래 24 · 목록 구역 아래 12 + 줄 12).
 * 일정 · 할 일이 비면 그 띠가 없다(둘 다 비면 둘 다). 앱 `dashboard_screen.dart` 와 같은 구조 · 같은 값이다(짝 1).
 */
export function HomeMobile() {
  const { t } = useTranslation("dashboard");
  const navigate = useNavigate();
  // 여기서 바로 가리지 않는다 — 가릴 카드를 고르는 설정으로 보낸다.
  const handleHideToggle = useOpenHideAmountsSettings("home");
  const { year, month } = useCurrentMonthKey();

  const pad2 = (n: number) => String(n).padStart(2, "0");
  const monthStart = `${year}-${pad2(month)}-01`;
  const monthEnd = `${year}-${pad2(month)}-${pad2(new Date(year, month, 0).getDate())}`;

  const dashboardQ = useDashboardSummary();
  const assetSummaryQ = useAssetSummary(year, month);
  const monthlyQ = useRangeSummary(monthStart, monthEnd);
  const recentQ = useExpenses({ startDate: monthStart, endDate: monthEnd });
  const budgetsQ = useExpenseBudgets({ year, month });
  const categoriesQ = useExpenseCategories({ reference: true });
  const { t: tc } = useTranslation("common");

  const summary = dashboardQ.data;
  const asset = assetSummaryQ.data;
  const monthly = monthlyQ.data;
  const income =
    monthly?.totalIncome ?? summary?.expenseSummary.monthlyIncome ?? 0;
  const expense =
    monthly?.totalExpense ?? summary?.expenseSummary.monthlyExpense ?? 0;
  const note = useMonthNote(year, month, expense);

  const todayStr = toLocalIso(new Date()).slice(0, 10);
  // 오늘 쓴 거래만
  const todayTx: Expense[] = (recentQ.data ?? [])
    .filter((e) => e.expenseDate?.slice(0, 10) === todayStr)
    .sort((a, b) => b.expenseDate.localeCompare(a.expenseDate));
  // 서버 집계와 같은 규칙 — 환불·예정 제외.
  const todayTotal = expenseSum(todayTx);

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

  const events = summary?.upcomingEvents.slice(0, 3) ?? [];
  const todos = summary?.recentTodos.slice(0, 3) ?? [];
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

  const assetFailed = assetSummaryQ.isError && assetSummaryQ.data === undefined;
  const showEvents = summaryLoading || summaryFailed || events.length > 0;
  const showTodos = summaryLoading || summaryFailed || todos.length > 0;

  return (
    // 폰 구역 화면 — 띠 사이 8 만 틈이다(머리 아래 · 마지막 띠 아래 없음 — I-05 74 · I-06 6 ~ 7)
    <ScreenBands>
      {/* 띠 순자산 */}
      {assetFailed ? (
        <div data-band="flush" data-section="netWorth">
          <NetWorthFailure
            band
            title={t("loadFailed.netWorth")}
            onRetry={() => void assetSummaryQ.refetch()}
          />
        </div>
      ) : (
        <HeroCard
          band
          data={{
            loading: assetSummaryQ.data === undefined,
            label: t("asset.netAsset"),
            netWorth: asset?.netWorth ?? 0,
            totalAssets: asset?.totalAssets ?? 0,
            totalDebt: asset?.totalDebt ?? 0,
            // 지난달 순자산이 0 이면 증감률을 낼 수 없다 — 안내 글로 바꾼다(QA #20).
            hasLastMonth: (asset?.lastMonthNetWorth ?? 0) !== 0,
            changePercent: asset?.changePercent ?? 0,
            changeAmount: asset?.changeAmount ?? 0,
            showChangeAmount: false,
            assetLabel: t("asset.assetTab"),
            debtLabel: t("asset.debtTab"),
            onHideSettings: handleHideToggle,
          }}
        />
      )}

      {/* 띠 이번 달 가계부 */}
      <section data-band="flush" data-section="month">
        <HomeHead band list title={t("summary.monthExpenseBook", { month })} />
        {monthFailed ? (
          <SectionFailure
            band
            title={t("loadFailed.month")}
            onRetry={() => void monthlyQ.refetch()}
          />
        ) : monthLoading ? (
          <div className="pb-x6">
            <RowsSkeleton rows={2} />
          </div>
        ) : (
          <>
            <MonthRows income={income} expense={expense} />
            <div className="px-x6 pb-x6">
              <MonthNote {...note} />
            </div>
          </>
        )}
      </section>

      {/* 띠 카테고리 */}
      <section data-band="flush" data-section="category">
        <HomeHead
          band
          title={t("categoryTitle")}
          action={{
            label: t("viewAll"),
            onClick: () => navigate("/desk/stats"),
          }}
        />
        <div className="px-x6 pb-x6">
          {monthFailed ? (
            <SectionFailure
              title={t("loadFailed.category")}
              onRetry={() => void monthlyQ.refetch()}
            />
          ) : monthLoading ? (
            <CategorySkeleton size={120} />
          ) : slices.length === 0 ? (
            <EmptyLine>{t("categoryEmptyNow")}</EmptyLine>
          ) : (
            <CategoryBody
              slices={slices}
              size={120}
              center={false}
              month={month}
            />
          )}
        </div>
      </section>

      {/* 띠 예산 */}
      <section data-band="flush" data-section="budget">
        <HomeHead
          band
          title={t("expense.budget")}
          action={{
            label: t("viewAll"),
            onClick: () => navigate("/desk/budget"),
          }}
        />
        <div className="px-x6 pb-x6">
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
        </div>
      </section>

      {/* 띠 다가오는 일정 — 비면 띠가 없다(화면이 그리지 않는다) */}
      {showEvents && (
        <section data-band="flush" data-section="events">
          <HomeHead
            band
            list
            title={t("schedule.title")}
            action={{
              label: t("viewAll"),
              onClick: () => navigate("/desk/calendar"),
            }}
          />
          {summaryFailed ? (
            <SectionFailure
              band
              title={t("loadFailed.events")}
              onRetry={() => void dashboardQ.refetch()}
            />
          ) : summaryLoading ? (
            <div className="pb-x3">
              <RowsSkeleton kind="dot" />
            </div>
          ) : (
            <div className="pb-x3">
              <EventRows
                events={events}
                onOpen={() => navigate("/desk/calendar")}
              />
            </div>
          )}
        </section>
      )}

      {/* 띠 최근 할 일 */}
      {showTodos && (
        <section data-band="flush" data-section="todos">
          <HomeHead
            band
            list
            title={t("todo.recent")}
            suffix={overdue > 0 ? <OverdueBadge count={overdue} /> : undefined}
            action={{
              label: t("viewAll"),
              onClick: () => navigate("/desk/todo"),
            }}
          />
          {summaryFailed ? (
            <SectionFailure
              band
              title={t("loadFailed.todos")}
              onRetry={() => void dashboardQ.refetch()}
            />
          ) : summaryLoading ? (
            <div className="pb-x3">
              <RowsSkeleton kind="dot" />
            </div>
          ) : (
            <div className="pb-x3">
              <TodoRows
                todos={todos}
                todayStr={todayStr}
                onOpen={() => navigate("/desk/todo")}
              />
            </div>
          )}
        </section>
      )}

      {/* 띠 오늘 쓴 돈 */}
      <section data-band="flush" data-section="today">
        <HomeHead
          band
          list
          title={t("expense.todaySpent")}
          suffix={
            todayTotal > 0 ? <TodayTotal total={todayTotal} /> : undefined
          }
          action={{
            label: t("viewAll"),
            onClick: () => navigate("/desk/expense"),
          }}
        />
        {todayFailed ? (
          <SectionFailure
            band
            title={t("loadFailed.today")}
            onRetry={() => void recentQ.refetch()}
          />
        ) : todayLoading ? (
          <div className="pb-x3">
            <RowsSkeleton kind="tx" />
          </div>
        ) : todayTx.length === 0 ? (
          <div className="pb-x3">
            <EmptyLine>{t("expense.noTodaySpent")}</EmptyLine>
          </div>
        ) : (
          <div className="pb-x3">
            <TodayRows items={todayTx} onOpen={openToday} />
          </div>
        )}
      </section>
    </ScreenBands>
  );
}
