import { useEffect, useId, useMemo, useState } from "react";
import { format } from "date-fns";
import { useTranslation } from "react-i18next";
import { ModalShell } from "@/shared/ui/groo/dialogs";
import { ModalFooter } from "@/shared/ui/groo/modal-footer";
import { Field, FieldLabel } from "@/shared/ui/field";
import { Input } from "@/shared/ui/input";
import {
  blockNonDigitKey,
  sanitizeAmountInput,
} from "@/shared/lib/groo/amount";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import { useCreateTrade, useAssets, useTradePreview } from "@/features/asset";
import { useStockSymbolName } from "@/features/stock/model/useStockMaster";
import { sanitizeQty, qtyNumber, formatQty } from "@/entities/asset";
import type {
  Asset,
  AssetHolding,
  AssetTradeFormValues,
  TradeType,
} from "@/entities/asset";
import { KRW, money } from "@/shared/lib/groo/format";

/**
 * 매수·매도 입력.
 *
 * <p>예수금이 줄고 느는 진짜 사건을 여기서 기록한다. 이게 없으면 평가액 갱신을 보고
 * 예수금을 추측해야 하는데, 시세 변동·추가 매수·재등록이 전부 같은 갱신으로 들어와
 * 구분되지 않는다.
 *
 * <p>거래대금은 수수료를 뺀 순수 금액이다. 수수료는 매수면 취득원가에 들어가고 매도면
 * 대금에서 빠진다 — 어느 쪽이든 예수금에서 실제로 나간다.
 */
export function AssetTradeDialog({
  asset,
  holding,
  defaultType = "BUY",
  mobile,
  onClose,
}: {
  asset: Asset;
  /** 어떤 종목인지 정해진 채로 들어온다 — 여기서 다시 고르게 하면 편집과 역할이 겹친다. */
  holding: AssetHolding;
  defaultType?: TradeType;
  mobile: boolean;
  onClose: () => void;
}) {
  const uid = useId(); // 결제 계좌 칸 이름 잇기
  const { t } = useTranslation("asset");
  const { t: tc } = useTranslation("common");
  const createMut = useCreateTrade();
  const { data: assetsData } = useAssets();
  // 결제 계좌 후보 — 이 증권계좌 자신은 뺀다(예수금 경로와 같아진다).
  const settlementOptions = useMemo(
    () =>
      (assetsData?.assets ?? []).filter(
        (a) =>
          a.rowId !== asset.rowId &&
          a.assetType !== "CREDIT_CARD" &&
          a.assetType !== "CHECK_CARD",
      ),
    [assetsData, asset.rowId],
  );

  const [type, setType] = useState<Exclude<TradeType, "OPENING">>(
    defaultType === "SELL" ? "SELL" : "BUY",
  );
  const [quantity, setQuantity] = useState("");
  const [amount, setAmount] = useState("");
  const [fee, setFee] = useState("");
  // datetime-local 은 타임존 없는 로컬 시각을 받는다 — toISOString() 은 UTC 라
  // 한국에서 9시간 과거로 표시·저장돼 거래가 소급 입력이 된다.
  const [tradeDate, setTradeDate] = useState(() =>
    format(new Date(), "yyyy-MM-dd'T'HH:mm"),
  );
  const [description, setDescription] = useState("");
  // 결제 계좌 — 비우면 증권계좌 예수금에서. 예수금을 따로 관리하지 않으면 통장을 고른다.
  const [settlementAssetRowId, setSettlementAssetRowId] = useState<
    number | null
  >(null);

  const isSell = type === "SELL";
  // 종목 식별자 — 연동은 토스 종목코드, 미연동은 항목명. 보유 목록은 편집할 때마다
  // 통째로 재생성돼서 rowId 로는 거래를 묶을 수 없다.
  const holdingKey =
    (holding.linked ? holding.tossSymbol : holding.holdingName) ?? "";
  // 티커가 아니라 종목명으로 보여 준다 — 편집 화면과 같은 이름이어야 헷갈리지 않는다.
  const { data: masterName } = useStockSymbolName(
    holding.linked ? (holding.tossSymbol ?? "") : "",
  );
  const holdingName = holding.linked
    ? (masterName ?? holding.tossSymbol ?? "")
    : (holding.holdingName ?? "");

  const qty = qtyNumber(quantity) ?? 0;
  const amountNum = Number(amount.replace(/[^\d]/g, "")) || 0;
  const feeNum = Number(fee.replace(/[^\d]/g, "")) || 0;

  const heldQty = qtyNumber(holding.quantity) ?? 0;

  // 저장할 때 그대로 보낼 값 — 미리보기도 같은 몸통을 쓴다.
  const payload: AssetTradeFormValues | null = useMemo(() => {
    if (!(holdingKey.length > 0 && qty > 0 && amountNum > 0)) return null;
    return {
      assetRowId: asset.rowId,
      tradeType: type,
      holdingType: holding.holdingType ?? "STOCK",
      holdingKey,
      linked: holding.linked,
      quantity: sanitizeQty(quantity),
      amount: amountNum,
      fee: feeNum,
      tradeDate: `${tradeDate}:00`,
      description: description.trim() || undefined,
      settlementAssetRowId,
    };
  }, [
    holdingKey,
    qty,
    amountNum,
    feeNum,
    asset.rowId,
    type,
    holding.holdingType,
    holding.linked,
    quantity,
    tradeDate,
    description,
    settlementAssetRowId,
  ]);

  // 타이핑하는 중에는 묻지 않는다 — 손을 멈추면 그때 한 번 간다.
  const [settled, setSettled] = useState<AssetTradeFormValues | null>(null);
  useEffect(() => {
    const id = setTimeout(() => setSettled(payload), 350);
    return () => clearTimeout(id);
  }, [payload]);

  // 실현손익·예수금 잔액은 서버가 계산한다 — 화면이 같은 규칙을 따로 들고 있으면 갈라진다.
  const { data: preview } = useTradePreview(settled);
  const cashDelta = preview?.cashDelta ?? null;
  const cashAfter = preview?.cashAfter ?? null;
  const realizedPreview = isSell ? (preview?.realizedPl ?? null) : null;
  const fundingAmount = preview?.fundingAmount ?? 0;

  // 예수금으로 살 때만 잔액을 본다 — 결제 계좌는 마이너스를 막지 않는다(서버도 같은 규칙).
  const viaCash = settlementAssetRowId == null;
  const canSubmit =
    holdingKey.length > 0 &&
    qty > 0 &&
    amountNum > 0 &&
    (!isSell || qty <= heldQty) &&
    // 예수금이 모자라도 막지 않는다 — 기록용 앱이라 마이너스로 쌓이는 게 정상이다.
    true;

  const submit = () => {
    if (!canSubmit || payload == null) return;
    // 미리보기에 보낸 것과 같은 몸통을 보낸다 — 보여 준 값과 저장될 값이 다를 수 없다.
    createMut.mutate(payload, {
      onSuccess: () => {
        onClose();
      },
      // onError: 전역 인터셉터가 서버 메시지를 토스트로 노출(예수금 부족·수량 부족 등)
    });
  };

  return (
    <ModalShell
      title={t("trade.title")}
      onClose={onClose}
      size="sm"
      mobile={mobile}
      footer={
        <ModalFooter
          onCancel={onClose}
          cancelLabel={tc("cancel")}
          onSave={submit}
          saveLabel={isSell ? t("trade.actionSell") : t("trade.actionBuy")}
          saving={createMut.isPending}
          saveDisabled={!canSubmit}
        />
      }
    >
      <Tabs
        value={type}
        onValueChange={(v) => {
          if (!v) return;
          setType(v as typeof type);
        }}
        className="mb-[14px]"
      >
        <TabsList variant="pill" size="sm" className="w-full">
          <TabsTrigger value="BUY" className="flex-1">
            {t("trade.buy")}
          </TabsTrigger>
          <TabsTrigger value="SELL" className="flex-1">
            {t("trade.sell")}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* 어떤 종목인지 — 여기서 고르는 게 아니라 이미 정해져서 들어온다.
          종목 추가는 편집(토스 검색)에서 한다. */}
      <div className="mb-[14px] rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-sunken)] px-3 py-2.5">
        <div style={{ fontSize: "var(--text-body-sm)", fontWeight: 700 }}>
          {holdingName}
        </div>
        <div className="mt-0.5 text-[11.5px] text-[var(--fg-tertiary)]">
          {t("trade.heldSummary", {
            qty: formatQty(holding.quantity, holding.holdingType ?? "STOCK"),
            avg: holding.avgPrice
              ? money(Math.round(Number(holding.avgPrice)))
              : "—",
          })}
        </div>
      </div>

      <Field className="mb-[14px]">
        <FieldLabel>{t("trade.quantity")}</FieldLabel>
        <Input
          value={quantity}
          onChange={(e) => setQuantity(sanitizeQty(e.target.value))}
          inputMode="decimal"
          placeholder="0"
        />
      </Field>

      <Field className="mb-[14px]">
        <FieldLabel>{t("trade.amount")}</FieldLabel>
        <Input
          value={amount}
          onChange={(e) => setAmount(sanitizeAmountInput(e.target.value))}
          onKeyDown={blockNonDigitKey}
          inputMode="numeric"
          placeholder="0"
        />
        <div className="mt-1.5 text-[11.5px] text-[var(--fg-tertiary)]">
          {t("trade.amountHelp")}
        </div>
      </Field>

      <Field className="mb-[14px]">
        <FieldLabel>{t("trade.fee")}</FieldLabel>
        <Input
          value={fee}
          onChange={(e) => setFee(sanitizeAmountInput(e.target.value))}
          onKeyDown={blockNonDigitKey}
          inputMode="numeric"
          placeholder="0"
        />
      </Field>

      {/* 결제 계좌는 매수에만. 매도 대금은 예수금에 남기고 사용자가 이체로 관리한다 —
          팔았다고 통장으로 자동 이체되지는 않는다. */}
      {!isSell && (
        <Field className="mb-[14px]">
          <FieldLabel id={`${uid}settle-label`}>
            {t("trade.settlement")}
          </FieldLabel>
          <Select
            value={
              settlementAssetRowId != null
                ? String(settlementAssetRowId)
                : "__cash__"
            }
            onValueChange={(v) =>
              setSettlementAssetRowId(v === "__cash__" ? null : Number(v))
            }
          >
            <SelectTrigger
              id={`${uid}settle`}
              aria-labelledby={`${uid}settle-label ${uid}settle`}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__cash__">
                {t("trade.settlementCash")}
              </SelectItem>
              {settlementOptions.map((a) => (
                <SelectItem key={a.rowId} value={String(a.rowId)}>
                  {a.institution
                    ? `${a.institution} · ${a.assetName}`
                    : a.assetName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="mt-1.5 text-[11.5px] text-[var(--fg-tertiary)]">
            {viaCash
              ? t("trade.settlementCashHelp")
              : t("trade.settlementAccountHelp")}
          </div>
        </Field>
      )}

      <Field className="mb-[14px]">
        <FieldLabel>{t("trade.date")}</FieldLabel>
        <Input
          type="datetime-local"
          value={tradeDate}
          onChange={(e) => setTradeDate(e.target.value)}
        />
      </Field>

      <Field className="mb-[14px]">
        <FieldLabel>{t("trade.memo")}</FieldLabel>
        <Input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t("trade.memoPlaceholder")}
          maxLength={200}
        />
      </Field>

      {/* 예수금이 어떻게 되는지 먼저 보여 준다 — 저장하고 나서 놀라지 않게. */}
      <div
        className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-sunken)] px-3 py-2.5"
        style={{ fontSize: "var(--text-body-sm)" }}
      >
        <div className="flex items-center justify-between">
          <span className="text-[var(--fg-secondary)]">
            {viaCash ? t("trade.cashAfter") : t("trade.settlementDelta")}
          </span>
          <span
            className="num font-bold"
            style={{
              color:
                viaCash && (cashAfter ?? 0) < 0
                  ? "var(--color-fg-critical)"
                  : "var(--fg-primary)",
            }}
          >
            {/* 서버가 아직 답하기 전에는 자리만 잡아 둔다 — 틀린 값을 잠깐 보여 주느니 낫다. */}
            {cashAfter == null || cashDelta == null
              ? "—"
              : viaCash
                ? money(cashAfter)
                : `${cashDelta >= 0 ? "+" : "−"}${money(Math.abs(cashDelta))}`}
          </span>
        </div>
        {realizedPreview != null && (
          <div className="mt-1.5 flex items-center justify-between">
            <span className="text-[var(--fg-secondary)]">
              {t("trade.realizedPreview")}
            </span>
            <span
              className="num font-bold"
              style={{
                color:
                  realizedPreview >= 0
                    ? "var(--fg-income)"
                    : "var(--fg-expense)",
              }}
            >
              {realizedPreview >= 0 ? "+" : "−"}
              {money(Math.abs(realizedPreview))}
            </span>
          </div>
        )}
        {/* 예수금이 모자라면 결제 계좌에서 그만큼 끌어온다 — 이체가 한 건 생긴다는 걸 미리 알린다. */}
        {fundingAmount > 0 && (
          <div className="mt-1.5 text-[11.5px] text-[var(--fg-tertiary)]">
            {t("trade.fundingNotice", { amount: KRW(fundingAmount) })}
          </div>
        )}
        {!isSell && viaCash && (cashAfter ?? 0) < 0 && (
          <div
            className="mt-1.5 text-[11.5px]"
            style={{ color: "var(--color-fg-critical)" }}
          >
            {t("trade.insufficientCash")}
          </div>
        )}
        {isSell && qty > heldQty && (
          <div
            className="mt-1.5 text-[11.5px]"
            style={{ color: "var(--color-fg-critical)" }}
          >
            {t("trade.insufficientQty")}
          </div>
        )}
      </div>
    </ModalShell>
  );
}
