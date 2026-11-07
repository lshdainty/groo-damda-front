import { loadFailed } from "@/shared/api";
import { useRef, type ReactNode } from "react";
import { Bell, Settings } from "lucide-react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/shared/ds/button";
import { Card } from "@/shared/ds/card";
import { ListHeader } from "@/shared/ds/list";
import { ResultSection } from "@/shared/ds/result-section";
import { Skeleton, SkeletonGroup } from "@/shared/ds/skeleton";
import {
  TopNavigation,
  TopNavigationActions,
  TopNavigationBackButton,
  TopNavigationIconButton,
  TopNavigationTitle,
  useScreenTitle,
} from "@/shared/ds/top-navigation";
import { PageHead } from "@/shared/ui/groo/page-head";
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

type OutletCtx = { onAddTx: () => void; mobile: boolean };

const SETTINGS_PATH = "/desk/settings?section=notifications";

/** 알림 목록 skeleton — 머리 줄 · 날짜 머리 · 줄(타일 40 · 제목 · 본문 두 줄 · 시각) 자리만. */
function NotificationsPageSkeleton() {
  return (
    <SkeletonGroup>
      <div className="px-global-gutter py-x2">
        <Skeleton radius="4" text="t4" className="w-32" />
      </div>
      <div className="px-global-gutter pb-x2 pt-x2">
        <Skeleton radius="4" text="t4" className="w-28" />
      </div>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-start gap-x3 px-global-gutter py-x3">
          <Skeleton className="size-10 shrink-0 rounded-r3" />
          <div className="min-w-0 flex-1">
            <Skeleton
              radius="4"
              text="t5"
              className={i % 3 === 0 ? "w-36" : i % 3 === 1 ? "w-28" : "w-40"}
            />
            <Skeleton radius="4" text="t4" className="mt-x1 w-full" />
            <Skeleton radius="4" text="t4" className="mt-x1 w-2/3" />
          </div>
          <Skeleton radius="4" text="t3" className="w-8 shrink-0" />
        </div>
      ))}
    </SkeletonGroup>
  );
}

/**
 * 알림 페이지 — 폰은 상단 바(← 알림 · ⚙) + 흰 면 하나, 데스크톱은 최대 720 가운데의 목록 카드 하나(I-15 41 ~ 45).
 * 목록 머리 "읽지 않은 알림 n개" 는 서버 안 읽은 수(useUnreadCount)다 — 받아 온 줄(최대 100개)로 세지 않는다.
 * 줄은 벨 팝오버 · 시트와 같은 부품(NotificationRow · NotificationDayGroups).
 * 줄 끝 ⋮ → 삭제 → 확인창(2026-10-22 알림 지우기 결정 B). 바닥 고정 띠는 없다 — 설정은 상단 ⚙ / 데스크톱 [알림 설정].
 */
export function NotificationsPage() {
  const { t } = useTranslation("notification");
  const navigate = useNavigate();
  const { mobile } = useOutletContext<OutletCtx>();
  useScreenTitle(t("title"));
  // 상대시각 기준점 — 벨과 같은 훅(기준이 갈리면 같은 알림이 서로 다른 문구로 보인다)
  const now = useNow();
  const { data, isLoading, isError, refetch, isRefetching } =
    useNotifications();
  // 수가 오기 전에는 머리 줄을 숨긴다(받아 온 줄로 세지 않는다)
  const { data: unreadCount = 0 } = useUnreadCount({ reference: true });
  const notifications = data ?? [];
  const listRef = useRef<HTMLDivElement>(null);
  const markRead = useMarkRead();
  const markAllRead = useMarkAllRead();

  const handleClick = (n: Notification) => {
    if (!n.isRead) markRead.mutate(n.rowId);
  };

  // 목록 위 상태 줄(머리말이 아니다 — h2 를 주지 않는다). 안 읽은 것이 0 이면 줄 전체를 두지 않는다.
  const head =
    !isLoading && !loadFailed({ isError, data }) && unreadCount > 0 ? (
      <ListHeader as="div" className="pt-x2">
        <span>
          {t("popover.unreadPlain", { count: formatCount(unreadCount) })}
        </span>
        <Button
          variant="ghost"
          ghostColor="neutralMuted"
          size="small"
          loading={markAllRead.isPending}
          onClick={() =>
            markAllRead.mutate(undefined, {
              // 머리 줄이 걷히면 누른 버튼이 사라진다 — 초점을 목록으로 옮긴다
              onSuccess: () => listRef.current?.focus(),
            })
          }
        >
          {t("markAllRead")}
        </Button>
      </ListHeader>
    ) : null;

  let body: ReactNode;
  if (isLoading) {
    body = <NotificationsPageSkeleton />;
  } else if (isError && data === undefined) {
    body = (
      <ResultSection
        kind="failure"
        size={mobile ? "large" : "medium"}
        title={t("loadFailed.title")}
        description={t("loadFailed.desc")}
        primaryAction={{
          label: t("common:retry"),
          loading: isRefetching,
          onClick: () => void refetch(),
        }}
      />
    );
  } else if (notifications.length === 0) {
    body = (
      <ResultSection
        kind="empty"
        size={mobile ? "large" : "medium"}
        icon={<Bell />}
        title={t("empty")}
      />
    );
  } else {
    body = (
      <div ref={listRef} tabIndex={-1} className="outline-none">
        {head}
        <NotificationDayGroups
          items={notifications}
          now={now}
          renderRow={(n) => (
            <NotificationRow
              key={n.rowId}
              notification={n}
              pending={markRead.pendingIds.has(n.rowId)}
              now={now}
              onClick={() => handleClick(n)}
              menu={<NotificationMoreMenu notification={n} />}
            />
          )}
        />
      </div>
    );
  }

  // ── 폰 — 상단 바(← 알림 · ⚙ 알림 설정) + 화면 끝까지 흰 면 ─────────────────────
  if (mobile) {
    return (
      <>
        <TopNavigation type="standard">
          <TopNavigationBackButton fallbackHref="/desk/more" />
          <TopNavigationTitle>{t("title")}</TopNavigationTitle>
          <TopNavigationActions>
            <TopNavigationIconButton
              aria-label={t("prefs.title")}
              onClick={() => navigate(SETTINGS_PATH)}
            >
              <Settings />
            </TopNavigationIconButton>
          </TopNavigationActions>
        </TopNavigation>
        <div className="flex-1 shrink-0 bg-bg-layer-default pb-x6">{body}</div>
      </>
    );
  }

  // ── 데스크톱 · 태블릿 — 최대 720 가운데(밀도 low), 제목 줄 [알림 설정] + 목록 카드 하나 ───
  return (
    <div className="m-scroll" style={{ padding: 0 }}>
      <div className="mx-auto w-full max-w-[720px] px-[var(--layout-margin)] pt-nav-to-title">
        <PageHead
          title={t("title")}
          actions={
            <Button
              variant="neutralOutline"
              size="small"
              onClick={() => navigate(SETTINGS_PATH)}
            >
              <Settings aria-hidden />
              {t("prefs.title")}
            </Button>
          }
        />
        <Card body="list" className="mt-x1 mb-x6">
          {body}
        </Card>
      </div>
    </div>
  );
}
