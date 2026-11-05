import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { usePendingIds } from "@/shared/lib/groo/use-pending-ids";
import { invalidateFor, userCalendarKeys } from "@/shared/config";
import { userCalendarApi } from "../api/userCalendarApi";
import type {
  UserCalendarFormValues,
  CalendarRole,
} from "@/entities/user-calendar";

export const useUserCalendars = (opts?: { silent?: boolean }) => {
  return useQuery({
    queryKey: userCalendarKeys.list(),
    queryFn: () => userCalendarApi.getCalendars(opts),
  });
};

export const useCreateUserCalendar = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UserCalendarFormValues) =>
      userCalendarApi.createCalendar(data),
    onSuccess: () => invalidateFor(queryClient, "user-calendar"),
  });
};

export const useUpdateUserCalendar = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UserCalendarFormValues }) =>
      userCalendarApi.updateCalendar(id, data),
    onSuccess: () => invalidateFor(queryClient, "user-calendar"),
  });
};

export const useToggleCalendarVisibility = () => {
  const queryClient = useQueryClient();
  const { pendingIds, begin, end } = usePendingIds();

  const mutation = useMutation({
    mutationFn: (id: number) => userCalendarApi.toggleVisibility(id),
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

export const useCalendarMembers = (id: number | null) => {
  return useQuery({
    queryKey: [...userCalendarKeys.all, "members", id],
    queryFn: () => userCalendarApi.getMembers(id as number),
    enabled: id != null,
  });
};

export const useRegenerateCalendarInviteCode = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => userCalendarApi.regenerateInviteCode(id),
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
    mutationFn: ({ id, memberId }: { id: number; memberId: number }) =>
      userCalendarApi.removeMember(id, memberId),
    onSuccess: () => invalidateFor(queryClient, "user-calendar"),
  });
};

export const useChangeCalendarMemberRole = () => {
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
    }) => userCalendarApi.changeMemberRole(id, memberId, permission),
    onSuccess: () => invalidateFor(queryClient, "user-calendar"),
  });
};
