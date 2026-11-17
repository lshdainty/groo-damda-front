import { useState, useCallback } from "react";
import { authApi } from "../api/authApi";
import { setAuthenticated, clearAuthenticated } from "@/shared/api";
import { rememberCurrentPath } from "@/shared/lib/groo/login-redirect";
import { isWithdrawnAccountError } from "../lib/withdrawn-error";
import { isReloginRequiredError } from "../lib/relogin-required-error";
import { clearSignedOut, markSignedOut } from "../lib/signed-out-mark";
import {
  SIGNED_OUT_OF_ACCOUNT_PATH,
  SIGNED_OUT_PATH,
} from "../lib/signed-out-landing";
import { ssoLogoutUrl } from "../lib/sso-redirect";

export type LogoutOptions = {
  /**
   * 어디까지 끝내나.
   * - `"service"`(기본) — **담다만.** 그루 계정 로그인과 다른 그루 서비스는 그대로 둔다.
   * - `"grooAccount"` — 그루 계정까지. 해지처럼 그루 계정 로그인을 남기면 안 되는 경우에만 쓴다 —
   *   같은 브라우저의 다른 그루 서비스도 함께 끊긴다.
   */
  scope?: "service" | "grooAccount";
  /**
   * `scope: "grooAccount"` 일 때 그루 계정 로그아웃 뒤 돌아올 자리(기본 `/login?out=all`). 해지처럼
   * **로그인으로 보내면 안 되는** 경우에 쓴다 — 왜 로그인이 안 되는지 모른 채 비밀번호만 다시 넣어 보게 된다.
   */
  returnTo?: string;
  /** 보던 자리를 적어 둘지(기본 true). 해지한 사람에게는 돌아갈 자리가 없다. */
  remember?: boolean;
};

export const useAuth = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * 인가 코드를 desk 토큰으로 바꾼다.
   *
   * <p>실패해도 던지지 않고 **왜 실패했는지**를 담아 돌려준다. 부르는 쪽이 갈 자리를
   * 그것으로 정하기 때문이다 — 해지한 계정(`USER_021`)은 로그인이 아니라 안내 화면이고,
   * 담다에서 로그아웃한 그 그루 계정 로그인(`AUTH_030`)은 비밀번호를 다시 받아야 한다.
   */
  const exchangeCode = useCallback(
    async (params: {
      code: string;
      codeVerifier: string;
      redirectUri: string;
    }) => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await authApi.exchangeCode(params);
        setAuthenticated();
        // 다시 들어왔다 — "직접 로그아웃했다" 표시를 지워 다음 로그인은 평소대로(무음 재인증) 돈다.
        clearSignedOut();
        return { ok: true as const, data: response };
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Code exchange failed";
        setError(message);
        // 실패 이유를 **돌려준다** — 상태로 두면 같은 턴에 읽지 못한다(setState 는
        // 다음 렌더에 반영되는데, 부르는 쪽은 await 직후에 어디로 갈지 정한다).
        return {
          ok: false as const,
          withdrawn: isWithdrawnAccountError(err),
          reloginRequired: isReloginRequiredError(err),
        };
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  /**
   * 로그아웃한다 — 기본은 **담다만**이다(보안 점검 CLI-6, 사용자 결정).
   *
   * 담다 세션을 끝내고 로그아웃한 뒤 화면(`/login?out=1`)으로 간다. 그루 계정 로그인은 건드리지 않아 같은
   * 브라우저의 다른 그루 서비스가 그대로다. 그루 계정까지 끝내는 단추는 그 화면에 따로 있다.
   * 그루 계정이 살아 있어도 다시 들어올 때 비밀번호를 받도록 브라우저에 표시를 남긴다(signed-out-mark.ts).
   */
  const logout = useCallback(async (options?: LogoutOptions) => {
    // 표시는 맨 먼저 남긴다 — 아래 요청을 기다리는 사이 다른 요청의 401 이 먼저 로그인 화면으로
    // 보내도(기기 끊기 뒤 목록 다시 받기 등) 그 로그인이 비밀번호를 받는다.
    markSignedOut();
    try {
      await authApi.logout();
    } catch {
      // 로그아웃 API 실패해도 클라이언트 상태는 정리
    }
    clearAuthenticated();
    // 로그아웃도 되돌아갈 자리를 남긴다 — 다시 들어온 사람이 보던 화면으로 간다(QA #131).
    if (options?.remember !== false) rememberCurrentPath();
    if (options?.scope === "grooAccount") {
      // 그루 계정 로그아웃 경유지로 최상위 이동해 그루 계정 로그인까지 끝내고 돌아온다.
      window.location.href = ssoLogoutUrl(
        options.returnTo ?? SIGNED_OUT_OF_ACCOUNT_PATH,
      );
      return;
    }
    // 담다만 — 그루 계정으로 가지 않는다. 새로 불러와(최상위 이동) 메모리에 남은 화면 상태 · 캐시를 버린다.
    window.location.href = SIGNED_OUT_PATH;
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return { exchangeCode, logout, isLoading, error, clearError };
};
