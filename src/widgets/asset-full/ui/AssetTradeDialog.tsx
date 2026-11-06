import { useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { useTranslation } from "react-i18next";
import { Button } from "@/shared/ds/button";
import { Callout } from "@/shared/ds/callout";
import { BandFailure } from "@/shared/ui/groo/band-parts";
import { useScrollToError } from "@/shared/hooks/useScrollToError";
import { ChipRadio, ChipRadioGroup } from "@/shared/ds/chip";
import { DatePicker, dayKey, parseDayKey } from "@/shared/ds/date-picker";
import {
  ResponsiveDialog,
  ResponsiveDialogBody,
  ResponsiveDialogCancel,
  ResponsiveDialogContent,
  ResponsiveDialogFooter,
} from "@/shared/ds/dialog";
import { Field } from "@/shared/ds/field";
import { Input } from "@/shared/ds/input";
import { List, ListItem } from "@/shared/ds/list";
import { useWideSurface } from "@/shared/ds/overlay";
import { Select, SelectGroup, SelectItem } from "@/shared/ds/select";
import { AmountInput } from "@/shared/ui/groo/amount-input";
import { PickerRow } from "@/shared/ui/groo/picker-row";
import { i18n } from "@/shared/i18n/config";
import { useCreateTrade, useAssets, useTradePreview } from "@/features/asset";
import { useStockSymbolName } from "@/features/stock/model/useStockMaster";
import { sanitizeQty, qtyNumber, formatQty, toKrw } from "@/entities/asset";
import type {
  Asset,
  AssetHolding,
  AssetTradeFormValues,
  TradeType,
} from "@/entities/asset";
import { MINUS, money } from "@/shared/lib/groo/format";
import {
  formatAssetAmount,
  isForeignCurrency,
} from "@/shared/lib/groo/currency";
import { dsLocale } from "@/shared/ds/i18n";

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
  onClose,
}: {
  asset: Asset;
  /** 어떤 종목인지 정해진 채로 들어온다 — 여기서 다시 고르게 하면 편집과 역할이 겹친다. */
  holding: AssetHolding;
  defaultType?: TradeType;
  onClose: () => void;
}) {
  const { t } = useTranslation("asset");
  const { t: tc } = useTranslation("common");
  const wide = useWideSurface();
  // 저장 실패는 전역 서버 원문 토스트 대신 폼 맨 위 Callout(고정 글)이 알린다 — 요청은 silent, 폼은 열린 채 · 쓴 값 그대로
  const createMut = useCreateTrade({ silent: true });
  // 결제 계좌 후보 — 폼 안의 참조 목록이라 실패해도 폼은 그대로 두고, 저장할 때 다시 받는다(submit)
  const assetsQ = useAssets({ silent: true });
  const assetsData = assetsQ.data;
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
  // 거래일은 날짜 고르기(Date Picker) · 시각은 시 칸 — 합쳐 지금 몸통의 tradeDate 가 된다(요청은 그대로)
  const dayPart = tradeDate.slice(0, 10);
  const timePart = tradeDate.slice(11, 16);
  const [dateDraft, setDateDraft] = useState<Date | undefined>(undefined);
  const dateText = new Intl.DateTimeFormat(i18n.language, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(parseDayKey(dayPart));
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
  const previewQ = useTradePreview(settled, { silent: true });
  const preview = previewQ.data;
  const cashDelta = preview?.cashDelta ?? null;
  const cashAfter = preview?.cashAfter ?? null;
  const realizedPreview = isSell ? (preview?.realizedPl ?? null) : null;
  const fundingAmount = preview?.fundingAmount ?? 0;
  // 금액의 통화(I-13 L6) — 예수금 증감 · 거래 후 예수금은 투자 계좌 통화(cashCurrency), 결제 계좌에서 옮기는 금액은 그 계좌
  // 통화(fundingCurrency). 옛 서버(칸 없음)면 계좌 통화로 읽는다. 원화가 아니면 "약 …원" 을 함께 쓴다(그 계좌 환율, HALF_UP).
  const cashCurrency = preview?.cashCurrency ?? asset.currency;
  const settlementAsset =
    settlementAssetRowId != null
      ? settlementOptions.find((a) => a.rowId === settlementAssetRowId)
      : undefined;
  const fundingCurrency =
    preview?.fundingCurrency ?? settlementAsset?.currency ?? "KRW";
  // 금액 한 개 → 그 통화 글 + (외화면) "약 …원". 원화 환산은 그 계좌 환율 · HALF_UP
  const moneyParts = (
    n: number,
    code: string | null | undefined,
    rateOf: { currency?: string | null; exchangeRate?: number | null },
    signed = false,
  ) => {
    const sign = n < 0 ? MINUS : signed ? "+" : "";
    if (!isForeignCurrency(code))
      return { main: sign + money(Math.abs(n)), approx: null };
    const krw = toKrw(Math.abs(n), {
      currency: code,
      exchangeRate: rateOf.exchangeRate,
    });
    return {
      main: sign + formatAssetAmount(Math.abs(n), code!, dsLocale()),
      approx: t("fx.approxKrw", { amount: sign + money(krw) }),
    };
  };
  /** 줄 값 — 외화면 아래 작게 "약 …원"(상세 예수금 줄과 같은 모양) */
  const moneyNode = (parts: ReturnType<typeof moneyParts>) =>
    parts.approx == null ? (
      parts.main
    ) : (
      <span className="flex flex-col items-end">
        <span>{parts.main}</span>
        <span className="text-t3 font-medium text-fg-neutral-subtle">
          {parts.approx}
        </span>
      </span>
    );
  /** 문장 안 — "$900.00(약 1,170,000원)" */
  const moneyInline = (parts: ReturnType<typeof moneyParts>) =>
    parts.approx == null ? parts.main : `${parts.main}(${parts.approx})`;

  // 예수금으로 살 때만 잔액을 본다 — 결제 계좌는 마이너스를 막지 않는다(서버도 같은 규칙).
  const viaCash = settlementAssetRowId == null;
  const canSubmit =
    holdingKey.length > 0 &&
    qty > 0 &&
    amountNum > 0 &&
    (!isSell || qty <= heldQty) &&
    // 예수금이 모자라도 막지 않는다 — 기록용 앱이라 마이너스로 쌓이는 게 정상이다.
    true;

  const [tried, setTried] = useState(false);
  const qtyError =
    tried && qty <= 0
      ? t("trade.qtyRequired")
      : isSell && qty > heldQty
        ? t("trade.insufficientQty")
        : undefined;
  const amountError =
    tried && amountNum <= 0 ? t("trade.amountRequired") : undefined;
  // 결제 계좌 후보를 저장할 때 다시 받다 또 실패했다 — 요청은 보내지 않고 폼 Callout 으로 알린다(submit)
  const [refFailed, setRefFailed] = useState(false);
  const errorRef = useScrollToError<HTMLDivElement>(
    createMut.isError || refFailed,
    createMut.error ?? refFailed,
  );
  // 서버 글은 내지 않는다 — 고쳐 다시 할 수 있는 보유 수량 부족만 오류 코드(ASSET_012)로 가려 고정 글을 준다
  const failCode = (
    createMut.error as { response?: { data?: { code?: unknown } } } | null
  )?.response?.data?.code;
  const saveFailedText =
    failCode === "ASSET_012"
      ? t("trade.saveInsufficientQty")
      : t("trade.saveFailed");
  // 이중 제출 가드 — 같은 프레임의 두 번째 누름은 렌더 전 클로저라 isPending 이 아직 false 다. 누르는 순간 켜고 끝나면(성공 · 실패) 끈다
  const savingRef = useRef(false);
  const submit = () => {
    setTried(true);
    if (!canSubmit || payload == null) return;
    if (savingRef.current) return;
    savingRef.current = true;
    createMut.reset();
    setRefFailed(false);
    const send = () => {
      // 미리보기에 보낸 것과 같은 몸통을 보낸다 — 보여 준 값과 저장될 값이 다를 수 없다.
      createMut.mutate(payload, {
        onSuccess: () => {
          onClose();
        },
        onSettled: () => {
          savingRef.current = false;
        },
      });
    };
    if (assetsQ.isError && !assetsQ.data) {
      void assetsQ.refetch().then((r) => {
        if (r.isError) {
          setRefFailed(true);
          savingRef.current = false;
        } else send();
      });
      return;
    }
    send();
  };

  const critical = viaCash && (cashAfter ?? 0) < 0;
  const dirty =
    quantity !== "" || amount !== "" || fee !== "" || description !== "";
  return (
    <ResponsiveDialog
      open
      form
      dirty={dirty}
      onOpenChange={(next) => !next && onClose()}
      busy={createMut.isPending}
    >
      <ResponsiveDialogContent title={t("trade.title")}>
        <ResponsiveDialogBody>
          {(createMut.isError || refFailed) && (
            <div ref={errorRef}>
              <Callout tone="critical" role="alert" className="mb-x4">
                {createMut.isError
                  ? saveFailedText
                  : tc("query.referenceSaveFailed")}
              </Callout>
            </div>
          )}
          <div className="flex flex-col gap-x4 pb-x2">
            {/* 매수 · 매도 — 2 ~ 4개 폼 값은 칩 하나 고르기(DESIGN.desk 칩) */}
            <ChipRadioGroup
              aria-label={t("trade.title")}
              value={type}
              onValueChange={(v) => v && setType(v as typeof type)}
            >
              <ChipRadio variant="outlineStrong" size="medium" value="BUY">
                {t("trade.buy")}
              </ChipRadio>
              <ChipRadio variant="outlineStrong" size="medium" value="SELL">
                {t("trade.sell")}
              </ChipRadio>
            </ChipRadioGroup>

            {/* 어떤 종목인지 — 여기서 고르는 게 아니라 이미 정해져서 들어온다. 종목 추가는 편집(검색)에서 한다. */}
            <List aria-label={t("trade.holding")} className="-mx-global-gutter">
              <ListItem
                title={holdingName}
                detail={t("trade.heldSummary", {
                  qty: formatQty(
                    holding.quantity,
                    holding.holdingType ?? "STOCK",
                  ),
                  avg: holding.avgPrice
                    ? money(Math.round(Number(holding.avgPrice)))
                    : "—",
                })}
              />
            </List>

            <Field
              label={t("trade.quantity")}
              invalid={qtyError != null}
              errorMessage={qtyError}
            >
              <Input
                value={quantity}
                onChange={(e) => setQuantity(sanitizeQty(e.target.value))}
                inputMode="decimal"
                placeholder="0"
              />
            </Field>

            <Field
              label={t("trade.amount")}
              description={t("trade.amountHelp")}
              invalid={amountError != null}
              errorMessage={amountError}
            >
              <AmountInput value={amount} onValueChange={setAmount} />
            </Field>

            <Field label={t("trade.fee")} indicator={t("editDialog.optional")}>
              <AmountInput value={fee} onValueChange={setFee} />
            </Field>

            {/* 결제 계좌는 매수에만. 매도 대금은 예수금에 남기고 사용자가 이체로 관리한다 — 팔았다고 통장으로 자동 이체되지는 않는다. */}
            {!isSell && (
              <Field
                label={t("trade.settlement")}
                description={
                  viaCash
                    ? t("trade.settlementCashHelp")
                    : t("trade.settlementAccountHelp")
                }
              >
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
                  <SelectGroup>
                    <SelectItem
                      value="__cash__"
                      label={t("trade.settlementCash")}
                    />
                  </SelectGroup>
                  <SelectGroup>
                    {settlementOptions.map((a) => (
                      <SelectItem
                        key={a.rowId}
                        value={String(a.rowId)}
                        label={
                          a.institution
                            ? `${a.institution} · ${a.assetName}`
                            : a.assetName
                        }
                      />
                    ))}
                  </SelectGroup>
                </Select>
              </Field>
            )}

            {/* 거래일 — 고르는 값이라 Input Button 줄 + Date Picker(1280 미만 시트 · 이상 팝오버, "완료" 로 넣는다) */}
            <div className="-mx-global-gutter">
              <PickerRow
                title={t("trade.date")}
                value={dateText}
                surfaceTitle={t("trade.date")}
                onOpen={() => setDateDraft(parseDayKey(dayPart))}
                popoverClassName="w-[336px]"
                pickerActions={({ close }) => (
                  <Button
                    disabled={!dateDraft}
                    onClick={() => {
                      if (dateDraft)
                        setTradeDate(`${dayKey(dateDraft)}T${timePart}`);
                      close();
                    }}
                  >
                    {t("savingGoal.done")}
                  </Button>
                )}
              >
                <DatePicker
                  selection="single"
                  aria-label={t("trade.date")}
                  value={dateDraft}
                  onValueChange={setDateDraft}
                  autoFocus
                />
              </PickerRow>
            </div>
            <Field label={t("trade.time")}>
              <Input
                type="time"
                value={timePart}
                onChange={(e) =>
                  setTradeDate(`${dayPart}T${e.target.value || timePart}`)
                }
              />
            </Field>

            <Field label={t("trade.memo")} indicator={t("editDialog.optional")}>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t("trade.memoPlaceholder")}
                maxLength={200}
              />
            </Field>

            {/* 예수금이 어떻게 되는지 먼저 보여 준다 — 저장하고 나서 놀라지 않게. 키-값 줄 */}
            {previewQ.isError ? (
              <BandFailure
                title={tc("query.failedNamed", {
                  name: t("trade.previewName"),
                })}
                onRetry={() => void previewQ.refetch()}
              />
            ) : (
              <List
                aria-label={t("trade.preview")}
                className="-mx-global-gutter"
              >
                <ListItem
                  title={
                    viaCash ? t("trade.cashAfter") : t("trade.settlementDelta")
                  }
                  suffix={
                    <span
                      className={`text-end font-bold tabular-nums ${critical ? "text-fg-critical" : "text-fg-neutral"}`}
                    >
                      {/* 서버가 아직 답하기 전에는 자리만 잡아 둔다 — 틀린 값을 잠깐 보여 주느니 낫다. */}
                      {cashAfter == null || cashDelta == null
                        ? "—"
                        : viaCash
                          ? moneyNode(
                              moneyParts(cashAfter, cashCurrency, asset),
                            )
                          : // 결제 계좌에서 나가는 금액 = 충당액(결제 계좌 통화, I-13 L6). 예수금이 넉넉하면 0
                            moneyNode(
                              moneyParts(
                                -fundingAmount,
                                fundingCurrency,
                                settlementAsset ?? {
                                  currency: fundingCurrency,
                                },
                              ),
                            )}
                    </span>
                  }
                />
                {realizedPreview != null && (
                  <ListItem
                    title={t("trade.realizedPreview")}
                    suffix={
                      <span className="text-end font-bold tabular-nums text-fg-neutral">
                        {realizedPreview >= 0 ? "+" : "−"}
                        {money(Math.abs(realizedPreview))}
                      </span>
                    }
                  />
                )}
              </List>
            )}
            {/* 예수금이 모자라면 결제 계좌에서 그만큼 끌어온다 — 이체가 한 건 생긴다는 걸 미리 알린다. */}
            {fundingAmount > 0 && (
              <p className="m-0 text-t3 text-fg-neutral-subtle">
                {t("trade.fundingNotice", {
                  amount: moneyInline(
                    moneyParts(
                      fundingAmount,
                      fundingCurrency,
                      settlementAsset ?? { currency: fundingCurrency },
                    ),
                  ),
                })}
              </p>
            )}
            {!isSell && critical && (
              <p className="m-0 text-t3 text-fg-critical">
                {t("trade.insufficientCash")}
              </p>
            )}
          </div>
        </ResponsiveDialogBody>
        <ResponsiveDialogFooter>
          <div
            className={
              wide ? "ml-auto flex items-center gap-x2" : "flex min-w-0 flex-1"
            }
          >
            {/* 대화상자의 [취소] — 표면의 닫기를 청한다(저장 중이면 받지 않는다 · 바뀐 값이 있으면 묻는다) */}
            <ResponsiveDialogCancel size="small">
              {tc("cancel")}
            </ResponsiveDialogCancel>
            <Button
              size={wide ? "small" : "large"}
              className={wide ? undefined : "flex-1"}
              loading={createMut.isPending}
              onClick={submit}
            >
              {isSell ? t("trade.actionSell") : t("trade.actionBuy")}
            </Button>
          </div>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
