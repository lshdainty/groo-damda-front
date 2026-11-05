import { useTranslation } from "react-i18next";
import { Crown, EllipsisVertical, Eye, Pencil } from "lucide-react";
import { Avatar } from "@/shared/ds/avatar";
import { Badge } from "@/shared/ds/badge";
import { Button } from "@/shared/ds/button";
import { ListItem } from "@/shared/ds/list";
import {
  ResponsiveMenu,
  ResponsiveMenuContent,
  ResponsiveMenuGroup,
  ResponsiveMenuItem,
  ResponsiveMenuTrigger,
} from "@/shared/ds/menu";
import type { CalendarMember, CalendarRole } from "@/entities/user-calendar";

// 권한 배지 — outline + 앞 아이콘(badge.md 예시): 편집 가능 positive + 연필 · 읽기 전용 informative + 눈, 소유자는 예시 밖이라 neutral + 왕관
const ROLE_BADGE: Record<
  CalendarRole,
  { tone: "neutral" | "positive" | "informative"; icon: typeof Crown }
> = {
  OWNER: { tone: "neutral", icon: Crown },
  EDIT: { tone: "positive", icon: Pencil },
  READ: { tone: "informative", icon: Eye },
};

/**
 * 멤버 줄(I-09b 26 · 27) — ds List 보기 줄: 앞 Avatar 36(이니셜 + 이름 색) · 이름(나이면 뒤 " (나)") · 메일(아무 자리에서 줄바꿈) ·
 * 오른쪽 권한 Badge outline(늘) + 내보낼 수 있는 줄에만 ⋮ 아이콘 버튼. ⋮ 는 폰 Menu Sheet · 1280 이상 Menu — 항목은 지금 권한이 아닌 쪽
 * 하나 + "내보내기"(critical, 맨 아래) 한 묶음이다. 권한 바꾸기는 누르면 바로 서버로 간다.
 */
export function CalendarMemberRow({
  member,
  isSelf,
  canManage,
  onChangeRole,
  onRemove,
}: {
  member: CalendarMember;
  isSelf: boolean;
  /** 내보낼 수 있다 — 내가 소유자이고, 그 줄이 소유자도 나도 아니다 */
  canManage: boolean;
  onChangeRole: (permission: Exclude<CalendarRole, "OWNER">) => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation("calendar");
  const role = ROLE_BADGE[member.permission];
  const RoleIcon = role.icon;
  const other = member.permission === "EDIT" ? "READ" : "EDIT";
  return (
    <ListItem
      prefix={<Avatar name={member.userName} size={36} />}
      title={
        <>
          <span className="[overflow-wrap:anywhere]">{member.userName}</span>
          {isSelf && (
            <span className="text-fg-neutral-subtle">
              {" "}
              {t("shareSection.you")}
            </span>
          )}
        </>
      }
      detail={
        <span className="[overflow-wrap:anywhere]">{member.userEmail}</span>
      }
      suffix={
        <span className="inline-flex items-center gap-x1">
          <Badge
            variant="outline"
            tone={role.tone}
            prefixIcon={<RoleIcon />}
            className="shrink-0"
          >
            {t(`role.${member.permission}`)}
          </Badge>
          {canManage && (
            <ResponsiveMenu>
              <ResponsiveMenuTrigger asChild>
                <Button
                  variant="ghost"
                  ghostColor="neutralSubtle"
                  layout="iconOnly"
                  size="small"
                  aria-label={t("shareSection.moreOf", {
                    name: member.userName,
                  })}
                >
                  <EllipsisVertical aria-hidden />
                </Button>
              </ResponsiveMenuTrigger>
              <ResponsiveMenuContent
                title={member.userName}
                layout="textOnly"
                align="end"
              >
                <ResponsiveMenuGroup>
                  <ResponsiveMenuItem
                    label={t(`shareSection.changeTo.${other}`)}
                    onSelect={() => onChangeRole(other)}
                  />
                  <ResponsiveMenuItem
                    label={t("shareSection.removeMemberAction")}
                    tone="critical"
                    onSelect={onRemove}
                  />
                </ResponsiveMenuGroup>
              </ResponsiveMenuContent>
            </ResponsiveMenu>
          )}
        </span>
      }
    />
  );
}
