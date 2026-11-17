/*
 * 새 배포 직후 옛 화면 코드 조각(지연 청크) 받기 실패를 한 번 새로 고침으로 푼다.
 *
 * 화면마다 코드를 따로 받는다(router/routes.tsx 의 lazy). 배포가 끝나면 서버에는 새 해시의 조각만 있어, 배포 전에 연 탭이
 * 아직 받지 않은 화면으로 옮기면 옛 이름의 조각이 404 다 — "Importing a module script failed."(Safari) ·
 * "Failed to fetch dynamically imported module"(크롬). 잡는 곳이 없으면 React 가 루트를 통째로 내려 #root 가 비고 흰 화면이
 * 된다(QA 2026-11-17 web_dt_after_close3 — 배포 dfe45d5e 직후).
 *
 * Vite 는 조각 받기에 실패하면 window 에 `vite:preloadError` 를 쏜다 — 새 index.html 을 받도록 한 번 새로 고친다. 고친 뒤에도
 * 또 실패하면(서버가 정말 아픈 경우) 다시 고치지 않는다 — 고친 시각을 sessionStorage 에 남겨 RELOAD_WINDOW 안에서는 한 번만.
 * 그때는 오류가 화면 경계(router/RouteErrorBoundary)까지 가서 "문제가 생겼어요" + [다시 시도] 로 보인다.
 */
const RELOADED_AT = "groo:chunk-reload-at";
const RELOAD_WINDOW = 10_000;

let reloading = false;

const CHUNK_ERROR =
  /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Unable to preload CSS/i;

/** 지연 청크(화면 코드 조각)를 받지 못한 오류인가 */
export function isChunkLoadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return CHUNK_ERROR.test(message);
}

/**
 * 새로 고침을 한 번 건다 — 최근(RELOAD_WINDOW) 이미 고쳤으면 걸지 않고 false. 저장소를 못 쓰면(사생활 보호 모드 등) 되풀이를
 * 막을 수 없어 고치지 않는다.
 */
export function reloadOnceForStaleChunk(
  reload: () => void = () => window.location.reload(),
): boolean {
  try {
    const last = Number(window.sessionStorage.getItem(RELOADED_AT) ?? 0);
    if (Date.now() - last < RELOAD_WINDOW) return false;
    window.sessionStorage.setItem(RELOADED_AT, String(Date.now()));
  } catch {
    return false;
  }
  reloading = true;
  reload();
  return true;
}

/** 새로 고침을 걸어 둔 참인가 — 화면 경계는 그동안 실패 대신 빈 틀을 둔다(고침 직전 실패 화면이 번쩍이지 않게) */
export function isChunkReloadPending(): boolean {
  return reloading;
}

/**
 * `vite:preloadError` 를 듣는다 — 앱 시작에 한 번. 오류는 삼키지 않는다(preventDefault 하면 import 가 undefined 로 풀려
 * 엉뚱한 TypeError 가 된다) — 화면 경계가 받아 고치는 동안 빈 틀을 둔다.
 */
export function installChunkReload(reload?: () => void): () => void {
  const onPreloadError = () => {
    if (!reloading) reloadOnceForStaleChunk(reload);
  };
  window.addEventListener("vite:preloadError", onPreloadError);
  return () => window.removeEventListener("vite:preloadError", onPreloadError);
}
