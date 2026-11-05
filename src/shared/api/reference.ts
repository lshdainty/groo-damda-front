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
 * ResponsiveDialog 가 열림에 맞춰 부른다. 닫힌 뒤에 알리지는 않는다(그 사이 실패는 폼 · 화면 자리가 말했다).
 */
let heldCount = 0;

export const isReferenceNoticeHeld = (): boolean => heldCount > 0;

export function useHoldReferenceNotice(active: boolean): void {
  React.useEffect(() => {
    if (!active) return;
    heldCount += 1;
    return () => {
      heldCount -= 1;
    };
  }, [active]);
}
