import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ListButtonItem, ListItem, ListTile } from "@/shared/ds/list";
import { Spinner } from "@/shared/ui/spinner";
import { notificationVisual } from "../lib/notificationVisual";
import { relativeTime } from "../lib/relativeTime";
import type { Notification } from "../model/types";

/**
 * 알림 줄 — SEED List 줄(9-1 A): 타일 40 · 제목 16/400 · 설명 13 muted · 시각 13 subtle,
 * 안 읽은 줄은 bg-brand-weak 바탕 + 제목 옆 점. 읽은 줄은 보기만 하는 줄(`ListItem`), 안 읽은 줄만 버튼
 * (`ListButtonItem` — 9-2 A, 누르면 읽음)이다. `<List>` 안에 놓는다.
 */
export function NotificationRow({
  notification,
  now,
  onClick,
  pending,
  menu,
}: {
  notification: Notification;
  /**
   * 상대시각의 기준점 — 호출부에서 `useNow()` 로 받아 내린다.
   *
   * 기본값을 주지 않는다. 기본값이 있으면 안 넘긴 호출부가 조용히 다른 기준을 쓰게
   * 되는데, 그래서 같은 알림이 벨과 알림 페이지에서 서로 다른 문구로 보였다.
   * 필수로 두면 새 호출부가 생겨도 컴파일이 먼저 붙잡는다.
   */
  now: number;
  /** 안 읽은 줄을 눌렀을 때(읽음 처리) — 읽은 줄은 누르지 않는다 */
  onClick?: () => void;
  /** 읽음 처리 요청 진행 중 — 점 자리에 스피너, 누르지 못한다. */
  pending?: boolean;
  /**
   * 줄 끝에 시각과 함께 놓는 작은 버튼(⋮ 더보기) — 호출부가 넘긴다(entities 는 features 를 모른다).
   * 뒤 붙이개에 놓이므로 줄의 읽음 버튼과 형제다 — 줄 버튼 안에 들어가지 않고 따로 눌린다.
   */
  menu?: ReactNode;
}) {
  const { t } = useTranslation("notification");
  const { Icon, bg, fg } = notificationVisual(notification.notificationType);
  const unread = !notification.isRead;
  const cut = notification.title.lastIndexOf(" ") + 1;
  const titleHead = notification.title.slice(0, cut);
  const titleTail = notification.title.slice(cut);

  const common = {
    prefix: (
      <ListTile style={{ background: bg, color: fg }}>
        <Icon size={20} strokeWidth={2} aria-hidden />
      </ListTile>
    ),
    // 점은 제목 글 안의 인라인이다 — 줄바꿈이 나도 마지막 글 바로 뒤 6 에 붙고, 점만 다음 줄로 떨어지지 않게 마지막 단어와 묶는다
    title: (
      <>
        {titleHead}
        <span className="whitespace-nowrap">
          {titleTail}
          {pending ? (
            <span className="ml-x1_5 inline-block align-middle">
              <Spinner size="sm" />
            </span>
          ) : (
            unread && (
              <>
                <span
                  aria-hidden
                  className="ml-x1_5 inline-block size-1.5 shrink-0 rounded-full bg-fg-brand align-middle"
                />
                <span className="sr-only">{t("row.unread")}</span>
              </>
            )
          )}
        </span>
      </>
    ),
    detail: (
      <span className="line-clamp-2 text-fg-neutral-muted">
        {notification.message}
      </span>
    ),
    suffix: menu ? (
      <>
        <span className="text-t3 text-fg-neutral-subtle">
          {relativeTime(notification.createAt, now)}
        </span>
        {menu}
      </>
    ) : (
      <span className="text-t3 text-fg-neutral-subtle">
        {relativeTime(notification.createAt, now)}
      </span>
    ),
    highlighted: unread,
    align: "top" as const,
  };

  if (unread && onClick)
    return (
      <ListButtonItem
        {...common}
        rootProps={{ "data-notification-id": notification.rowId } as object}
        disabled={pending}
        aria-busy={pending || undefined}
        onClick={onClick}
      />
    );
  return (
    <ListItem
      {...common}
      {...({ "data-notification-id": notification.rowId } as object)}
    />
  );
}
