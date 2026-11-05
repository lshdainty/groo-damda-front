import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowRightLeft, Lock, Repeat } from "lucide-react";

import { Callout } from "@/shared/ds/callout";
import { List, ListItem } from "@/shared/ds/list";
import { LogoTile } from "@/shared/ds/logo-tile";
import { useSnackbar } from "@/shared/ds/snackbar";
import { KRW, isEn } from "@/shared/lib/groo/format";
import {
  formatAssetAmount,
  isForeignCurrency,
} from "@/shared/lib/groo/currency";
import { dsLocale } from "@/shared/ds/i18n";
import {
  HIDE_AMOUNTS_MASK,
  useHideAmounts,
} from "@/shared/lib/groo/hide-amounts-core";
import { ConfirmDialog } from "@/shared/ui/groo/dialogs";
import { useAssets, useDeleteTransfer } from "@/features/asset";
import { RecurringAddDialog } from "@/features/recurring-transaction/ui/RecurringAddDialog";
import { useTxForm, useTxSheetParts } from "@/widgets/add-tx";
import { SheetStepDone } from "@/widgets/calendar/ui/event-form/step-header";
import type { Asset, AssetTransfer } from "@/entities/asset";

import { dateTimeLabel } from "@/widgets/expense-detail/lib/detail-format";
import { BandFailure } from "@/shared/ui/groo/band-parts";
import { DetailSurface } from "./detail-surface";
import {
  AmountText,
  DetailHeadBlock,
  KvRow,
  MoreSection,
  StatusSlot,
  TxDetailSkeleton,
} from "./tx-detail-parts";

/** 계좌 한 줄 — 앞 Logo Tile 40(그 자산의 기관) · 이름 · 설명 "보내는 계좌" / "받는 계좌". 누르지 않는다 */
function AccountRow({
  name,
  asset,
  role,
}: {
  name: string;
  asset?: Asset;
  role: string;
}) {
  return (
    <ListItem
      prefix={
        <LogoTile
          size={40}
          // 지운 자산이라 못 찾으면 이름만 — Logo Tile 은 첫 글자를 그린다
          name={asset?.institution || asset?.assetName || name}
        />
      }
      title={name}
      detail={role}
    />
  );
}

/**
 * 이체 상세 — 거래 상세와 한 벌이다 (I-21 C 15 ~ 18). 머리(회색 타일 + "이체" + 금액 + 날짜) → 보내는 · 받는 계좌 줄 → 값 줄 → "더 하기" 반복 설정.
 *
 * <p>수정·삭제는 서버가 이자 지출·잔액 이력을 되돌렸다 다시 만든다. rowId 는 유지되므로 이 이체를 가리키던 참조가 끊기지 않는다.
 * [수정]은 상세 위에서 수정 폼을 열고 저장하면 응답 이체로 상세를 다시 그린다(7a).
 *
 * <p>시스템이 만든 이체(매수 예수금 충당·카드 자동결제)는 금액이 원본과 묶여 있어 고칠 수 없다 — 버튼을 감추고 왜 그런지 적어 둔다.
 */
export function TransferDetailDialog({
  transfer: transferProp,
  mobile,
  onClose,
}: {
  transfer: AssetTransfer;
  /** 표면은 ds 가 1280 으로 정한다 — 아직 옛 겹침 대화상자(반복 폼 · 수정 폼)에만 넘긴다 */
  mobile: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation("expense");
  const { t: tc } = useTranslation("common");
  const snackbar = useSnackbar();
  const [step, setStep] = useState<"detail" | "edit">("detail");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [openRecurring, setOpenRecurring] = useState(false);
  const deleteMut = useDeleteTransfer();
  const assetsQ = useAssets({ silent: true });
  // 수정 저장의 응답으로 갈아 그린다(부모는 목록에서 집은 스냅샷을 준다)
  const [saved, setSaved] = useState<AssetTransfer | null>(null);
  const transfer = saved?.rowId === transferProp.rowId ? saved : transferProp;
  // 수정 폼 — 상세가 한 번 들고 같은 시트 안 한 단계로 보인다(7a). [수정] 때 이 이체로 갈아 끼운다
  const [editing, setEditing] = useState<AssetTransfer | null>(null);
  const form = useTxForm({
    editTransfer: editing ?? undefined,
    onTransferSaved: (updated) => setSaved(updated),
    onClose: () => setStep("detail"),
  });
  const formParts = useTxSheetParts(form, {
    mobile,
    embedded: true,
    onClose: () => setStep("detail"),
    onBack: () => setStep("detail"),
  });
  const startEdit = () => {
    setEditing(transfer);
    form.beginEdit({ editTransfer: transfer });
    setStep("edit");
  };

  // 이체 상세는 거래 상세와 같은 카드로 묶는다. 금액만 가리고 수수료를 남기면 `이체금액 = 출금총액 − 수수료` 로 좁혀지므로 한 덩어리로 본다.
  const hidden = useHideAmounts("ledger.txDetail", "transfer");
  const fee = transfer.fee ?? 0;
  const interest = transfer.interestAmount ?? 0;
  // 매수 충당·카드 결제로 생긴 이체는 원본과 금액이 묶여 있다.
  const locked = transfer.autoSource != null;
  const assets = assetsQ.data?.assets ?? [];
  const fromAsset = assets.find((a) => a.rowId === transfer.fromAssetRowId);
  const toAsset = assets.find((a) => a.rowId === transfer.toAssetRowId);
  // 금액 · 수수료 · 이자 · 원금은 보내는 계좌 통화, 받는 금액(toAmount)은 받는 계좌 통화다(I-13). 계좌를 모르면 원화로 본다.
  const fromCurrency = fromAsset?.currency ?? null;
  const toCurrency = toAsset?.currency ?? null;
  const inCur = (v: number, code: string | null) =>
    hidden
      ? HIDE_AMOUNTS_MASK
      : isForeignCurrency(code)
        ? formatAssetAmount(Math.abs(v), code!, dsLocale())
        : `${isEn() ? "₩" : ""}${KRW(v, { abs: true })}${isEn() ? "" : "원"}`;
  const won = (v: number) => inCur(v, fromCurrency);

  const runDelete = () => {
    // 실패는 서버 글 대신 고정 글 — 확인창을 닫고 스낵바 + [다시 시도](28-3)
    deleteMut.mutate(
      { id: transfer.rowId, silent: true },
      {
        onSuccess: () => {
          setConfirmDelete(false);
          onClose();
        },
        onError: () => {
          setConfirmDelete(false);
          snackbar.show({
            message: t("transferDeleteFailed"),
            tone: "critical",
            action: { label: tc("retry"), onClick: runDelete },
          });
        },
      },
    );
  };

  const isEditing = step === "edit";
  const ep = formParts.embedParts;

  return (
    <>
      <DetailSurface
        title={isEditing ? ep.title : t("transferDetailTitle")}
        onClose={onClose}
        subStep={isEditing}
        dirty={isEditing ? ep.dirty : false}
        closeDirty={isEditing ? ep.dirtyAll : undefined}
        closeBlocked={isEditing && form.submitting}
        onStepBack={isEditing ? ep.onBack : undefined}
        footerNode={isEditing ? ep.footer : undefined}
        bodyRef={isEditing ? ep.bodyRef : undefined}
        // 값 하나를 치는 단계는 닫기 원 자리에 "완료" — 표면 경계는 1280(시트는 768 ~ 1279 포함)이라 mobile 로 가르지 않는다
        stepDone={
          isEditing && ep.inSub ? (
            <SheetStepDone onClick={ep.onDone} />
          ) : undefined
        }
        bodyKey={isEditing ? `edit:${form.main}:${form.sub ?? ""}` : "detail"}
        footer={
          isEditing || locked
            ? undefined
            : {
                onDelete: () => setConfirmDelete(true),
                deleting: deleteMut.isPending,
                primary: { label: tc("edit"), onClick: startEdit },
              }
        }
      >
        {isEditing ? (
          ep.body
        ) : assetsQ.isLoading ? (
          <TxDetailSkeleton />
        ) : (
          <>
            <DetailHeadBlock
              tile={
                <span
                  aria-hidden
                  className="inline-grid size-x12 shrink-0 place-items-center rounded-r4 bg-chart-gray-weak text-chart-gray"
                >
                  <ArrowRightLeft size={24} />
                </span>
              }
              name={t("addTx.transfer")}
              amount={
                <AmountText
                  amount={transfer.amount}
                  sign=""
                  kind="transfer"
                  currency={fromCurrency}
                />
              }
              dateTime={dateTimeLabel(transfer.transferDate)}
            />

            {assetsQ.isError && !assetsQ.data && (
              <BandFailure
                title={tc("query.failedNamed", {
                  name: t("txDetail.accountName"),
                })}
                onRetry={() => void assetsQ.refetch()}
              />
            )}

            {/* 왜 고칠 수 없는지 알려 준다 — 버튼만 없으면 고장으로 보인다. */}
            {locked && (
              <StatusSlot>
                <Callout tone="neutral" icon={<Lock aria-hidden />}>
                  {t(`transferAutoSource.${transfer.autoSource}`, {
                    defaultValue: t("transferAutoSource.default"),
                  })}
                </Callout>
              </StatusSlot>
            )}

            <List data-slot="transfer-detail-accounts">
              <AccountRow
                name={transfer.fromAssetName}
                asset={fromAsset}
                role={t("transferFromLabel")}
              />
              <AccountRow
                name={transfer.toAssetName}
                asset={toAsset}
                role={t("transferToLabel")}
              />
            </List>

            <List data-slot="tx-detail-kv" className="pt-x1">
              {/* 통화가 다른 두 계좌 사이 — 받는 쪽이 그 통화로 받은 금액(서버 toAmount) */}
              {transfer.toAmount != null && (
                <KvRow
                  label={t("transferReceived")}
                  value={inCur(transfer.toAmount, toCurrency)}
                />
              )}
              {fee > 0 && (
                <KvRow label={t("transferFeePrefix")} value={won(fee)} />
              )}
              {/* 보내는 쪽에서 실제로 빠져나간 금액 — 수수료가 있으면 이체 금액과 다르다. */}
              {fee > 0 && (
                <KvRow
                  label={t("transferWithdrawn")}
                  value={won(transfer.amount + fee)}
                />
              )}
              {/* 대출 상환에만 있다. 이자는 부채를 줄이지 않고 은행으로 나가는 비용이라, 안 보여 주면 "왜 원금이 이만큼밖에 안 줄었지" 가 된다. */}
              {interest > 0 && (
                <>
                  <KvRow label={t("addTx.interest")} value={won(interest)} />
                  <KvRow
                    label={t("transferPrincipal")}
                    value={won(transfer.principalAmount)}
                  />
                </>
              )}
              <KvRow label={t("memo")} value={transfer.description} />
            </List>

            {/* 반복 설정 — 이 이체와 같은 값으로 규칙을 새로 만든다. 이 이체 자체는 건드리지 않는다. 시스템이 만든 이체는 잠겨 있다. */}
            {!locked && (
              <MoreSection
                rows={[
                  {
                    key: "recurring",
                    icon: <Repeat aria-hidden />,
                    label: t("txDetail.recurring"),
                    onClick: () => setOpenRecurring(true),
                  },
                ]}
              />
            )}
          </>
        )}
      </DetailSurface>
      {isEditing && formParts.overlays}

      {openRecurring && (
        <RecurringAddDialog
          mobile={mobile}
          transferSeed={{
            fromAssetRowId: transfer.fromAssetRowId,
            toAssetRowId: transfer.toAssetRowId,
            amount: transfer.amount,
            fee: transfer.fee,
            interestAmount: transfer.interestAmount,
            description: transfer.description,
            // 이 이체가 일어난 날부터 반복한다 — 규칙은 이 거래를 본떠 만든 것이다.
            startDate: transfer.transferDate.slice(0, 10),
          }}
          onClose={() => setOpenRecurring(false)}
        />
      )}

      {confirmDelete && (
        <ConfirmDialog
          title={t("transferDeleteTitle")}
          message={t("transferDeleteConfirm")}
          confirmLabel={tc("delete")}
          danger
          loading={deleteMut.isPending}
          onCancel={() => !deleteMut.isPending && setConfirmDelete(false)}
          onConfirm={runDelete}
        />
      )}
    </>
  );
}
