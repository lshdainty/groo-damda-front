import { PriceFailBand } from "@/features/stock/ui/phone/price-fail-band";
import { Plus, Trash2 } from "lucide-react";
import { Badge } from "@/shared/ds/badge";
import { Button } from "@/shared/ds/button";
import { Input } from "@/shared/ds/input";
import { ListHeader } from "@/shared/ds/list";
import { Field } from "@/shared/ds/field";
import { AmountInput } from "@/shared/ui/groo/amount-input";
import { KRW, wonPrefix } from "@/shared/lib/groo/format";
import { MAX_BALANCE } from "@/shared/lib/groo/amount";
import {
  HOLDING_UNIT_KEY,
  HOLDING_TYPES,
  sanitizeQty,
  qtyNumber,
} from "@/entities/asset";
import { useStockSymbolName } from "@/features/stock/model/useStockMaster";
import { type EditHolding, nextHoldingKey } from "./form-lib";
import { StockAddButton } from "./StockAddButton";
import type { AssetForm } from "./use-asset-form";

/** 연동 항목 이름 — 저장돼 있던 항목은 심볼→마스터 이름 조회(캐시), 검색 추가분은 displayName. */
function LinkedHoldingName({ holding }: { holding: EditHolding }) {
  const { data: masterName } = useStockSymbolName(
    holding.displayName ? "" : (holding.tossSymbol ?? ""),
  );
  return <>{holding.displayName ?? masterName ?? holding.tossSymbol ?? ""}</>;
}

/**
 * 투자의 "보유 종목" 칸(I-17 16) — 머리(칸 이름 + 오른쪽 요약), 종목 추가 줄, 유형 묶음(주식 · 금 · 코인)별 보유 줄.
 * 보유 줄은 이름(연동 = 글 + "연동" Badge · 직접 = Input) · 수량 · 평가액(연동 = 읽기 전용 · 직접 = 금액 칸) · 매수원가 · 지우기.
 * 저장 본문의 보유 목록 계약(전체 교체 · sortOrder · 연동 · 직접 키)은 껍데기 handleSubmit 이 그대로 쥔다.
 */
export function HoldingsEditor({ f }: { f: AssetForm }) {
  const {
    t,
    tCommon,
    holdings,
    setHoldings,
    holdingValueOf,
    holdingsTotal,
    holdingsTotalUnknown,
    allowStock,
    manualAddTypes,
    isForeign,
    holdingPricesFailed,
    holdingPricesRetrying,
    retryHoldingPrices,
  } = f;
  // 보유 평가 · 매수원가는 외화 계좌에서도 원화다(I-13 길 A) — 칸은 "원" 그대로, 외화 계좌에만 칸 아래 안내
  const krwHint = isForeign ? t("holdings.krwInputHint") : undefined;
  const patch = (key: string, p: Partial<EditHolding>) =>
    setHoldings((prev) =>
      prev.map((x) => (x.key === key ? { ...x, ...p } : x)),
    );
  return (
    <Field
      label={t("holdings.sectionTitle")}
      headerAction={
        <span className="num font-sans text-t5 font-bold text-fg-neutral">
          {holdingsTotalUnknown
            ? // 시세를 모르는 연동 줄이 있으면 합계를 말하지 않는다(0 · 부분합 아님)
              t("holdings.editSummaryUnknown", { n: holdings.length })
            : t("holdings.editSummary", {
                n: holdings.length,
                total: KRW(holdingsTotal),
              })}
        </span>
      }
      description={
        holdings.length === 0
          ? allowStock
            ? t("holdings.editEmptyHelp")
            : t("holdings.editEmptyHelpManual")
          : undefined
      }
    >
      <div
        className="flex flex-col gap-x2"
        role="group"
        aria-label={t("holdings.sectionTitle")}
      >
        {/* 평가액 미리보기의 시세를 못 받았다 — 칸을 비워 두지 않고 그 자리 실패 + [다시 시도](B2a 분할 실패와 같은 꼴, 고정 글) */}
        {holdingPricesFailed && (
          <PriceFailBand
            band={false}
            onRetry={retryHoldingPrices}
            retrying={holdingPricesRetrying}
          />
        )}
        {/* 종목 추가 — 주식은 검색 시트, 금 · 코인은 검색 대상이 아니라 직접 추가로만 담는다(토스 · 마스터 모두 미제공).
          기관이 유형을 정하므로 증권사면 금 · 코인 단추가 없다. */}
        <div className="flex flex-wrap gap-x2">
          {allowStock && <StockAddButton f={f} />}
          {manualAddTypes.map((type) => (
            <Button
              key={type}
              type="button"
              variant="neutralOutline"
              size="small"
              onClick={() =>
                setHoldings((prev) => [
                  ...prev,
                  {
                    key: nextHoldingKey(),
                    holdingType: type,
                    linked: false,
                    holdingName: "",
                    holdingValue: 0,
                  },
                ])
              }
            >
              <Plus aria-hidden />
              {type === "GOLD"
                ? t("holdings.addGold")
                : t("holdings.addCrypto")}
            </Button>
          ))}
        </div>
        {holdings.length > 0 && (
          <div>
            {HOLDING_TYPES.map(({ type, labelKey }) => {
              const rows = holdings.filter((h) => h.holdingType === type);
              if (rows.length === 0) return null;
              return (
                <section key={type} aria-label={t(labelKey)}>
                  <div className="-mx-x6">
                    <ListHeader as="h3">{t(labelKey)}</ListHeader>
                  </div>
                  {rows.map((h) => {
                    const val = holdingValueOf(h);
                    const nameOf = h.linked ? undefined : (h.holdingName ?? "");
                    return (
                      <div
                        key={h.key}
                        data-slot="holding-row"
                        className="flex flex-col gap-x3 py-x3"
                      >
                        <div className="flex items-center gap-x2">
                          <div className="min-w-0 flex-1">
                            {h.linked ? (
                              <>
                                <div className="flex flex-wrap items-center gap-x2 font-sans text-t5 font-medium text-fg-neutral">
                                  <span className="min-w-0 break-keep">
                                    <LinkedHoldingName holding={h} />
                                  </span>
                                  <Badge variant="weak" tone="informative">
                                    {t("holdings.linkedBadge")}
                                  </Badge>
                                </div>
                                <div className="num font-sans text-t3 text-fg-neutral-subtle">
                                  {t("holdings.editLinkedSub")}
                                </div>
                              </>
                            ) : (
                              // 미연동은 이름도 고칠 수 있어야 한다 — 금·코인은 검색으로 이름을 받지 못한다.
                              <Input
                                aria-label={t("holdings.nameLabel")}
                                value={nameOf}
                                placeholder={t("holdings.namePlaceholder")}
                                onChange={(e) =>
                                  patch(h.key, { holdingName: e.target.value })
                                }
                              />
                            )}
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            ghostColor="neutralSubtle"
                            layout="iconOnly"
                            size="small"
                            aria-label={t("holdings.removeOf", {
                              name: h.linked
                                ? (h.displayName ?? h.tossSymbol ?? "")
                                : (h.holdingName ?? ""),
                            })}
                            onClick={() =>
                              setHoldings((prev) =>
                                prev.filter((x) => x.key !== h.key),
                              )
                            }
                          >
                            <Trash2 />
                          </Button>
                        </div>
                        <div className="grid grid-cols-2 gap-x-x4 gap-y-x3">
                          {/* 수량 — 연동은 필수(시세×수량), 미연동은 선택. 소수 허용(0.05 BTC·3.75g) */}
                          <Field label={t("holdings.quantity")}>
                            <Input
                              inputMode="decimal"
                              value={h.quantity ?? ""}
                              suffix={t(HOLDING_UNIT_KEY[h.holdingType])}
                              onChange={(e) =>
                                patch(h.key, {
                                  quantity: sanitizeQty(e.target.value),
                                })
                              }
                            />
                          </Field>
                          {/* 평가액 — 연동은 시세로 계산(읽기 전용), 미연동은 직접 입력 */}
                          <Field
                            label={t("holdings.value")}
                            description={h.linked ? undefined : krwHint}
                          >
                            {h.linked ? (
                              <Input
                                readOnly
                                value={val != null ? KRW(val) : "—"}
                                suffix={
                                  val != null ? tCommon("searchWon") : undefined
                                }
                              />
                            ) : (
                              <AmountInput
                                max={MAX_BALANCE}
                                value={
                                  h.holdingValue != null
                                    ? String(h.holdingValue)
                                    : ""
                                }
                                onValueChange={(v) =>
                                  patch(h.key, {
                                    holdingValue: parseInt(v, 10) || 0,
                                  })
                                }
                              />
                            )}
                          </Field>
                          {/* 매수원가 — 실현손익의 기준. 매수·매도로 쌓이지만
                            앱을 쓰기 전부터 갖고 있던 보유는 여기서 적어 넣어야 손익이 맞는다. */}
                          <Field
                            label={t("holdings.totalCost")}
                            description={
                              h.totalCost != null &&
                              h.totalCost > 0 &&
                              qtyNumber(h.quantity) ? (
                                <>
                                  {krwHint && (
                                    <span className="block">{krwHint}</span>
                                  )}
                                  {t("holdings.avgPriceInline", {
                                    avg: `${wonPrefix()}${KRW(
                                      Math.round(
                                        h.totalCost /
                                          (qtyNumber(h.quantity) || 1),
                                      ),
                                    )}`,
                                  })}
                                </>
                              ) : (
                                krwHint
                              )
                            }
                            className="col-span-2"
                          >
                            <AmountInput
                              max={MAX_BALANCE}
                              value={
                                h.totalCost != null ? String(h.totalCost) : ""
                              }
                              onValueChange={(v) =>
                                patch(h.key, {
                                  totalCost: parseInt(v, 10) || 0,
                                })
                              }
                            />
                          </Field>
                        </div>
                      </div>
                    );
                  })}
                </section>
              );
            })}
          </div>
        )}
      </div>
    </Field>
  );
}
