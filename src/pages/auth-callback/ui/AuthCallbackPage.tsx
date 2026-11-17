import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/features/auth";
import {
  getCodeVerifier,
  getSavedState,
  clearPkce,
  wasPromptLogin,
} from "@/features/auth/lib/pkce";
import { markSignedOut } from "@/features/auth/lib/signed-out-mark";
import { startSsoLogin } from "@/features/auth/lib/sso-redirect";
import { Button } from "@/shared/ds/button";
import { ProgressCircle } from "@/shared/ds/progress-circle";
import { ResultSection } from "@/shared/ds/result-section";
import { useWaitPhase } from "@/shared/ds/skeleton";
import { useDsText } from "@/shared/ds/i18n";
import { takeLoginRedirect } from "@/shared/lib/groo/login-redirect";

/**
 * 그루 계정 로그인에서 돌아온 자리 — 인가 code 를 담다 토큰으로 바꾼다.
 *
 * 교환이 거절되면(담다를 쓸 수 없는 그루 계정 `AUTH_003` · 연결 불일치 · 그루 계정 오류 등) 실패 화면에 머문다.
 * 그루 계정 로그인이 이 브라우저에 살아 있어 그냥 다시 시작하면 그루 계정이 같은 계정으로 바로 code 를 내주고
 * 같은 거절로 돌아온다 — 비밀번호 칸이 한 번도 안 떠 계정을 바꿀 수 없다. 그래서 표시를 남기고(signed-out-mark.ts)
 * [다시 로그인하기] 가 `prompt=login` 으로 그루 계정 로그인을 바로 시작한다. 로그인 화면의 단추도 표시를 읽어
 * `prompt=login` 이다. 저절로 다시 가지는 않는다 — 고르는 건 사용자다. 저절로 다시 가는 건 `AUTH_030` 한 번뿐이다.
 */
export const AuthCallbackPage = () => {
  const { t } = useTranslation("login");
  const navigate = useNavigate();
  const { exchangeCode } = useAuth();
  const dsT = useDsText();
  // 기다리는 시간표(progress-circle.md "기다리는 동안") — 1초 안에 끝나면 원이 보이지 않고, 1초에 원, 5초에 원 아래 16 안내 글.
  // 10초 실패 화면은 두지 않는다 — 교환에 요청 제한이 생기는 배치(셸)에서 정한다.
  const phase = useWaitPhase(true);
  // 교환이 거절됐다 — 실패 화면(Result Section)을 그린다
  const [failed, setFailed] = useState(false);
  // [다시 로그인하기] 가 그루 계정으로 떠나는 동안 — 단추 로딩
  const [retrying, setRetrying] = useState(false);
  // StrictMode/재렌더로 effect 가 2번 돌아도 일회용 code 를 단 한 번만 교환하도록 가드
  const calledRef = useRef(false);

  useEffect(() => {
    if (calledRef.current) return;
    calledRef.current = true;
    const handleCallback = async () => {
      const query = new URLSearchParams(window.location.search);
      const code = query.get("code");

      // 신규: OAuth2 Authorization Code + PKCE (?code=&state=)
      if (code) {
        const returnedState = query.get("state");
        const savedState = getSavedState();
        const verifier = getCodeVerifier();
        // verifier 가 없거나 state(CSRF) 가 저장값과 다르면 거부한다. 주소에 state 가 없거나
        // 저장해 둔 state 가 없는 것도 불일치다 — 한쪽이 비었다고 검사를 건너뛰면 공격자가
        // state 를 뺀 주소로 자기 code 를 피해자 브라우저에서 교환시킬 수 있다(보안 점검 CLI-5).
        if (
          !verifier ||
          !savedState ||
          !returnedState ||
          savedState !== returnedState
        ) {
          clearPkce();
          navigate("/login", { replace: true });
          return;
        }
        const redirectUri = `${window.location.origin}/auth/callback`;
        // 이 시도가 비밀번호를 다시 받게(`prompt=login`) 보낸 것이었나 — clearPkce 가 지우기 전에 읽는다.
        const promptedLogin = wasPromptLogin();
        const result = await exchangeCode({
          code,
          codeVerifier: verifier,
          redirectUri,
        });
        clearPkce();
        window.history.replaceState({}, "", window.location.pathname);
        // 해지한 계정은 로그인으로 되돌리지 않는다 — 왜 안 들어가지는지 모른 채
        // 비밀번호만 다시 넣어 보게 된다. 안내 화면이 이유를 말해 준다.
        if (!result.ok && result.withdrawn) {
          navigate("/withdrawn", { replace: true });
          return;
        }
        // 담다에서 로그아웃한 그 그루 계정 로그인으로 돌아왔다(`AUTH_030`) — 그루 계정이 살아 있는 로그인을
        // 그대로 내준 것이다. 표시를 남기고 비밀번호를 다시 받는 로그인을 **한 번** 새로 시작한다(새 PKCE).
        // 이미 그렇게 보낸 시도가 또 거절됐으면 맴돌지 않고 아래 실패 갈래(로그인 화면)로 간다(보안 점검 CLI-6).
        if (!result.ok && result.reloginRequired && !promptedLogin) {
          markSignedOut();
          await startSsoLogin({ promptLogin: true });
          return;
        }
        if (!result.ok) {
          // 담다를 쓸 수 없는 계정 등으로 교환이 거절됐다 — 그루 계정 로그인이 살아 있어 그냥 다시 가면 같은 계정으로
          // 돌아온다. 다음 로그인은 비밀번호를 받게(prompt=login) 표시를 남기고 실패 화면에 머문다 — 계정을 바꿀 수 있다.
          // 보던 자리(post_login_redirect)는 꺼내지 않고 둔다 — 다시 로그인해 돌아오면 그 화면으로 간다.
          markSignedOut();
          setFailed(true);
          return;
        }
        // 밀려나기 전에 보던 자리로 되돌린다(QA #131). 적어 둔 게 없으면 홈이다.
        // 꺼내며 지우므로 다음 로그인이 옛 자리를 물려받지 않는다.
        navigate(takeLoginRedirect() ?? "/desk", { replace: true });
        return;
      }

      // code 없음 → 로그인으로
      navigate("/login", { replace: true });
    };

    handleCallback();
  }, [exchangeCode, navigate]);

  // [다시 로그인하기] — 비밀번호를 받는 그루 계정 로그인(prompt=login)을 바로 시작해 계정을 바꿀 수 있게 한다.
  // 시작하지 못하면(저장소 · crypto) 로그인 화면으로 — 거기서도 표시를 읽어 prompt=login 이다.
  const handleRetry = async () => {
    setRetrying(true);
    try {
      await startSsoLogin({ promptLogin: true });
    } catch {
      clearPkce();
      setRetrying(false);
      navigate("/login", { replace: true });
    }
  };

  if (failed) {
    return (
      // 해지 안내(WithdrawnPage)와 같은 틀 — 흰 면 하나, 폭 420 상자 안에 Result Section(실패) + Bottom CTA.
      // 폰(768 미만)은 버튼이 화면 바닥 · 좌우 24 · 안전 영역 위, 768 이상은 Result Section 아래 가운데.
      <div
        data-slot="auth-callback-failed"
        className="flex min-h-svh flex-col items-center bg-bg-layer-default md:justify-center"
      >
        <div className="flex w-full max-w-[420px] grow flex-col md:grow-0">
          <ResultSection
            kind="failure"
            size="large"
            as="h1"
            title={t("callback.failedTitle")}
            description={t("callback.exchangeFailed")}
            className="md:grow-0"
          />
          <div className="flex justify-center px-x6 pb-[calc(var(--spacing-x6)+env(safe-area-inset-bottom))] md:pb-x6">
            <Button
              type="button"
              variant="neutralSolid"
              size="large"
              className="w-full md:w-auto"
              loading={retrying}
              onClick={handleRetry}
            >
              {t("callback.retry")}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex h-screen flex-col items-center justify-center bg-bg-layer-default"
      aria-busy="true"
    >
      {phase !== "quiet" && (
        <ProgressCircle size="40" aria-label={t("authenticating")} />
      )}
      {phase === "slow" && (
        <p className="m-0 mt-x4 text-center text-t4 font-normal text-fg-neutral-muted break-keep [overflow-wrap:break-word]">
          {dsT("skeleton.slow")}
        </p>
      )}
    </div>
  );
};
