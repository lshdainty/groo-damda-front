/**
 * 로그인 뒤 돌아갈 자리.
 *
 * 세션이 끊기거나(401) 사용자가 로그아웃하면 앱을 **떠난다** — 로그인 화면으로 최상위
 * 이동을 하고 거기서 그루 계정 로그인을 다녀오므로 리액트 상태도, 라우터 히스토리도 남지 않는다. 그래서 `/desk/memo` 에서
 * 밀려난 사람이 다시 들어오면 늘 `/desk` 였다(QA #131). 떠나기 직전에 자리를 적어
 * 두고 콜백에서 그 자리로 되돌린다.
 *
 * 보관은 `sessionStorage` 다 — SSO 왕복은 같은 탭 안에서 일어나므로 살아남고,
 * 탭을 닫으면 사라진다(다음에 앱을 열 때 옛 자리로 끌려가지 않는다). 쿼리 파라미터로
 * 나르지 않는 이유는 그 값이 곧 **이동 목적지**라, 링크로 흘리면 남이 조작한 주소로
 * 보낼 수 있기 때문이다.
 */

const KEY = "post_login_redirect";

/**
 * 앱 안의 경로인가.
 *
 * `//evil.com` 은 브라우저가 **스킴 상대 URL**(다른 출처)로 읽는다 — `/` 로
 * 시작한다는 것만 보면 통과하므로 따로 막는다. 로그인·콜백 자신은 되돌아갈 자리가
 * 아니다(로그인 → 로그인 무한 왕복).
 */
const isInAppPath = (p: string): boolean =>
  p.startsWith("/") &&
  !p.startsWith("//") &&
  !p.startsWith("/login") &&
  !p.startsWith("/auth/");

/** 지금 보고 있는 자리를 적어 둔다. 로그인 화면으로 밀어내기 **직전**에 부른다. */
export function rememberCurrentPath(): void {
  const path = `${window.location.pathname}${window.location.search}`;
  if (!isInAppPath(path)) return;
  try {
    sessionStorage.setItem(KEY, path);
  } catch {
    // 사생활 보호 모드 등 저장이 막힌 브라우저 — 복귀만 포기하고 로그인은 진행한다.
  }
}

/**
 * 적어 둔 자리를 꺼내며 지운다.
 *
 * **한 번만 쓰인다.** 남겨 두면 다음에 로그인할 때 엉뚱한 옛 자리로 끌려간다.
 */
export function takeLoginRedirect(): string | null {
  try {
    const v = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
    return v && isInAppPath(v) ? v : null;
  } catch {
    return null;
  }
}
