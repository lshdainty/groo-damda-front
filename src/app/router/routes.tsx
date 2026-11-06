import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { lazy, Suspense } from "react";
import { ProtectedRoute } from "./ProtectedRoute";

const AppLayout = lazy(() =>
  import("@/widgets/layout/ui/AppLayout").then((m) => ({
    default: m.AppLayout,
  })),
);
const DashboardPage = lazy(() =>
  import("@/pages/dashboard/ui/DashboardPage").then((m) => ({
    default: m.DashboardPage,
  })),
);
const TodoPage = lazy(() =>
  import("@/pages/todo/ui/TodoPage").then((m) => ({ default: m.TodoPage })),
);
const CalendarPage = lazy(() =>
  import("@/pages/calendar/ui/CalendarPage").then((m) => ({
    default: m.CalendarPage,
  })),
);
const MemoPage = lazy(() =>
  import("@/pages/memo/ui/MemoPage").then((m) => ({ default: m.MemoPage })),
);
const ExpensePage = lazy(() =>
  import("@/pages/expense/ui/ExpensePage").then((m) => ({
    default: m.ExpensePage,
  })),
);
const AssetPage = lazy(() =>
  import("@/pages/asset/ui/AssetPage").then((m) => ({ default: m.AssetPage })),
);
const AssetDetailPage = lazy(() =>
  import("@/pages/asset-detail/ui/AssetDetailPage").then((m) => ({
    default: m.AssetDetailPage,
  })),
);
const StocksPage = lazy(() =>
  import("@/pages/stocks/ui/StocksPage").then((m) => ({
    default: m.StocksPage,
  })),
);
import { SecuritiesGate } from "@/features/subscription/ui/SecuritiesGate";
const DutchPayPage = lazy(() =>
  import("@/pages/dutch-pay/ui/DutchPayPage").then((m) => ({
    default: m.DutchPayPage,
  })),
);
const StatsPage = lazy(() =>
  import("@/pages/stats/ui/StatsPage").then((m) => ({ default: m.StatsPage })),
);
const NightSkyPage = lazy(() =>
  import("@/pages/night-sky/ui/NightSkyPage").then((m) => ({
    default: m.NightSkyPage,
  })),
);
const ForestReportPage = lazy(() =>
  import("@/pages/night-sky/ui/ForestReportPage").then((m) => ({
    default: m.ForestReportPage,
  })),
);
const BudgetPage = lazy(() =>
  import("@/pages/budget/ui/BudgetPage").then((m) => ({
    default: m.BudgetPage,
  })),
);
const SettingsPage = lazy(() =>
  import("@/pages/settings/ui/SettingsPage").then((m) => ({
    default: m.SettingsPage,
  })),
);
const MorePage = lazy(() =>
  import("@/pages/more/ui/MorePage").then((m) => ({ default: m.MorePage })),
);
const SearchPage = lazy(() =>
  import("@/pages/search/ui/SearchPage").then((m) => ({
    default: m.SearchPage,
  })),
);
const NotificationsPage = lazy(() =>
  import("@/pages/notifications/ui/NotificationsPage").then((m) => ({
    default: m.NotificationsPage,
  })),
);
const CardBenefitPage = lazy(() =>
  import("@/pages/card-benefit").then((m) => ({ default: m.CardBenefitPage })),
);
const LoginPage = lazy(() =>
  import("@/pages/login/ui/LoginPage").then((m) => ({ default: m.LoginPage })),
);
const WithdrawnPage = lazy(() =>
  import("@/pages/withdrawn/ui/WithdrawnPage").then((m) => ({
    default: m.WithdrawnPage,
  })),
);
const DownloadPage = lazy(() =>
  import("@/pages/download/ui/DownloadPage").then((m) => ({
    default: m.DownloadPage,
  })),
);
const AuthCallbackPage = lazy(() =>
  import("@/pages/auth-callback/ui/AuthCallbackPage").then((m) => ({
    default: m.AuthCallbackPage,
  })),
);
const EmbedStockChartPage = lazy(() =>
  import("@/pages/stocks/ui/EmbedStockChartPage").then((m) => ({
    default: m.EmbedStockChartPage,
  })),
);

// 개발 전용 — 컴포넌트 라이브러리 카탈로그(src/shared/ds). 운영 빌드에서는 import.meta.env.DEV 가
// false 라 import 째 빠진다.
const DsCatalogPage = import.meta.env.DEV
  ? lazy(() =>
      import("@/shared/ds/catalog/CatalogPage").then((m) => ({
        default: m.CatalogPage,
      })),
    )
  : null;

// 화면 코드를 받는 동안은 빈 틀(높이만) — 틀 없는 가운데 원은 걷는다(DESIGN.desk.md "첫 진입" · skeleton.md "무엇으로 기다리나").
// 코드가 오면 셸 · 머리가 먼저 그려지고 데이터 자리만 스켈레톤이다
const Loading = () => <div data-slot="route-loading" className="min-h-dvh" />;

export const AppRouter = () => {
  return (
    <BrowserRouter>
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/auth/callback" element={<AuthCallbackPage />} />
          {/* 해지 안내 — 로그인 없이 열린다. 방금 해지한 사람이 SSO 로그아웃을 거쳐
              돌아오는 자리이자, 해지한 계정으로 다시 들어오려다 막힌 사람이 닿는 자리다.
              ProtectedRoute 안에 두면 둘 다 못 본다(desk 토큰이 이미 없다). */}
          <Route path="/withdrawn" element={<WithdrawnPage />} />
          {/* 앱 받기 — 로그인 없이 열린다. 링크만 알면 누구나 받을 수 있게(사용자 결정). */}
          <Route path="/download" element={<DownloadPage />} />
          {DsCatalogPage && (
            <Route path="/dev/ds" element={<DsCatalogPage />} />
          )}
          {/* 임베드 차트 — ProtectedRoute 밖 (querystring 의 60초 embed_token 으로 인증) */}
          <Route
            path="/embed/stocks/:symbol"
            element={<EmbedStockChartPage />}
          />
          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route path="/desk" element={<DashboardPage />} />
              <Route path="/desk/asset" element={<AssetPage />} />
              {/* 자산 상세 — 주소가 있는 화면(I-17 34). 풀스크린 · 흰 바탕은 shell.ts 가 가른다 */}
              <Route
                path="/desk/asset/:assetId"
                element={<AssetDetailPage />}
              />
              {/* 증권사는 경로가 고른다 — 사이드바 하위 메뉴가 가리키는 자리.
                  부모 `/desk/stocks` 는 남긴다(기존 북마크 · 모바일 전체 메뉴 ·
                  AppLayout FULLSCREEN_PATHS 접두사) — 들어오면 StocksPage 가 기본 증권사로 넘긴다. */}
              <Route
                path="/desk/stocks"
                element={
                  <SecuritiesGate>
                    <StocksPage />
                  </SecuritiesGate>
                }
              />
              <Route
                path="/desk/stocks/:broker"
                element={
                  <SecuritiesGate>
                    <StocksPage />
                  </SecuritiesGate>
                }
              />
              {/* 포트폴리오 구성(정적 — 먼저) · 종목 상세. 심볼은 encodeURIComponent("BRK.B") */}
              <Route
                path="/desk/stocks/:broker/portfolio"
                element={
                  <SecuritiesGate>
                    <StocksPage view="portfolio" />
                  </SecuritiesGate>
                }
              />
              <Route
                path="/desk/stocks/:broker/:symbol"
                element={
                  <SecuritiesGate>
                    <StocksPage view="detail" />
                  </SecuritiesGate>
                }
              />
              <Route path="/desk/expense" element={<ExpensePage />} />
              {/* 고정 정리는 통계의 자식 주소 — 같은 StatsPage 가 이어져 고른 탭 · 기간이 남고, 화면은 1280 미만 페이지 · 이상 대화상자 */}
              <Route path="/desk/stats" element={<StatsPage />}>
                <Route path="fixed" element={null} />
              </Route>
              <Route path="/desk/budget" element={<BudgetPage />} />
              <Route path="/desk/calendar" element={<CalendarPage />} />
              <Route path="/desk/todo" element={<TodoPage />} />
              <Route path="/desk/todo/night-sky" element={<NightSkyPage />} />
              <Route
                path="/desk/todo/night-sky/report"
                element={<ForestReportPage />}
              />
              <Route path="/desk/dutch-pay" element={<DutchPayPage />} />
              <Route path="/desk/memo" element={<MemoPage />} />
              <Route path="/desk/card-benefit" element={<CardBenefitPage />} />
              <Route path="/desk/settings" element={<SettingsPage />} />
              <Route path="/desk/more" element={<MorePage />} />
              <Route path="/desk/search" element={<SearchPage />} />
              <Route
                path="/desk/notifications"
                element={<NotificationsPage />}
              />
            </Route>
          </Route>
          <Route path="/" element={<Navigate to="/desk" replace />} />
          <Route path="*" element={<Navigate to="/desk" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
};
