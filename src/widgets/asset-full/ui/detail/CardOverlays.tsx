import { useState, type ReactNode } from "react";
import { useTranslation, Trans } from "react-i18next";
import { Badge } from "@/shared/ds/badge";
import { Button } from "@/shared/ds/button";
import { Callout } from "@/shared/ds/callout";
import { BottomSheet, BottomSheetContent } from "@/shared/ds/bottom-sheet";
import {
  ResponsiveDialog,
  ResponsiveDialogBody,
  ResponsiveDialogContent,
  ResponsiveDialogFooter,
} from "@/shared/ds/dialog";
import { Field } from "@/shared/ds/field";
import { ListHeader, ListRadioGroup, ListRadioItem } from "@/shared/ds/list";
import { useWideSurface } from "@/shared/ds/overlay";
import { Popover, PopoverAnchor, PopoverContent } from "@/shared/ds/popover";
import { AmountInput } from "@/shared/ui/groo/amount-input";
import { ConfirmDialog } from "@/shared/ui/groo/dialogs";
import { KRW, formatDay, money, wonPrefix } from "@/shared/lib/groo/format";
import { useAssetMask } from "../../lib/asset-groups";
import type { Asset } from "@/entities/asset";
import type { CardDetail } from "./use-card-detail";

/**
 * 명세 기간 고르기(I-17 54) — 1280 미만 Bottom Sheet · 이상 회차 단추 아래 8 에 붙는 Popover. 연도 묶음 머리 + 라디오 줄,
 * 누르면 바로 고르고 닫힌다. 열면 고른 줄이 보인다. 회차 목록 셈은 그대로(`statements`). 단추를 감싼다 — 단추가 Popover 의 자리다.
 */
export function PeriodPicker({
  asset,
  c,
  children,
}: {
  asset: Asset;
  c: CardDetail;
  children: ReactNode;
}) {
  const { t } = useTranslation("asset");
  const wide = useWideSurface();
  const m = useAssetMask("asset.detail", asset.isAmountHidden === "Y");
  const body = (
    <>
      {c.byYear.map(([y, rows]) => (
        <ListRadioGroup
          key={y}
          aria-label={t("assetDetail.yearLabel", { year: y })}
          value={String(c.activeIdx)}
          onValueChange={(v) => {
            c.setStIdx(Number(v));
            c.setPickOpen(false);
          }}
        >
          <ListHeader as="div" variant="mediumWeak">
            {t("assetDetail.yearLabel", { year: y })}
          </ListHeader>
          {rows.map(({ s, i }) => (
            <ListRadioItem
              key={s.key}
              value={String(i)}
              title={
                <span className="flex flex-wrap items-center gap-x2">
                  {t("assetDetail.dueOn", { date: s.label })}
                  {s.scheduled && (
                    <Badge variant="weak" tone="neutral" size="medium">
                      {t("assetDetail.scheduledTag")}
                    </Badge>
                  )}
                </span>
              }
              detail={m(`${KRW(s.amount)}원`)}
            />
          ))}
        </ListRadioGroup>
      ))}
    </>
  );
  if (wide)
    return (
      <Popover open={c.pickOpen} onOpenChange={c.setPickOpen}>
        <PopoverAnchor asChild>
          <span className="inline-flex">{children}</span>
        </PopoverAnchor>
        <PopoverContent aria-label={t("assetDetail.periodPick")} align="start">
          {body}
        </PopoverContent>
      </Popover>
    );
  return (
    <>
      {children}
      <BottomSheet open={c.pickOpen} onOpenChange={c.setPickOpen}>
        <BottomSheetContent title={t("assetDetail.periodPick")}>
          {body}
        </BottomSheetContent>
      </BottomSheet>
    </>
  );
}

/**
 * 지금 결제 = 입력 폼(I-17 53) — 1280 미만 시트 · 이상 Dialog 480. 금액 검사(0 < 금액 ≤ 예정액)는 그대로이되 주 버튼은 막지 않고 누르면 Field 오류.
 * 돈이 다 안 움직이는 안내(`payMoveNote`)는 Callout warning. 요청 · 금액 · 결제일 · 무효화는 `useCardDetail.handlePay` 그대로.
 */
function PayDialog({ asset, c }: { asset: Asset; c: CardDetail }) {
  const { t } = useTranslation("asset");
  const { t: tc } = useTranslation("common");
  const wide = useWideSurface();
  const m = useAssetMask("asset.detail", asset.isAmountHidden === "Y");
  const [initial] = useState(c.payAmount);
  const [tried, setTried] = useState(false);
  const empty = c.payAmountNum <= 0;
  const over = c.payAmountNum > c.upcoming;
  const error = !tried
    ? undefined
    : empty
      ? t("assetDetail.payAmountEmpty")
      : over
        ? t("assetDetail.payAmountOver", { amount: m(money(c.upcoming)) })
        : undefined;
  const close = () => {
    if (!c.payCard.isPending) c.setConfirmPay(false);
  };
  const date = c.st?.paymentDate ?? c.billing?.nextPaymentDate;
  const submit = () => {
    setTried(true);
    if (c.payAmountValid) c.handlePay();
  };
  return (
    <ResponsiveDialog
      open
      form
      dirty={c.payAmount !== initial}
      onOpenChange={(next) => {
        if (!next) close();
      }}
    >
      <ResponsiveDialogContent title={t("assetDetail.payNow")}>
        <ResponsiveDialogBody>
          <div className="flex flex-col gap-x4 pb-x2">
            <p className="m-0 text-t5 text-fg-neutral-muted">
              <Trans
                i18nKey="assetDetail.payConfirm"
                ns="asset"
                values={{ amount: m(money(c.upcoming)) }}
              />
              {date
                ? ` ${t("assetDetail.paymentDateNote", { date: formatDay(date).md })}`
                : ""}
            </p>
            {c.payMoveNote && <Callout tone="warning">{c.payMoveNote}</Callout>}
            <Field
              label={t("assetDetail.payAmount")}
              invalid={error != null}
              errorMessage={error}
              description={
                c.payAmountNum > 0 && c.payAmountNum < c.upcoming
                  ? t("assetDetail.payRemainder", {
                      amount: m(money(c.upcoming - c.payAmountNum)),
                    })
                  : undefined
              }
            >
              <AmountInput
                value={c.payAmount}
                onValueChange={c.setPayAmount}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    submit();
                  }
                }}
              />
            </Field>
          </div>
        </ResponsiveDialogBody>
        <ResponsiveDialogFooter>
          <div
            className={
              wide ? "ml-auto flex items-center gap-x2" : "flex min-w-0 flex-1"
            }
          >
            {wide && (
              <Button variant="neutralWeak" size="small" onClick={close}>
                {tc("cancel")}
              </Button>
            )}
            <Button
              size={wide ? "small" : "large"}
              className={wide ? undefined : "flex-1"}
              loading={c.payCard.isPending}
              onClick={submit}
            >
              {t("assetDetail.payAction")}
            </Button>
          </div>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}

/** 카드 상세 위에 하나씩 뜨는 표면들 — 지금 결제 폼 · 할부 정리 / 되돌리기 확인 · 결제 취소 확인(I-17 K 53 · 55). 겹치지 않는다 */
export function CardOverlays({ asset, c }: { asset: Asset; c: CardDetail }) {
  const { t } = useTranslation("asset");
  return (
    <>
      {c.confirmPay && <PayDialog asset={asset} c={c} />}
      {c.payoffTarget && (
        <ConfirmDialog
          title={
            c.payoffTarget.undo
              ? t("assetDetail.installmentPayoffUndo")
              : t("assetDetail.installmentPayoff")
          }
          message={
            c.payoffTarget.undo
              ? t("assetDetail.installmentPayoffUndoConfirm")
              : t("assetDetail.installmentPayoffConfirm", {
                  amount: money(c.payoffTarget.due.amount),
                })
          }
          confirmLabel={
            c.payoffTarget.undo
              ? t("assetDetail.installmentPayoffUndo")
              : t("assetDetail.installmentPayoff")
          }
          loading={c.installmentPayoff.isPending}
          onCancel={() => {
            if (!c.installmentPayoff.isPending) c.setPayoffTarget(null);
          }}
          onConfirm={() => {
            const target = c.payoffTarget!;
            c.installmentPayoff.mutate(
              { expenseId: target.due.expenseRowId, undo: target.undo },
              { onSuccess: () => c.setPayoffTarget(null) },
            );
          }}
        />
      )}
      {c.confirmCancelPay && c.lastPayment && (
        <ConfirmDialog
          title={t("assetDetail.cancelPayment")}
          message={t("assetDetail.cancelPaymentConfirm", {
            date: formatDay(c.lastPayment.paymentDate).md,
            amount: `${wonPrefix()}${KRW(c.lastPayment.billingAmount)}`,
          })}
          confirmLabel={t("assetDetail.cancelPayment")}
          danger
          loading={c.cancelPayment.isPending}
          onCancel={() => {
            if (!c.cancelPayment.isPending) c.setConfirmCancelPay(false);
          }}
          onConfirm={() => {
            c.cancelPayment.mutate(c.lastPayment!.rowId, {
              onSuccess: () => c.setConfirmCancelPay(false),
              onError: () => c.setConfirmCancelPay(false),
            });
          }}
        />
      )}
    </>
  );
}
