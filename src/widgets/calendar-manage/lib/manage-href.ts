/** 캘린더 관리·공유 목록(관리 페이지의 부모) */
export const CALENDAR_SHARE_HREF = "/desk/settings?section=calendar-share";

/** 캘린더 하나의 관리 페이지 — 설정 숨은 구역 `calendar-manage` + 캘린더 id(I-09b 21). 링크라 가운데 누름 · 새 탭이 산다 */
export const calendarManageHref = (calendarId: number) =>
  `/desk/settings?section=calendar-manage&calendar=${calendarId}`;

/** 일반 왼쪽 클릭인가 — 새 탭 · 가운데 클릭 · 수정 키는 브라우저가 링크로 처리하게 둔다 */
export const isPlainLinkClick = (e: {
  defaultPrevented: boolean;
  button: number;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
}) =>
  !e.defaultPrevented &&
  e.button === 0 &&
  !e.metaKey &&
  !e.ctrlKey &&
  !e.shiftKey &&
  !e.altKey;
