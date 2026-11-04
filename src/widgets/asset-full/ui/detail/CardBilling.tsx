import { useTranslation, Trans } from "react-i18next";
import { Check, ChevronDown, Undo2, Zap } from "lucide-react";
import { Badge } from "@/shared/ds/badge";
import { Button, ResponsivePair } from "@/shared/ds/button";
import { List, ListItem } from "@/shared/ds/list";
import { KvRow } from "./KvRow";
import { Skeleton } from "@/shared/ds/skeleton";
import { MINUS, money } from "@/shared/lib/groo/format";
import { MaskAmount } from "@/shared/lib/groo/hide-amounts";
import { won } from "@/shared/lib/groo/money-text";
import { withCommaBreaks } from "@/shared/ds/i18n";
import { BandFailure, BigAmount, ListTitle } from "@/shared/ui/groo/band-parts";
import type { Asset } from "@/entities/asset";
import { useAssetMask } from "../../lib/asset-groups";
import type { CardDetail } from "./use-card-detail";
import { fmtBillingDate } from "./detail-shared";
import { PeriodPicker } from "./CardOverlays";

const NOTE = "m-0 px-global-gutter pt-x1 text-t3 text-fg-neutral-subtle";
const VALUE = "min-w-0 text-end tabular-nums text-fg-neutral-muted";
const TEXT_LINK = "-my-x1";

/**
 * 신용카드 — 결제 예정 · 키-값 · 이번 회차 구성 · 동작(I-17 46 · 47, 4-3A).
 * 회차 단추(ghost small) + 결제 예정 금액 R13 + 키-값 줄, 할부가 있으면 "이번 회차 구성", 그 아래 [지금 결제] [결제 취소] 한 줄.
 * 한도 · 결제일 변경 타일 · 알약은 없다 — 수정은 머리 하나(41 · 43)다. 계산 · 요청 · 무효화는 그대로(`useCardDetail`).
 */
export function CardBilling({
  asset,
  c,
  onEdit,
}: {
  asset: Asset;
  c: CardDetail;
  onEdit: () => void;
}) {
  const { t } = useTranslation("asset");
  const m = useAssetMask("asset.detail", asset.isAmountHidden === "Y");
  const { st } = c;

  if (c.isLoading) {
    return (
      <div aria-hidden className="px-global-gutter pt-x3">
        <Skeleton text="t5" className="w-1/3" />
        <Skeleton className="mt-x3 h-x8 w-2/3" radius="8" />
        <Skeleton text="t5" className="mt-x4 w-full" />
        <Skeleton className="mt-x4 h-x10 w-full" radius="8" />
      </div>
    );
  }
  if (c.isError) {
    return (
      <BandFailure
        title={t("assetDetail.billingLoadError")}
        onRetry={c.refetch}
      />
    );
  }

  const closed = st != null && !st.scheduled;
  const noCycle = st == null;
  const period =
    st?.periodStart && st?.periodEnd
      ? `${fmtBillingDate(st.periodStart)} ~ ${fmtBillingDate(st.periodEnd)}`
      : null;
  const mix = st?.scheduled && (st.installments?.length ?? 0) > 0;
  const closedMix = closed && (st.installments?.length ?? 0) > 0;
  const dueRows = (st?.installments ?? []).map((due) => (
    <ListItem
      key={due.expenseRowId}
      align="top"
      title={`${
        due.merchant ?? due.description ?? t("assetDetail.installmentFallback")
      } ${t("assetDetail.installmentSeq", {
        seq: due.sequence,
        total: due.installmentMonths,
      })}`}
      detail={
        <>
          {m(
            t("assetDetail.installmentPrincipal", {
              amount: money(due.principalAmount),
            }),
          )}
          {due.recordOnly && ` · ${t("recordOnly", { ns: "common" })}`}
          {mix &&
            (due.paidOff ? (
              <span className="mt-x1 flex flex-wrap items-center gap-x2">
                <Badge variant="outline" tone="positive" size="medium">
                  {t("assetDetail.installmentPaidOffBadge")}
                </Badge>
                <Button
                  type="button"
                  variant="ghost"
                  size="small"
                  flush="left"
                  className={TEXT_LINK}
                  onClick={() => c.setPayoffTarget({ due, undo: true })}
                >
                  {t("assetDetail.installmentPayoffUndo")}
                </Button>
              </span>
            ) : (
              <span className="mt-x1 block">
                <Button
                  type="button"
                  variant="ghost"
                  size="small"
                  flush="left"
                  className={TEXT_LINK}
                  onClick={() => c.setPayoffTarget({ due, undo: false })}
                >
                  {t("assetDetail.installmentPayoff")}
                </Button>
              </span>
            ))}
        </>
      }
      suffix={
        <span className="text-end text-t5 font-bold tabular-nums text-fg-neutral">
          {withCommaBreaks(m(money(due.amount)))}
        </span>
      }
    />
  ));
  const showActions = c.showPayNow || c.lastPayment != null;

  return (
    <section
      data-slot="asset-detail-billing"
      aria-label={t("assetDetail.paymentDue")}
    >
      {noCycle ? (
        <p className="m-0 px-global-gutter pt-x3 text-t3 font-medium text-fg-neutral-subtle">
          {t("assetDetail.valueCard")}
        </p>
      ) : (
        <div className="px-global-gutter pt-x2">
          <PeriodPicker asset={asset} c={c}>
            <Button
              type="button"
              variant="ghost"
              size="small"
              flush="left"
              aria-haspopup="dialog"
              aria-expanded={c.pickOpen}
              onClick={() => c.setPickOpen(true)}
            >
              {t("assetDetail.dueOn", { date: st.label })}
              {st.scheduled && (
                <Badge variant="weak" tone="neutral" size="medium">
                  {t("assetDetail.scheduledTag")}
                </Badge>
              )}
              <ChevronDown aria-hidden />
            </Button>
          </PeriodPicker>
        </div>
      )}
      <div className="px-global-gutter pt-x1">
        <BigAmount value={m(won(st?.amount ?? 0))} />
      </div>
      {/* 앱이 한 푼도 안 뺀 회차(결제계좌 없음 · 카드 등록 전 · 전부 기록용)에 "결제 완료" 를 달면 돈이 나간 것으로 읽힌다 — "기록 회차"(24차 7) */}
      {closed && (
        <div className="px-global-gutter pt-x1_5">
          {st.paid === 0 ? (
            <Badge
              data-testid="record-cycle-label"
              variant="weak"
              tone="neutral"
              size="medium"
            >
              {t("assetDetail.recordCycle")}
            </Badge>
          ) : (
            <Badge
              variant="weak"
              tone="positive"
              size="medium"
              prefixIcon={<Check />}
            >
              {t("assetDetail.paidDone")}
            </Badge>
          )}
        </div>
      )}
      {closed && st.paid != null && st.paid !== 0 && st.amount !== st.paid && (
        <p data-testid="recorded-diff-note" className={NOTE}>
          {st.amount > st.paid ? (
            <Trans
              t={t}
              i18nKey="assetDetail.recordedMoreNote"
              values={{
                paid: money(st.paid),
                diff: money(st.amount - st.paid),
              }}
              components={{
                amt: <MaskAmount card="asset.detail">{""}</MaskAmount>,
              }}
            />
          ) : (
            <Trans
              t={t}
              i18nKey="assetDetail.recordedLessNote"
              values={{ recorded: money(st.amount), paid: money(st.paid) }}
              components={{
                amt: <MaskAmount card="asset.detail">{""}</MaskAmount>,
              }}
            />
          )}
        </p>
      )}
      {closed && st.preRegistration && (
        <p data-testid="pre-registration-note" className={NOTE}>
          {t("assetDetail.preRegistrationNote")}
        </p>
      )}

      {/* 키-값 — 결제일 · 카드 이용 기간. 결제일이 없는 옛 카드는 값 자리에서 넣으라고 말한다(D8) */}
      <List className="mt-x1" aria-label={t("assetDetail.billingInfo")}>
        {c.paymentDay != null ? (
          <KvRow
            label={t("assetDetail.paymentDateLabel")}
            value={t("assetDetail.paymentDayValue", { day: c.paymentDay })}
          />
        ) : (
          <ListItem
            data-testid="payment-day-missing"
            title={t("assetDetail.paymentDateLabel")}
            suffix={
              <Button
                type="button"
                variant="ghost"
                size="small"
                flush="right"
                className={TEXT_LINK}
                onClick={onEdit}
              >
                {t("assetDetail.paymentDayMissing")}
              </Button>
            }
          />
        )}
        {period && (
          <KvRow label={t("assetDetail.usagePeriodLabel")} value={period} />
        )}
      </List>

      {mix && (
        <>
          <ListTitle id={`asset-mix-${asset.rowId}`}>
            {t("assetDetail.cycleMix")}
          </ListTitle>
          <List aria-labelledby={`asset-mix-${asset.rowId}`}>
            {dueRows}
            {(st.lumpSum ?? 0) !== 0 && (
              <ListItem
                title={t("assetDetail.lumpSumLabel")}
                suffix={
                  <span className={VALUE}>
                    {withCommaBreaks(m(money(st.lumpSum!)))}
                  </span>
                }
              />
            )}
            {(st.alreadyPaid ?? 0) > 0 && (
              <ListItem
                title={t("assetDetail.alreadyPaidLabel")}
                suffix={
                  <span className={VALUE}>
                    {withCommaBreaks(m(`${MINUS}${money(st.alreadyPaid!)}`))}
                  </span>
                }
              />
            )}
          </List>
        </>
      )}
      {/* 닫힌 회차의 할부 회차분 — 머리 금액에는 들어 있는데 이용 내역에는 안 나온다. 정리 · 되돌리기는 없다(24차 8) */}
      {closedMix && (
        <div data-testid="closed-installments">
          <ListTitle id={`asset-mix-${asset.rowId}`}>
            {t("assetDetail.cycleMix")}
          </ListTitle>
          <List aria-labelledby={`asset-mix-${asset.rowId}`}>{dueRows}</List>
        </div>
      )}

      {showActions && (
        <ResponsivePair className="px-global-gutter pt-x4">
          {c.lastPayment && (
            <Button
              type="button"
              variant="neutralWeak"
              size="medium"
              disabled={c.cancelPayment.isPending}
              onClick={() => c.setConfirmCancelPay(true)}
            >
              <Undo2 aria-hidden />
              {t("assetDetail.cancelPayment")}
            </Button>
          )}
          {c.showPayNow && (
            <Button
              type="button"
              variant="neutralWeak"
              size="medium"
              disabled={!c.canPay}
              onClick={c.openPay}
            >
              <Zap aria-hidden />
              {t("assetDetail.payNow")}
            </Button>
          )}
        </ResponsivePair>
      )}
    </section>
  );
}
