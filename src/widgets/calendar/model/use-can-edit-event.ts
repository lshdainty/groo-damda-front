import { useUserCalendars } from "@/features/user-calendar";

import type { CalendarRole } from "@/entities/user-calendar";
import type { IEvent } from "@/widgets/calendar/model/interfaces";

const EDIT_ROLES: CalendarRole[] = ["OWNER", "EDIT"];

/**
 * 이 일정을 고치고 지울 수 있는가 (I-09b 7) — 서버 규칙 그대로다(`CalendarEventServiceImpl.validateEventOwnership`):
 * 그 일정이 든 캘린더에서 내 권한이 OWNER · EDIT 이면 된다. 권한은 캘린더에 걸린다 — 읽기 전용(READ)이면
 * 내가 만든 일정이라도 버튼이 없다(2026-11-24 사용자 결정). 공휴일 · 지출 · 할 일 같은 일정이 아닌 것은 늘 아니다.
 *
 * 권한을 아직 모르면(캘린더 목록을 불러오는 중 · 실패) 버튼을 그리지 않는다 — 떴다 사라지지 않게.
 *
 * 상세를 여는 자리 셋(그날 시트 · 그날 패널 · 480 시트 / 대화상자)이 이 함수 하나를 같이 쓴다.
 */
export function canEditEvent(
  event: Pick<IEvent, "sourceType" | "calendarRowId">,
  roleOf: (calendarRowId: number) => CalendarRole | undefined,
): boolean {
  if (event.sourceType !== "calendar") return false;
  const role =
    event.calendarRowId != null ? roleOf(event.calendarRowId) : undefined;
  return role != null && EDIT_ROLES.includes(role);
}

/** `canEditEvent` 에 내 캘린더 권한을 채워 돌려준다 */
export function useCanEditEvent(): (event: IEvent) => boolean {
  const { data: calendars } = useUserCalendars({ reference: true });
  const roleOf = (id: number) => calendars?.find((c) => c.rowId === id)?.myRole;
  return (event) => canEditEvent(event, roleOf);
}
