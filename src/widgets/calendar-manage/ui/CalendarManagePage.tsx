import { useEffect, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Palette, Type } from "lucide-react";
import { Button } from "@/shared/ds/button";
import { Card } from "@/shared/ds/card";
import { List, ListButtonItem } from "@/shared/ds/list";
import {
  ResponsiveMenu,
  ResponsiveMenuContent,
  ResponsiveMenuGroup,
  ResponsiveMenuItem,
  ResponsiveMenuTrigger,
} from "@/shared/ds/menu";
import { Skeleton } from "@/shared/ds/skeleton";
import { useSnackbar } from "@/shared/ds/snackbar";
import { useConfirmFail, useToggleFail } from "@/shared/lib/confirm-fail";
import { hasPreviousEntry } from "@/shared/ds/top-navigation/top-navigation-context";
import { AlertConfirm } from "@/shared/ui/groo/alert-confirm";
import { BandFailure } from "@/shared/ui/groo/band-parts";
import { ColorPickerRow } from "@/shared/ui/groo/icon-color-rows";
import { ManagerHead } from "@/shared/ui/groo/manager-layout";
import { useCurrentUser } from "@/features/user";
import {
  useCalendarMembers,
  useChangeCalendarMemberRole,
  useDeleteUserCalendar,
  useLeaveCalendar,
  useRegenerateCalendarInviteCode,
  useStopCalendarSharing,
  useRemoveCalendarMember,
  useTransferCalendarOwnership,
  useUpdateUserCalendar,
  useUserCalendars,
} from "@/features/user-calendar";
import type {
  CalendarMember,
  CalendarRole,
  UserCalendar,
} from "@/entities/user-calendar";
import { CALENDAR_SHARE_HREF } from "../lib/manage-href";
import {
  calendarErrorCode,
  transferCandidates,
} from "../lib/transfer-candidates";
import { CalendarMemberRow } from "./CalendarMemberRow";
import { CalendarNameDialog } from "./CalendarNameDialog";
import { ManageSection } from "./manage-list-parts";

/**
 * 캘린더 관리 페이지(I-09b 21 ~ 31, 3-B) — 캘린더 하나 = 페이지. 설정 숨은 구역 `calendar-manage` + `?calendar={id}`.
 * 소유자: 목록 제목 "캘린더"(이름 · 색상 줄) → "초대 코드"(코드 + [복사][새로 만들기]) → "멤버 · n" → 맨 아래 동작 하나.
 *   다른 멤버가 있으면 [소유자 넘기고 나가기](공유 캘린더는 지우지 않는다 — 사용자 결정 2026-11-24, 기본 캘린더도 넘길 수 있다),
 *   나 혼자면 (기본 캘린더가 아닐 때) [캘린더 삭제].
 * 공유받은 캘린더: "멤버 · n" → [캘린더 나가기]. 이름 · 색은 줄마다 그 자리에서 저장 — 한 번의 [저장] 은 없다.
 * 폰은 흰 면 하나(목록 제목이 가른다), 데스크톱 · 태블릿은 카드 셋 + 카드 밖 [캘린더 삭제] 버튼. 제목(h1)은 캘린더 이름이다.
 * 목록에 없는 id(지운 · 내보내진 캘린더 · 틀린 주소)는 부모(관리·공유 목록)로 `replace` 한다 — 빈 페이지를 두지 않는다.
 */
export function CalendarManagePage({
  mobile,
  calendarId,
}: {
  mobile: boolean;
  calendarId: number | null;
}) {
  const { t } = useTranslation("calendar");
  const navigate = useNavigate();
  const calendarsQ = useUserCalendars({ silent: true });
  const calendar =
    calendarId != null
      ? (calendarsQ.data?.find((c) => c.rowId === calendarId) ?? null)
      : null;

  // 못 찾는 주소 → 부모로 replace. 목록을 다시 받는 중에는 기다린다(옛 캐시에 없는 새 캘린더로 튕기지 않게)
  const missing =
    calendarId == null ||
    (calendarsQ.isSuccess && !calendarsQ.isFetching && !calendar);
  useEffect(() => {
    if (missing) navigate(CALENDAR_SHARE_HREF, { replace: true });
  }, [missing, navigate]);

  if (calendarsQ.isError && !calendarsQ.data) {
    return (
      <>
        {!mobile && <ManagerHead title={t("shareSection.title")} />}
        <ListFrame mobile={mobile}>
          <BandFailure
            title={t("shareSection.loadFailed")}
            onRetry={() => void calendarsQ.refetch()}
            band={mobile}
            size="medium"
            as="h2"
          />
        </ListFrame>
      </>
    );
  }

  if (!calendar) {
    // 불러오는 동안(또는 부모로 가는 동안) — 제목 자리는 비우고 목록 제목 셋 + 줄 모양
    return (
      <div
        aria-busy="true"
        className={mobile ? "pb-x6" : "flex flex-col gap-x2"}
      >
        {[2, 1, 2].map((rows, i) => (
          <ListFrame key={i} mobile={mobile}>
            <div className="px-x6 py-x2">
              <Skeleton text="t4" className="w-1/4" />
            </div>
            {Array.from({ length: rows }, (_, r) => (
              <div key={r} className="flex items-center gap-x3 px-x6 py-x3">
                <Skeleton radius="full" className="size-x9 shrink-0" />
                <div className="flex min-w-0 flex-1 flex-col gap-x0_5">
                  <Skeleton text="t5" className="w-1/2" />
                  <Skeleton text="t3" className="w-1/3" />
                </div>
              </div>
            ))}
          </ListFrame>
        ))}
      </div>
    );
  }

  return (
    <ManageBody key={calendar.rowId} calendar={calendar} mobile={mobile} />
  );
}

// 폰은 흰 면 위에 그대로, 데스크톱 · 태블릿은 목록마다 카드(카드 사이 8)
function ListFrame({
  mobile,
  children,
}: {
  mobile: boolean;
  children: React.ReactNode;
}) {
  return mobile ? <>{children}</> : <Card body="list">{children}</Card>;
}

function ManageBody({
  calendar,
  mobile,
}: {
  calendar: UserCalendar;
  mobile: boolean;
}) {
  const uid = useId();
  const { t } = useTranslation("calendar");
  const { t: tc } = useTranslation("common");
  const navigate = useNavigate();
  const snackbar = useSnackbar();
  const confirmFail = useConfirmFail();
  const toggleFail = useToggleFail();
  const { data: currentUser } = useCurrentUser();
  const membersQ = useCalendarMembers(calendar.rowId, { silent: true });
  const calendarsQ = useUserCalendars({ silent: true });
  // 바로 나가는 셋(색 · 권한 · 코드 새로 만들기)은 서버 글을 내지 않는다 — 고정 한 문장 critical 스낵바(P4)
  const colorMut = useUpdateUserCalendar({ silent: true });
  const regenMut = useRegenerateCalendarInviteCode({ silent: true });
  const stopMut = useStopCalendarSharing({ silent: true });
  const roleMut = useChangeCalendarMemberRole({ silent: true });
  const removeMut = useRemoveCalendarMember();
  const deleteMut = useDeleteUserCalendar();
  const transferMut = useTransferCalendarOwnership();
  const leaveMut = useLeaveCalendar();

  const [renaming, setRenaming] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<CalendarMember | null>(
    null,
  );
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmTransfer, setConfirmTransfer] = useState<CalendarMember | null>(
    null,
  );
  const [confirmLeave, setConfirmLeave] = useState(false);

  const isOwner = calendar.isOwner;
  const members = membersQ.data;
  const membersFailed = membersQ.isError && !members;

  const copyCode = async () => {
    const code = calendar.inviteCode ?? "";
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = code;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    snackbar.show({ message: t("shareSection.toast.codeCopied") });
  };

  const regenerate = async () => {
    await regenMut.mutateAsync(calendar.rowId);
    snackbar.show({ message: t("shareSection.toast.codeRegenerated") });
  };
  const regenerateWithFail = () =>
    regenerate().catch((error: unknown) =>
      confirmFail({
        error,
        unconfirmedKind: "action",
        message: t("shareSection.regenFailed"),
        retry: regenerate,
      }),
    );

  // 공유 끄기 — 코드를 지운다. 이미 참여한 멤버는 그대로다(새로 들어올 수만 없다)
  const stopSharing = async () => {
    await stopMut.mutateAsync(calendar.rowId);
    snackbar.show({ message: t("shareSection.toast.sharingStopped") });
  };
  const stopSharingWithFail = () =>
    stopSharing().catch((error: unknown) =>
      confirmFail({
        error,
        unconfirmedKind: "action",
        message: t("shareSection.stopFailed"),
        retry: stopSharing,
      }),
    );

  const roleChange = (
    member: CalendarMember,
    permission: Exclude<CalendarRole, "OWNER">,
  ) =>
    roleMut.mutateAsync({
      id: calendar.rowId,
      memberId: member.rowId,
      permission,
    });
  const changeRole = (
    member: CalendarMember,
    permission: Exclude<CalendarRole, "OWNER">,
  ) =>
    // 권한은 고르는 순간 바뀌는 값 — 토글과 같이 [다시 시도] 없이 한 문장, 응답을 못 받았으면 다시 받은 값 + "바뀌었는지 확인하지 못했어요."(판단 ②)
    roleChange(member, permission).catch((error: unknown) =>
      toggleFail(error, t("shareSection.roleFailed")),
    );

  // 색은 바로 반영하는 값 — 실패하면 줄 값은 옛 색 그대로이고 [다시 시도] 는 두지 않는다(스위치와 같다). 요청 중에는 다음 고름을 받지 않는다
  const changeColor = (hex: string) => {
    if (hex === calendar.color || colorMut.isPending) return;
    colorMut
      .mutateAsync({ id: calendar.rowId, data: { color: hex } })
      .catch((error: unknown) =>
        toggleFail(error, t("shareSection.colorFailed")),
      );
  };

  const removeMember = (member: CalendarMember) =>
    removeMut.mutateAsync({ id: calendar.rowId, memberId: member.rowId });

  // 지운 뒤 history 뒤로 — 앱 pop 과 같게(기록에 [목록, 목록] 이 남지 않는다). 기록이 없을 때(주소로 바로 들어옴)만 부모로 replace.
  // 다시 시도가 성공해도 같은 길을 지난다
  const leavePage = () => {
    if (hasPreviousEntry()) navigate(-1);
    else navigate(CALENDAR_SHARE_HREF, { replace: true });
  };
  const deleteCalendar = async () => {
    await deleteMut.mutateAsync(calendar.rowId);
    leavePage();
  };

  // 넘기면 나는 이 캘린더에서 빠진다 — 지우기와 같이 목록으로 돌아간다
  const transferTo = async (member: CalendarMember) => {
    await transferMut.mutateAsync({
      id: calendar.rowId,
      memberId: member.rowId,
    });
    snackbar.show({
      message: t("shareSection.toast.transferred", { name: member.userName }),
    });
    leavePage();
  };

  const leaveCalendar = async () => {
    await leaveMut.mutateAsync(calendar.rowId);
    snackbar.show({ message: t("shareSection.toast.left") });
    leavePage();
  };

  // 다시 해도 같은 답인 거절(그 사이 멤버가 들어옴 · 받을 수 없는 멤버) — [다시 시도] 없이 까닭 한 문장, 목록 · 멤버를 다시 받는다
  const rejected = (error: unknown, code: string, message: string) => {
    if (calendarErrorCode(error) !== code) return false;
    snackbar.show({ message, tone: "critical" });
    void calendarsQ.refetch();
    void membersQ.refetch();
    return true;
  };

  const calId = `${uid}-cal`;
  const codeId = `${uid}-code`;
  const memberId = `${uid}-members`;

  const nameColor = (
    <List aria-labelledby={calId}>
      <ListButtonItem
        prefix={
          <span aria-hidden className="text-fg-neutral [&>svg]:size-[22px]">
            <Type />
          </span>
        }
        title={t("name")}
        suffix={calendar.calendarName}
        suffixText
        aria-haspopup="dialog"
        onClick={() => setRenaming(true)}
      />
      <ColorPickerRow
        title={t("form.color")}
        prefix={<Palette />}
        value={calendar.color}
        onChange={changeColor}
      />
    </List>
  );

  const code = (
    <div className="px-x6 pb-x3 pt-x1">
      <div className="flex flex-wrap items-center justify-between gap-x3">
        {/* 코드는 공유를 켤 때만 있다(보안 점검 DAM-4 — 새 캘린더 · 기본 캘린더는 꺼진 채 시작). 없으면 값 자리에 "공유 꺼짐", [복사] · [끄기] 는 숨기고 [만들기] 만.
            코드는 32자라 손으로 옮기기보다 [복사] 해서 보낸다 — 줄이 넘치면 글자 단위로 꺾는다 */}
        {calendar.inviteCode ? (
          <span
            data-slot="invite-code"
            className="min-w-0 break-all text-t8 font-bold tabular-nums text-fg-neutral"
          >
            {calendar.inviteCode}
          </span>
        ) : (
          <span
            data-slot="invite-code-none"
            className="min-w-0 text-t5 text-fg-neutral-subtle"
          >
            {t("shareSection.codeNone")}
          </span>
        )}
        <span className="ml-auto flex shrink-0 items-center gap-x2">
          {calendar.inviteCode && (
            <Button
              variant="neutralWeak"
              size="small"
              onClick={() => void copyCode()}
            >
              {t("shareSection.copyCode")}
            </Button>
          )}
          <Button
            variant="neutralWeak"
            size="small"
            loading={regenMut.isPending}
            onClick={() => void regenerateWithFail()}
          >
            {calendar.inviteCode
              ? t("shareSection.regenCode")
              : t("shareSection.createCode")}
          </Button>
          {calendar.inviteCode && (
            <Button
              variant="neutralWeak"
              size="small"
              loading={stopMut.isPending}
              onClick={() => void stopSharingWithFail()}
            >
              {t("shareSection.stopSharing")}
            </Button>
          )}
        </span>
      </div>
      <p className="m-0 mt-x2 text-t3 text-fg-neutral-subtle">
        {calendar.inviteCode
          ? t("shareSection.codeHint")
          : t("shareSection.codeOffHint")}
      </p>
    </div>
  );

  const memberRows = membersFailed ? (
    <BandFailure
      title={t("shareSection.membersLoadFailed")}
      onRetry={() => void membersQ.refetch()}
      band={mobile}
      size="medium"
      as="h3"
    />
  ) : !members ? (
    <div aria-busy="true">
      {[0, 1].map((i) => (
        <div key={i} className="flex items-center gap-x3 px-x6 py-x3">
          <Skeleton radius="full" className="size-x9 shrink-0" />
          <div className="flex min-w-0 flex-1 flex-col gap-x0_5">
            <Skeleton text="t5" className="w-1/2" />
            <Skeleton text="t3" className="w-2/3" />
          </div>
        </div>
      ))}
    </div>
  ) : (
    <List aria-labelledby={memberId}>
      {members.map((m) => {
        const isSelf = m.userRowId === currentUser?.rowId;
        return (
          <CalendarMemberRow
            key={m.rowId}
            member={m}
            isSelf={isSelf}
            canManage={isOwner && m.permission !== "OWNER" && !isSelf}
            onChangeRole={(p) => changeRole(m, p)}
            onRemove={() => setConfirmRemove(m)}
          />
        );
      })}
    </List>
  );

  const sections = (
    <>
      {isOwner && (
        <ListFrame mobile={mobile}>
          <ManageSection
            id={calId}
            title={t("shareSection.calendarGroup")}
            first
            mobile={mobile}
          >
            {nameColor}
          </ManageSection>
        </ListFrame>
      )}
      {isOwner && (
        <ListFrame mobile={mobile}>
          <ManageSection
            id={codeId}
            title={t("inviteCode")}
            first={false}
            mobile={mobile}
          >
            {code}
          </ManageSection>
        </ListFrame>
      )}
      <ListFrame mobile={mobile}>
        <ManageSection
          id={memberId}
          title={
            members
              ? `${t("shareSection.members")} · ${members.length}`
              : t("shareSection.members")
          }
          first={!isOwner}
          mobile={mobile}
        >
          {memberRows}
        </ManageSection>
      </ListFrame>
    </>
  );

  // 다른 멤버가 있는지는 목록의 memberCount 로 본다(멤버 목록을 받기 전에도 동작이 정해진다)
  const hasOthers = calendar.memberCount > 1;
  const canTransfer = isOwner && hasOthers;
  const canDelete = isOwner && !hasOthers && !calendar.isDefault;
  const canLeave = !isOwner;
  const candidates = members ? transferCandidates(members) : null;

  // 맨 아래 되돌릴 수 없는 동작 하나 — 폰은 빨간 글 줄, 데스크톱 · 태블릿은 카드 밖 ghost critical 버튼
  // 넘기기 고르기는 멤버를 받기 전엔 막는다(고를 줄이 없다) — 여는 함수가 없는 동작이 그것이다
  const dangerDisabled = (onClick?: () => void) =>
    onClick == null && candidates == null;
  const dangerRow = (label: string, onClick?: () => void) => (
    <ListButtonItem
      disabled={dangerDisabled(onClick)}
      title={
        <span className="text-fg-critical group-has-[[data-list-action]:active]/list-item:text-fg-critical-contrast group-has-[[data-list-action]:hover]/list-item:text-fg-critical-contrast">
          {label}
        </span>
      }
      onClick={onClick}
    />
  );
  const dangerButton = (label: string, onClick?: () => void) => (
    // 확인을 여는 버튼 — ghost + critical, 상자 여백 그대로(flush 는 빨강을 덮고, 음수 여백은 쓰지 않는다 — button.md)
    <Button
      variant="ghost"
      ghostColor="critical"
      size="small"
      disabled={dangerDisabled(onClick)}
      onClick={onClick}
    >
      {label}
    </Button>
  );
  const danger = (label: string, onClick?: () => void) =>
    mobile ? dangerRow(label, onClick) : dangerButton(label, onClick);

  // 넘겨받을 멤버 고르기 — 폰 Menu Sheet · 1280 이상 Menu. 규칙에 맞지 않는 멤버는 보이되 막는다(transferCandidates)
  const transferPicker = (
    <ResponsiveMenu>
      <ResponsiveMenuTrigger asChild>
        {danger(t("shareSection.transferAndLeave"))}
      </ResponsiveMenuTrigger>
      <ResponsiveMenuContent
        title={t("shareSection.transferPickTitle")}
        description={
          candidates?.readOnlyFallback
            ? t("shareSection.transferPickReadOnly")
            : t("shareSection.transferPickDesc")
        }
        layout="textOnly"
        align="start"
      >
        <ResponsiveMenuGroup>
          {candidates?.others.map((m) => (
            <ResponsiveMenuItem
              key={m.rowId}
              label={m.userName}
              description={t(`role.${m.permission}`)}
              disabled={!candidates.eligible.has(m.rowId)}
              onSelect={() => setConfirmTransfer(m)}
            />
          ))}
        </ResponsiveMenuGroup>
      </ResponsiveMenuContent>
    </ResponsiveMenu>
  );

  const action = canTransfer
    ? transferPicker
    : canDelete
      ? danger(t("deleteCalendar"), () => setConfirmDelete(true))
      : canLeave
        ? danger(t("shareSection.leaveCalendar"), () => setConfirmLeave(true))
        : null;

  return (
    <>
      {!mobile && <ManagerHead title={calendar.calendarName} />}
      <div className={mobile ? "pb-x6" : "flex flex-col gap-x2"}>
        {sections}
        {action &&
          (mobile ? (
            // 되돌릴 수 없는 동작을 멤버 줄과 떼어 놓는 흰 여백 8
            <List className="mt-x2">{action}</List>
          ) : (
            <div className="mt-x2">{action}</div>
          ))}
      </div>

      {renaming && (
        <CalendarNameDialog
          calendar={calendar}
          onClose={() => setRenaming(false)}
        />
      )}

      {confirmRemove && (
        <AlertConfirm
          title={t("shareSection.removeMember")}
          message={t("shareSection.removeMemberConfirm", {
            name: confirmRemove.userName,
          })}
          confirmLabel={t("shareSection.removeMemberAction")}
          onConfirm={() => removeMember(confirmRemove)}
          onError={(error) =>
            confirmFail({
              error,
              unconfirmedKind: "action",
              message: t("shareSection.removeMemberFailed"),
              retry: () => removeMember(confirmRemove),
            })
          }
          onClose={() => setConfirmRemove(null)}
        />
      )}

      {confirmDelete && (
        <AlertConfirm
          title={t("deleteCalendar")}
          message={t("shareSection.deleteMessage", {
            name: calendar.calendarName,
          })}
          confirmLabel={tc("delete")}
          onConfirm={deleteCalendar}
          onError={(error) => {
            if (rejected(error, "CAL_019", t("shareSection.deleteHasMembers")))
              return;
            confirmFail({
              error,
              message: t("shareSection.deleteFailed"),
              retry: deleteCalendar,
            });
          }}
          onClose={() => setConfirmDelete(false)}
        />
      )}

      {confirmTransfer && (
        <AlertConfirm
          title={t("shareSection.transferAndLeave")}
          message={t("shareSection.transferMessage", {
            name: confirmTransfer.userName,
            calendar: calendar.calendarName,
          })}
          confirmLabel={t("shareSection.transferAction")}
          onConfirm={() => transferTo(confirmTransfer)}
          onError={(error) => {
            if (
              rejected(
                error,
                "CAL_020",
                t("shareSection.transferTargetInvalid"),
              )
            )
              return;
            confirmFail({
              error,
              unconfirmedKind: "action",
              message: t("shareSection.transferFailed"),
              retry: () => transferTo(confirmTransfer),
            });
          }}
          onClose={() => setConfirmTransfer(null)}
        />
      )}

      {confirmLeave && (
        <AlertConfirm
          title={t("shareSection.leaveCalendar")}
          message={t("shareSection.leaveMessage", {
            name: calendar.calendarName,
          })}
          confirmLabel={t("shareSection.leaveAction")}
          onConfirm={leaveCalendar}
          onError={(error) =>
            confirmFail({
              error,
              unconfirmedKind: "action",
              message: t("shareSection.leaveFailed"),
              retry: leaveCalendar,
            })
          }
          onClose={() => setConfirmLeave(false)}
        />
      )}
    </>
  );
}
