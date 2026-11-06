import { PriceFailBand } from "@/features/stock/ui/phone/price-fail-band";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Delta } from "@/shared/ds/card";
import { Button } from "@/shared/ds/button";
import { List, ListButtonItem, ListItem } from "@/shared/ds/list";
import { Skeleton } from "@/shared/ds/skeleton";
import { withCommaBreaks } from "@/shared/ds/i18n";
import { ConfirmDialog } from "@/shared/ui/groo/dialogs";
import { BandFailure, ListTitle } from "@/shared/ui/groo/band-parts";
import { MINUS, KRW, money, formatChangeRate } from "@/shared/lib/groo/format";
import { won } from "@/shared/lib/groo/money-text";
import {
  HOLDING_UNIT_KEY,
  formatQty,
  qtyNumber,
  type Asset,
  type AssetHolding,
  type AssetTrade,
  type TradeType,
} from "@/entities/asset";
import { holdingsOf, useAssetTrades, useDeleteTrade } from "@/features/asset";
import { useLivePrices } from "@/features/stock/model/useLivePrices";
import { useMyFeatures } from "@/features/subscription/model/useSubscription";
import { useStockSymbolName } from "@/features/stock/model/useStockMaster";
import { useAssetMask } from "../../lib/asset-groups";
import { AssetTradeDialog } from "../AssetTradeDialog";
import { TradeDetailSurface } from "./TradeDetailSurface";
import { useTradeLabel } from "./trade-label";
import { useConfirmFail } from "@/shared/lib/confirm-fail";
import { useSnackbar } from "@/shared/ds/snackbar";

/**
 * 보유 종목 한 줄(I-17 50) — List 줄 위 맞춤: 제목 종목 이름 · 설명 "{수량}{단위} · 현재가 {가격} 연동" / "직접 입력" · 뒤 기둥(오른쪽 맞춤)
 * 평가액 R13 → 등락 Delta → [매수] [매도] ghost small. 줄 자체는 누르지 않는다(웹 사용자 결정 — 수정은 머리 하나, 4-3A).
 */
export function HoldingRow({
  asset,
  holding,
  price,
  unitKrw,
  prevUnitKrw,
  live,
  priceFailed = false,
  pricesPending = false,
  onTrade,
}: {
  asset: Asset;
  holding: AssetHolding;
  /** 원표기 견적 — 라벨 표시용. 환산값은 아래 두 prop 으로 받는다. */
  price: { price: number; currency: string } | null;
  /** 1주 원화 환산가. 환율을 못 구했으면 null */
  unitKrw: number | null;
  /** 전일 종가의 원화 환산가. 없으면 등락을 감춘다 */
  prevUnitKrw: number | null;
  live: boolean;
  /** 시세 · 환율을 못 받았다 — 값을 기다리는 Skeleton 이 아니라 "—"(섹션 위 띠가 실패를 말한다, 단계 4) */
  priceFailed?: boolean;
  /** 시세를 받는 중이다 — 이때만 금액 자리가 Skeleton. 받았는데 이 종목이 없거나 종목 코드가 없으면 "—"(검수 2차 L3) */
  pricesPending?: boolean;
  onTrade?: (type: TradeType) => void;
}) {
  const { t } = useTranslation("asset");
  const m = useAssetMask("asset.detail", asset.isAmountHidden === "Y");
  const { data: masterName } = useStockSymbolName(
    holding.linked ? (holding.tossSymbol ?? "") : "",
  );
  const name = holding.linked
    ? (masterName ?? holding.tossSymbol ?? "")
    : (holding.holdingName ?? "");

  // 수량은 정밀도 때문에 문자열로 온다 — 표시·미리보기 계산에서만 숫자로 푼다(저장은 서버 몫).
  const qty = qtyNumber(holding.quantity) ?? 0;
  let value: number | null = null;
  let changePct: number | null = null;
  let priceLabel: string | null = null;
  if (holding.linked) {
    if (live && price) {
      if (unitKrw != null) value = Math.round(unitKrw * qty);
      // 통화를 하나로 가정하지 않는다 — 나무를 붙이며 JPY·HKD·CNY 가 들어왔다.
      priceLabel =
        price.currency === "KRW"
          ? money(price.price)
          : price.currency === "USD"
            ? `$${price.price.toLocaleString()}`
            : `${price.price.toLocaleString()} ${price.currency}`;
      if (unitKrw != null && prevUnitKrw != null && prevUnitKrw > 0) {
        changePct =
          Math.round(((unitKrw - prevUnitKrw) / prevUnitKrw) * 10000) / 100;
      }
    }
  } else {
    value = holding.holdingValue ?? 0;
  }

  // 수량 표기는 문자열을 그대로 다듬는다 — 코인은 8자리까지(0.00012345 BTC 가 0 으로 보이지 않게).
  const qtyLabel = formatQty(holding.quantity, holding.holdingType ?? "STOCK");
  // 미연동도 수량을 적어뒀으면 함께 보여준다 — 단위는 유형을 따른다(주/g/개).
  const manualQty =
    !holding.linked && qty > 0
      ? `${qtyLabel}${t(HOLDING_UNIT_KEY[holding.holdingType ?? "STOCK"])}`
      : null;
  const sub = holding.linked
    ? live && priceLabel
      ? t("holdings.linkedSub", { n: qtyLabel, price: priceLabel })
      : t("holdings.linkedPending", { n: qtyLabel })
    : manualQty
      ? `${manualQty} · ${t("holdings.manualSub")}`
      : t("holdings.manualSub");

  return (
    <ListItem
      align="top"
      title={name}
      detail={sub}
      suffix={
        <span className="flex min-w-0 flex-col items-end gap-x0_5">
          <span className="text-end text-t5 font-bold tabular-nums text-fg-neutral">
            {value != null ? withCommaBreaks(m(won(value))) : null}
            {value == null &&
              (holding.linked &&
              (!live ||
                priceFailed ||
                !holding.tossSymbol ||
                !pricesPending ||
                (price != null && unitKrw == null)) ? (
                "—"
              ) : (
                <Skeleton text="t5" className="w-x10" />
              ))}
          </span>
          {changePct != null && (
            <Delta
              direction={changePct >= 0 ? "up" : "down"}
              value={m(formatChangeRate(changePct, { sign: "none" }))}
              className="text-t3"
            />
          )}
          {onTrade && (
            <span className="-mr-x2 -mb-x1 flex">
              <Button
                type="button"
                variant="ghost"
                size="small"
                onClick={() => onTrade("BUY")}
              >
                {t("trade.entryBuy")}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="small"
                onClick={() => onTrade("SELL")}
              >
                {t("trade.entrySell")}
              </Button>
            </span>
          )}
        </span>
      }
    />
  );
}

/**
 * 거래 기록(I-17 50) — 있을 때만. 목록 제목 "거래 기록 · {n}" + List 줄: 제목 "{매수 | 매도} · {종목} {수량}" · 설명 날짜(+ 매도 실현손익) · 뒤 금액.
 * 줄 끝 ⋮ 는 두지 않는다(10-25 줄 끝 ⋮ 원칙) — 줄을 누르면 거래 기록 상세, 거기 바닥 왼쪽 [거래 취소] → 확인창. 취소하면 예수금 · 보유 수량 · 원가가 거래 전으로 돌아간다.
 */
export function TradeHistory({ asset }: { asset: Asset }) {
  const { t } = useTranslation("asset");
  const m = useAssetMask("asset.detail", asset.isAmountHidden === "Y");
  // 실패는 이 구역 자리에서 말한다 — 서버 원문 토스트는 끄고, 없는 것처럼 사라지지 않게
  const tradesQ = useAssetTrades(asset.rowId, { silent: true });
  const trades = tradesQ.data;
  const { t: tc } = useTranslation("common");
  // 줄을 누르면 거래 기록 상세(조회), 거기 바닥 왼쪽 [거래 취소] 가 확인창을 연다 — 한 번에 표면 하나
  const [openId, setOpenId] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  if (tradesQ.isError && !trades)
    return (
      <section data-slot="asset-detail-trades">
        <BandFailure
          title={tc("query.failedNamed", { name: t("trade.recordName") })}
          onRetry={() => void tradesQ.refetch()}
        />
      </section>
    );
  if (!trades || trades.length === 0) return null;
  const target = trades.find((tr) => tr.rowId === confirmDelete) ?? null;
  const opened = trades.find((tr) => tr.rowId === openId) ?? null;
  const titleId = `asset-trades-${asset.rowId}`;
  return (
    <section data-slot="asset-detail-trades" aria-labelledby={titleId}>
      <ListTitle id={titleId}>
        {t("trade.recordTitle")} · {trades.length}
      </ListTitle>
      <List aria-labelledby={titleId}>
        {trades.map((tr) => (
          <TradeRow
            key={tr.rowId}
            tr={tr}
            m={m}
            onOpen={() => setOpenId(tr.rowId)}
          />
        ))}
      </List>
      {opened && (
        <TradeDetailSurface
          trade={opened}
          mask={m}
          onClose={() => setOpenId(null)}
          onCancelTrade={() => {
            setOpenId(null);
            setConfirmDelete(opened.rowId);
          }}
        />
      )}
      {target && (
        <TradeCancelConfirm
          target={target}
          onClose={() => setConfirmDelete(null)}
        />
      )}
    </section>
  );
}

function TradeRow({
  tr,
  m,
  onOpen,
}: {
  tr: AssetTrade;
  m: (v: string) => string;
  onOpen: () => void;
}) {
  const { t } = useTranslation("asset");
  const label = useTradeLabel(tr);
  return (
    <ListButtonItem
      title={`${tr.tradeType === "SELL" ? t("trade.sell") : t("trade.buy")} · ${label.name} ${label.qty}`}
      detail={
        <>
          {tr.tradeDate.slice(0, 10)}
          {tr.realizedPl != null && tr.realizedPl !== 0 && (
            <>
              {" · "}
              {t("trade.realizedPreview")}{" "}
              {m(
                `${tr.realizedPl > 0 ? "+" : MINUS}${KRW(Math.abs(tr.realizedPl))}`,
              )}
            </>
          )}
        </>
      }
      suffix={
        <span className="text-end text-t5 font-bold tabular-nums text-fg-neutral">
          {withCommaBreaks(m(money(tr.amount)))}
        </span>
      }
      aria-label={t("trade.openRow", {
        name: label.name,
        date: tr.tradeDate.slice(0, 10),
      })}
      onClick={onOpen}
    />
  );
}

/** 거래 취소 확인 — 실패는 확인창을 닫고 critical 스낵바 + [다시 시도](요청 silent), 성공은 스낵바로 알린다 */
function TradeCancelConfirm({
  target,
  onClose,
}: {
  target: AssetTrade;
  onClose: () => void;
}) {
  const { t } = useTranslation("asset");
  const label = useTradeLabel(target);
  const deleteMut = useDeleteTrade();
  const confirmFail = useConfirmFail();
  const snackbar = useSnackbar();
  const done = () => snackbar.show({ message: t("trade.canceled") });
  return (
    <ConfirmDialog
      title={t("trade.deleteTitle")}
      message={t("trade.deleteConfirmTarget", {
        date: target.tradeDate.slice(0, 10),
        name: label.name,
        qty: label.qty,
        kind: target.tradeType === "SELL" ? t("trade.sell") : t("trade.buy"),
      })}
      confirmLabel={t("trade.deleteAction")}
      danger
      loading={deleteMut.isPending}
      onCancel={() => {
        if (!deleteMut.isPending) onClose();
      }}
      onConfirm={() =>
        deleteMut.mutateAsync(target.rowId).then(
          () => {
            onClose();
            done();
          },
          (error) => {
            onClose();
            confirmFail({
              error,
              message: t("trade.cancelFailed"),
              retry: () => deleteMut.mutateAsync(target.rowId),
              onRetried: done,
            });
          },
        )
      }
    />
  );
}

/** 보유 종목(I-17 50) — 목록 제목 "보유 종목 · {n}" + 보유 줄. 비면 R9 한 줄. 매수 · 매도는 거래 기록 시트(종목이 정해진 채) */
export function HoldingsSection({ asset }: { asset: Asset }) {
  const { t } = useTranslation("asset");
  // 매수·매도는 종목마다 연다 — 어떤 종목인지 정해진 채로 들어가야 다시 고를 일이 없다.
  const [trade, setTrade] = useState<{
    type: TradeType;
    holding: AssetHolding;
  } | null>(null);
  const { data: features } = useMyFeatures({ reference: true });
  const live =
    (features?.features?.includes("SECURITIES") ?? false) &&
    (features?.connectedBrokers?.length ?? 0) > 0;
  const hs = holdingsOf(asset);
  const symbols = useMemo(
    () => [
      ...new Set(
        hs
          .filter((h) => h.linked && h.tossSymbol)
          .map((h) => h.tossSymbol as string),
      ),
    ],
    [hs],
  );
  const active = live && symbols.length > 0;
  const activeSymbols = useMemo(
    () => (active ? symbols : []),
    [active, symbols],
  );
  // 증권사 무관 경로 + 통화별 환율. 목록(useInvestValuation)과 같은 훅이라 총액과
  // 종목별 금액이 한 화면에서 어긋나지 않는다.
  const prices = useLivePrices(activeSymbols, active);

  const titleId = `asset-holdings-${asset.rowId}`;
  return (
    <section data-slot="asset-detail-holdings" aria-labelledby={titleId}>
      <ListTitle id={titleId}>
        {t("holdings.sectionTitle")} · {hs.length}
      </ListTitle>
      {/* 시세를 못 받았다 — 예전에는 연동 줄 금액 Skeleton 이 끝없이 돌았다. 실패 + [다시 시도], 줄은 "—" · 받아 둔 값(단계 4) */}
      {prices.failedShows === "lastBalance" && (
        // 보이는 시세가 없다 — 그 자리 Result Section + [다시 시도], 연동 줄 금액은 "—"
        <PriceFailBand
          onRetry={prices.retry}
          retrying={prices.retrying}
          className="pb-x2"
        />
      )}
      {/* 받아 둔 시세가 있는 채 실패는 맨 위 금액 카드의 Callout 하나가 말한다(같은 실패에 하나 — 검수 2차 L5) */}
      {hs.length > 0 ? (
        <List aria-labelledby={titleId}>
          {hs.map((h, i) => (
            <HoldingRow
              key={h.rowId ?? `${h.tossSymbol ?? h.holdingName ?? ""}-${i}`}
              asset={asset}
              holding={h}
              price={
                h.linked && h.tossSymbol
                  ? (prices.quoteOf(h.tossSymbol) ?? null)
                  : null
              }
              unitKrw={
                h.linked && h.tossSymbol ? prices.unitKrw(h.tossSymbol) : null
              }
              prevUnitKrw={
                h.linked && h.tossSymbol
                  ? prices.prevUnitKrw(h.tossSymbol)
                  : null
              }
              live={live}
              priceFailed={prices.failed}
              pricesPending={prices.retrying}
              onTrade={(type) => setTrade({ type, holding: h })}
            />
          ))}
        </List>
      ) : (
        <p className="m-0 px-global-gutter py-x6 text-center text-t4 text-fg-neutral-subtle">
          {t("trade.noHolding")}
        </p>
      )}
      {trade && (
        <AssetTradeDialog
          asset={asset}
          holding={trade.holding}
          defaultType={trade.type}
          onClose={() => setTrade(null)}
        />
      )}
    </section>
  );
}
