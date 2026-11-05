import { useId, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Calendar, ChevronRight, Crown, Eye, Link, Pencil } from "lucide-react";
import { Badge as DsBadge } from "@/shared/ds/badge";
import { Button as DsButton } from "@/shared/ds/button";
import { Card as DsCard } from "@/shared/ds/card";
import { List, ListItem, ListLinkItem, ListTile } from "@/shared/ds/list";
import { BandFailure } from "@/shared/ui/groo/band-parts";
import { getPaletteByColor } from "@/shared/lib/groo/chart-palette";
import { ManagerHead } from "@/shared/ui/groo/manager-layout";
import { useUserCalendars } from "@/features/user-calendar";
import type { CalendarRole, UserCalendar } from "@/entities/user-calendar";
import { calendarManageHref, isPlainLinkClick } from "../lib/manage-href";
import { CalendarCreateDialog } from "./CalendarCreateDialog";
import { CalendarJoinDialog } from "./CalendarJoinDialog";
import {
  ManageEmpty,
  ManageIntro,
  ManageRowsSkeleton,
  ManageSection,
} from "./manage-list-parts";

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
  const uid = useId();

  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);

  const list = useMemo(() => calendars ?? [], [calendars]);
  const owned = useMemo(() => list.filter((c) => c.isOwner), [list]);
  const shared = useMemo(() => list.filter((c) => !c.isOwner), [list]);

  const addAction = (
    // 목록 제목 오른쪽 글 버튼 — ghost small neutralMuted + 앞 plus (39)
    <DsButton
      type="button"
      variant="ghost"
      ghostColor="neutralMuted"
      size="small"
      onClick={() => setCreating(true)}
    >
      {t("newCalendar")}
    </DsButton>
  );

  const rowsOf = (items: UserCalendar[], labelId: string, empty: string) => {
    if (isLoading) return <ManageRowsSkeleton />;
    if (items.length === 0) return <ManageEmpty title={empty} />;
    return (
      <List aria-labelledby={labelId}>
        {items.map((cal) => (
          <CalendarRow key={cal.rowId} cal={cal} />
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
        as="h2"
      />,
    )
  ) : (
    <>
      {wrap(
        mobile,
        <ManageSection
          id={ownedId}
          title={countTitle(
            t("shareSection.myCalendars"),
            owned.length,
            isLoading,
          )}
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
          title={countTitle(
            t("shareSection.sharedCalendars"),
            shared.length,
            isLoading,
          )}
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
      title={t("inviteCode")}
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
        {mobile && (
          <ManageIntro mobile>{t("shareSection.infoDesc")}</ManageIntro>
        )}
        {lists}
        {join}
      </div>

      {creating && (
        <CalendarCreateDialog
          owned={owned}
          onClose={() => setCreating(false)}
        />
      )}

      {joining && <CalendarJoinDialog onClose={() => setJoining(false)} />}
    </>
  );
}

// 불러오는 동안은 수를 말하지 않는다(받은 게 없는데 0 이라 하지 않게)
function countTitle(name: string, count: number, loading: boolean) {
  return loading ? name : `${name} · ${count}`;
}

// 폰은 흰 면 위에 묶음을 그대로, 데스크톱은 묶음마다 목록 카드(43)
function wrap(mobile: boolean, node: React.ReactNode) {
  return mobile ? node : <DsCard body="list">{node}</DsCard>;
}

function CalendarRow({ cal }: { cal: UserCalendar }) {
  const { t } = useTranslation("calendar");
  const navigate = useNavigate();
  const pal = getPaletteByColor(cal.color);
  const role = ROW_ROLE_BADGE[cal.myRole];
  const RoleIcon = role.icon;
  const href = calendarManageHref(cal.rowId);
  return (
    // 누르면 이 캘린더의 관리 페이지로 간다 — 화면을 옮기는 줄이라 꺾쇠 18 (list.md:122). 링크라 가운데 누름 · 새 탭이 산다
    <ListLinkItem
      href={href}
      onClick={(e) => {
        if (!isPlainLinkClick(e)) return;
        e.preventDefault();
        navigate(href);
      }}
      prefix={
        <ListTile aria-hidden style={{ background: pal.bg, color: pal.color }}>
          <Calendar />
        </ListTile>
      }
      suffix={<ChevronRight aria-hidden />}
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
