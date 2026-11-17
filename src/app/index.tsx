import {
  QueryProvider,
  ReferenceFailureNotice,
  RefreshFailureNotice,
} from "./providers";
import { AppRouter } from "./router";
import { AppErrorBoundary } from "./router/RouteErrorBoundary";
import { LoadingAnnouncer } from "@/shared/ds/skeleton";
import { SnackbarProvider } from "@/shared/ds/snackbar";
import { ThemeProvider } from "@/shared/ui/theme-provider";
import { EnvWatermark } from "@/shared/ui/env-watermark";
import "@/shared/i18n";

export const AppRoot = () => {
  return (
    // 라우터 밖(알림 · 스낵바 자리)에서 멈춰도 #root 가 통째로 비지 않게 — 화면 안은 라우터의 화면 경계가 먼저 받는다
    <AppErrorBoundary>
      <ThemeProvider>
        <EnvWatermark />
        <QueryProvider>
          <SnackbarProvider>
            {/* 불러오는 중 상태 글 — 앱 맨 위에 한 번(skeleton.md). 스켈레톤이 마운트하며 여기에 알린다 */}
            <LoadingAnnouncer>
              <ReferenceFailureNotice />
              <RefreshFailureNotice />
              <AppRouter />
            </LoadingAnnouncer>
          </SnackbarProvider>
        </QueryProvider>
      </ThemeProvider>
    </AppErrorBoundary>
  );
};
