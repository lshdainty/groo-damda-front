import * as React from "react";
import type { SilentOpts } from "./silent-config";

/*
 * 참조 데이터(카테고리 · 계좌 · 현재 사용자처럼 화면이 이름 · 선택지를 채우려고 읽어 두는 조회) 실패의 공용 표식.
 *
 * 화면마다 Result Section 을 두지 않고 앱 한 자리(app/providers/ReferenceFailureNotice)가 스낵바 한 문장으로 알린다.
 * 그 화면의 주 데이터(목록 · 카드)는 이 표식이 아니라 자기 자리의 Result Section 이 맡는다 — 두 곳에서 겹쳐 말하지 않도록
 * 주 데이터로 읽는 호출처는 `reference` 를 켜지 않는다.
 */

/** 조회 훅이 useQuery 의 meta 로 다는 표식 — QueryCache 구독자가 읽는다 */
export const REFERENCE_META = { reference: true } as const;

/** 조회 훅이 받는 옵션: silent(호출처가 직접 알림) 에 더해, 참조 데이터로 읽는다는 뜻의 reference */
export type ReferenceOpts = SilentOpts & { reference?: boolean };

/** 참조로 읽으면 요청은 늘 silent(서버 원문 토스트 없음) — 알림은 공용 한 자리가 한다 */
export const referenceSilent = (opts?: ReferenceOpts): SilentOpts => ({
  silent: opts?.silent || opts?.reference || undefined,
});

/** useQuery 옵션에 펼치는 meta — 참조가 아니면 아무것도 달지 않는다 */
export const referenceMeta = (opts?: ReferenceOpts) =>
  opts?.reference ? { meta: REFERENCE_META } : {};

export const isReferenceQuery = (meta: unknown): boolean =>
  typeof meta === "object" &&
  meta !== null &&
  (meta as { reference?: unknown }).reference === true;

/*
 * 폼 · 시트가 열려 있는 동안은 공용 참조 실패 스낵바를 띄우지 않는다 — 그 안의 참조 목록 실패는 폼이 맡는다
 * (불러 둔 값 유지 · 저장 때 다시 받기 · 또 실패하면 폼 Callout). 열려 있는 수를 세는 전역 카운터 하나.
 * ResponsiveDialog 가 열림에 맞춰 부른다. 마지막 하나가 닫히면 구독자(공용 스낵바)가 한 번 다시 판단한다 —
 * 그 사이 쉰 참조 실패가 값 없이 남아 있으면 그때 알린다.
 */
let heldCount = 0;
const releaseListeners = new Set<() => void>();

/** 열려 있던 폼 · 시트가 모두 닫혔을 때 부른다. 구독 해제 함수를 돌려준다 */
export const onReferenceNoticeRelease = (cb: () => void): (() => void) => {
  releaseListeners.add(cb);
  return () => {
    releaseListeners.delete(cb);
  };
};
export const isReferenceNoticeHeld = (): boolean => heldCount > 0;

/*
 * 참조 실패 스낵바를 마지막으로 띄운 시각 — 같은 장애에서 새로 고침 실패 스낵바(RefreshFailureNotice)가 뒤이어 한 번 더
 * critical 띠를 띄우지 않게 본다(검수 L9 — 한 사건에 한 문장).
 */
let referenceShownAt = -Infinity;
export const markReferenceNoticeShown = (): void => {
  referenceShownAt = Date.now();
};
export const referenceNoticeShownWithin = (ms: number): boolean =>
  Date.now() - referenceShownAt < ms;

export function useHoldReferenceNotice(active: boolean): void {
  React.useEffect(() => {
    if (!active) return;
    heldCount += 1;
    return () => {
      heldCount -= 1;
      if (heldCount === 0) releaseListeners.forEach((cb) => cb());
    };
  }, [active]);
}

/** 폼 안 참조 목록 하나 — useQuery 결과에서 이 셋만 본다 */
export interface RefQueryLike {
  isError: boolean;
  data: unknown;
  refetch: () => Promise<{ isError: boolean }>;
}

/**
 * 저장할 때 호출한다 — 값 없이 실패해 있는 참조 목록만 한 번 다시 받는다.
 * 모두 받았거나 처음부터 문제없으면 true, 하나라도 또 실패하면 false(호출한 폼이 요청을 보내지 않고 Callout 으로 알린다).
 */
export async function refetchMissingRefs(
  queries: RefQueryLike[],
): Promise<boolean> {
  const missing = queries.filter((q) => q.isError && q.data === undefined);
  if (missing.length === 0) return true;
  const results = await Promise.all(missing.map((q) => q.refetch()));
  return results.every((r) => !r.isError);
}
