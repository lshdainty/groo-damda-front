import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { ChevronRight } from "lucide-react";
import { Badge } from "@/shared/ds/badge";
import { Delta } from "@/shared/ds/card";
import { withCommaBreaks, dsLocale, useDsText } from "@/shared/ds/i18n";
import { ListButtonItem } from "@/shared/ds/list";
import { LogoTile } from "@/shared/ds/logo-tile";
import { Skeleton } from "@/shared/ds/skeleton";
import { TagGroup, TagGroupItem } from "@/shared/ds/tag-group";
import {
  formatAssetAmount,
  isForeignCurrency,
} from "@/shared/lib/groo/currency";
import { MINUS, formatChangeRate } from "@/shared/lib/groo/format";
import type { HideCardKey } from "@/shared/lib/groo/hide-amounts-cards";
import { won } from "@/shared/lib/groo/money-text";
import { BarCaption, BarredItem, MeterBar } from "@/shared/ui/groo/band-parts";
import { holdingsOf, type InvestValuation } from "@/features/asset";
import { useStockSymbolName } from "@/features/stock/model/useStockMaster";
import { assetTypeLabel, type Asset } from "@/entities/asset";
import {
  CARD_TYPES,
  cardUsageOf,
  krwOf,
  useAssetHidden,
  useAssetMask,
} from "../lib/asset-groups";

/*
 * 자산 줄 한 부품(I-05 56 · I-17 27) — 자산 화면(줄 끝 ›)과 계좌 · 카드 관리(줄 끝 없음 · 밀기)가 같이 쓴다.
 * 같은 줄이 두 화면에서 모양이 갈리지 않도록 줄 안(타일 · 제목 · 설명 · 금액 · 배지)은 하나이고, 다른 것은 줄 끝과 설명 구성뿐이다.
 */

function InvestHoldingsSub({ asset }: { asset: Asset }) {
  const { t } = useTranslation("asset");
  const hs = holdingsOf(asset);
  const first = hs[0];
  const firstSymbol = first?.linked ? (first.tossSymbol ?? "") : "";
  const { data: firstName } = useStockSymbolName(firstSymbol);
  if (hs.length === 0) {
    return <>{t("holdings.emptySub")}</>;
  }
  const label = first?.linked
    ? (firstName ?? first.tossSymbol ?? "")
    : (first?.holdingName ?? "");
  return (
    <>
      {hs.length > 1
        ? t("holdings.firstAndMore", { name: label, n: hs.length - 1 })
        : label}
    </>
  );
}

/**
 * 관리 줄 설명의 종류 이름 — 예금 · 적금은 둘 다 SAVINGS 라 구분할 수 없어 "예적금"(I-17 :180). 정기예금 줄에 "적금" 이라 쓰면 틀린 말이다.
 */
function kindLabelOf(asset: Asset, t: TFunction<"asset">): string {
  return asset.assetType === "SAVINGS"
    ? t("assetType.savingsDeposit")
    : assetTypeLabel(asset.assetType, asset.balance);
}

/**
 * 자산 줄(56) — ds List 줄: 앞 Logo Tile 40 · 제목 · 설명 Tag Group(기관 · 보유 요약 · 결제일) · 뒤 금액 + 작은 글(사용액 · 등락 · 배지) · ›.
 * 카드 사용 막대는 ds Progress limit(8, 넘으면 끝까지 fg-critical + "N원 초과", 70 · 90% 경고 색 없음) 을 줄 아래에 둔다.
 * 외화는 원화 합계(서버 balanceInKrw)가 주 표기, 외화 계좌(투자 아님)는 자산 통화 잔액이 아래 한 줄. 이 자산만 가렸으면 금액을 전부 가린다.
 */
export function AssetRow({
  asset,
  card,
  onOpenDetail,
  investVal,
  end = "chevron",
  describe = "summary",
  usageBar = true,
  wrap,
}: {
  asset: Asset;
  card: HideCardKey;
  onOpenDetail: (asset: Asset) => void;
  /** 투자 자산 라이브 평가(등락) — 투자 그룹에서만 전달, 없으면 등락 미표시 */
  investVal?: InvestValuation | null;
  /** 줄 끝 — 화면을 옮기는 줄은 ›, 동작 자리를 쓰는 줄(관리)은 두지 않는다(I-17 Q2 B) */
  end?: "chevron" | "none";
  /** 설명 — "summary" 기관 · 보유 요약 · 메모 · 결제일 / "kind" 기관 · 종류 이름 · (투자 보유 n종목 · 신용카드 결제일) */
  describe?: "summary" | "kind";
  /** 카드 사용 막대 — 자산 화면에서만 */
  usageBar?: boolean;
  /** 줄을 감싼다 — 밀기(SwipeActions). 감싸는 쪽이 List 를 둔다 */
  wrap?: (row: ReactNode) => ReactNode;
}) {
  const { t } = useTranslation("asset");
  const dsT = useDsText();
  const m = useAssetMask(card, asset.isAmountHidden === "Y");
  const hiddenNow = useAssetHidden(card, asset.isAmountHidden === "Y");
  const isCard = CARD_TYPES.includes(asset.assetType);
  // 연결계좌형 체크카드는 결제가 계좌에서 즉시 빠져 잔액이 늘 0 이다 — 행 금액은 "이번 달 얼마 썼나"(서버 계산 당월 합계)로 바꾼다.
  const checkCardMonthly =
    asset.assetType === "CHECK_CARD" && asset.paymentAssetRowId != null
      ? (asset.monthlyUsedAmount ?? 0)
      : null;
  const krw = krwOf(asset);
  const neg = krw < 0;
  const foreign = isForeignCurrency(asset.currency);
  const cash = asset.cashBalance ?? asset.balance;
  const foreignCash =
    (cash < 0 ? MINUS : "") +
    formatAssetAmount(Math.abs(cash), asset.currency, dsLocale());

  const tags: ReactNode[] = [];
  // 줄어드는 항목: 요약 설명은 기관 2 · 보유 요약/메모 1, 종류 설명은 기관만 1(종류 · 결제일은 0 — 꼭 보여야 한다, tag-group.md)
  if (asset.institution) {
    tags.push(
      <TagGroupItem key="inst" shrink={describe === "kind" ? 1 : 2}>
        {asset.institution}
      </TagGroupItem>,
    );
  }
  if (describe === "kind") {
    tags.push(
      <TagGroupItem key="kind" shrink={0}>
        {kindLabelOf(asset, t)}
      </TagGroupItem>,
    );
    const held = holdingsOf(asset).length;
    if (asset.assetType === "INVESTMENT" && held > 0) {
      tags.push(
        <TagGroupItem key="hold" shrink={0}>
          {t("holdings.countLabel", { n: held })}
        </TagGroupItem>,
      );
    }
  } else if (asset.assetType === "INVESTMENT") {
    tags.push(
      <TagGroupItem key="hold" shrink={1}>
        <InvestHoldingsSub asset={asset} />
      </TagGroupItem>,
    );
  } else if (asset.memo && !isCard) {
    tags.push(
      <TagGroupItem key="memo" shrink={1}>
        {asset.memo}
      </TagGroupItem>,
    );
  }
  // 결제일 — 한 번만("14일 결제", 앱과 같은 글)
  if (asset.assetType === "CREDIT_CARD" && asset.paymentDay != null) {
    tags.push(
      <TagGroupItem key="pay" shrink={0}>
        {t("paymentDayLabel", { day: asset.paymentDay })}
      </TagGroupItem>,
    );
  }
  if (checkCardMonthly != null) {
    tags.push(
      <TagGroupItem key="month" shrink={0}>
        {t("checkCardMonthLabel")}
      </TagGroupItem>,
    );
  }

  const main =
    checkCardMonthly != null
      ? won(checkCardMonthly)
      : (neg ? MINUS : "") + won(Math.abs(krw));
  const small = "text-t3 font-medium tabular-nums text-fg-neutral-subtle";
  const suffix = (
    <>
      <span className="flex min-w-0 flex-col items-end gap-x0_5">
        <span className="text-end text-t5 font-bold tabular-nums text-fg-neutral">
          {withCommaBreaks(m(main))}
        </span>
        {foreign &&
          checkCardMonthly == null &&
          asset.assetType !== "INVESTMENT" && (
            // 외화 계좌의 자산 통화 잔액(정수 — "$100"). 투자는 줄에 두지 않는다 — 예수금만 자산 통화라 작은 글이 기관 · 종목 설명을
            // 밀어 자른다(I-13 검수). 투자 예수금 "$100 + 약 130,000원" 은 상세에서만.
            <span className={small}>{m(foreignCash)}</span>
          )}
        {investVal?.changePct != null && (
          <Delta
            direction={investVal.changePct >= 0 ? "up" : "down"}
            // 가림이 켜져도 줄은 둔다 — 값만 "•••"(다른 금액 가림과 같은 규칙)
            value={
              hiddenNow
                ? "•••"
                : `${formatChangeRate(investVal.changePct, { sign: "none" })}${
                    investVal.changeAmt != null
                      ? ` (${investVal.changeAmt >= 0 ? "+" : MINUS}${won(Math.abs(investVal.changeAmt))})`
                      : ""
                  }`
            }
            className="text-t3"
          />
        )}
        {(asset.isIncludedInTotal === "N" || asset.isAmountHidden === "Y") && (
          <span className="flex flex-wrap justify-end gap-x1">
            {asset.isIncludedInTotal === "N" && (
              <Badge variant="weak" tone="neutral" size="medium">
                {t("excludedFromTotal")}
              </Badge>
            )}
            {asset.isAmountHidden === "Y" && (
              <Badge variant="weak" tone="neutral" size="medium">
                {t("amountHiddenBadge")}
              </Badge>
            )}
          </span>
        )}
      </span>
      {end === "chevron" && (
        <ChevronRight
          aria-hidden
          size={18}
          className="text-fg-neutral-subtle"
        />
      )}
    </>
  );

  const usage = usageBar ? cardUsageOf(asset) : null;
  const row = (
    <ListButtonItem
      as={usage ? "div" : undefined}
      align={tags.length > 0 ? "top" : undefined}
      prefix={
        <LogoTile
          name={asset.institution || asset.assetName}
          face={asset.institution ? "institution" : "name"}
          size={40}
        />
      }
      title={asset.assetName}
      detail={
        tags.length > 0 ? (
          <TagGroup size="t3" truncate>
            {tags}
          </TagGroup>
        ) : undefined
      }
      suffix={suffix}
      onClick={() => onOpenDetail(asset)}
    />
  );
  if (!usage) return wrap ? wrap(row) : row;
  const over = usage.over > 0;
  return (
    <BarredItem
      row={row}
      wrap={wrap}
      bar={
        <>
          <MeterBar
            label={t("cardLimitName", { name: asset.assetName })}
            value={usage.used}
            max={usage.limit}
            formatValue={(n) => m(won(n))}
          />
          <BarCaption
            left={m(`${won(usage.used)} / ${won(usage.limit)}`)}
            right={
              over ? dsT("progress.over", { value: m(won(usage.over)) }) : null
            }
            critical={over}
          />
        </>
      }
    />
  );
}

/** 자산 줄 스켈레톤 — 실제 줄(두 줄 66)과 같은 높이 */
export function GroupRowsSkeleton({
  rows,
  band,
}: {
  rows: number;
  band?: boolean;
}) {
  return (
    <div aria-hidden className={band ? "pb-x3" : undefined}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-x3 px-x6 py-x3">
          <Skeleton radius="12" className="size-x10 shrink-0" />
          <div className="flex min-w-0 flex-1 flex-col gap-x0_5">
            <Skeleton text="t5" className="w-1/2" />
            <Skeleton text="t3" className="w-1/3" />
          </div>
          <Skeleton text="t5" className="w-x10 shrink-0" />
        </div>
      ))}
    </div>
  );
}

// ── 저축 목표 ───────────────────────────────────────────────────
