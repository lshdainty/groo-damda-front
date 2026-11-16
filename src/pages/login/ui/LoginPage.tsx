import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Navigate, useSearchParams } from "react-router-dom";
import { config } from "@/shared/config";
import { hasToken } from "@/shared/api";
import {
  generateCodeVerifier,
  codeChallenge,
  generateState,
  savePkce,
} from "@/features/auth/lib/pkce";
import { Button } from "@/shared/ds/button";
import { GrooTree } from "@/shared/ui/groo/groo-tree";

export const LoginPage = () => {
  if (hasToken()) {
    return <Navigate to="/desk" replace />;
  }

  return (
    // 앱 로그인 정합(사용자 결정) — 카드/이미지 패널 없이 셸 밖 흰 면(bg-layer-default, 11B) 중앙 콘텐츠만.
    <div className="flex min-h-svh flex-col items-center justify-center bg-bg-layer-default p-x6">
      {/* max-w-[384px] — 옛 groo 간격 토큰이 Tailwind 크기 이름(sm 등)을 가려 max-w-* 가 간격 값(8px)으로 컴파일되던 때 명시 값으로 적었다. */}
      <div className="w-full max-w-[384px]">
        <LoginForm />
      </div>
    </div>
  );
};

const LoginForm = () => {
  const { t } = useTranslation("login");
  const { t: tc } = useTranslation("common");
  const [searchParams] = useSearchParams();
  // 세션 만료로 밀려난 진입(?expired=1)은 버튼 대기 없이 곧장 SSO 로 넘어간다 —
  // SSO 쪽 무음 재인증이 살아 있으면 사용자는 클릭도 입력도 없이 제자리로 돌아온다.
  const expired = searchParams.get("expired") === "1";
  const [isRedirecting, setIsRedirecting] = useState(expired);
  const autoStarted = useRef(false);

  const startSsoRedirect = async () => {
    const callbackUrl = `${window.location.origin}/auth/callback`;
    // PKCE: code_verifier/state 생성 후 보관, code_challenge(S256) 을 인가 요청에 첨부.
    const verifier = generateCodeVerifier();
    const state = generateState();
    savePkce(verifier, state);
    const challenge = await codeChallenge(verifier);
    const params = new URLSearchParams({
      redirect_uri: callbackUrl,
      client_id: "desk",
      code_challenge: challenge,
      code_challenge_method: "S256",
      state,
    });
    window.location.href = `${config.ssoUrl}/login?${params.toString()}`;
  };

  const handleSsoRedirect = () => {
    setIsRedirecting(true);
    void startSsoRedirect();
  };

  useEffect(() => {
    if (expired && !autoStarted.current) {
      autoStarted.current = true;
      // isRedirecting 은 expired 로 이미 true 초기화 — 여기서는 이동만 시작한다.
      void startSsoRedirect();
    }
  }, [expired]);

  return (
    // 묶음 구조(사용자 결정) — [로고+타이틀+안내문] 한 묶음(내부 gap 8, 앱 x8) ↔ 버튼을
    // gap 32(앱 x32)로 분리.
    <div className="flex w-full flex-col gap-x8">
      <div className="flex flex-col items-center gap-x2 text-center">
        {/* 나무(장식) 56 + 사이 8 + 이름 — 가로 묶음(로고 결정 5A, I-05 86). 이름은 실제 글(합성 이미지 금지)이고
            화면 제목이다 — h1 하나(02W-002). 크기 · 자간은 지금 그대로(32 / 40 · 700) */}
        <div className="flex items-center justify-center gap-x2">
          <GrooTree size={56} />
          <h1
            className="m-0 text-t12 font-bold text-fg-neutral"
            style={{
              lineHeight: 1.25,
              letterSpacing: "-0.32px",
            }}
          >
            {tc("app.title")}
          </h1>
        </div>
        {/* 화면 부제 R2 — t5 · 400 · fg-neutral-muted */}
        <p className="m-0 text-t5 text-fg-neutral-muted">
          {t("sso.description")}
        </p>
      </div>
      {/* 버튼 — ds Button large 48 · neutralSolid(일반 CTA) · 전체 폭. 대기는 누른 버튼의 로딩이다 */}
      <Button
        type="button"
        variant="neutralSolid"
        size="large"
        className="w-full"
        onClick={handleSsoRedirect}
        loading={isRedirecting}
      >
        {t("sso.login")}
      </Button>
    </div>
  );
};
