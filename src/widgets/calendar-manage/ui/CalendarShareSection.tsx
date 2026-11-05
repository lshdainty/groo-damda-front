import { useId, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Calendar,
  Copy,
  Crown,
  Eye,
  Link,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import { Badge as DsBadge } from "@/shared/ds/badge";
import { Button as DsButton } from "@/shared/ds/button";
import { Card as DsCard } from "@/shared/ds/card";
import { List, ListButtonItem, ListItem, ListTile } from "@/shared/ds/list";
import { AlertConfirm } from "@/shared/ui/groo/alert-confirm";
import { BandFailure } from "@/shared/ui/groo/band-parts";
import { useConfirmFail } from "@/shared/lib/confirm-fail";
import { ConfirmDialog, ModalShell } from "@/shared/ui/groo/dialogs";
import { ModalFooter } from "@/shared/ui/groo/modal-footer";
import { Field, FieldLabel } from "@/shared/ui/field";
import { Input } from "@/shared/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import {
  getPaletteByColor,
  CAT_PALETTE,
} from "@/shared/lib/groo/chart-palette";
import { ColorSwatchGroup } from "@/shared/ui/color-swatch";
import { Skeleton as SkeletonBase } from "@/shared/ui/skeleton";
import { ManagerHead } from "@/shared/ui/groo/manager-layout";
import { useCurrentUser } from "@/features/user";
import {
  useCalendarMembers,
  useChangeCalendarMemberRole,
  useCreateUserCalendar,
  useDeleteUserCalendar,
  useJoinCalendar,
  useRegenerateCalendarInviteCode,
  useRemoveCalendarMember,
  useUpdateUserCalendar,
  useUserCalendars,
} from "@/features/user-calendar";
import type {
  CalendarMember,
  CalendarRole,
  UserCalendar,
} from "@/entities/user-calendar";
import {
  ManageEmpty,
  ManageIntro,
  ManageRowsSkeleton,
  ManageSection,
} from "./manage-list-parts";

const ROLE_ICON: Record<CalendarRole, typeof Crown> = {
  OWNER: Crown,
  EDIT: Pencil,
  READ: Eye,
};

// 권한 배지 — badge.md "같은 카테고리는 한 style(outline)" 규칙: 색만 분기.
const ROLE_BADGE_VARIANT: Record<
  CalendarRole,
  "outline-info" | "outline-success" | "outline"
> = {
  OWNER: "outline-info",
  EDIT: "outline-success",
  READ: "outline",
};

// 멤버 아바타 — 권한 색 톤 (소유자 info / 편집 success / 읽기 neutral).
const ROLE_AVATAR: Record<CalendarRole, { bg: string; fg: string }> = {
  OWNER: {
    bg: "var(--color-bg-informative-weak)",
    fg: "var(--color-fg-informative)",
  },
  EDIT: {
    bg: "var(--color-bg-positive-weak)",
    fg: "var(--color-fg-positive)",
  },
  READ: { bg: "var(--bg-sunken)", fg: "var(--fg-tertiary)" },
};

// 캘린더 줄의 권한 배지(40) — badge.md 예시 그대로: outline + 앞 아이콘. 편집 가능 positive + pencil · 읽기 전용 informative + eye.
const ROW_ROLE_BADGE: Record<
  CalendarRole,
  { tone: "informative" | "positive"; icon: typeof Pencil }
> = {
  OWNER: { tone: "informative", icon: Crown },
  EDIT: { tone: "positive", icon: Pencil },
  READ: { tone: "informative", icon: Eye },
};

export function CalendarShareSection({ mobile }: { mobile: boolean }) {
  const { t } = useTranslation("calendar");
  // 실패는 화면 안 Result Section 한 벌로 말한다 — 전역 서버 원문 토스트와 겹치지 않게 silent (42)
  const calendarsQ = useUserCalendars({ silent: true });
  const { data: calendars, isLoading } = calendarsQ;
  const failed = calendarsQ.isError && !calendars;
  const createMut = useCreateUserCalendar();
  const deleteMut = useDeleteUserCalendar();
  const joinMut = useJoinCalendar();
  const confirmFail = useConfirmFail();
  const uid = useId();

  const [managingId, setManagingId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<UserCalendar | null>(null);
  const [joining, setJoining] = useState(false);

  const list = useMemo(() => calendars ?? [], [calendars]);
  const owned = useMemo(() => list.filter((c) => c.isOwner), [list]);
  const shared = useMemo(() => list.filter((c) => !c.isOwner), [list]);

  const deleteCalendar = async (cal: UserCalendar) => {
    await deleteMut.mutateAsync(cal.rowId);
    if (managingId === cal.rowId) setManagingId(null);
  };

  const managing =
    managingId != null
      ? (list.find((c) => c.rowId === managingId) ?? null)
      : null;

  const addAction = (
    // 목록 제목 오른쪽 글 버튼 — ghost small neutralMuted + 앞 plus (39)
    <DsButton
      type="button"
      variant="ghost"
      ghostColor="neutralMuted"
      size="small"
      onClick={() => setCreating(true)}
    >
      <Plus aria-hidden />
      {t("newCalendar")}
    </DsButton>
  );

  const rowsOf = (items: UserCalendar[], labelId: string, empty: string) => {
    if (isLoading) return <ManageRowsSkeleton />;
    if (items.length === 0) return <ManageEmpty title={empty} />;
    return (
      <List aria-labelledby={labelId}>
        {items.map((cal) => (
          <CalendarRow key={cal.rowId} cal={cal} onManage={setManagingId} />
        ))}
      </List>
    );
  };

  const ownedId = `${uid}-owned`;
  const sharedId = `${uid}-shared`;
  const joinId = `${uid}-join`;

  const lists = failed ? (
    wrap(
      mobile,
      <BandFailure
        title={t("shareSection.loadFailed")}
        onRetry={() => void calendarsQ.refetch()}
        band={mobile}
        size="medium"
      />,
    )
  ) : (
    <>
      {wrap(
        mobile,
        <ManageSection
          id={ownedId}
          title={`${t("shareSection.myCalendars")} · ${owned.length}`}
          action={addAction}
          first
          mobile={mobile}
        >
          {rowsOf(owned, ownedId, t("shareSection.emptyOwned"))}
        </ManageSection>,
      )}
      {wrap(
        mobile,
        <ManageSection
          id={sharedId}
          title={`${t("shareSection.sharedCalendars")} · ${shared.length}`}
          first={false}
          mobile={mobile}
        >
          {rowsOf(shared, sharedId, t("shareSection.emptyShared"))}
        </ManageSection>,
      )}
    </>
  );

  const join = wrap(
    mobile,
    <ManageSection
      id={joinId}
      title={t("joinByCode")}
      first={false}
      mobile={mobile}
    >
      {/* 초대 코드로 참여(41) — 보기만 하는 줄 + 오른쪽 작은 버튼 */}
      <List aria-labelledby={joinId}>
        <ListItem
          prefix={
            <ListTile
              aria-hidden
              className="bg-chart-gray-weak text-chart-gray"
            >
              <Link />
            </ListTile>
          }
          title={t("joinByCode")}
          detail={t("shareSection.joinDesc")}
          suffix={
            <DsButton
              type="button"
              variant="neutralWeak"
              size="small"
              onClick={() => setJoining(true)}
            >
              {t("join")}
            </DsButton>
          }
        />
      </List>
    </ManageSection>,
  );

  return (
    <>
      {!mobile && (
        <ManagerHead
          title={t("shareSection.title")}
          description={t("shareSection.description")}
        />
      )}
      <div className={mobile ? "flex flex-col pb-x6" : "flex flex-col gap-x2"}>
        <ManageIntro mobile={mobile}>{t("shareSection.infoDesc")}</ManageIntro>
        {lists}
        {join}
      </div>

      {managing && (
        <CalendarManageDialog
          calendar={managing}
          onClose={() => setManagingId(null)}
          onRequestDelete={(c) => setConfirmDelete(c)}
          mobile={mobile}
        />
      )}

      {creating && (
        <CalendarCreateDialog
          onClose={() => setCreating(false)}
          onCreate={(values, onDone) =>
            createMut.mutate(values, {
              onSuccess: () => {
                onDone();
              },
            })
          }
          submitting={createMut.isPending}
          mobile={mobile}
        />
      )}

      {joining && (
        <CalendarJoinDialog
          onClose={() => setJoining(false)}
          onJoin={(code, onDone) =>
            joinMut.mutate(code, {
              onSuccess: () => {
                onDone();
                toast.success(t("shareSection.toast.joined"), {
                  id: "cal-join-success",
                });
              },
              onError: () =>
                toast.error(t("shareSection.toast.joinError"), {
                  id: "cal-join-err",
                }),
            })
          }
          submitting={joinMut.isPending}
          mobile={mobile}
        />
      )}

      {confirmDelete && (
        <AlertConfirm
          title={t("deleteCalendar")}
          message={t("shareSection.deleteMessage", {
            name: confirmDelete.calendarName,
          })}
          confirmLabel={t("shareSection.permanentDelete")}
          onConfirm={() => deleteCalendar(confirmDelete)}
          onError={() =>
            confirmFail({
              message: t("shareSection.deleteFailed"),
              retry: () => deleteCalendar(confirmDelete),
            })
          }
          onClose={() => setConfirmDelete(null)}
        />
      )}
    </>
  );
}

// 폰은 흰 면 위에 묶음을 그대로, 데스크톱은 묶음마다 목록 카드(43)
function wrap(mobile: boolean, node: React.ReactNode) {
  return mobile ? node : <DsCard body="list">{node}</DsCard>;
}

function CalendarRow({
  cal,
  onManage,
}: {
  cal: UserCalendar;
  onManage: (id: number) => void;
}) {
  const { t } = useTranslation("calendar");
  const pal = getPaletteByColor(cal.color);
  const role = ROW_ROLE_BADGE[cal.myRole];
  const RoleIcon = role.icon;
  return (
    // 누르면 지금의 관리 대화상자가 열린다 — 화면을 옮기지 않는 줄이라 꺾쇠는 없다(list.md:122). 관리 페이지로 바뀌면 09b-2 가 더한다
    <ListButtonItem
      onClick={() => onManage(cal.rowId)}
      prefix={
        <ListTile aria-hidden style={{ background: pal.bg, color: pal.color }}>
          <Calendar />
        </ListTile>
      }
      title={
        <>
          {cal.calendarName}
          {cal.isDefault && (
            <DsBadge tone="neutral" className="ml-x1 align-middle">
              {t("default")}
            </DsBadge>
          )}
          {!cal.isOwner && (
            <DsBadge
              variant="outline"
              tone={role.tone}
              prefixIcon={<RoleIcon />}
              className="ml-x1 align-middle"
            >
              {t(`role.${cal.myRole}`)}
            </DsBadge>
          )}
        </>
      }
      detail={
        cal.memberCount <= 1
          ? t("shareSection.onlyMe")
          : t("shareSection.memberCount", { count: cal.memberCount })
      }
    />
  );
}

function CalendarManageDialog({
  calendar,
  onClose,
  onRequestDelete,
  mobile,
}: {
  calendar: UserCalendar;
  onClose: () => void;
  onRequestDelete: (cal: UserCalendar) => void;
  mobile: boolean;
}) {
  const uid = useId(); // 멤버 권한 칸 이름 잇기
  const { t } = useTranslation("calendar");
  const { t: tc } = useTranslation("common");
  const { data: currentUser } = useCurrentUser();
  const { data: members, isLoading } = useCalendarMembers(calendar.rowId);
  const regenMut = useRegenerateCalendarInviteCode();
  const removeMut = useRemoveCalendarMember();
  const roleMut = useChangeCalendarMemberRole();
  const updateMut = useUpdateUserCalendar();

  const isOwner = calendar.isOwner;
  const [name, setName] = useState(calendar.calendarName);
  const [color, setColor] = useState(calendar.color);
  const dirty =
    name.trim() !== calendar.calendarName || color !== calendar.color;

  const handleSaveMeta = () => {
    if (!name.trim()) return;
    updateMut.mutate({
      id: calendar.rowId,
      data: { calendarName: name.trim(), color },
    });
  };

  const handleCopyCode = async (code: string) => {
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
    toast.success(t("shareSection.toast.codeCopied"), { id: "cal-code-copy" });
  };

  const handleRegenerate = () => {
    regenMut.mutate(calendar.rowId, {
      onSuccess: () =>
        toast.success(t("shareSection.toast.codeRegenerated"), {
          id: "cal-code-regen",
        }),
    });
  };

  // 내보내면 그 사람은 캘린더를 잃는다 — 앱은 이미 한 번 더 묻는다.
  const [confirmRemove, setConfirmRemove] = useState<CalendarMember | null>(
    null,
  );
  const handleRemove = (member: CalendarMember) => setConfirmRemove(member);

  const doRemove = (member: CalendarMember) => {
    removeMut.mutate(
      { id: calendar.rowId, memberId: member.rowId },
      {
        onSuccess: () => {
          setConfirmRemove(null);
        },
      },
    );
  };

  const handleChangeRole = (
    member: CalendarMember,
    permission: CalendarRole,
  ) => {
    roleMut.mutate({ id: calendar.rowId, memberId: member.rowId, permission });
  };

  // 관리 시트는 상세 화면이 따로 없어 폼이 곧 상세다 — 삭제를 여기 남기고 `취소/닫기` 는
  // 우상단 X 에 맡긴다(spec drawer.md 액션 구성 · 상세 화면이 없는 흐름).
  // 저장은 본문 인라인이 아니라 footer 로 — 폼의 주 액션은 footer 에 있어야 찾는다.
  // 소유자가 아니면 바꿀 것도 지울 것도 없어 footer 자체를 두지 않는다.
  const Footer = isOwner ? (
    <ModalFooter
      onSave={handleSaveMeta}
      saveLabel={tc("save")}
      saving={updateMut.isPending}
      saveDisabled={!dirty || !name.trim()}
      onDelete={
        calendar.isDefault
          ? undefined
          : () => {
              onRequestDelete(calendar);
              onClose();
            }
      }
      deleteLabel={t("deleteCalendar")}
    />
  ) : undefined;

  return (
    <ModalShell
      title={`${calendar.calendarName} · ${t("shareSection.manageSuffix")}`}
      onClose={onClose}
      size="md"
      footer={Footer}
      mobile={mobile}
    >
      {isOwner && (
        <>
          {/* 이름 */}
          <Field style={{ marginBottom: 14 }}>
            <FieldLabel>{t("name")}</FieldLabel>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("shareSection.namePlaceholder")}
            />
          </Field>

          {/* 색상 */}
          <Field style={{ marginBottom: 14 }}>
            <FieldLabel>{t("form.color")}</FieldLabel>
            <ColorSwatchGroup
              columns={5}
              value={color}
              onValueChange={setColor}
              options={CAT_PALETTE.map((p) => ({
                value: p.baseHex,
                bg: p.bg,
                fg: p.color,
              }))}
            />
          </Field>

          {/* 초대 코드 */}
          <Field style={{ marginBottom: 18 }}>
            <FieldLabel>{t("inviteCode")}</FieldLabel>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Input
                value={calendar.inviteCode ?? ""}
                readOnly
                style={{ flex: 1, minWidth: 0 }}
              />
              <Button
                variant="outline"
                size="icon"
                aria-label={t("shareSection.copyCode")}
                onClick={() => handleCopyCode(calendar.inviteCode ?? "")}
              >
                <Copy size={14} />
              </Button>
              <Button
                variant="outline"
                size="icon"
                aria-label={t("shareSection.regenCode")}
                onClick={handleRegenerate}
                loading={regenMut.isPending}
              >
                {!regenMut.isPending && <RefreshCw size={14} />}
              </Button>
            </div>
            <div
              style={{
                fontSize: "var(--text-badge)",
                color: "var(--fg-tertiary)",
                marginTop: 6,
              }}
            >
              {t("shareSection.codeHint")}
            </div>
          </Field>
        </>
      )}

      {/* 멤버 리스트 */}
      <div
        style={{
          fontSize: "var(--text-badge)",
          fontWeight: "700",
          color: "var(--fg-tertiary)",
          letterSpacing: "0.04em",
          textTransform: "uppercase",
          marginBottom: 8,
          paddingLeft: 4,
        }}
      >
        {t("shareSection.members")} · {members?.length ?? 0}
      </div>
      {isLoading || !members ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <SkeletonBase className="h-12 w-full rounded-md" />
          <SkeletonBase className="h-12 w-full rounded-md" />
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column" }}>
          {members.map((member, i) => {
            const RoleIcon = ROLE_ICON[member.permission];
            const isSelf = member.userRowId === currentUser?.rowId;
            const canManage =
              isOwner && member.permission !== "OWNER" && !isSelf;
            return (
              <div
                key={member.rowId}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "12px 4px",
                  borderTop:
                    i === 0 ? "none" : "1px solid var(--border-subtle)",
                }}
              >
                <span
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: "var(--radius-pill)",
                    background: ROLE_AVATAR[member.permission].bg,
                    color: ROLE_AVATAR[member.permission].fg,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <RoleIcon size={16} strokeWidth={2} />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    id={`${uid}member-${member.rowId}`}
                    style={{
                      fontSize: "var(--text-body-sm)",
                      fontWeight: "600",
                      color: "var(--fg-primary)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {member.userName}
                    {isSelf && (
                      <span
                        style={{
                          color: "var(--fg-tertiary)",
                          fontWeight: "500",
                        }}
                      >
                        {" "}
                        {t("shareSection.you")}
                      </span>
                    )}
                  </div>
                  <div
                    style={{
                      fontSize: "var(--text-caption)",
                      color: "var(--fg-tertiary)",
                      marginTop: 2,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {member.userEmail}
                  </div>
                </div>
                {canManage ? (
                  <>
                    <Select
                      value={member.permission}
                      onValueChange={(v) =>
                        handleChangeRole(member, v as CalendarRole)
                      }
                      disabled={roleMut.isPending}
                    >
                      <SelectTrigger
                        id={`${uid}role-${member.rowId}`}
                        aria-labelledby={`${uid}member-${member.rowId} ${uid}role-${member.rowId}`}
                        className="h-8 w-28 text-xs"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="EDIT">{t("role.EDIT")}</SelectItem>
                        <SelectItem value="READ">{t("role.READ")}</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="!text-[var(--color-fg-critical)]"
                      aria-label={t("shareSection.removeMember")}
                      onClick={() => handleRemove(member)}
                      loading={removeMut.isPending}
                    >
                      {!removeMut.isPending && <Trash2 size={14} />}
                    </Button>
                  </>
                ) : (
                  <Badge
                    variant={ROLE_BADGE_VARIANT[member.permission]}
                    style={{ flexShrink: 0 }}
                  >
                    <RoleIcon size={11} strokeWidth={2.2} />
                    {t(`role.${member.permission}`)}
                  </Badge>
                )}
              </div>
            );
          })}
        </div>
      )}
      {confirmRemove && (
        <ConfirmDialog
          title={t("shareSection.removeMember")}
          message={t("shareSection.removeMemberConfirm", {
            name: confirmRemove.userName,
          })}
          confirmLabel={t("shareSection.removeMemberAction")}
          danger
          loading={removeMut.isPending}
          onCancel={() => setConfirmRemove(null)}
          onConfirm={() => doRemove(confirmRemove)}
        />
      )}
    </ModalShell>
  );
}

function CalendarCreateDialog({
  onClose,
  onCreate,
  submitting,
  mobile,
}: {
  onClose: () => void;
  onCreate: (
    values: { calendarName: string; color: string },
    onDone: () => void,
  ) => void;
  submitting?: boolean;
  mobile: boolean;
}) {
  const { t } = useTranslation("calendar");
  const [name, setName] = useState("");
  const [color, setColor] = useState("#2c70bf");
  const [touched, setTouched] = useState(false);

  const nameTrim = name.trim();
  const valid = nameTrim.length > 0;
  const err = touched && !valid ? t("shareSection.nameRequired") : null;

  const save = () => {
    setTouched(true);
    if (!valid) return;
    onCreate({ calendarName: nameTrim, color }, onClose);
  };

  const Footer = (
    <ModalFooter
      onSave={save}
      saveLabel={t("shareSection.create")}
      saving={submitting}
      saveDisabled={touched && !valid}
      onCancel={onClose}
    />
  );

  return (
    <ModalShell
      title={t("newCalendar")}
      onClose={onClose}
      size="md"
      footer={Footer}
      mobile={mobile}
    >
      <Field style={{ marginBottom: 14 }}>
        <FieldLabel>{t("name")}</FieldLabel>
        <Input
          aria-invalid={!!err}
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setTouched(true);
          }}
          placeholder={t("shareSection.createNamePlaceholder")}
          autoFocus
        />
        {err && (
          <div
            style={{
              fontSize: "var(--text-badge)",
              color: "var(--color-fg-critical)",
              marginTop: 4,
            }}
          >
            {err}
          </div>
        )}
      </Field>

      <Field>
        <FieldLabel>{t("form.color")}</FieldLabel>
        <ColorSwatchGroup
          columns={5}
          value={color}
          onValueChange={setColor}
          options={CAT_PALETTE.map((p) => ({
            value: p.baseHex,
            bg: p.bg,
            fg: p.color,
          }))}
        />
      </Field>
    </ModalShell>
  );
}

function CalendarJoinDialog({
  onClose,
  onJoin,
  submitting,
  mobile,
}: {
  onClose: () => void;
  onJoin: (code: string, onDone: () => void) => void;
  submitting?: boolean;
  mobile: boolean;
}) {
  const { t } = useTranslation("calendar");
  const [code, setCode] = useState("");
  const valid = code.trim().length > 0;
  /**
   * **연타 가드는 문이 아니라 여기 있어야 한다.**
   *
   * 저장 버튼에만 걸면 Enter 는 그 문을 안 지난다 — 코드를 넣고 Enter 를 다섯 번
   * 누르면 참여 요청이 다섯 번 나갔다(QA #134). 입구는 버튼·Enter 둘이고 앞으로 더
   * 늘 수 있으니, "이미 나가 있으면 무시" 는 입구마다가 아니라 나가는 함수가 든다
   * (`shared/lib/groo/enter-save.ts` 주석 · 할 일 빠른 추가 #122 와 같은 자리).
   */
  const submit = () => {
    if (!valid || submitting) return;
    onJoin(code.trim().toUpperCase(), onClose);
  };

  const Footer = (
    <ModalFooter
      onSave={submit}
      saveLabel={t("join")}
      saving={submitting}
      saveDisabled={!valid}
      onCancel={onClose}
    />
  );

  return (
    <ModalShell
      title={t("joinByCode")}
      onClose={onClose}
      size="md"
      footer={Footer}
      mobile={mobile}
      // Enter 로 참여 — 손으로 단 `onKeyDown` 대신 껍데기의 문을 지난다. 한글 조합
      // 중 Enter·포털 안의 칸을 거르는 규칙(`isEnterSave`)이 거기 하나에 있다.
      onEnterSave={submit}
    >
      <Field>
        <FieldLabel>{t("inviteCode")}</FieldLabel>
        <Input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder={t("shareSection.joinCodePlaceholder")}
          autoFocus
        />
      </Field>
    </ModalShell>
  );
}
