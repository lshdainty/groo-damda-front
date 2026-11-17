import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Navigate, useSearchParams } from "react-router-dom";
import { hasToken } from "@/shared/api";
import {
  SIGNED_OUT_OF_ACCOUNT_PATH,
  signedOutKind,
} from "@/features/auth/lib/signed-out-landing";
import { ssoLogoutUrl, startSsoLogin } from "@/features/auth/lib/sso-redirect";
import { Button } from "@/shared/ds/button";
import { Callout } from "@/shared/ds/callout";
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

  // 로그아웃한 뒤 닿은 자리인가 — `out=1` 은 담다만, `out=all` 은 그루 계정까지(보안 점검 CLI-6).
  const signedOut = signedOutKind(searchParams);
  const [isLeavingAccount, setIsLeavingAccount] = useState(false);

  // 그루 계정 로그인으로 보낸다(PKCE). 직접 로그아웃한 브라우저면 `prompt=login` 이 붙어 비밀번호를 다시 받는다.
  const handleSsoRedirect = () => {
    setIsRedirecting(true);
    void startSsoLogin();
  };

  // 그루 계정 로그아웃 경유지로 최상위 이동한다 — 그루 계정 로그인까지 끝내고 `out=all` 로 돌아온다.
  const handleAccountLogout = () => {
    setIsLeavingAccount(true);
    window.location.href = ssoLogoutUrl(SIGNED_OUT_OF_ACCOUNT_PATH);
  };

  useEffect(() => {
    if (expired && !autoStarted.current) {
      autoStarted.current = true;
      // isRedirecting 은 expired 로 이미 true 초기화 — 여기서는 이동만 시작한다.
      void startSsoLogin();
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
      {/* 로그아웃한 뒤 안내 — ds Callout neutral(늘 보이는 안내 상자). 처음부터 있는 안내라 role 을 두지 않는다 */}
      {signedOut === "service" && (
        <Callout title={t("signedOut.title")}>
          {t("signedOut.grooAccountHint")}
        </Callout>
      )}
      {signedOut === "account" && (
        <Callout>{t("signedOut.grooAccountDone")}</Callout>
      )}
      {/* 버튼 — ds Button large 48 · neutralSolid(일반 CTA) · 전체 폭. 대기는 누른 버튼의 로딩이다.
          담다만 로그아웃한 자리에는 보조 단추(neutralWeak)가 아래에 붙는다 — 사이 8(짝 버튼과 같은 값) */}
      <div className="flex flex-col gap-x2">
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
        {signedOut === "service" && (
          <Button
            type="button"
            variant="neutralWeak"
            size="large"
            className="w-full"
            onClick={handleAccountLogout}
            loading={isLeavingAccount}
          >
            {t("signedOut.grooAccountLogout")}
          </Button>
        )}
      </div>
    </div>
  );
};
