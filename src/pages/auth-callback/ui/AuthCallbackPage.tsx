import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/features/auth";
import {
  getCodeVerifier,
  getSavedState,
  clearPkce,
} from "@/features/auth/lib/pkce";
import { ProgressCircle } from "@/shared/ds/progress-circle";
import { useWaitPhase } from "@/shared/ds/skeleton";
import { useDsText } from "@/shared/ds/i18n";
import { takeLoginRedirect } from "@/shared/lib/groo/login-redirect";

export const AuthCallbackPage = () => {
  const { t } = useTranslation("login");
  const navigate = useNavigate();
  const { exchangeCode } = useAuth();
  const dsT = useDsText();
  // 기다리는 시간표(progress-circle.md "기다리는 동안") — 1초 안에 끝나면 원이 보이지 않고, 1초에 원, 5초에 원 아래 16 안내 글.
  // 10초 실패 화면은 두지 않는다 — 교환에 요청 제한이 생기는 배치(셸)에서 정한다.
  const phase = useWaitPhase(true);
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
        // 밀려나기 전에 보던 자리로 되돌린다(QA #131). 적어 둔 게 없으면 홈이다.
        // 꺼내며 지우므로 다음 로그인이 옛 자리를 물려받지 않는다.
        navigate(result.ok ? (takeLoginRedirect() ?? "/desk") : "/login", {
          replace: true,
        });
        return;
      }

      // code 없음 → 로그인으로
      navigate("/login", { replace: true });
    };

    handleCallback();
  }, [exchangeCode, navigate]);

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
