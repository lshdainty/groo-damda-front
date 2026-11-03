import { useUserCalendars } from "@/features/user-calendar";
import { useCurrentUser } from "@/features/user";

import type { CalendarRole } from "@/entities/user-calendar";
import type { IEvent } from "@/widgets/calendar/model/interfaces";

const EDIT_ROLES: CalendarRole[] = ["OWNER", "EDIT"];

/**
 * 이 일정을 고치고 지울 수 있는가 (I-09b 7) — 서버 규칙 그대로다(`CalendarMembershipValidator.canEditOrDelete`):
 * 만든 사람이거나, 그 일정이 든 캘린더에서 내 권한이 OWNER · EDIT 이면 된다. 공휴일 · 지출 · 할 일 같은 일정이 아닌 것은 늘 아니다.
 * 읽기 전용(READ) 캘린더라도 내가 만든 일정은 고칠 수 있다 — 서버가 허락하므로 버튼도 둔다.
 *
 * 권한을 아직 모르면(캘린더 목록을 불러오는 중 · 실패) 만든 사람 판정만 쓴다 — 버튼이 떴다 사라지지 않게,
 * 모르는 동안은 남의 일정에 버튼을 그리지 않는다.
 *
 * 상세를 여는 자리 셋(그날 시트 · 그날 패널 · 480 시트 / 대화상자)이 이 함수 하나를 같이 쓴다.
 */
export function canEditEvent(
  event: Pick<IEvent, "sourceType" | "userRowId" | "calendarRowId">,
  me: number | undefined,
  roleOf: (calendarRowId: number) => CalendarRole | undefined,
): boolean {
  if (event.sourceType !== "calendar") return false;
  if (me != null && event.userRowId != null && event.userRowId === me)
    return true;
  const role =
    event.calendarRowId != null ? roleOf(event.calendarRowId) : undefined;
  return role != null && EDIT_ROLES.includes(role);
}

/** `canEditEvent` 에 나(현재 사용자)와 내 캘린더 권한을 채워 돌려준다 */
export function useCanEditEvent(): (event: IEvent) => boolean {
  const { data: me } = useCurrentUser();
  const { data: calendars } = useUserCalendars();
  const roleOf = (id: number) => calendars?.find((c) => c.rowId === id)?.myRole;
  return (event) => canEditEvent(event, me?.rowId, roleOf);
}
