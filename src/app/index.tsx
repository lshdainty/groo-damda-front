import {
  QueryProvider,
  ReferenceFailureNotice,
  RefreshFailureNotice,
} from "./providers";
import { AppRouter } from "./router";
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
          <ReferenceFailureNotice />
          <RefreshFailureNotice />
          <AppRouter />
        </SnackbarProvider>
      </QueryProvider>
    </ThemeProvider>
  );
};
