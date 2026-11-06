import { useState } from "react";
import {
  Calendar,
  CalendarDays,
  Coins,
  CreditCard,
  Percent,
  StickyNote,
  Tags,
  Wallet,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/shared/ds/button";
import { Callout } from "@/shared/ds/callout";
import { formatDateValue, parseDayKey } from "@/shared/ds/date-picker";
import { Field } from "@/shared/ds/field";
import { Input } from "@/shared/ds/input";
import { ResultSection } from "@/shared/ds/result-section";
import { DecimalInput } from "./DecimalInput";
import {
  List,
  ListCheckItem,
  ListItem,
  ListSwitchItem,
} from "@/shared/ds/list";
import { formatTimeValue } from "@/shared/ds/time-picker";
import { getPaletteByColor } from "@/shared/lib/groo/chart-palette";
import { money } from "@/shared/lib/groo/format";
import {
  DayPickSurface,
  TimePickSurface,
} from "@/widgets/calendar/ui/event-form/pickers";
import { transferEligible } from "@/features/asset-transfer";
import { isEnterSave } from "@/shared/lib/groo/enter-save";
import { amountText } from "../lib/amount-format";
import { INSTALLMENT_MONTHS, type TxForm } from "../model/use-tx-form";
import { TypeChips } from "./TxStep1";
import { Piece, PieceGroup } from "@/widgets/calendar/ui/event-form/sheet-body";
import { AssetPickBody, CategoryPickBody, SimplePickBody } from "./pick-bodies";
import {
  LockedRow,
  PickRow,
  ROW_ICON,
  RowError,
  RowTitle,
  StepRow,
} from "./tx-parts";

const NUM = (n: number) => n.toLocaleString("en-US");

/**
 * 2단계 · 수정 (D 22 · 25) — 거래처 칸 · (외화면 환율 칸 + 원화 금액 줄) · 줄 칸 · 고정 스위치.
 * 수정 · 고쳐 쓰기는 위에 종류 칩과 금액 줄이 더 있다. 틀린 칸은 [추가] · [저장] 을 누를 때 그 칸 아래에 글이 뜬다.
 */
export function TxStep2({ f }: { f: TxForm }) {
  const { t } = useTranslation("expense");
  const { t: tc } = useTranslation("common");
  const isTransfer = f.type === "TRANSFER";
  const isIncome = f.type === "INCOME";
  const locked = f.moneyFieldsLocked;
  const editLike = f.isEdit || f.isRewrite;
  const show = f.showErrors;
  const [today] = useState(() => new Date());
  const dayText = (day: string) => formatDateValue(parseDayKey(day), today);
  const timeText = (hhmm: string) =>
    formatTimeValue({
      hour: Number(hhmm.slice(0, 2)),
      minute: Number(hhmm.slice(3, 5)),
    });
  const none = t("addTx.none");
  // 목록에 없는 id(지운 계좌 · 카테고리)는 "없음" 이 아니라 "지운 …" 으로 보인다 — 읽어 온 기록이라 본문은 그 id 그대로(N4)
  const asset = (id: number | null) => {
    if (id == null) return null;
    const found = f.assets.find((a) => a.rowId === id);
    if (found) return found.assetName;
    return f.assetsLoaded ? t("addTx.deletedAsset") : "…";
  };

  const cat = f.selectedCategory;
  const catParent =
    cat?.parentRowId != null
      ? f.categories.find((c) => c.rowId === cat.parentRowId)
      : null;
  const catText = cat
    ? catParent
      ? `${catParent.categoryName} · ${cat.categoryName}`
      : cat.categoryName
    : f.categoryRowId != null
      ? f.categoriesLoaded
        ? t("addTx.deletedCategory")
        : "…"
      : null;

  const methodItems = [
    { value: "", label: t("addTx.noMethodOption") },
    { value: "CASH", label: t("form.paymentMethod.CASH") },
    { value: "CARD", label: t("form.paymentMethod.CARD") },
    { value: "TRANSFER", label: t("paymentTransferFull") },
    { value: "OTHER", label: t("form.paymentMethod.OTHER") },
  ];
  const methodLabel = f.paymentMethod
    ? (methodItems.find((m) => m.value === f.paymentMethod)?.label ?? null)
    : null;
  const eligible = transferEligible(f.assets);

  const dateRow = (
    <List>
      <ListItem
        title={<RowTitle>{t("addTx.dateRow")}</RowTitle>}
        prefix={<Calendar aria-hidden className={ROW_ICON} />}
        suffixText
        suffix={
          <PieceGroup>
            <DayPickSurface
              title={t("addTx.dateRow")}
              value={f.expenseDate}
              onConfirm={f.setExpenseDate}
              trigger={({ open, onClick }) => (
                <Piece
                  label={`${t("addTx.dateRow")}, ${dayText(f.expenseDate)}`}
                  expanded={open}
                  onClick={onClick}
                >
                  {dayText(f.expenseDate)}
                </Piece>
              )}
            />
            <TimePickSurface
              title={t("addTx.timeRow")}
              value={f.expenseTime}
              onConfirm={f.setExpenseTime}
              trigger={({ open, onClick }) => (
                <Piece
                  label={`${t("addTx.timeRow")}, ${timeText(f.expenseTime)}`}
                  expanded={open}
                  onClick={onClick}
                >
                  {timeText(f.expenseTime)}
                </Piece>
              )}
            />
          </PieceGroup>
        }
      />
    </List>
  );

  const memoRow = (
    <StepRow
      title={t("addTx.memo")}
      prefix={<StickyNote />}
      value={f.description || none}
      empty={!f.description}
      clamp
      onClick={() => f.setSub("memo")}
    />
  );

  const dateText = `${dayText(f.expenseDate)} ${timeText(f.expenseTime)}`;

  const excess = f.splitSum - f.amountNumber;
  const diffText =
    excess > 0
      ? t("addTx.splitDiffOver", { diff: NUM(excess) })
      : t("addTx.splitDiffShort", { diff: NUM(-excess) });

  return (
    <>
      {f.smsLow && (
        <div className="px-global-gutter pb-x3">
          <Callout tone="warning">{t("sms.lowConfidence")}</Callout>
        </div>
      )}
      {/* 결제 문자 초안도 지출 · 수입 칩이 있다 — 환불 · 입금 문자를 수입으로 남길 길이 막히지 않게(이체 칩은 막힌다) */}
      {f.smsDraft && !editLike && <TypeChips f={f} />}
      {editLike && (
        <>
          <TypeChips f={f} />
          {locked ? (
            <LockedRow
              title={t("form.amount")}
              prefix={<Coins />}
              value={amountText(f)}
            />
          ) : (
            <StepRow
              ref={f.refFor("entry")}
              title={t("form.amount")}
              prefix={<Coins />}
              value={amountText(f) || none}
              empty={!amountText(f)}
              errorMessage={
                show && (f.errors.entry || f.errors.fx)
                  ? t("addTx.entryRequired")
                  : f.errors.tooLarge
                    ? t("addTx.amountTooLarge")
                    : null
              }
              onClick={() => f.setSub("amount")}
            />
          )}
          {locked && (
            <div className="px-global-gutter pb-x2 pt-x1">
              <p className="m-0 font-sans text-t3 text-fg-neutral-subtle">
                {f.isAutoGenerated
                  ? t(`addTx.autoSource.${f.expense?.autoSource}`, {
                      defaultValue: t("addTx.autoSource.default"),
                    })
                  : f.isReplaceable
                    ? t("addTx.moneyLockedNote")
                    : t("addTx.moneyLockedPaidOffNote")}
              </p>
              {f.isMoneyLocked && !f.isAutoGenerated && f.isReplaceable && (
                <Button
                  type="button"
                  variant="neutralOutline"
                  size="small"
                  className="mt-x2"
                  disabled={!f.canRewrite}
                  onClick={() => f.requestRewrite()}
                >
                  {t("addTx.rewrite")}
                </Button>
              )}
              {/* 막는 동안에는 왜 막혔는지 한 줄 — 나눈 내역을 알아야 교체 본문에 실을 수 있다 */}
              {f.isMoneyLocked &&
                !f.isAutoGenerated &&
                f.isReplaceable &&
                !f.canRewrite && (
                  <p className="m-0 mt-x2 font-sans text-t3 text-fg-neutral-subtle">
                    {t("addTx.rewriteNeedsSplits")}
                  </p>
                )}
            </div>
          )}
          {/* 나눈 내역을 못 받았다 — 그 자리 실패 + [다시 시도](상세 SplitFailure · 나누기 단계와 같은 꼴) */}
          {f.splitsLoadFailed && (
            <ResultSection
              size="medium"
              kind="failure"
              title={t("txDetail.splitLoadFailed")}
              description={tc("loadFailedDesc")}
              primaryAction={{
                label: tc("retry"),
                onClick: f.retrySplits,
                loading: f.splitsRetrying,
              }}
            />
          )}
          {f.splitMismatch && (
            <div className="px-global-gutter pb-x3">
              <Callout
                tone="warning"
                title={t("addTx.splitMismatchTitle")}
                link={{
                  label: t("addTx.matchSplits"),
                  onClick: () => f.setOpenReconcile(true),
                }}
              >
                {t("addTx.splitMismatchBody", {
                  total: NUM(f.amountNumber),
                  sum: NUM(f.splitSum),
                  diffText,
                })}
              </Callout>
            </div>
          )}
        </>
      )}

      {!isTransfer && (
        <Field
          label={isIncome ? t("addTx.incomeSource") : t("form.merchant")}
          className="px-global-gutter pb-x4 pt-x1"
        >
          <Input
            value={f.merchant}
            maxLength={100}
            autoFocus={f.focusMerchant}
            placeholder={
              isIncome
                ? t("addTx.incomeSourcePlaceholder")
                : t("addTx.merchantPlaceholder")
            }
            onChange={(e) => f.setMerchant(e.target.value)}
            onKeyDown={(e) => {
              if (isEnterSave(e)) {
                e.preventDefault();
                f.save();
              }
            }}
          />
        </Field>
      )}

      {!isTransfer && f.isForeignTx && !locked && (
        <>
          <Field
            label={t("addTx.fxRateLabel")}
            invalid={show && f.errors.fx}
            errorMessage={t("addTx.errFx")}
            description={
              f.fxRate && parseFloat(f.origAmount) > 0 && f.amountNumber > 0
                ? t("addTx.fxHint", {
                    original: `${NUM(parseFloat(f.origAmount))} ${f.origCurrency}`,
                    rate: NUM(parseFloat(f.fxRate)),
                    krw: NUM(f.amountNumber),
                  })
                : undefined
            }
            className="px-global-gutter pb-x4"
          >
            <DecimalInput
              ref={f.refFor("fx")}
              value={f.fxRate}
              maxDecimals={4}
              onValueChange={(v) => {
                f.setFxRate(v);
                f.clearPresetMark();
              }}
            />
          </Field>
          <StepRow
            ref={f.refFor("fxAmount")}
            title={t("addTx.krwAmount")}
            prefix={<Coins />}
            value={f.amountNumber > 0 ? money(f.amountNumber) : none}
            empty={f.amountNumber <= 0}
            errorMessage={f.errors.tooLarge ? t("addTx.amountTooLarge") : null}
            onClick={() => f.setSub("krwAmount")}
          />
        </>
      )}
      {!isTransfer && f.isForeignTx && locked && (
        <>
          <LockedRow
            title={t("addTx.fxRateLabel")}
            prefix={<Percent />}
            value={f.fxRate || none}
          />
          <LockedRow
            title={t("addTx.krwAmount")}
            prefix={<Coins />}
            value={f.amountNumber > 0 ? money(f.amountNumber) : none}
          />
        </>
      )}

      {isTransfer ? (
        <>
          <PickRow
            ref={f.refFor("from")}
            title={t("addTx.fromAccountRow")}
            prefix={<Wallet />}
            value={asset(f.fromAssetRowId)}
            placeholder={t("addTx.fromAccountPick")}
            errorMessage={show && f.errors.from ? t("addTx.errFrom") : null}
          >
            {({ close }) => (
              <AssetPickBody
                f={f}
                close={close}
                list={eligible.filter((a) => a.rowId !== f.toAssetRowId)}
                value={f.fromAssetRowId}
                onPick={(id) => {
                  f.setFromAssetRowId(id);
                  f.clearPresetMark();
                }}
              />
            )}
          </PickRow>
          <PickRow
            ref={f.refFor("to")}
            title={t("addTx.toAccount")}
            prefix={<Wallet />}
            value={asset(f.toAssetRowId)}
            placeholder={t("addTx.toAccountPick")}
            errorMessage={show && f.errors.to ? t("addTx.errTo") : null}
          >
            {({ close }) => (
              <AssetPickBody
                f={f}
                close={close}
                list={eligible.filter((a) => a.rowId !== f.fromAssetRowId)}
                value={f.toAssetRowId}
                onPick={(id) => {
                  f.setToAssetRowId(id);
                  f.clearPresetMark();
                }}
              />
            )}
          </PickRow>
          {f.transferHintText != null && (
            // 금액은 보내는 계좌 통화(I-13) — 외화면 원화 어림, 두 계좌 통화가 다르면 받는 금액(읽기 전용, 서버와 같은 식 · HALF_UP)
            <p className="m-0 px-global-gutter pb-x2 pt-x1 font-sans text-t3 text-fg-neutral-subtle">
              {f.transferHintText}
            </p>
          )}
          <StepRow
            title={t("addTx.fee")}
            prefix={<Percent />}
            value={f.fee ? f.transferMoney(Number(f.fee)) : none}
            empty={!f.fee}
            onClick={() => f.setSub("fee")}
          />
          {f.showInterest && (
            <StepRow
              title={t("addTx.interest")}
              prefix={<Percent />}
              value={f.interest ? f.transferMoney(Number(f.interest)) : none}
              empty={!f.interest}
              ref={f.refFor("interest")}
              errorMessage={
                show && f.errors.interest ? t("addTx.errInterest") : null
              }
              onClick={() => f.setSub("interest")}
            />
          )}
          {dateRow}
          {memoRow}
        </>
      ) : (
        <>
          <PickRow
            ref={f.refFor("category")}
            title={t("addTx.category")}
            prefix={<Tags />}
            value={catText}
            placeholder={t("addTx.noCategoryValue")}
            dot={cat ? getPaletteByColor(cat.color).color : undefined}
            errorMessage={
              show && f.errors.category ? t("addTx.errCategory") : null
            }
          >
            {({ close }) => <CategoryPickBody f={f} close={close} />}
          </PickRow>
          {locked ? (
            <LockedRow
              title={isIncome ? t("addTx.depositAccount") : t("addTx.account")}
              prefix={<Wallet />}
              value={asset(f.assetRowId) ?? none}
            />
          ) : (
            <PickRow
              title={isIncome ? t("addTx.depositAccount") : t("addTx.account")}
              prefix={<Wallet />}
              value={asset(f.assetRowId)}
              placeholder={
                isIncome
                  ? t("addTx.noDepositAccount")
                  : t("addTx.noAccountOption")
              }
              surfaceTitle={t("addTx.account")}
            >
              {({ close }) => (
                <AssetPickBody
                  f={f}
                  close={close}
                  allowNone
                  list={f.filteredAssets}
                  value={f.assetRowId}
                  onPick={(id) => {
                    f.setAssetRowId(id);
                    f.clearPresetMark();
                  }}
                />
              )}
            </PickRow>
          )}
          {f.smsDraft?.parsed.cardHint &&
            !f.smsDraft.parsed.assetRemembered && (
              <List>
                <ListCheckItem
                  title={t("sms.rememberCard")}
                  checked={f.assetRowId != null && f.rememberCard}
                  disabled={f.assetRowId == null}
                  onCheckedChange={(v) => f.setRememberCard(v === true)}
                />
              </List>
            )}
          {locked ? (
            <LockedRow
              title={
                isIncome
                  ? t("addTx.incomeMethodRow")
                  : t("addTx.paymentMethodRow")
              }
              prefix={<CreditCard />}
              value={methodLabel ?? none}
            />
          ) : (
            <PickRow
              title={
                isIncome
                  ? t("addTx.incomeMethodRow")
                  : t("addTx.paymentMethodRow")
              }
              prefix={<CreditCard />}
              value={methodLabel}
              placeholder={
                isIncome ? t("addTx.noIncomeMethod") : t("addTx.noMethodOption")
              }
            >
              {({ close }) => (
                <SimplePickBody
                  label={t("addTx.paymentMethodRow")}
                  items={methodItems}
                  value={f.paymentMethod}
                  onPick={(v) => {
                    f.setPaymentMethod(v);
                    f.clearPresetMark();
                  }}
                  close={close}
                />
              )}
            </PickRow>
          )}
          {f.showInstallment &&
            (locked ? (
              <LockedRow
                title={t("addTx.installment")}
                prefix={<CalendarDays />}
                value={
                  f.installmentMonths
                    ? t("addTx.installmentMonths", {
                        months: f.installmentMonths,
                      })
                    : t("addTx.lumpSum")
                }
              />
            ) : (
              <PickRow
                title={t("addTx.installment")}
                prefix={<CalendarDays />}
                value={
                  f.installmentMonths
                    ? `${t("addTx.installmentMonths", { months: f.installmentMonths })} · ${t("addTx.installmentHint", { perMonth: NUM(Math.round(f.amountNumber / Number(f.installmentMonths))), months: f.installmentMonths })}`
                    : t("addTx.lumpSum")
                }
              >
                {({ close }) => (
                  <SimplePickBody
                    label={t("addTx.installment")}
                    items={[
                      { value: "", label: t("addTx.lumpSum") },
                      ...INSTALLMENT_MONTHS.map((m) => ({
                        value: String(m),
                        label: t("addTx.installmentMonths", { months: m }),
                      })),
                    ]}
                    value={f.installmentMonths}
                    onPick={(v) => {
                      f.setInstallmentMonths(v);
                      f.clearPresetMark();
                    }}
                    close={close}
                  />
                )}
              </PickRow>
            ))}
          {locked ? (
            <LockedRow
              title={t("addTx.dateRow")}
              prefix={<Calendar />}
              value={dateText}
            />
          ) : (
            dateRow
          )}
          {memoRow}
        </>
      )}

      {/* 고정 수입 · 지출 — 이체 · 문자 초안에는 없다(문자 전용 저장 경로가 표식을 싣지 못한다) */}
      {!isTransfer && !f.smsDraft && (
        <List>
          <ListSwitchItem
            title={
              isIncome ? t("fixed.switch.income") : t("fixed.switch.expense")
            }
            detail={isIncome ? t("fixed.hint.income") : t("fixed.hint.expense")}
            checked={f.isFixed}
            onCheckedChange={f.setIsFixed}
          />
        </List>
      )}
      {show && f.errors.splitsPending && (
        <RowError>
          {f.splitsLoadFailed
            ? t("txDetail.splitLoadFailed")
            : t("addTx.splitsLoading")}
        </RowError>
      )}
    </>
  );
}
