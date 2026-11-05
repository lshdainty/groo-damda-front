import { useState } from "react";
import { EllipsisVertical, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/shared/ds/button";
import {
  ResponsiveMenu,
  ResponsiveMenuContent,
  ResponsiveMenuGroup,
  ResponsiveMenuItem,
  ResponsiveMenuTrigger,
} from "@/shared/ds/menu";
import { AlertConfirm } from "@/shared/ui/groo/alert-confirm";
import { useConfirmFail } from "@/shared/lib/confirm-fail";
import type { Notification } from "@/entities/notification";

import { useDeleteNotification } from "../model/useNotifications";

/**
 * 알림 줄 끝 ⋮ → "삭제" → 확인창 → 지움(2026-10-22 알림 지우기 결정 B, decisions/notif-delete.md).
 *
 * - ⋮ 의 이름은 "{알림 제목} 더보기" — 줄마다 다르게 읽힌다. 줄의 읽음 버튼과 형제다(줄 버튼 안에 넣지 않는다).
 * - 1280 미만은 Menu Sheet(제목 = 알림 제목), 이상은 Menu. 위험 줄 "삭제" 하나.
 * - 줄을 고르면 메뉴가 먼저 다 닫히고, 그 뒤 Alert Dialog "알림 삭제" 가 뜬다(ResponsiveMenuItem onSelect 규칙).
 * - 줄 밀기는 두지 않는다. 서버 API 는 있는 것(DELETE /v1/notification/{id} — 숨김 표시)을 쓴다.
 */
export function NotificationMoreMenu({
  notification,
}: {
  notification: Notification;
}) {
  const { t } = useTranslation("notification");
  const { t: tc } = useTranslation("common");
  const del = useDeleteNotification();
  const confirmFail = useConfirmFail();
  const [confirming, setConfirming] = useState(false);

  return (
    <>
      <ResponsiveMenu>
        <ResponsiveMenuTrigger asChild>
          <Button
            variant="ghost"
            ghostColor="neutralSubtle"
            layout="iconOnly"
            size="xsmall"
            aria-label={t("more", { title: notification.title })}
            data-slot="notification-more"
          >
            <EllipsisVertical aria-hidden />
          </Button>
        </ResponsiveMenuTrigger>
        <ResponsiveMenuContent title={notification.title} align="end">
          <ResponsiveMenuGroup>
            <ResponsiveMenuItem
              label={tc("delete")}
              icon={<Trash2 aria-hidden />}
              tone="critical"
              onSelect={() => setConfirming(true)}
            />
          </ResponsiveMenuGroup>
        </ResponsiveMenuContent>
      </ResponsiveMenu>
      {confirming && (
        <AlertConfirm
          title={t("deleteTitle")}
          message={t("deleteDescription")}
          confirmLabel={tc("delete")}
          onConfirm={() => del.mutateAsync(notification.rowId)}
          onError={() =>
            confirmFail({
              message: t("deleteFailed"),
              retry: () => del.mutateAsync(notification.rowId),
            })
          }
          onClose={() => setConfirming(false)}
        />
      )}
    </>
  );
}
