/**
 * "사용자가 직접 로그아웃했다" 표시.
 *
 * 담다에서 로그아웃하면 **담다만** 끝난다 — 그루 계정 로그인은 이 브라우저에 남는다(보안 점검 CLI-6).
 * 그 상태로 로그인 단추를 누르면 그루 계정이 살아 있는 로그인으로 비밀번호 없이 되돌려 보내, 로그아웃이
 * 로그아웃이 아니게 된다. 그래서 직접 로그아웃한 브라우저에 표시를 남기고, 표시가 있는 동안 그루 계정 로그인
 * 주소에 `prompt=login` 을 붙여 비밀번호를 다시 받는다(sso-login.ts).
 *
 * - 남긴다 — 사용자가 직접 로그아웃할 때(useAuth.logout), 교환이 `AUTH_030` 으로 거절됐을 때(콜백).
 * - 지운다 — 교환이 성공했을 때(useAuth.exchangeCode).
 * - 남기지 않는다 — 세션 만료(401 → `/login?expired=1`). 무음 재인증이 그대로 돈다.
 *
 * 보관은 `localStorage` 다 — 탭을 닫았다 열어도, 다른 탭에서 들어와도 같은 브라우저면 비밀번호를 받는다.
 * 표시가 사라져도(사이트 데이터 삭제 등) 뚫리지 않는다 — 백엔드가 로그아웃한 그 로그인의 교환을 `AUTH_030` 으로
 * 거절하고, 콜백이 그때 표시를 다시 남긴다. 표시는 그 왕복을 줄이는 지름길이다.
 */
const KEY = "signed_out_by_user";

export function markSignedOut(): void {
  try {
    localStorage.setItem(KEY, "1");
  } catch {
    // 저장이 막힌 브라우저(사생활 보호 모드 등) — 백엔드의 AUTH_030 거절이 대신 막는다.
  }
}

export function clearSignedOut(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // 지우지 못하면 다음 로그인에서 비밀번호를 한 번 더 받을 뿐이다.
  }
}

export function hasSignedOut(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}
