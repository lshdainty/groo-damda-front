import { useMemo, useState } from "react";
import { AssetTradeDialog } from "../AssetTradeDialog";
import { useAssetTrades, useDeleteTrade } from "@/features/asset";
import type { TradeType } from "@/entities/asset";
import { useTranslation } from "react-i18next";
import { Trash2 } from "lucide-react";
import {
  HOLDING_UNIT_KEY,
  formatQty,
  qtyNumber,
  type Asset,
  type AssetHolding,
} from "@/entities/asset";
import { holdingsOf } from "@/features/asset";
import { useLivePrices } from "@/features/stock/model/useLivePrices";
import { useMyFeatures } from "@/features/subscription/model/useSubscription";
import { useStockSymbolName } from "@/features/stock/model/useStockMaster";
import { ConfirmDialog } from "@/shared/ui/groo/dialogs";
import { Button } from "@/shared/ui/button";
import { KRW, formatChangeRate } from "@/shared/lib/groo/format";
import { MaskAmount, WonUnit } from "@/shared/lib/groo/hide-amounts";
import { wonPre } from "@/shared/lib/groo/hide-amounts-core";

// ---------------------------------------------------------------------------
// 투자 상세 — 보유 종목 리스트 (design dialogs.jsx split24 AssetDetailDialog invest 분기 미러)
//   연동(linked) 항목: 종목명 · "N주 · 현재가 X 연동" · 평가액 · 등락%
//   수동(manual) 항목: 이름 · "직접 입력" · 평가액
//   행 클릭 → 편집 다이얼로그(종목 추가/수정은 편집에서).
// ---------------------------------------------------------------------------
export function HoldingRow({
  holding,
  price,
  unitKrw,
  prevUnitKrw,
  live,
  first,
  onTrade,
}: {
  holding: AssetHolding;
  /** 원표기 견적 — 라벨 표시용. 환산값은 아래 두 prop 으로 받는다. */
  price: { price: number; currency: string } | null;
  /** 1주 원화 환산가. 환율을 못 구했으면 null */
  unitKrw: number | null;
  /** 전일 종가의 원화 환산가. 없으면 등락을 감춘다 */
  prevUnitKrw: number | null;
  live: boolean;
  first: boolean;
  onTrade?: (type: TradeType) => void;
}) {
  const { t } = useTranslation("asset");
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
          ? `${KRW(price.price)}원`
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

  // 행 자체는 누르는 자리가 아니다. 종목을 고치는 건 하단 [수정] 로만 들어간다 —
  // 매수·매도 버튼 옆에서 행을 누르면 편집이 열려, 어디를 눌렀는지에 따라 다른 일이
  // 벌어졌다. 앱도 버튼 둘만 두고 편집은 하단에서 받는다(사용자 결정).
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "12px 0",
        borderTop: first ? "none" : "1px solid var(--border-subtle)",
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: "var(--text-label-sm)",
            fontWeight: 600,
            letterSpacing: "-0.01em",
          }}
        >
          {name}
        </div>
        <div
          className="num"
          style={{
            fontSize: "var(--text-badge)",
            color: "var(--fg-tertiary)",
            marginTop: 2,
          }}
        >
          {sub}
        </div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div
          className="num"
          style={{ fontSize: "var(--text-label-sm)", fontWeight: 700 }}
        >
          {value != null ? (
            <>
              <MaskAmount card="asset.detail">
                {wonPre()}
                {KRW(value)}
              </MaskAmount>
              <WonUnit card="asset.detail" />
            </>
          ) : (
            "—"
          )}
        </div>
        {changePct != null && (
          <div
            className="num"
            style={{
              fontSize: "var(--text-badge)",
              fontWeight: 600,
              marginTop: 2,
              color:
                changePct >= 0 ? "var(--status-danger-fg)" : "var(--fg-brand)",
            }}
          >
            {formatChangeRate(changePct, { sign: "always" })}
          </div>
        )}
      </div>
      {/* 매수·매도 — 이 종목에 대한 사건. 종목이 정해진 자리라 다시 고를 필요가 없다.
          brand 색을 빼고 본문 톤으로 둔다 — 행마다 파란 글씨 둘이 서면 금액보다 먼저
          눈에 들어와, 정작 봐야 할 평가액이 뒤로 밀린다(앱 정합). */}
      {onTrade && (
        <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
          <Button variant="ghost" size="xs" onClick={() => onTrade("BUY")}>
            {t("trade.entryBuy")}
          </Button>
          <Button variant="ghost" size="xs" onClick={() => onTrade("SELL")}>
            {t("trade.entrySell")}
          </Button>
        </div>
      )}
    </div>
  );
}

/**
 * 거래 내역 — 매수·매도가 언제 얼마에 있었는지. 실현손익도 함께 보여 준다.
 * 취소하면 예수금·보유 수량·원가가 거래 전으로 되돌아간다.
 */
export function TradeHistory({ assetRowId }: { assetRowId: number }) {
  const { t } = useTranslation("asset");
  const { data: trades } = useAssetTrades(assetRowId);
  const deleteMut = useDeleteTrade();
  // 브라우저 confirm 은 앱 테마를 안 따르고 문구도 못 꾸민다 — 프로젝트 다이얼로그를 쓴다.
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  if (!trades || trades.length === 0) {
    return null;
  }
  return (
    <div style={{ marginTop: 14 }}>
      <h3
        style={{
          fontSize: "var(--text-label-sm)",
          fontWeight: 700,
          margin: "0 0 6px",
        }}
      >
        {t("trade.history")}
      </h3>
      {trades.map((tr) => (
        <div
          key={tr.rowId}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 0",
            borderBottom: "1px solid var(--border-subtle)",
          }}
        >
          <span
            style={{
              fontSize: "var(--text-badge)",
              fontWeight: 700,
              color:
                tr.tradeType === "SELL"
                  ? "var(--fg-brand)"
                  : "var(--status-danger-fg)",
            }}
          >
            {tr.tradeType === "SELL" ? t("trade.sell") : t("trade.buy")}
          </span>
          <span
            className="truncate"
            style={{ fontSize: "var(--text-body-sm)", minWidth: 0, flex: 1 }}
          >
            {tr.holdingKey}
          </span>
          <span
            className="num"
            style={{
              fontSize: "var(--text-badge)",
              color: "var(--fg-tertiary)",
            }}
          >
            {tr.quantity} · {tr.tradeDate.slice(0, 10)}
          </span>
          <span
            className="num"
            style={{ fontSize: "var(--text-body-sm)", fontWeight: 700 }}
          >
            {KRW(tr.amount)}원
          </span>
          {tr.realizedPl != null && tr.realizedPl !== 0 && (
            <span
              className="num"
              style={{
                fontSize: "var(--text-badge)",
                fontWeight: 700,
                color:
                  tr.realizedPl > 0 ? "var(--fg-income)" : "var(--fg-expense)",
              }}
            >
              {tr.realizedPl > 0 ? "+" : "−"}
              {KRW(Math.abs(tr.realizedPl))}
            </span>
          )}
          <Button
            variant="ghost"
            size="xs"
            aria-label={t("trade.deleted")}
            onClick={() => setConfirmDelete(tr.rowId)}
          >
            <Trash2 size={13} />
          </Button>
        </div>
      ))}

      {confirmDelete != null && (
        <ConfirmDialog
          title={t("trade.deleteTitle")}
          message={t("trade.deleteConfirm")}
          confirmLabel={t("trade.deleteAction")}
          danger
          loading={deleteMut.isPending}
          onCancel={() => setConfirmDelete(null)}
          onConfirm={() =>
            deleteMut.mutate(confirmDelete, {
              onSuccess: () => {
                setConfirmDelete(null);
              },
            })
          }
        />
      )}
    </div>
  );
}

export function HoldingsSection({
  asset,
  mobile,
}: {
  asset: Asset;
  mobile: boolean;
}) {
  const { t } = useTranslation("asset");
  // 매수·매도는 종목마다 연다 — 어떤 종목인지 정해진 채로 들어가야 다시 고를 일이 없다.
  const [trade, setTrade] = useState<{
    type: TradeType;
    holding: AssetHolding;
  } | null>(null);
  const { data: features } = useMyFeatures();
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

  return (
    <div
      style={{
        borderTop: "1px solid var(--border-subtle)",
        padding: "14px 0 6px",
        marginBottom: 12,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <h2
          style={{
            fontSize: "var(--text-label-md)",
            fontWeight: 700,
            margin: 0,
          }}
        >
          {t("holdings.sectionTitle")}{" "}
          <span className="num" style={{ color: "var(--fg-brand)" }}>
            {hs.length}
          </span>
        </h2>
      </div>
      {hs.map((h, i) => (
        <HoldingRow
          key={h.rowId ?? `${h.tossSymbol ?? h.holdingName ?? ""}-${i}`}
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
            h.linked && h.tossSymbol ? prices.prevUnitKrw(h.tossSymbol) : null
          }
          live={live}
          first={i === 0}
          onTrade={(type) => setTrade({ type, holding: h })}
        />
      ))}
      {hs.length === 0 && (
        <div
          style={{
            padding: "20px 0",
            fontSize: "var(--text-label-sm)",
            color: "var(--fg-tertiary)",
            textAlign: "center",
          }}
        >
          {t("holdings.emptyDetail")}
        </div>
      )}

      {/* 거래 내역 — 언제 사고 팔았는지, 얼마가 남았는지. 취소도 여기서. */}
      <TradeHistory assetRowId={asset.rowId} />

      {trade && (
        <AssetTradeDialog
          asset={asset}
          holding={trade.holding}
          defaultType={trade.type}
          mobile={mobile}
          onClose={() => setTrade(null)}
        />
      )}
    </div>
  );
}
