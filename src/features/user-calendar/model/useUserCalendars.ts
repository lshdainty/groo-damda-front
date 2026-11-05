import {
  referenceMeta,
  referenceSilent,
  type ReferenceOpts,
} from "@/shared/api";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { usePendingIds } from "@/shared/lib/groo/use-pending-ids";
import { invalidateFor, userCalendarKeys } from "@/shared/config";
import { userCalendarApi } from "../api/userCalendarApi";
import type {
  UserCalendarFormValues,
  CalendarRole,
} from "@/entities/user-calendar";

export const useUserCalendars = (
  opts?: ReferenceOpts & {
    /** false 면 요청하지 않는다 — 쓰는 구역이 아닐 때 목록을 받지 않게 */
    enabled?: boolean;
  },
) => {
  return useQuery({
    queryKey: userCalendarKeys.list(),
    queryFn: () => userCalendarApi.getCalendars(referenceSilent(opts)),
    enabled: opts?.enabled,
    ...referenceMeta(opts),
  });
};

/** `silent` — 실패를 폼 맨 위 Callout 이 고정 글로 말한다(서버 원문 알림을 끈다) */
export const useCreateUserCalendar = (opts?: { silent?: boolean }) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UserCalendarFormValues) =>
      userCalendarApi.createCalendar(data, opts),
    onSuccess: () => invalidateFor(queryClient, "user-calendar"),
  });
};

/** 보낸 칸만 바뀐다(이름만 · 색만). `silent` — 이름 폼처럼 실패를 폼 안 Callout 이 말하는 자리 */
export const useUpdateUserCalendar = (opts?: { silent?: boolean }) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: number;
      data: Partial<UserCalendarFormValues>;
    }) => userCalendarApi.updateCalendar(id, data, opts),
    onSuccess: () => invalidateFor(queryClient, "user-calendar"),
  });
};

export const useToggleCalendarVisibility = () => {
  const queryClient = useQueryClient();
  const { pendingIds, begin, end } = usePendingIds();

  const mutation = useMutation({
    // silent — 실패는 호출처(캘린더 필터)가 고정 한 문장 스낵바로 말한다. 화면 값은 서버 목록에서 읽으므로 실패하면 그대로(되돌림)
    mutationFn: (id: number) =>
      userCalendarApi.toggleVisibility(id, { silent: true }),
    onMutate: (id: number) => begin(id),
    onSettled: (_data, _error, id) => end(id),
    // 표시 여부는 화면이 거르는 값이라 일정 캐시는 그대로 둔다.
    onSuccess: () => invalidateFor(queryClient, "user-calendar"),
  });
  /** 진행 중인 항목 id — 그 항목만 스피너·잠금. */
  return { ...mutation, pendingIds };
};

export const useDeleteUserCalendar = () => {
  const queryClient = useQueryClient();

  return useMutation({
    // silent — 실패는 호출처가 확인창 뒤 스낵바(useConfirmFail)로 말한다
    mutationFn: (id: number) =>
      userCalendarApi.deleteCalendar(id, { silent: true }),
    // 서버가 이 캘린더의 일정을 기본 캘린더로 옮긴다 — 일정 캐시도 늙는다.
    onSuccess: () => invalidateFor(queryClient, "user-calendar-scope"),
  });
};

// ── 공유 ──

export const useCalendarMembers = (
  id: number | null,
  opts?: { silent?: boolean },
) => {
  return useQuery({
    queryKey: [...userCalendarKeys.all, "members", id],
    queryFn: () => userCalendarApi.getMembers(id as number, opts),
    enabled: id != null,
  });
};

/** `silent` — 실패를 호출처가 고정 한 문장 스낵바로 말한다 */
export const useRegenerateCalendarInviteCode = (opts?: {
  silent?: boolean;
}) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => userCalendarApi.regenerateInviteCode(id, opts),
    onSuccess: () => invalidateFor(queryClient, "user-calendar"),
  });
};

export const useJoinCalendar = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (inviteCode: string) => userCalendarApi.joinByCode(inviteCode),
    // 남의 캘린더가 들어온다 — 그 캘린더의 일정도 이제 내 조회 결과에 들어간다.
    onSuccess: () => invalidateFor(queryClient, "user-calendar-scope"),
  });
};

export const useRemoveCalendarMember = () => {
  const queryClient = useQueryClient();
  return useMutation({
    // silent — 실패는 호출처가 확인창 뒤 스낵바(useConfirmFail)로 말한다
    mutationFn: ({ id, memberId }: { id: number; memberId: number }) =>
      userCalendarApi.removeMember(id, memberId, { silent: true }),
    onSuccess: () => invalidateFor(queryClient, "user-calendar"),
  });
};

export const useChangeCalendarMemberRole = (opts?: { silent?: boolean }) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      memberId,
      permission,
    }: {
      id: number;
      memberId: number;
      permission: CalendarRole;
    }) => userCalendarApi.changeMemberRole(id, memberId, permission, opts),
    onSuccess: () => invalidateFor(queryClient, "user-calendar"),
  });
};
