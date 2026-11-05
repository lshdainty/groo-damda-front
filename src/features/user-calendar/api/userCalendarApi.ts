import { apiClient, silentConfig, type SilentOpts } from "@/shared/api";
import type { ApiResponse } from "@/shared/types";
import type {
  UserCalendar,
  UserCalendarFormValues,
  CalendarMember,
  CalendarRole,
} from "@/entities/user-calendar";

/**
 * 백엔드 API 응답의 UserCalendar를 프론트엔드 타입으로 변환
 * - isDefault / isVisible: "Y"/"N" 또는 boolean → boolean
 * - 공유 필드(isShared/isOwner/myRole/inviteCode/memberCount/ownerRowId/ownerName)는 그대로 전달
 */
function fromApiCalendar(cal: Record<string, unknown>): UserCalendar {
  return {
    ...cal,
    isDefault: cal.isDefault === "Y" || cal.isDefault === true,
    isVisible: cal.isVisible === "Y" || cal.isVisible === true,
  } as UserCalendar;
}

export const userCalendarApi = {
  getCalendars: async (opts?: SilentOpts): Promise<UserCalendar[]> => {
    const resp: ApiResponse<{ calendars: UserCalendar[] }> =
      await apiClient.get("/v1/calendar/calendars", silentConfig(opts));
    return (resp.data.calendars as unknown as Record<string, unknown>[]).map(
      fromApiCalendar,
    );
  },

  createCalendar: async (
    data: UserCalendarFormValues,
  ): Promise<UserCalendar> => {
    const resp: ApiResponse<UserCalendar> = await apiClient.post(
      "/v1/calendar/calendars",
      data,
    );
    return fromApiCalendar(resp.data as unknown as Record<string, unknown>);
  },

  updateCalendar: async (
    id: number,
    data: UserCalendarFormValues,
  ): Promise<UserCalendar> => {
    const resp: ApiResponse<UserCalendar> = await apiClient.put(
      `/v1/calendar/calendars/${id}`,
      data,
    );
    return fromApiCalendar(resp.data as unknown as Record<string, unknown>);
  },

  toggleVisibility: async (id: number): Promise<void> => {
    const resp: ApiResponse<void> = await apiClient.patch(
      `/v1/calendar/calendars/${id}/visibility`,
    );
    return resp.data;
  },

  deleteCalendar: async (id: number, opts?: SilentOpts): Promise<void> => {
    const resp: ApiResponse<void> = await apiClient.delete(
      `/v1/calendar/calendars/${id}`,
      silentConfig(opts),
    );
    return resp.data;
  },

  // ── 공유 ──
  getMembers: async (id: number): Promise<CalendarMember[]> => {
    const resp: ApiResponse<{ members: CalendarMember[] }> =
      await apiClient.get(`/v1/calendar/calendars/${id}/members`);
    return resp.data.members;
  },

  regenerateInviteCode: async (id: number): Promise<string> => {
    const resp: ApiResponse<{ inviteCode: string }> = await apiClient.patch(
      `/v1/calendar/calendars/${id}/regenerate-invite-code`,
    );
    return resp.data.inviteCode;
  },

  joinByCode: async (inviteCode: string): Promise<UserCalendar> => {
    // 실패는 호출부가 "초대 코드를 확인해 주세요" 로 안내한다 — 전역 토스트까지 겹치면
    // 친절한 문구 옆에 서버 문구가 나란히 뜬다(QA #127 이 그 화면이었다). silent 로 끈다.
    const resp: ApiResponse<UserCalendar> = await apiClient.post(
      "/v1/calendar/calendars/join",
      { inviteCode },
      { silent: true } as import("axios").AxiosRequestConfig & {
        silent?: boolean;
      },
    );
    return fromApiCalendar(resp.data as unknown as Record<string, unknown>);
  },

  removeMember: async (id: number, memberId: number): Promise<void> => {
    const resp: ApiResponse<void> = await apiClient.delete(
      `/v1/calendar/calendars/${id}/member/${memberId}`,
    );
    return resp.data;
  },

  changeMemberRole: async (
    id: number,
    memberId: number,
    permission: CalendarRole,
  ): Promise<void> => {
    const resp: ApiResponse<void> = await apiClient.patch(
      `/v1/calendar/calendars/${id}/member/${memberId}/role`,
      { permission },
    );
    return resp.data;
  },
};
