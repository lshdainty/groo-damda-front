import { useSaveFailureText } from "@/shared/lib/save-failure-text";
import { useTranslation } from "react-i18next";
import { KRW } from "@/shared/lib/groo/format";
import { MaskAmount, WonUnit } from "@/shared/lib/groo/hide-amounts";
import { wonPre } from "@/shared/lib/groo/hide-amounts-core";
import { ModalShell } from "@/shared/ui/groo/dialogs";
import { ModalFooter } from "@/shared/ui/groo/modal-footer";
import { useScrollToError } from "../model/useScrollToError";
import { Callout } from "@/shared/ds/callout";
import { BandFailure } from "@/shared/ui/groo/band-parts";
import { Checkbox } from "@/shared/ui/checkbox";
import { Skeleton } from "@/shared/ui/skeleton";
import {
  SegmentedControl,
  SegmentedControlItem,
} from "@/shared/ds/segmented-control";
import type { ExpenseType } from "@/entities/expense";
import { useFixedBulk, type FixedBulkTarget } from "../model/useFixedBulk";
import { FixedBulkPage } from "./FixedBulkPage";
import {
  groupCheck,
  toggleGroup,
  type GroupCheck,
  type TxGroup,
} from "../lib/fixed-groups";

/*
 * 거래를 고정으로 정리하는 대화상자.
 *
 * 처음 쓰는 사람은 거래가 이미 수십~수백 건이다. 한 건씩 열어 스위치를 켜게 하면 아무도 안 한다.
 * 그래서 **같은 이름으로 나가는 거래를 묶어서**(월세 열두 달치가 한 줄) 한 번에 고르게 한다.
 * 돈·잔액은 안 움직이고 통계의 분류만 바뀌므로, 되돌리기는 같은 화면에서 "변동으로" 를 고르면 된다.
 */

function GroupRow({
  g,
  state,
  onChange,
}: {
  g: TxGroup;
  state: GroupCheck;
  onChange: (on: boolean) => void;
}) {
  const { t } = useTranslation("stats");
  const allFixed = g.fixedCount === g.count;
  const someFixed = g.fixedCount > 0 && !allFixed;
  return (
    <li>
      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          minHeight: 52,
          padding: "8px 4px",
          cursor: "pointer",
        }}
      >
        <Checkbox
          checked={state}
          onCheckedChange={(c) => onChange(c === true)}
          aria-label={g.name}
        />
        <span style={{ flex: 1, minWidth: 0 }}>
          <span
            style={{
              display: "block",
              fontSize: "var(--text-label-sm)",
              fontWeight: 600,
              color: "var(--fg-primary)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {g.name}
          </span>
          <span
            style={{
              display: "block",
              marginTop: 2,
              fontSize: "var(--text-caption)",
              color: "var(--fg-tertiary)",
            }}
          >
            {t("fixed.bulk.groupSub", { count: g.count })} ·{" "}
            <MaskAmount>
              {wonPre()}
              {KRW(g.total)}
            </MaskAmount>
            <WonUnit />
          </span>
        </span>
        {(allFixed || someFixed) && (
          <span
            style={{
              flexShrink: 0,
              fontSize: "var(--text-caption)",
              fontWeight: 700,
              color: "var(--fg-brand)",
            }}
          >
            {allFixed
              ? t("fixed.bulk.badgeAll")
              : t("fixed.bulk.badgeSome", {
                  fixed: g.fixedCount,
                  count: g.count,
                })}
          </span>
        )}
      </label>
    </li>
  );
}

export function FixedBulkDialog(props: {
  mobile: boolean;
  /** "YYYY-MM-DD" — 통계 화면에서 고른 기간 */
  startDate: string;
  endDate: string;
  onClose: () => void;
}) {
  // 폰은 대화상자가 아니라 페이지다(I-08 Q5-A) — 데스크톱(1280 이상)은 대화상자 그대로
  return props.mobile ? (
    <FixedBulkPage
      startDate={props.startDate}
      endDate={props.endDate}
      onClose={props.onClose}
    />
  ) : (
    <FixedBulkModal {...props} />
  );
}

function FixedBulkModal({
  mobile,
  startDate,
  endDate,
  onClose,
}: {
  mobile: boolean;
  startDate: string;
  endDate: string;
  onClose: () => void;
}) {
  const { t } = useTranslation("stats");
  const { t: tc } = useTranslation("common");
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
  const errorRef = useScrollToError<HTMLDivElement>(mut.isError, mut.error);

  return (
    <ModalShell
      title={t("fixed.bulk.title")}
      onClose={onClose}
      mobile={mobile}
      mobileMinHeight="70dvh"
      footer={
        <ModalFooter
          onSave={apply}
          saveLabel={t("fixed.bulk.apply", { count: picked.size })}
          saving={mut.isPending}
          saveDisabled={picked.size === 0}
          onCancel={onClose}
          cancelLabel={tc("cancel")}
        />
      }
    >
      {mut.isError && (
        // 적용이 실패했다 — 폼 맨 위 critical Callout(고정 문구), 폼은 열린 채 · 고른 것 그대로. 다시 시도는 [적용].
        // 본문은 스크롤되고 [적용] 은 바닥이라 내려서 고른 뒤 실패하면 Callout 이 화면 밖이다 — ref 로 맨 위로 올린다
        <div ref={errorRef} style={{ marginBottom: 16 }}>
          <Callout tone="critical" role="alert">
            {sft(mut.error, t("fixed.bulk.failed"))}
          </Callout>
        </div>
      )}
      <p
        style={{
          margin: "0 0 14px",
          fontSize: "var(--text-label-sm)",
          color: "var(--fg-secondary)",
        }}
      >
        {t("fixed.bulk.desc", { start: startDate, end: endDate })}
      </p>

      <SegmentedControl
        aria-label={t("fixed.trend.kindAria")}
        value={kind}
        onValueChange={(v) => setKind(v as ExpenseType)}
        style={{ marginBottom: 10 }}
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
        style={{ marginBottom: 14 }}
      >
        <SegmentedControlItem value="fixed">
          {t("fixed.bulk.toFixed")}
        </SegmentedControlItem>
        <SegmentedControlItem value="variable">
          {t("fixed.bulk.toVariable")}
        </SegmentedControlItem>
      </SegmentedControl>

      {q.isLoading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-[52px] w-full rounded-md" />
          ))}
        </div>
      ) : q.isError && !q.data ? (
        // 조회 실패를 "거래 없음" 으로 보이지 않는다 — 폰 FixedBulkPage 와 같이 실패 + 다시 시도
        <BandFailure
          title={t("fixed.bulk.loadFailed")}
          onRetry={() => void q.refetch()}
        />
      ) : groups.length === 0 ? (
        <div
          style={{
            padding: "32px 0",
            textAlign: "center",
            color: "var(--fg-tertiary)",
            fontSize: "var(--text-label-sm)",
          }}
        >
          {t("fixed.bulk.empty")}
        </div>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {groups.map((g) => (
            <GroupRow
              key={g.key}
              g={g}
              state={groupCheck(g, picked)}
              onChange={(on) => setPicked(toggleGroup(g, picked, on))}
            />
          ))}
        </ul>
      )}
    </ModalShell>
  );
}
