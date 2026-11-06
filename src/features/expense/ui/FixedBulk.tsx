import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ReceiptText } from "lucide-react";
import { Button } from "@/shared/ds/button";
import { Callout } from "@/shared/ds/callout";
import {
  ResponsiveDialog,
  ResponsiveDialogBody,
  ResponsiveDialogContent,
  ResponsiveDialogFooter,
} from "@/shared/ds/dialog";
import { ListCheckGroup, ListCheckItem } from "@/shared/ds/list";
import { cn } from "@/shared/lib/cn";
import { useWideSurface } from "@/shared/ds/overlay";
import { ResultSection } from "@/shared/ds/result-section";
import {
  SegmentedControl,
  SegmentedControlItem,
} from "@/shared/ds/segmented-control";
import { Skeleton } from "@/shared/ds/skeleton";
import {
  TopNavigation,
  TopNavigationBackButton,
  TopNavigationTitle,
  useScreenTitle,
} from "@/shared/ds/top-navigation";
import { BandFailure } from "@/shared/ui/groo/band-parts";
import { ParentLink } from "@/shared/ui/groo/parent-link";
import { PageHead } from "@/shared/ui/groo/page-head";
import { useRegisterLeaveGuard } from "@/shared/ui/groo/leave-guard-context";
import { won, useMasked } from "@/shared/lib/groo/money-text";
import { useSaveFailureText } from "@/shared/lib/save-failure-text";
import type { ExpenseType } from "@/entities/expense";
import { groupCheck, toggleGroup } from "../lib/fixed-groups";
import { useFixedBulk, type FixedBulkTarget } from "../model/useFixedBulk";
import { useScrollToError } from "../model/useScrollToError";

/**
 * 거래를 고정으로 정리하는 화면 — 주소 `/desk/stats/fixed`(I-wrap-b1 δ 1).
 * 1280 미만(폰 + 768 ~ 1279)은 주소가 있는 페이지, 1280 이상은 통계 위에 뜨는 Dialog 다(bottom-sheet.md:99 · 215 "처음부터 긴 내용은
 * 페이지로", dialog.md:3 1280 이상 대화상자). 같은 거래 묶음을 한 줄로 묶어 한 번에 고르고, 돈 · 잔액은 안 움직이고 통계의 분류만 바뀐다.
 *
 * 고른 것(종류 · 방향 · 체크)은 이 컴포넌트 하나가 든다 — 폭이 768 · 1280 을 넘나들어 페이지 ↔ 대화상자가 바뀌어도 읽기만 한다.
 * 적용 중(busy)에는 어느 닫는 길(← · 취소 · Esc · 바깥 · 사이드바 · 탭 바)도 받지 않는다(B2b) — 기기 뒤로 가기는 막을 수 없어,
 * 떠난 뒤에도 응답이 오면 스낵바로 알린다(useFixedBulk).
 */
export function FixedBulk({
  mobile,
  startDate,
  endDate,
  onClose,
}: {
  /** 폰 셸(768 미만) — 페이지의 머리가 상단 바냐 제목 줄이냐를 가른다 */
  mobile: boolean;
  /** "YYYY-MM-DD" — 통계 화면에서 고른 기간 */
  startDate: string;
  endDate: string;
  onClose: () => void;
}) {
  const wide = useWideSurface();
  const { t } = useTranslation("stats");
  const { t: tc } = useTranslation("common");
  const bulk = useFixedBulk({ startDate, endDate, onClose });
  const { mut, picked, apply } = bulk;
  const busy = mut.isPending;
  // 사이드바 · 탭 바로 떠나는 길도 받지 않는다 — 가드가 아무것도 하지 않는다(맡겨 두기만 해도 새로 고침 · 탭 닫기에 확인창이 뜬다)
  useRegisterLeaveGuard(busy ? () => {} : null);
  useScreenTitle(t("fixed.bulk.title"));
  const sft = useSaveFailureText();
  const errorRef = useScrollToError<HTMLDivElement>(mut.isError, mut.error);
  const leave = () => {
    if (!busy) onClose();
  };
  const applyLabel = mut.isError
    ? tc("retry")
    : t("fixed.bulk.apply", { count: picked.size });

  const content = (
    <FixedBulkBody
      bulk={bulk}
      startDate={startDate}
      endDate={endDate}
      errorText={sft(mut.error, t("fixed.bulk.failed"))}
      errorRef={errorRef}
      padded={!wide && mobile}
    />
  );

  if (wide) {
    return (
      <ResponsiveDialog
        open
        busy={busy}
        onOpenChange={(next) => {
          if (!next) leave();
        }}
      >
        <ResponsiveDialogContent
          title={t("fixed.bulk.title")}
          aria-describedby={undefined}
        >
          <ResponsiveDialogBody scrollFog>{content}</ResponsiveDialogBody>
          <ResponsiveDialogFooter>
            <Button loading={busy} disabled={picked.size === 0} onClick={apply}>
              {applyLabel}
            </Button>
          </ResponsiveDialogFooter>
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    );
  }

  const footer = (
    <div
      className={cn(
        "sticky bottom-0 mt-auto shrink-0 pb-[max(var(--spacing-x4),env(safe-area-inset-bottom))] pt-x3",
        // 폰은 흰 면 위, 768 ~ 1279 는 바닥(basement) 위다 — 머리 · 본문과 같은 가장자리
        mobile ? "bg-bg-layer-default px-x6" : "bg-bg-layer-basement",
      )}
    >
      <Button
        type="button"
        size="large"
        className="w-full"
        loading={busy}
        disabled={picked.size === 0}
        onClick={apply}
      >
        {applyLabel}
      </Button>
    </div>
  );

  if (mobile) {
    return (
      <>
        <TopNavigation type="standard">
          <TopNavigationBackButton fallbackHref="/desk/stats" onClick={leave} />
          <TopNavigationTitle>{t("fixed.bulk.title")}</TopNavigationTitle>
        </TopNavigation>
        <div
          data-slot="fixed-bulk-page"
          className="flex flex-1 flex-col bg-bg-layer-default"
        >
          {content}
          {footer}
        </div>
      </>
    );
  }
  // 768 ~ 1279 — 한 칸 720 가운데, "‹ 통계" → 제목 줄 → 본문 (자산 상세와 같은 틀)
  return (
    <div
      data-slot="fixed-bulk-page"
      className="px-[var(--layout-margin)] pb-screen-bottom pt-nav-to-title"
    >
      <div className="mx-auto flex w-full max-w-[var(--layout-max-low)] flex-col">
        <div className="mb-x1">
          <ParentLink
            to="/desk/stats"
            label={t("fixed.bulk.parent")}
            onClick={(e) => {
              e.preventDefault();
              leave();
            }}
          />
        </div>
        <PageHead
          style={{ marginBottom: "var(--spacing-x4)" }}
          title={t("fixed.bulk.title")}
        />
        {content}
        {footer}
      </div>
    </div>
  );
}

function FixedBulkBody({
  bulk,
  startDate,
  endDate,
  errorText,
  errorRef,
  padded,
}: {
  bulk: ReturnType<typeof useFixedBulk>;
  startDate: string;
  endDate: string;
  errorText: string;
  errorRef: React.RefObject<HTMLDivElement | null>;
  /** 페이지는 좌우 24 를 본문이 준다(대화상자 본문은 스스로 가진다) */
  padded: boolean;
}) {
  const { t } = useTranslation("stats");
  const mask = useMasked("stats.fixed");
  const {
    kind,
    setKind,
    target,
    setTarget,
    picked,
    setPicked,
    q,
    mut,
    groups,
  } = bulk;
  const px = padded ? "px-x6" : "";
  let list: ReactNode;
  if (q.isLoading) {
    list = (
      <div aria-hidden className={`flex flex-col gap-x2 ${px}`}>
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-[52px] w-full" radius="12" />
        ))}
      </div>
    );
  } else if (q.isError && !q.data) {
    // 실패는 빈 목록이 아니다 — 불러오지 못했다고 말하고 그 자리 [다시 시도]. 서버 글은 그리지 않는다
    list = (
      <div className={px}>
        <BandFailure
          title={t("fixed.bulk.loadFailed")}
          retrying={q.isRefetching}
          onRetry={() => void q.refetch()}
        />
      </div>
    );
  } else if (groups.length === 0) {
    list = (
      <ResultSection
        kind="empty"
        size="medium"
        icon={<ReceiptText />}
        title={t("fixed.bulk.empty")}
      />
    );
  } else {
    list = (
      <ListCheckGroup aria-label={t("fixed.bulk.title")}>
        {groups.map((g) => {
          const allFixed = g.fixedCount === g.count;
          const someFixed = g.fixedCount > 0 && !allFixed;
          const badge = allFixed
            ? t("fixed.bulk.badgeAll")
            : someFixed
              ? t("fixed.bulk.badgeSome", {
                  fixed: g.fixedCount,
                  count: g.count,
                })
              : null;
          return (
            <ListCheckItem
              key={g.key}
              title={g.name}
              detail={
                <>
                  {t("fixed.bulk.groupSub", { count: g.count })} ·{" "}
                  {mask(won(g.total))}
                  {badge && (
                    <span className="font-bold text-fg-brand"> · {badge}</span>
                  )}
                </>
              }
              checked={groupCheck(g, picked)}
              onCheckedChange={(c) =>
                setPicked(toggleGroup(g, picked, c === true))
              }
            />
          );
        })}
      </ListCheckGroup>
    );
  }
  return (
    <div className="flex flex-col">
      {mut.isError && (
        // 적용이 실패했다 — 폼 맨 위 critical Callout(고정 문구), 폼은 열린 채 · 고른 것 그대로. 본문이 스크롤되므로 맨 위로 올린다
        <div ref={errorRef} className={`${px} pt-x2 pb-x2`}>
          <Callout tone="critical" role="alert">
            {errorText}
          </Callout>
        </div>
      )}
      <p className={`m-0 ${px} pt-x2 text-t3 text-fg-neutral-muted`}>
        {t("fixed.bulk.desc", { start: startDate, end: endDate })}
      </p>
      <div className={`flex flex-col gap-x2_5 ${px} pt-x4`}>
        <SegmentedControl
          aria-label={t("fixed.trend.kindAria")}
          value={kind}
          onValueChange={(v) => setKind(v as ExpenseType)}
        >
          <SegmentedControlItem value="EXPENSE">
            {t("fixed.kind.expense")}
          </SegmentedControlItem>
          <SegmentedControlItem value="INCOME">
            {t("fixed.kind.income")}
          </SegmentedControlItem>
        </SegmentedControl>
        <SegmentedControl
          aria-label={t("fixed.bulk.targetAria")}
          value={target}
          onValueChange={(v) => setTarget(v as FixedBulkTarget)}
        >
          <SegmentedControlItem value="fixed">
            {t("fixed.bulk.toFixed")}
          </SegmentedControlItem>
          <SegmentedControlItem value="variable">
            {t("fixed.bulk.toVariable")}
          </SegmentedControlItem>
        </SegmentedControl>
      </div>
      <div className="pt-x3 pb-x4">{list}</div>
    </div>
  );
}
