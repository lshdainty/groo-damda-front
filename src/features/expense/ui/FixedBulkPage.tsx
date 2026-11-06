import { useSaveFailureText } from "@/shared/lib/save-failure-text";
import { useScrollToError } from "../model/useScrollToError";
import { Callout } from "@/shared/ds/callout";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/shared/ds/button";
import { ListCheckGroup, ListCheckItem } from "@/shared/ds/list";
import { Skeleton } from "@/shared/ds/skeleton";
import {
  SegmentedControl,
  SegmentedControlItem,
} from "@/shared/ds/segmented-control";
import {
  TopNavigation,
  TopNavigationBackButton,
  TopNavigationTitle,
} from "@/shared/ds/top-navigation";
import { BandFailure } from "@/shared/ui/groo/band-parts";
import { useBackClose } from "@/shared/ds/overlay";
import { won, useMasked } from "@/shared/lib/groo/money-text";
import type { ExpenseType } from "@/entities/expense";
import { groupCheck, toggleGroup } from "../lib/fixed-groups";
import { useFixedBulk, type FixedBulkTarget } from "../model/useFixedBulk";

/**
 * 거래를 고정으로 정리하는 폰 페이지(I-08 Q5-A) — 기간 안 거래 묶음이 처음부터 길어 시트가 아니라 페이지다.
 * 위 상단 바(← + 제목), 가운데 스크롤(설명 · 종류 · 방향 · 묶음 줄), 아래 바닥 [N건 적용] 하나. 앞 화면은 그대로 아래에 남는다.
 * 같은 이름으로 나가는 거래를 한 줄로 묶어 한 번에 고른다 — 돈 · 잔액은 안 움직이고 통계의 분류만 바뀐다.
 */
export function FixedBulkPage({
  startDate,
  endDate,
  onClose,
}: {
  startDate: string;
  endDate: string;
  onClose: () => void;
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
    apply,
  } = useFixedBulk({ startDate, endDate, onClose });
  const sft = useSaveFailureText();
  // 적용 중에는 ← · Esc · 기기 뒤로 가기로 나가지 않는다 — 나가면 실패 Callout 을 그릴 페이지가 사라진다(뒤로 가기는 칸을 다시 쌓는다)
  const leave = () => {
    if (!mut.isPending) onClose();
  };
  useBackClose(true, (keep) => {
    if (mut.isPending) keep();
    else onClose();
  });
  // 실패하면 Callout 이 보이게 본문을 맨 위로(스크롤 컨테이너는 아래 flex-1 overflow-y-auto)
  const errorRef = useScrollToError<HTMLDivElement>(mut.isError, mut.error);
  const page = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("fixed.bulk.title")}
      data-slot="fixed-bulk-page"
      className="fixed inset-0 z-(--z-modal) flex flex-col bg-bg-layer-default"
      onKeyDown={(e) => {
        if (e.key === "Escape") leave();
      }}
    >
      <TopNavigation>
        <TopNavigationBackButton fallbackHref="/desk/stats" onClick={leave} />
        <TopNavigationTitle>{t("fixed.bulk.title")}</TopNavigationTitle>
      </TopNavigation>
      <div className="min-h-0 flex-1 overflow-y-auto pb-x4">
        {mut.isError && (
          <div ref={errorRef} className="px-x6 pt-x2 pb-x2">
            <Callout tone="critical" role="alert">
              {sft(mut.error, t("fixed.bulk.failed"))}
            </Callout>
          </div>
        )}
        <p className="m-0 px-x6 pt-x2 text-t3 text-fg-neutral-muted">
          {t("fixed.bulk.desc", { start: startDate, end: endDate })}
        </p>
        <div className="flex flex-col gap-x2_5 px-x6 pt-x4">
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
        <div className="pt-x3">
          {q.isLoading ? (
            <div aria-hidden className="flex flex-col gap-x2 px-x6">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-[52px] w-full" radius="12" />
              ))}
            </div>
          ) : q.isError && !q.data ? (
            // 실패는 빈 목록이 아니다 — 불러오지 못했다고 말하고 다시 시도(I-08 41 과 같은 규칙)
            <div className="px-x6">
              <BandFailure
                title={t("fixed.bulk.loadFailed")}
                onRetry={() => void q.refetch()}
              />
            </div>
          ) : groups.length === 0 ? (
            <p className="m-0 py-x8 text-center text-t3 text-fg-neutral-subtle">
              {t("fixed.bulk.empty")}
            </p>
          ) : (
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
                          <span className="font-bold text-fg-brand">
                            {" "}
                            · {badge}
                          </span>
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
          )}
        </div>
      </div>
      <div className="shrink-0 px-x6 pb-[max(var(--spacing-x4),env(safe-area-inset-bottom))] pt-x3">
        <Button
          type="button"
          size="large"
          className="w-full"
          loading={mut.isPending}
          disabled={picked.size === 0}
          onClick={apply}
        >
          {t("fixed.bulk.apply", { count: picked.size })}
        </Button>
      </div>
    </div>
  );
  return createPortal(page, document.body);
}
