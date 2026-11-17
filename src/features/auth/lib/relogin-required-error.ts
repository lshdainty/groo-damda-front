/**
 * 토큰 교환이 "담다에서 로그아웃한 그 그루 계정 로그인" 이라서 막혔나.
 *
 * <p>담다 로그아웃은 담다만 끝내고 그루 계정 로그인은 남긴다(보안 점검 CLI-6). 백엔드는 로그아웃 때 그
 * 로그인을 기억해 두고, 같은 로그인으로 돌아온 인가 코드 교환을 401 · {@code AUTH_030} 으로 거절한다 —
 * 비밀번호를 다시 넣어 새 로그인을 만들어야 들어온다. 이 코드를 못 알아보면 화면은 보통의 로그인 실패로 보고
 * 로그인 화면으로 되돌리고, 사용자는 단추를 눌러도 같은 거절만 되풀이해 맞는다.
 *
 * <p>`withdrawn-error.ts` 와 같은 식이다 — 문구가 아니라 <b>코드로</b> 본다.
 */
export const RELOGIN_REQUIRED_CODE = "AUTH_030";

export function isReloginRequiredError(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const data = (err as { response?: { data?: { code?: unknown } } }).response
    ?.data;
  return data?.code === RELOGIN_REQUIRED_CODE;
}
