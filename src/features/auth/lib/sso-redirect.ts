/**
 * 그루 계정(SSO)으로 가는 최상위 이동 두 가지 — 로그인(인가 요청)과 로그아웃 경유지.
 *
 * 둘 다 XHR 로는 못 한다 — 그루 계정의 쿠키가 SameSite=Strict 이고 CORS 목록에 담다 출처가 없다.
 */
import { config } from "@/shared/config";
import {
  codeChallenge,
  generateCodeVerifier,
  generateState,
  savePkce,
} from "./pkce";
import { hasSignedOut } from "./signed-out-mark";

/**
 * 그루 계정 로그인으로 보낸다 — OAuth 2.0 Authorization Code + PKCE.
 * code_verifier · state 를 만들어 보관하고 code_challenge(S256)를 인가 요청에 붙인다.
 *
 * 사용자가 직접 로그아웃했거나 교환이 거절된 브라우저면(signed-out-mark.ts) `prompt=login` 을 붙인다 — 그루 계정이
 * 살아 있는 로그인을 쓰지 않고 비밀번호를 다시 받는다(보안 점검 CLI-6 · 담다를 쓸 수 없는 계정에서 다른 계정으로 바꾸기).
 * 붙였는지는 PKCE 값과 함께 적어 둬 콜백이 읽는다.
 *
 * @param options.promptLogin 표시와 상관없이 `prompt=login` 을 붙인다 — 교환이 `AUTH_030` 으로 거절된 뒤의
 *   한 번짜리 재시도와 콜백 실패 화면의 [다시 로그인하기] 가 쓴다(표시를 저장하지 못하는 브라우저에서도 붙게).
 */
export async function startSsoLogin(options?: {
  promptLogin?: boolean;
}): Promise<void> {
  const promptLogin = options?.promptLogin === true || hasSignedOut();
  const verifier = generateCodeVerifier();
  const state = generateState();
  savePkce(verifier, state, promptLogin);
  const challenge = await codeChallenge(verifier);
  const params = new URLSearchParams({
    redirect_uri: `${window.location.origin}/auth/callback`,
    client_id: "desk",
    code_challenge: challenge,
    code_challenge_method: "S256",
    state,
  });
  if (promptLogin) params.set("prompt", "login");
  window.location.href = `${config.ssoUrl}/login?${params.toString()}`;
}

/**
 * 그루 계정 로그아웃 경유지 주소 — 그루 계정 로그인까지 끝내고 `returnPath`(이 앱 안의 경로)로 돌아온다.
 * 같은 브라우저의 다른 그루 서비스도 함께 끊긴다.
 */
export function ssoLogoutUrl(returnPath: string): string {
  const back = encodeURIComponent(`${window.location.origin}${returnPath}`);
  return `${config.ssoUrl}/logout?redirect_uri=${back}`;
}
