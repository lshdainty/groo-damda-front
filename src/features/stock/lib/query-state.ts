/*
 * 질의가 "실패 화면" 을 띄울 만큼 실패했는가 — 웹 · 앱 하나의 규칙(I-13 13-1 검수 M1).
 *
 * react-query 의 `isError` 는 받아 둔 데이터가 남아 있어도 켜진다. 폴링(호가 · 체결 5초, 보유 10초)이
 * 한 번 실패했다고 받아 둔 값을 실패 화면으로 바꾸면 안 된다 — **값이 하나도 없을 때만** 실패다.
 * 값이 있으면 그 값을 그대로 두고, 다음 성공에 새 값으로 바뀐다.
 */
export { loadFailed as isHardError } from "@/shared/api";

/**
 * 받아 둔 값이 있는 채 다시 받기(폴링)가 실패했다 — 숫자는 그대로 두고 그 섹션 머리 아래 띠 한 줄로 "지금 시세가 아니다" 를 말한다
 * (I-wrap-b2b 단계 4 — 조용히 틀린 값을 보이지 않는다). 다음 폴링이 성공하면 저절로 걷힌다. 스낵바는 쓰지 않는다(POLL_META).
 */
export const isStaleError = (q: {
  isError: boolean;
  data?: unknown;
}): boolean => q.isError && q.data !== undefined;
