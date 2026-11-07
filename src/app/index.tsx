import {
  QueryProvider,
  ReferenceFailureNotice,
  RefreshFailureNotice,
} from "./providers";
import { AppRouter } from "./router";
import { LoadingAnnouncer } from "@/shared/ds/skeleton";
import { SnackbarProvider } from "@/shared/ds/snackbar";
import { ThemeProvider } from "@/shared/ui/theme-provider";
import { EnvWatermark } from "@/shared/ui/env-watermark";
import "@/shared/i18n";

export const AppRoot = () => {
  return (
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
  );
};
