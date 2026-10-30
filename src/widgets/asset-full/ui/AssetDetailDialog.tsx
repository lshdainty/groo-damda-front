import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ChevronRight, Eye, EyeOff } from "lucide-react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { AssetLogo, type Asset } from "@/entities/asset";
import { isRefundedTx } from "@/entities/expense";
import {
  useAssetBalanceTrend,
  useAssets,
  holdingsOf,
  useUpdateAsset,
} from "@/features/asset";
import { ModalShell } from "@/shared/ui/groo/dialogs";
import { ModalViewFooter } from "@/shared/ui/groo/modal-footer";
import { Button } from "@/shared/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import { ExpenseRow } from "@/entities/expense";
import { TransferRow } from "@/entities/asset";
import {
  ChartContainer,
  ChartTooltip,
  type ChartConfig,
} from "@/shared/ui/chart";
import {
  KRW,
  formatChartAxis,
  isEn,
  formatDay,
  formatChangeRate,
} from "@/shared/lib/groo/format";
import { useAxisWidth } from "@/shared/lib/groo/axisWidth";
import { DateGroupHeader } from "@/shared/ui/date-group-header";
import { niceAxis } from "@/shared/lib/groo/chartAxis";
import { getPaletteByColor } from "@/shared/lib/groo/chart-palette";
import { assetTypeLabel } from "@/entities/asset";
import {
  HideForce,
  HideUnit,
  MaskAmount,
} from "@/shared/lib/groo/hide-amounts";
import { wonPre, useHideAmounts } from "@/shared/lib/groo/hide-amounts-core";
import { HideAmountsUnlockDialog } from "@/widgets/account-settings/ui/HideAmountsUnlockDialog";
import { Skeleton as SkeletonBase } from "@/shared/ui/skeleton";
import { BalanceTooltip } from "./detail/BalanceTooltip";
import { groupOf } from "./detail/detail-shared";
import { CardPerfBadge } from "./detail/CardPerfBadge";
import { CardDetailBody } from "./detail/CardDetailBody";
import { HoldingsSection } from "./detail/HoldingsSection";
import {
  useAssetLiveValuation,
  useAssetLedger,
} from "./detail/use-asset-detail";

export function AssetDetailDialog({
  asset: assetProp,
  onClose,
  onEdit,
  onDelete,
  mobile,
}: {
  asset: Asset;
  onClose: () => void;
  onEdit?: (asset: Asset) => void;
  /**
   * 삭제 — 자산을 지울 수 있는 화면만 넘긴다(계좌·카드 관리). 자산 페이지처럼
   * 훑어보는 상세에서 켜면 목록으로 돌아갈 수도 없는 자리에서 자산이 사라진다.
   * 데스크탑은 `leftSlot`(금액 가리기)이 좌측을 쥐고 목록 행에 삭제 아이콘이 있어
   * 모바일에서만 그린다.
   */
  onDelete?: (asset: Asset) => void;
  mobile: boolean;
}) {
  const { t } = useTranslation("asset");
  const { t: tc } = useTranslation("common");
  // 여는 쪽은 클릭 시점의 asset 을 상태에 박아 넘긴다 — 열려 있는 동안 매수·취소가
  // 일어나면 리스트 쿼리는 새 값인데 prop 은 옛 스냅샷이라 수량·평가액이 낡은 채
  // 남는다. 같은 자산을 쿼리에서 다시 찾아 산 값을 쓴다.
  const { data: liveAssets } = useAssets();
  const asset =
    liveAssets?.assets.find((a) => a.rowId === assetProp.rowId) ?? assetProp;
  const navigate = useNavigate();
  // 이 자산만 가려 둔 경우도 함께 본다 — 화면 카드와 합집합이다.
  const assetHidden = asset.isAmountHidden === "Y";
  const hidden = useHideAmounts("asset.detail") || assetHidden;

  // footer 버튼은 **이 자산**을 켜고 끈다(예전엔 설정 화면으로 보내기만 했다).
  // 그래서 라벨·아이콘은 화면 상태(`hidden`)가 아니라 **자산 플래그**를 따른다 —
  // 카드로 가려진 상태에서 "금액 표시" 라고 적어 놓으면 눌러도 안 보여 고장으로 읽힌다.
  const updateAsset = useUpdateAsset();
  const [unlockOpen, setUnlockOpen] = useState(false);
  const applyHidden = (next: "Y" | "N") =>
    updateAsset.mutate({
      id: asset.rowId,
      // 이름·종류를 함께 싣는 건 폼 타입이 필수로 요구해서다. 서버 PUT 은 "키가 없으면
      // 유지" 라 굳이 보낼 필요는 없지만, **지금 값 그대로** 보내므로 아무것도 안 바뀐다.
      data: {
        assetName: asset.assetName,
        assetType: asset.assetType,
        isAmountHidden: next,
      },
    });
  const handleHideToggle = () => {
    // 켜는 건 그냥, 푸는 건 본인 확인을 거친다 — 카드 가리기와 같은 규칙
    // (`HideAmountsSection`). 잠그는 쪽에 마찰을 두면 아무도 안 쓴다.
    if (assetHidden) setUnlockOpen(true);
    else applyHidden("Y");
  };

  const group = groupOf(asset);
  const isCard = group === "card";
  const isInv = group === "invest";

  // 차트 기간: 3m/6m/1y → 12/24/52주
  const [period, setPeriod] = useState<"3m" | "6m" | "1y">("3m");
  const weeks = period === "3m" ? 12 : period === "6m" ? 24 : 52;
  const { data: trendData, isLoading: trendLoading } = useAssetBalanceTrend(
    asset.rowId,
    weeks,
  );
  const chartData = useMemo(
    () =>
      (trendData ?? []).map((p, i) => ({
        label: t("assetDetail.weekLabel", { n: i + 1 }),
        weekStart: p.weekStart,
        balance: p.balance,
      })),
    [trendData, t],
  );
  // Y축: 0기준 nice 눈금 (앱 asset_detail niceAxis 정합). 음수 잔액(대출)도 0 아래로 확장.
  const yAxis = useMemo(() => {
    const vals = chartData.map((d) => d.balance);
    return niceAxis(Math.min(0, ...vals), Math.max(0, ...vals));
  }, [chartData]);
  const yAxisWidth = useAxisWidth(
    yAxis.ticks.map((v) => (hidden ? "••••" : formatChartAxis(v))),
  );
  // 툴팁 자리 — recharts 는 눈금 폭을 뺀 그리는 자리 안에만 가두는데, 글자 크기가 커지면 그 자리가
  // 툴팁보다 좁아져 오른쪽이 잘렸다. 차트 상자 전체 안으로 좌우를 밀어 넣는다(chart.md 툴팁: 화면 끝에서 안으로).
  const chartBoxRef = useRef<HTMLDivElement>(null);
  const [tipX, setTipX] = useState<number | undefined>(undefined);
  const placeTip = (s: { activeCoordinate?: { x: number } }) => {
    const box = chartBoxRef.current;
    const cx = s.activeCoordinate?.x;
    if (!box || cx == null) return;
    const tip = box.querySelector<HTMLElement>(".recharts-tooltip-wrapper > *");
    const w = box.clientWidth;
    const tw = tip?.offsetWidth ?? 0;
    let x = cx + 12;
    if (x + tw > w) x = cx - 12 - tw;
    setTipX(Math.max(0, Math.min(x, w - tw)));
  };
  const periodLabel =
    period === "3m"
      ? t("assetDetail.weekLabel", { n: 12 })
      : period === "6m"
        ? t("assetDetail.weekLabel", { n: 24 })
        : t("assetDetail.weekLabel", { n: 52 });
  const seriesLabel = isCard
    ? t("assetDetail.seriesUsage")
    : isInv
      ? t("assetDetail.seriesValuation")
      : t("assetDetail.seriesBalance");

  const color = getPaletteByColor(asset.color).color;
  const chartConfig: ChartConfig = {
    balance: { label: seriesLabel, color },
  };

  /**
   * 헤드라인 금액 — 카드만 절대값이다.
   *
   * <p>카드 잔액은 <b>미결제 사용액이 음수</b>라는 규약이라, 화면에는 "얼마 썼나" 로 뒤집어
   * 보여 준다. 그 밖의 자산은 음수가 정상 상태다 — 마이너스 통장, 잔액을 실제와 맞추지
   * 않은 계좌, 지출이 잔고를 넘긴 현금. 여기서 abs() 를 씌우면 −5,000 이 "5,000원" 으로
   * 보여 목록·편집 폼과 어긋난다.
   */
  const heroBalance = isCard ? Math.abs(asset.balance) : asset.balance;

  // 투자 자산 — holdings 라이브 평가(시세×수량+수동합)로 헤로 금액을 덮어쓰고 등락 표시.
  const investVal = useAssetLiveValuation(asset, isInv);

  // 라이브 평가는 '보유분'만 — 예수금을 더해야 계좌 총액이다.
  const investCash = isInv ? (asset.cashBalance ?? 0) : 0;
  const investHolding =
    investVal != null ? investVal.value : (asset.holdingBalance ?? 0);
  // CREDIT_CARD 는 신판 카드 상세 본문(CardDetailBody) — 회차 히어로가 금액을 담당.
  const isCredit = asset.assetType === "CREDIT_CARD";
  // 연결계좌형 체크카드 — 결제가 계좌에서 즉시 빠져 잔액이 늘 0 이다. 히어로는 잔액 대신
  // "이번 달 사용액"(서버 계산 당월 합계), 내역은 당월 1일~말일 전체를 보여준다(사용자 결정).
  // 미연결 체크카드는 잔액이 실제로 쌓이므로 일반 계좌처럼 잔액·최근 내역 그대로다.
  const isCheckLinked =
    asset.assetType === "CHECK_CARD" && asset.paymentAssetRowId != null;
  // 투자도 예수금이 마이너스일 수 있다(기록용 앱이라 막지 않는다) — 부호를 살린다.
  const heroAmount =
    investVal != null
      ? investCash + investVal.value
      : isCheckLinked
        ? (asset.monthlyUsedAmount ?? 0)
        : heroBalance;

  const { relatedLoading, relatedItems, relatedGroups } = useAssetLedger(
    asset,
    isCheckLinked,
  );

  const title = isCard
    ? t("assetDetail.titleCard")
    : isInv
      ? t("assetDetail.titleInvest")
      : t("assetDetail.titleAccount");
  const valueLabel = isCheckLinked
    ? t("assetDetail.valueCheckCard")
    : isCard
      ? t("assetDetail.valueCard")
      : isInv
        ? t("assetDetail.seriesValuation")
        : t("assetDetail.seriesBalance");

  const viewAll = () => {
    onClose();
    navigate(`/desk/expense?assetId=${asset.rowId}`);
  };

  // 모바일은 [삭제][수정](spec drawer.md: 상세 = 삭제·수정). 금액 가리기는 카드
  // 우상단 눈 버튼과 계정 > 보안에도 있어 여기서 뺀다. 데스크탑·태블릿은 [금액 가리기][수정] 이고,
  // 관리 화면에서 열었으면(onDelete) 목록 줄에 연필 · 휴지통 · ⋮ 를 두지 않으므로(좁은 줄 ⋮ 원칙, 10-25)
  // 지우는 길이 여기 [삭제] 다. 상세가 페이지가 되는 17-3 에서 머리 ⋯ 로 옮겨 간다.
  const Footer = (
    <ModalViewFooter
      leftSlot={
        mobile ? undefined : (
          <div className="flex items-center gap-x2">
            {/* 아이콘을 본문 콘텐츠 열에 맞춘다 — flush ghost 는 텍스트 버튼이라 hover 에
              배경 없이 글자색으로만 반응한다(spec button.md Edge flush · dialog.md footer). */}
            <Button
              variant="ghost"
              flush="left"
              onClick={handleHideToggle}
              type="button"
            >
              {assetHidden ? <Eye size={16} /> : <EyeOff size={16} />}
              {assetHidden
                ? t("assetDetail.showAmounts")
                : t("assetDetail.hideAmounts")}
            </Button>
            {onDelete && (
              <Button
                variant="dangerSoft"
                type="button"
                onClick={() => onDelete(asset)}
              >
                {tc("delete")}
              </Button>
            )}
          </div>
        )
      }
      onDelete={mobile && onDelete ? () => onDelete(asset) : undefined}
      onEdit={onEdit ? () => onEdit(asset) : undefined}
    />
  );

  return (
    <>
      {/* 이 자산이 숨김이면 상세 안의 금액을 전부 가린다 — 히어로·예수금·카드 청구·
        할부·보유종목이 하위 컴포넌트에 흩어져 있어 자리마다 force= 를 달면 새기 쉽다. */}
      <HideForce value={assetHidden}>
        <ModalShell
          title={title}
          onClose={onClose}
          size="lg"
          footer={Footer}
          mobile={mobile}
        >
          {/* Hero — 플랫(design 신판): 이름 행 + 구분선 + 잔액. 신용카드는 이름 행만
          (회차 히어로가 금액 담당 — CardDetailBody). */}
          <div style={{ marginBottom: isCredit ? 0 : 18 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                paddingBottom: 14,
                marginBottom: isCredit ? 0 : 14,
                borderBottom: isCredit
                  ? "none"
                  : "1px solid var(--border-subtle)",
              }}
            >
              <AssetLogo asset={asset} size={48} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: "var(--text-body-lg)",
                    fontWeight: "700",
                    letterSpacing: "-0.012em",
                  }}
                >
                  {asset.assetName}
                </div>
                <div
                  style={{
                    fontSize: "var(--text-label-sm)",
                    color: "var(--fg-tertiary)",
                    marginTop: 2,
                  }}
                >
                  {/* 투자 — design: "투자 · 보유 N종목 · 메모" */}
                  {isInv
                    ? [
                        assetTypeLabel(asset.assetType, asset.balance),
                        t("holdings.countLabel", {
                          n: holdingsOf(asset).length,
                        }),
                        asset.memo,
                      ]
                        .filter(Boolean)
                        .join(" · ")
                    : [
                        asset.institution,
                        assetTypeLabel(asset.assetType, asset.balance),
                        asset.memo,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                </div>
              </div>
            </div>
            {!isCredit && (
              <>
                <div
                  style={{
                    fontSize: "var(--text-badge)",
                    color: "var(--fg-tertiary)",
                    fontWeight: "600",
                    letterSpacing: "0.04em",
                    marginBottom: 4,
                  }}
                >
                  {valueLabel}
                </div>
                <div
                  className="num"
                  style={{
                    fontSize: "var(--text-display-md)",
                    fontWeight: "800",
                    letterSpacing: "-0.022em",
                    color: "var(--fg-primary)",
                  }}
                >
                  <MaskAmount card="asset.detail">
                    {heroAmount < 0 ? "−" : ""}
                    {wonPre()}
                    {KRW(heroAmount, { abs: true })}
                  </MaskAmount>
                  {!isEn() && (
                    <HideUnit>
                      <span
                        style={{
                          fontSize: "var(--text-body-lg)",
                          marginLeft: 2,
                        }}
                      >
                        원
                      </span>
                    </HideUnit>
                  )}
                </div>
                {/* 예수금·평가금액 — 실제 증권 계좌처럼 나눠 보여 준다(예수금이 있을 때만). */}
                {isInv && investCash !== 0 && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      marginTop: 8,
                      fontSize: "var(--text-label-sm)",
                      color: "var(--fg-tertiary)",
                    }}
                  >
                    <span className="num">
                      {t("holdings.cashBalance")}{" "}
                      <MaskAmount card="asset.detail">
                        {KRW(investCash)}
                      </MaskAmount>
                    </span>
                    <span className="dot-sep" />
                    <span className="num">
                      {t("holdings.holdingBalance")}{" "}
                      <MaskAmount card="asset.detail">
                        {KRW(investHolding)}
                      </MaskAmount>
                    </span>
                  </div>
                )}

                {/* 투자 등락 — design: "+N% · 오늘 ±N원" (+빨강/−파랑 국내 통념) */}
                {investVal?.changePct != null && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      marginTop: 8,
                      fontSize: "var(--text-label-sm)",
                    }}
                  >
                    <span
                      className="num"
                      style={{
                        fontWeight: 700,
                        color:
                          investVal.changePct >= 0
                            ? "var(--status-danger-fg)"
                            : "var(--fg-brand)",
                      }}
                    >
                      {formatChangeRate(investVal.changePct, {
                        sign: "always",
                      })}
                    </span>
                    {investVal.changeAmt != null && (
                      <span
                        className="num"
                        style={{ color: "var(--fg-tertiary)" }}
                      >
                        {t("holdings.todayChange", {
                          sign: investVal.changeAmt >= 0 ? "+" : "−",
                          amount: KRW(Math.abs(investVal.changeAmt)),
                        })}
                      </span>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {/* 보유 종목 — design invest 상세: 연동/수동 항목 리스트 (행 클릭 → 편집) */}
          {/* 종목 수정은 하단 [수정] 로만 — 목록 행은 매수·매도 버튼만 받는다. */}
          {isInv && <HoldingsSection asset={asset} mobile={mobile} />}

          {/* 신용카드 — 신판 카드 상세 본문(회차·한도·실적·이용 내역 일체) */}
          {isCredit && (
            <CardDetailBody
              asset={asset}
              mobile={mobile}
              onEdit={onEdit ? () => onEdit(asset) : undefined}
            />
          )}

          {/* 체크카드 — 실적 배지만(청구 회차 없음) */}
          {isCard && !isCredit && (
            <div style={{ marginBottom: 18 }}>
              <CardPerfBadge assetRowId={asset.rowId} />
            </div>
          )}

          {!isCredit && (
            <>
              {/* Balance trend chart — 연결계좌형 체크카드는 잔액이 늘 0 이라 평평한 0 선뿐이다.
          차트만 빼고 내역은 그대로 둔다. */}
              {!isCheckLinked && (
                <div style={{ marginBottom: 18 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      marginBottom: 10,
                    }}
                  >
                    <h4
                      style={{
                        fontSize: "var(--text-label-sm)",
                        fontWeight: "700",
                        margin: 0,
                      }}
                    >
                      {t("assetDetail.recentTrend", {
                        period: periodLabel,
                        label: isCard
                          ? t("assetDetail.trendUsage")
                          : isInv
                            ? t("assetDetail.trendValuation")
                            : t("assetDetail.trendBalance"),
                      })}
                    </h4>
                    <Tabs
                      value={period}
                      onValueChange={(v) => setPeriod(v as "3m" | "6m" | "1y")}
                      className="ml-auto"
                    >
                      <TabsList variant="pill" size="sm">
                        <TabsTrigger value="3m">
                          {t("assetDetail.period3m")}
                        </TabsTrigger>
                        <TabsTrigger value="6m">
                          {t("assetDetail.period6m")}
                        </TabsTrigger>
                        <TabsTrigger value="1y">
                          {t("assetDetail.period1y")}
                        </TabsTrigger>
                      </TabsList>
                    </Tabs>
                  </div>
                  {trendLoading ? (
                    <SkeletonBase className="h-[160px] w-full rounded-md" />
                  ) : chartData.length === 0 ? (
                    <div
                      style={{
                        height: 160,
                        background: "var(--bg-sunken)",
                        borderRadius: "var(--radius-tile)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "var(--fg-tertiary)",
                        fontSize: "var(--text-label-sm)",
                      }}
                    >
                      {t("assetDetail.noData")}
                    </div>
                  ) : (
                    <div ref={chartBoxRef}>
                      <ChartContainer
                        config={chartConfig}
                        className="aspect-auto w-full"
                        style={{ height: 160 }}
                      >
                        <AreaChart
                          data={chartData}
                          onMouseMove={placeTip}
                          onMouseLeave={() => setTipX(undefined)}
                          margin={{ top: 10, right: 12, left: 0, bottom: 4 }}
                        >
                          <defs>
                            <linearGradient
                              id={`asset-balance-fill-${asset.rowId}`}
                              x1="0"
                              y1="0"
                              x2="0"
                              y2="1"
                            >
                              <stop
                                offset="0%"
                                stopColor="var(--color-balance)"
                                stopOpacity={0.28}
                              />
                              <stop
                                offset="100%"
                                stopColor="var(--color-balance)"
                                stopOpacity={0}
                              />
                            </linearGradient>
                          </defs>
                          <CartesianGrid
                            vertical={false}
                            stroke="var(--border-subtle)"
                            strokeDasharray="3 3"
                          />
                          <XAxis
                            dataKey="label"
                            tickLine={false}
                            axisLine={false}
                            tick={{
                              fontSize: "var(--text-badge)",
                              fill: "var(--fg-tertiary)",
                            }}
                            tickMargin={6}
                            interval="preserveStartEnd"
                            minTickGap={18}
                          />
                          <YAxis
                            tickLine={false}
                            axisLine={false}
                            domain={[yAxis.min, yAxis.max]}
                            ticks={yAxis.ticks}
                            // 금액 숨기기 시 Y축도 마스킹 (앱 정합 — '••••' 4점)
                            tickFormatter={(v: number) =>
                              hidden ? "••••" : formatChartAxis(v)
                            }
                            tick={{
                              fontSize: "var(--text-badge)",
                              fill: "var(--fg-tertiary)",
                            }}
                            width={yAxisWidth}
                          />
                          <ChartTooltip
                            cursor={{
                              stroke: "var(--fg-tertiary)",
                              strokeWidth: 1,
                              strokeDasharray: "3 3",
                            }}
                            position={tipX == null ? undefined : { x: tipX }}
                            allowEscapeViewBox={{ x: true }}
                            content={
                              <BalanceTooltip seriesLabel={seriesLabel} />
                            }
                          />
                          <Area
                            type="monotone"
                            dataKey="balance"
                            stroke="var(--color-balance)"
                            strokeWidth={2}
                            fill={`url(#asset-balance-fill-${asset.rowId})`}
                            dot={{
                              r: 4,
                              fill: "var(--color-balance)",
                              stroke: "var(--bg-surface)",
                              strokeWidth: 1.5,
                            }}
                            activeDot={{
                              r: 5.5,
                              fill: "var(--color-balance)",
                              stroke: "var(--bg-surface)",
                              strokeWidth: 2,
                            }}
                          />
                        </AreaChart>
                      </ChartContainer>
                    </div>
                  )}
                </div>
              )}

              {/* Recent tx */}
              <div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    marginBottom: 8,
                  }}
                >
                  <h4
                    style={{
                      fontSize: "var(--text-label-sm)",
                      fontWeight: "700",
                      margin: 0,
                    }}
                  >
                    {isCheckLinked
                      ? t("assetDetail.monthTx")
                      : t("assetDetail.recentTx")}
                    {relatedItems.length > 0 ? ` (${relatedItems.length})` : ""}
                  </h4>
                  <button
                    type="button"
                    className="all"
                    style={{
                      marginLeft: "auto",
                      background: "transparent",
                      border: 0,
                      color: "var(--fg-secondary)",
                      cursor: "pointer",
                      fontSize: "var(--text-label-sm)",
                      fontWeight: "600",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 2,
                    }}
                    onClick={viewAll}
                  >
                    {t("assetDetail.viewAll")} <ChevronRight size={12} />
                  </button>
                </div>
                {/* 가계부 메인 리스트 미러 — 카드 제거, 날짜 그룹 헤더 + 플랫 행 */}
                {relatedLoading ? (
                  // 실렌더와 같은 날짜 그룹 구조 — 그룹 gap 16, 행은 LedgerRow(py-3, 칩 40).
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 16,
                    }}
                  >
                    {[0, 1].map((g) => (
                      <div key={g}>
                        {/* DateGroupHeader 자리 — 날짜 + 요일 + 우측 일 합계 */}
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                          }}
                        >
                          <SkeletonBase className="h-4 w-12" />
                          <SkeletonBase className="h-4 w-8" />
                          <SkeletonBase className="h-4 w-16 ml-auto" />
                        </div>
                        {[0, 1].map((i) => (
                          <div
                            key={i}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 12,
                              padding: "12px 4px",
                            }}
                          >
                            <SkeletonBase className="h-10 w-10 rounded-[var(--radius-tile)] shrink-0" />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <SkeletonBase className="h-4 w-2/3" />
                              <SkeletonBase
                                className="h-3 w-1/3"
                                style={{ marginTop: 2 }}
                              />
                            </div>
                            <SkeletonBase className="h-4 w-20 shrink-0" />
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                ) : relatedItems.length === 0 ? (
                  <div
                    style={{
                      padding: "24px 0",
                      textAlign: "center",
                      color: "var(--fg-tertiary)",
                      fontSize: "var(--text-label-sm)",
                    }}
                  >
                    {t("assetDetail.noLinkedTx")}
                  </div>
                ) : (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 16,
                    }}
                  >
                    {relatedGroups.map(([d, items]) => {
                      const { md, dow } = formatDay(d);
                      // 일 합계는 지출/수입만 — 이체는 자산 간 이동이라 어느 쪽에도 넣지 않는다.
                      // 환불된 거래도 뺀다 — 행은 취소선으로 남지만 합계에선 없는 것이다(23차 8).
                      const dayExpenses = items.flatMap((i) =>
                        i.kind === "expense" && !isRefundedTx(i.expense)
                          ? [i.expense]
                          : [],
                      );
                      const out = dayExpenses
                        .filter((tx) => tx.expenseType === "EXPENSE")
                        .reduce((s, tx) => s + Math.abs(tx.amount), 0);
                      const inn = dayExpenses
                        .filter((tx) => tx.expenseType === "INCOME")
                        .reduce((s, tx) => s + Math.abs(tx.amount), 0);
                      return (
                        <div key={d}>
                          <DateGroupHeader
                            date={md}
                            weekday={dow}
                            expense={out}
                            income={inn}
                          />
                          {items.map((item) =>
                            item.kind === "expense" ? (
                              <ExpenseRow
                                key={`e${item.expense.rowId}`}
                                expense={item.expense}
                              />
                            ) : (
                              <TransferRow
                                key={`t${item.transfer.rowId}`}
                                transfer={item.transfer}
                                perspectiveAssetRowId={asset.rowId}
                              />
                            ),
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </ModalShell>
      </HideForce>
      {/* 푸는 쪽에만 본인 확인을 건다 — 켜는 건 그냥 된다(카드 가리기와 같은 규칙). */}
      <HideAmountsUnlockDialog
        open={unlockOpen}
        onOpenChange={setUnlockOpen}
        onVerified={() => {
          setUnlockOpen(false);
          applyHidden("N");
        }}
      />
    </>
  );
}
