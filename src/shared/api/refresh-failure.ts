import type { Query } from "@tanstack/react-query";
import { isHttpStatus } from "./base";
import { isReferenceQuery } from "./reference";

/*
 * 내용이 있는 채로 다시 받다 실패 — 공용 스낵바 "새로 고치지 못했어요." 한 줄(I-wrap-b2b 2-1 · result-section.md:53 · skeleton.md:167).
 *
 * QueryCache 의 onError(app/providers/QueryProvider)가 `notifyRefreshFailure` 를 부르고, 알릴 실패면 구독자
 * (app/providers/RefreshFailureNotice — 스낵바 훅이 Provider 안이라 컴포넌트가 듣는다)에게 알린다.
 * 처음 불러오기 실패(값이 없다)는 그 화면의 Result Section 이 맡는다 — 여기서 알리지 않는다(loadFailed).
 *
 * 빼는 것
 *   - 폴링(`meta: POLL_META` — 시세 · 보유 · 호가 · 체결 …) — 그 자리가 실패를 말한다(단계 4)
 *   - 참조(`meta: REFERENCE_META`) — ReferenceFailureNotice 가 맡는다(둘 다 뜨지 않게)
 *   - 화면을 떠난 뒤 끝난 질의(관찰자 0) — 보이지 않는 내용의 실패다
 *   - 401 — 응답 인터셉터가 로그인으로 보낸다. 403 · 404 는 빼지 않는다 — 다른 기기에서 지운 경우가 많아 보는 내용이 낡았다
 */

/** 시세처럼 되풀이해 받는 질의 — useQuery 의 meta 로 단다 */
export const POLL_META = { poll: true } as const;

export const isPollQuery = (meta: unknown): boolean =>
  typeof meta === "object" &&
  meta !== null &&
  (meta as { poll?: unknown }).poll === true;

type QueryLike = Pick<Query, "meta" | "getObserversCount"> & {
  state: { data: unknown };
};

/** 이 실패를 공용 스낵바로 알릴까 — 받아 둔 값이 있고 · 폴링 · 참조가 아니고 · 화면이 보고 있고 · 401 이 아니면 */
export const shouldNotifyRefreshFailure = (
  error: unknown,
  query: QueryLike,
): boolean =>
  query.state.data !== undefined &&
  !isPollQuery(query.meta) &&
  !isReferenceQuery(query.meta) &&
  query.getObserversCount() > 0 &&
  !isHttpStatus(error, 401);

const listeners = new Set<() => void>();

/** 구독 — 해제 함수를 돌려준다 */
export const onRefreshFailure = (cb: () => void): (() => void) => {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
};

/** QueryCache onError 에 건다 */
export const notifyRefreshFailure = (error: unknown, query: QueryLike) => {
  if (!shouldNotifyRefreshFailure(error, query)) return;
  listeners.forEach((cb) => cb());
};
