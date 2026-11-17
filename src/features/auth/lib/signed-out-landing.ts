/**
 * 로그아웃한 뒤 닿는 자리 — 로그인 화면이 `out` 값으로 안내를 고른다(보안 점검 CLI-6).
 *
 * - `out=1` — 담다만 로그아웃했다. 그루 계정은 이 브라우저에 남아 있어 "그루 계정에서도 로그아웃" 단추를 함께 보인다.
 * - `out=all` — 그루 계정까지 로그아웃하고 돌아왔다. 단추는 다시 보이지 않는다.
 */
export const SIGNED_OUT_PATH = "/login?out=1";
export const SIGNED_OUT_OF_ACCOUNT_PATH = "/login?out=all";

/** 로그인 화면이 어느 안내를 보일지 — 담다만(`service`) · 그루 계정까지(`account`) · 없음. */
export function signedOutKind(
  search: URLSearchParams,
): "service" | "account" | null {
  const out = search.get("out");
  if (out === "1") return "service";
  if (out === "all") return "account";
  return null;
}
