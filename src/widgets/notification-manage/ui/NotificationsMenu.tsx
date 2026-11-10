import { useRef, useState, type ReactNode } from "react";
import { Bell } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  BottomSheet,
  BottomSheetBody,
  BottomSheetContent,
  BottomSheetFooter,
  BottomSheetTrigger,
} from "@/shared/ds/bottom-sheet";
import { Button } from "@/shared/ds/button";
import { List } from "@/shared/ds/list";
import { useWideSurface } from "@/shared/ds/overlay";
import {
  Popover,
  PopoverBody,
  PopoverContent,
  PopoverFooter,
  PopoverTrigger,
} from "@/shared/ds/popover";
import { ResultSection } from "@/shared/ds/result-section";
import { Skeleton } from "@/shared/ds/skeleton";
import { TopNavigationIconButton } from "@/shared/ds/top-navigation";
import {
  NotificationMoreMenu,
  useMarkAllRead,
  useMarkRead,
  useNotifications,
  useUnreadCount,
} from "@/features/notification";
import { useNow } from "@/shared/hooks";
import {
  NotificationDayGroups,
  NotificationRow,
  formatCount,
} from "@/entities/notification";
import type { Notification } from "@/entities/notification";

/**
 * 데스크톱 머리의 벨 + 알림 목록(Q-017 17-3b B · popover.md "알림 목록").
 * 1280 이상은 벨 아래 Popover(폭 380 · 600 까지), 768 ~ 1279 는 Bottom Sheet — 머리 "알림" · 설명 · 닫기, 본문 목록,
 * 바닥 "알림 설정" · "모두 읽음". 줄은 SEED List 줄이고 안 읽은 줄만 버튼이다(누르면 읽음 + 초점이 다음 안 읽은 줄로).
 * 줄 끝 ⋮ 는 읽음 버튼의 형제이고 "삭제" 하나를 연다(알림 지우기 결정 B) — 읽음 초점 이동은 `button` 을 찾으므로 줄 본문 버튼만 겨눈다.
 */
export function NotificationsMenu({
  onGoSettings,
}: {
  onGoSettings: () => void;
}) {
  const { t } = useTranslation("notification");
  const { t: tl } = useTranslation("layout");
  const { t: tc } = useTranslation("common");
  const wide = useWideSurface();
  const [open, setOpen] = useState(false);
  const now = useNow();
  const { data, isLoading, isError, refetch, isRefetching } =
    useNotifications();
  // 서버 수 — 오기 전에는 설명 줄을 비우고 받아 온 줄로 세지 않는다
  const { data: serverUnread } = useUnreadCount({ reference: true });
  const unreadCount = serverUnread ?? 0;
  const markRead = useMarkRead();
  const markAllRead = useMarkAllRead();
  const bodyRef = useRef<HTMLDivElement>(null);

  const items: Notification[] = data ?? [];
  // 안 읽은 수는 서버 수(useUnreadCount) — 받아 온 줄(최대 100개)만 세면 벨 · 화면과 수가 갈린다
  const unread = unreadCount;
  const description =
    serverUnread === undefined
      ? undefined
      : unread > 0
        ? t("popover.unreadPlain", { count: formatCount(unread) })
        : t("popover.noNew");

  // 누르면 읽음이 되고 초점이 다음 안 읽은 줄로 간다(9-2 A) — 눌린 줄은 버튼이 아니게 되므로 미리 옮긴다
  const readAndAdvance = (n: Notification) => {
    const nextUnread = items.find((m) => !m.isRead && m.rowId !== n.rowId);
    markRead.mutate(n.rowId);
    const target = nextUnread
      ? bodyRef.current?.querySelector<HTMLElement>(
          `[data-notification-id="${nextUnread.rowId}"] [data-slot=list-body]`,
        )
      : bodyRef.current;
    target?.focus();
  };

  const close = () => setOpen(false);
  const goSettings = () => {
    close();
    onGoSettings();
  };

  const bell = (
    <TopNavigationIconButton
      aria-label={
        unreadCount > 0 ? tl("notificationsUnread") : tl("notifications")
      }
      notification={unreadCount > 0}
    >
      <Bell />
    </TopNavigationIconButton>
  );

  const list: ReactNode = isLoading ? (
    <List aria-label={t("title")}>
      {Array.from({ length: 5 }).map((_, i) => (
        <li key={i} className="px-global-gutter py-x3">
          <Skeleton className="h-10 w-full" />
        </li>
      ))}
    </List>
  ) : isError && data === undefined ? (
    <ResultSection
      kind="failure"
      size="medium"
      title={t("loadFailed.title")}
      description={t("loadFailed.desc")}
      primaryAction={{
        label: tc("retry"),
        loading: isRefetching,
        onClick: () => void refetch(),
      }}
    />
  ) : items.length === 0 ? (
    <p className="m-0 py-x10 text-center text-t4 text-fg-neutral-subtle">
      {t("empty")}
    </p>
  ) : (
    <NotificationDayGroups
      items={items}
      now={now}
      headingAs="h3"
      renderRow={(n) => (
        <NotificationRow
          key={n.rowId}
          notification={n}
          now={now}
          pending={markRead.pendingIds.has(n.rowId)}
          onClick={() => readAndAdvance(n)}
          menu={<NotificationMoreMenu notification={n} />}
        />
      )}
    />
  );

  const body = (
    <div ref={bodyRef} tabIndex={-1} className="outline-none">
      {list}
    </div>
  );

  if (wide)
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>{bell}</PopoverTrigger>
        <PopoverContent
          title={t("title")}
          description={description}
          align="end"
          className="w-[380px]"
        >
          <PopoverBody scrollFog className="px-0">
            {body}
          </PopoverBody>
          <PopoverFooter>
            <Button variant="neutralWeak" onClick={goSettings}>
              {t("prefs.title")}
            </Button>
            <Button
              variant="neutralSolid"
              disabled={unread === 0}
              loading={markAllRead.isPending}
              onClick={() => markAllRead.mutate()}
            >
              {t("markAllRead")}
            </Button>
          </PopoverFooter>
        </PopoverContent>
      </Popover>
    );

  return (
    <BottomSheet open={open} onOpenChange={setOpen}>
      <BottomSheetTrigger asChild>{bell}</BottomSheetTrigger>
      <BottomSheetContent title={t("title")} description={description}>
        <BottomSheetBody scrollFog className="px-0">
          {body}
        </BottomSheetBody>
        <BottomSheetFooter>
          <Button variant="neutralWeak" onClick={goSettings}>
            {t("prefs.title")}
          </Button>
          <Button
            variant="neutralSolid"
            disabled={unread === 0}
            loading={markAllRead.isPending}
            onClick={() => markAllRead.mutate()}
          >
            {t("markAllRead")}
          </Button>
        </BottomSheetFooter>
      </BottomSheetContent>
    </BottomSheet>
  );
}
