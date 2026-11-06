/*
 * 처음 불러오기가 실패했는가 — 화면을 실패 자리(Result Section · BandFailure)로 바꿀 때 이것으로 가른다(I-wrap-b2b 2-0, 앱 loadFailed 와 같은 뜻).
 *
 * react-query 의 `isError` 는 받아 둔 데이터가 남아 있어도 켜진다(포커스 갱신 · 무효화 뒤 다시 받기가 실패하면).
 * 그때 보던 내용을 실패 자리로 바꾸지 않는다 — 내용은 그대로 두고 공용 스낵바 "새로 고치지 못했어요." 가 알린다
 * (app/providers/RefreshFailureNotice). **값이 하나도 없을 때만** 실패 자리다.
 */
export const loadFailed = (q: { isError: boolean; data?: unknown }): boolean =>
  q.isError && q.data === undefined;
