import { useId, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAssets } from "@/features/asset";
import { useDefaultCurrencyState } from "@/features/user";
import { todayLocalKey } from "@/shared/lib/date";
import { pendingBillWindow } from "@/entities/expense";
import { parseAmount } from "@/shared/lib/groo/amount";
import {
  DEFAULT_CURRENCY,
  currencyUnit,
  isForeignCurrency,
} from "@/shared/lib/groo/currency";
import { nameIssue } from "@/shared/lib/groo/name-policy";
import type { AccountSub } from "../../lib/account-sub";
import {
  groupOfKind,
  isAccountKind,
  kindOfAsset,
  type AssetGroup,
  type AssetKind,
} from "../../lib/asset-kind";
import {
  getBrandColor,
  BANK_ENTRIES,
  CATEGORY_HOLDING_TYPE,
} from "@/shared/lib/groo/bank-colors";
import type { CardCatalogSummary, CardType } from "@/entities/card";
import { type Asset, type HoldingType, qtyNumber } from "@/entities/asset";
import type { YNType } from "@/shared/types";
import { useLivePrices } from "@/features/stock/model/useLivePrices";
import { useMyFeatures } from "@/features/subscription/model/useSubscription";
import {
  type EditHolding,
  nextHoldingKey,
  ASSET_NAME_MAX,
  trimRate,
  INVEST_BRANDS,
  cardSummaryOf,
} from "./form-lib";

export interface UseAssetFormArgs {
  item: Asset | null;
  /** 추가 때 미리 정한 종류 — 없으면 1단계에서 고른다. 수정은 자산에서 잰다 */
  kind?: AssetKind | null;
}

/** 쓴 값의 모음을 글 하나로 — 처음 값과 견줘 바뀐 값이 있는지 본다. 보유 줄의 react key 는 뺀다 */
function valuesKey(v: {
  name: string;
  memo: string;
  isIncludedInTotal: string;
  isAmountHidden: string;
  balanceStr: string;
  dueStr: string;
  currencyPick: string | null;
  exchangeRate: string;
  brandPick: string | null;
  holdings: EditHolding[];
  selectedCard: CardCatalogSummary | null;
  creditLimit: string;
  paymentDay: string;
  paymentAssetRowId: number | null;
  paymentNone: boolean;
}): string {
  return JSON.stringify([
    v.name,
    v.memo,
    v.isIncludedInTotal,
    v.isAmountHidden,
    v.balanceStr,
    v.dueStr,
    v.currencyPick,
    v.exchangeRate,
    v.brandPick,
    v.holdings.map(({ key: _key, ...rest }) => rest),
    v.selectedCard?.rowId ?? null,
    v.creditLimit,
    v.paymentDay,
    v.paymentAssetRowId,
    v.paymentNone,
  ]);
}

/** 폼 칸의 처음 값 — 다시 시작(reset)과 바뀐 값 판정(dirty)이 같은 값을 본다 */
function initialOf(item: Asset | null, kindArg: AssetKind | null) {
  const kind: AssetKind | null = item ? kindOfAsset(item) : kindArg;
  const group: AssetGroup = kind ? groupOfKind(kind) : "account";
  const holdings: EditHolding[] = (() => {
    if (item?.holdings && item.holdings.length > 0) {
      return item.holdings.map((h) => ({
        key: nextHoldingKey(),
        rowId: h.rowId,
        // 구버전 응답(holdingType 없음)은 주식으로 본다.
        holdingType: h.holdingType ?? "STOCK",
        linked: h.linked,
        marketCode: h.marketCode ?? undefined,
        tossSymbol: h.tossSymbol ?? undefined,
        quantity: h.quantity ?? undefined,
        holdingName: h.holdingName ?? undefined,
        holdingValue: h.holdingValue ?? undefined,
        totalCost: h.totalCost ?? undefined,
      }));
    }
    if (item?.tossSymbol && item.tossQuantity != null) {
      return [
        {
          key: nextHoldingKey(),
          holdingType: "STOCK" as HoldingType,
          linked: true,
          marketCode: item.marketCode ?? undefined,
          tossSymbol: item.tossSymbol,
          quantity: String(item.tossQuantity),
        },
      ];
    }
    return [];
  })();
  return {
    kind,
    brandPick: item?.institution ?? null,
    name: item?.assetName ?? "",
    memo: item?.memo ?? "",
    isIncludedInTotal: (item?.isIncludedInTotal ?? "Y") as YNType,
    // 새 자산은 가리지 않는다 — 만들자마자 금액이 안 보이면 잘못 만든 줄 안다.
    isAmountHidden: (item?.isAmountHidden ?? "N") as YNType,
    // 절대값으로 보여 준다 — 부호는 종류가 정하므로 칸에 `-` 가 남아 있을 이유가 없다(QA #19).
    //
    // 신용카드는 이 칸이 **이월 금액**(카드를 등록할 때 적은 이전 미결제 사용액)이다(D7).
    // 지금 잔액(이월 + 그 뒤 사용)으로 채우면 이름만 고쳐 저장해도 서버가 그 값을 이월로
    // 받아 빚이 두 배가 됐다(QA 23차 1). 이월이 없으면 0 이다.
    // 값은 쉼표 없는 숫자 문자열이다 — 금액 칸(AmountInput)이 쓰는 동안 쉼표를 찍는다.
    balanceStr: item
      ? String(
          Math.abs(
            (item.assetType === "CREDIT_CARD"
              ? item.carryoverAmount
              : item.balance) ?? 0,
          ),
        )
      : "",
    // 신용카드의 결제 대기 청구분 칸(2026-09-22) — 기존 카드는 서버가 준 값으로 연다.
    dueStr:
      item?.assetType === "CREDIT_CARD" && item.dueCarryover
        ? String(Math.abs(item.dueCarryover.amount))
        : "",
    exchangeRate: item?.exchangeRate != null ? trimRate(item.exchangeRate) : "",
    holdings,
    selectedCard: cardSummaryOf(item, group),
    creditLimit: item?.creditLimit != null ? String(item.creditLimit) : "",
    paymentDay: item?.paymentDay != null ? String(item.paymentDay) : "",
    paymentAssetRowId: item?.paymentAssetRowId ?? null,
    // 저장된 자산의 결제 출금계좌 · 연결 계좌 null 은 "없다고 답한 것" — 처음부터 "없음". 새로 추가할 때만 자리 글
    paymentNone: !!item,
  };
}

export function useAssetForm({ item, kind: kindArg = null }: UseAssetFormArgs) {
  const uid = useId(); // 선택 칸 이름 잇기 — 보이는 라벨 + 값을 aria-labelledby 로
  const { t, i18n } = useTranslation("asset");
  const { t: tCommon } = useTranslation("common");
  const isNew = !item;
  const [init] = useState(() => initialOf(item, kindArg));

  // 종류(I-17 6 · 9) — 1단계가 고르고(추가), 수정의 "종류" 칸이 같은 묶음 안에서 바꾼다.
  // 계좌 종류 · 카드 종류는 이 값에서 나온다.
  const [kind, setKind] = useState<AssetKind | null>(init.kind);
  const editingGroup: AssetGroup = kind ? groupOfKind(kind) : "account";

  // 설정의 기본 통화 — 새 자산이 먼저 골라 두는 값이다(D7).
  const {
    currency: defaultCurrency,
    ready: defaultCurrencyReady,
    ensure: ensureDefaultCurrency,
  } = useDefaultCurrencyState();

  // 공통
  // 처음 값은 이 자산의 기관, 없으면 묶음의 첫 기관이다(지금 그대로). 묶음은 1단계가 정하므로 고른 값만 들고 나머지는 읽을 때 정한다.
  const [brandPick, setBrand] = useState<string | null>(init.brandPick);
  // 기관이 없는 자산(현금 등)을 고칠 때는 빈 칸 그대로 둔다 — 예전엔 첫 은행("신한")이 채워져 그대로 저장됐다.
  const brand =
    brandPick ??
    (!isNew
      ? ""
      : editingGroup === "invest"
        ? (INVEST_BRANDS[0]?.name ?? "삼성증권")
        : (BANK_ENTRIES[0]?.name ?? "신한"));
  const [name, setName] = useState(init.name);
  const [memo, setMemo] = useState(init.memo);
  const [isIncludedInTotal, setIsIncludedInTotal] = useState<YNType>(
    init.isIncludedInTotal,
  );
  // 새 자산은 가리지 않는다 — 만들자마자 금액이 안 보이면 잘못 만든 줄 안다.
  const [isAmountHidden, setIsAmountHidden] = useState<YNType>(
    init.isAmountHidden,
  );
  // 숨김을 **푸는** 쪽에만 본인 확인을 건다 — 켜는 건 그냥 된다(카드 가리기·상세 토글과
  // 같은 규칙). 모바일은 상세에 토글이 없어 이 폼이 유일한 해제 경로다. 여기에 확인이
  // 없으면 "풀 때는 비밀번호" 규칙 자체가 없는 것과 같다(QA 22차 #2).
  const needsUnlock =
    !isNew && item?.isAmountHidden === "Y" && isAmountHidden === "N";
  // state 가 아니라 ref 다 — 확인창의 `onVerified` 에서 곧바로 `handleSubmit()` 을
  // 다시 부르는데, setState 로 두면 그 호출이 아직 `false` 인 값을 읽는다.
  const unlockedRef = useRef(false);
  const [balanceStr, setBalanceStr] = useState<string>(init.balanceStr);
  const [dueStr, setDueStr] = useState<string>(init.dueStr);
  /**
   * 결제일을 바꿀 때 한 번 받는 확인(D5). state 가 아니라 ref 다 — 확인창의
   * `onConfirm` 에서 곧바로 `handleSubmit()` 을 다시 부르는데, setState 로 두면 그 호출이
   * 아직 `false` 인 값을 읽는다(금액 숨김 해제 확인과 같은 자리).
   */
  const paymentDayConfirmedRef = useRef(false);
  const [paymentDayConfirm, setPaymentDayConfirm] = useState<string | null>(
    null,
  );

  // 통화·환율 — 세 묶음(계좌·카드·투자) 모두에 칸이 있다(D1).
  //
  // **읽어 온 값으로 연다.** 이게 이 칸의 안전장치다 — 안 채우고 열면 그대로 저장하는
  // 것만으로 외화 자산이 원화가 된다. 칸이 생겨서 오히려 위험해지는 자리라, 앱도
  // 같은 순서로 잠갔다(desk-app #330).
  //
  // **새로 만들 때만** 설정의 기본 통화가 들어온다(D7 · QA #124). 기존 자산에까지
  // 쓰면 기본 통화를 USD 로 바꾼 순간 원화 계좌들이 전부 USD 로 열리고, 그대로 저장만
  // 해도 통화가 바뀐다 — 고치라고 만든 칸이 고장을 내는 쪽이다.
  const [currencyPick, setCurrency] = useState<string | null>(null);
  // 우선순위는 **고른 값 > 이 자산의 값 > 설정의 기본 통화**다.
  //
  // 기본 통화를 `useState` 초기값으로 굳히면 안 된다(D7) — `/me/preferences` 는 설정
  // 화면을 안 들른 세션에서 이 폼보다 늦게 도착해서, 초기값으로 받으면 첫 렌더의
  // `KRW` 에 잠긴 채 열린다. 매 렌더 읽어야 늦게 온 값이 반영된다.
  // 카드(신용 · 체크)는 원화만이다(I-13 사용자 결정 4, 서버 AST_037) — 통화 칸이 없고 늘 원화로 보낸다. 해외 결제는 거래의 통화 칸으로 적는다.
  const currency =
    editingGroup === "card"
      ? DEFAULT_CURRENCY
      : (currencyPick ?? item?.currency ?? defaultCurrency);
  const [exchangeRate, setExchangeRate] = useState<string>(init.exchangeRate);
  // 환율은 통화가 원화가 아닐 때만 의미가 있다 — 서버도 KRW 의 환산율은 1 로
  // 정규화한다(`Asset.normalizeRate`). 칸을 숨길 뿐 값은 들고 있는다:
  // 통화를 잘못 눌렀다 되돌렸을 때 적어 둔 환율이 사라지면 곤란하다.
  const isForeign = isForeignCurrency(currency);

  // 계좌 종류 · 카드 종류 — 종류(kind)에서 나온다
  const accountSub: AccountSub = kind && isAccountKind(kind) ? kind : "입출금";

  // 투자 — 보유 종목 다건 편집 (design AssetEditDialog invest 분기 미러).
  // 기존 holdings 우선, 구버전 단일 연동(tossSymbol)은 linked 1건으로 합성(하위호환).
  const [holdings, setHoldings] = useState<EditHolding[]>(init.holdings);
  const { data: features } = useMyFeatures({ reference: true });
  const liveEnabled =
    (features?.features?.includes("SECURITIES") ?? false) &&
    (features?.connectedBrokers?.length ?? 0) > 0;
  // 연동 항목 라이브 평가 — 시세(10초 폴링)×수량, 외화는 환율 환산. 게이트 밖이면 미평가.
  const holdingSymbols = useMemo(
    () => [
      ...new Set(
        holdings
          .filter((h) => h.linked && h.tossSymbol)
          .map((h) => h.tossSymbol as string),
      ),
    ],
    [holdings],
  );
  const priceActive =
    liveEnabled && editingGroup === "invest" && holdingSymbols.length > 0;
  const activeHoldingSymbols = useMemo(
    () => (priceActive ? holdingSymbols : []),
    [priceActive, holdingSymbols],
  );
  // 증권사 무관 경로 + 통화별 환율. 목록·상세와 같은 훅을 써야 한 화면에서 금액이 안 어긋난다.
  const live = useLivePrices(activeHoldingSymbols, priceActive);
  const holdingValueOf = useMemo(() => {
    return (h: EditHolding): number | null => {
      if (!h.linked) return h.holdingValue ?? 0;
      const krw = h.tossSymbol ? live.unitKrw(h.tossSymbol) : null;
      return krw != null
        ? Math.round(krw * (qtyNumber(h.quantity) ?? 0))
        : null;
    };
  }, [live]);
  // 합계 — 평가 불가 연동 항목은 0 취급하지 않고 '평가 가능분 합'으로 표기.
  const holdingsTotal = useMemo(
    () => holdings.reduce((s, h) => s + (holdingValueOf(h) ?? 0), 0),
    [holdings, holdingValueOf],
  );

  // 카드
  const cardType: CardType = kind === "체크카드" ? "CHECK" : "CREDIT";
  // 편집 진입 시 기존 카드 카탈로그를 선택 상태처럼 보이도록 채움.
  //
  // 초기값으로 넣는다 — 이 컴포넌트의 `item` 기반 상태는 전부 그렇게 시드된다
  // (`cardType`·`creditLimit`·…). 이것만 effect 였고, 그래서 의존성을 `item?.rowId`
  // 하나로 좁히려 규칙을 꺼야 했다. 다이얼로그는 자산 하나마다 새로 열린다.
  const [selectedCard, setSelectedCard] = useState<CardCatalogSummary | null>(
    init.selectedCard,
  );

  // 신용카드 청구사이클 (CREDIT_CARD 전용)
  const [creditLimit, setCreditLimit] = useState<string>(init.creditLimit);
  const [paymentDay, setPaymentDay] = useState<string>(init.paymentDay);
  const [paymentAssetRowId, setPaymentAssetRowId] = useState<number | null>(
    init.paymentAssetRowId,
  );
  const [paymentNone, setPaymentNone] = useState(init.paymentNone);

  // 결제 계좌 후보 — 폼 안의 참조 목록이라 실패해도 폼은 그대로 두고, 저장할 때 다시 받는다(AssetEditDialog.attemptSubmit)
  const assetsQ = useAssets({ silent: true });
  const { data: assetsData } = assetsQ;
  const bankAccounts = useMemo(
    () =>
      (assetsData?.assets ?? []).filter(
        (a) => a.assetType === "BANK_ACCOUNT" && a.rowId !== item?.rowId,
      ),
    [assetsData, item?.rowId],
  );

  // 색/미리보기
  const cardCompanyName =
    selectedCard?.company?.name ?? item?.institution ?? "";
  const cardBrandColor = useMemo(
    () => getBrandColor(cardCompanyName),
    [cardCompanyName],
  );
  // 기관이 보유 유형을 정한다 — 증권사에서 코인을, 금거래소에서 주식을 담을 일은 없다.
  // 모르는 기관(직접 입력·구버전 데이터)이면 셋 다 열어 둔다.
  const brandHoldingType = useMemo<HoldingType | null>(() => {
    const cat = BANK_ENTRIES.find((e) => e.name === brand)?.category;
    return cat ? (CATEGORY_HOLDING_TYPE[cat] ?? null) : null;
  }, [brand]);
  const allowStock = brandHoldingType === null || brandHoldingType === "STOCK";
  /**
   * 손으로 추가하는 보유의 유형.
   *
   * <p>기관이 정해져 있으면 그 카테고리를 따른다(상품거래소=금, 코인거래소=코인).
   * 기관을 안 골랐으면 <b>이미 들고 있는 보유</b>를 본다 — 금만 있는 자산에서 항목을
   * 추가했는데 주식으로 저장되면 단위가 "주" 로 나오고 유형 분리가 무의미해진다.
   * 둘 다 단서가 없을 때만 주식이다.
   */
  const manualHoldingType = useMemo<HoldingType>(() => {
    if (brandHoldingType !== null) return brandHoldingType;
    const types = new Set(holdings.map((h) => h.holdingType));
    return types.size === 1 ? ([...types][0] ?? "STOCK") : "STOCK";
  }, [brandHoldingType, holdings]);
  const manualAddTypes = useMemo<HoldingType[]>(() => {
    if (brandHoldingType === null) return ["GOLD", "CRYPTO"];
    return brandHoldingType === "STOCK" ? [] : [brandHoldingType];
  }, [brandHoldingType]);

  const brandColor = useMemo(() => {
    if (editingGroup === "card") return cardBrandColor;
    return getBrandColor(brand);
  }, [editingGroup, brand, cardBrandColor]);

  // 별칭 — 길이·중복. 서버에 자산 이름 중복 코드가 없어 여기서 볼 수밖에 없다(QA #16).
  // 카드는 별칭이 선택 입력이라(비우면 카드명으로 폴백) 빈 이름은 계속 허용한다.
  const nameTrim = name.trim();
  const nameIssueKind =
    nameTrim.length === 0
      ? null
      : nameIssue(
          name,
          ASSET_NAME_MAX,
          (assetsData?.assets ?? [])
            .filter((a) => a.rowId !== item?.rowId)
            .map((a) => a.assetName),
        );
  const nameErr =
    nameIssueKind === "tooLong"
      ? t("editDialog.nameTooLong")
      : nameIssueKind === "duplicate"
        ? t("editDialog.nameDuplicate")
        : null;

  // 유효성
  //
  // 필수가 빈 칸(issues)은 [추가] · [저장] 을 막지 않는다 — 누르면 칸마다 오류가 서고 첫 칸에 초점이 간다(field.md "저장 버튼은 켜 둔다").
  // 신용카드는 결제일 필수 — 없으면 청구 사이클(이용기간·예정액·할부 회차)을 세울 수 없다(체크카드는 즉시 출금이라 결제일이 없다).
  // 편집 모드: 카드 카탈로그 재선택 없이 별칭/금액만 바꿀 수 있어야 한다. 새 계좌 · 투자는 별칭이 필수다.
  const issues = {
    name: editingGroup !== "card" && nameTrim.length === 0,
    card: editingGroup === "card" && isNew && !selectedCard,
    paymentDay:
      cardType === "CREDIT" && editingGroup === "card" && !paymentDay.trim(),
    // 외화 자산은 환율이 필수다(서버 AST_036) — 비면 원화로 그대로 더해져 합계가 틀린다
    exchangeRate: isForeign && !(Number(exchangeRate.replace(/,/g, "")) > 0),
  };
  const canSubmit =
    !nameErr &&
    !issues.name &&
    !issues.card &&
    !issues.paymentDay &&
    !issues.exchangeRate;
  // 누르고도 못 보낸 적이 있으면 오류 글을 세운다 — 고치면 저절로 걷힌다
  const [showErrors, setShowErrors] = useState(false);
  // 못 보낸 횟수 — 첫 오류 칸에 초점을 옮기는 신호
  const [submitTick, setSubmitTick] = useState(0);

  const isOverdraft =
    editingGroup === "account" && accountSub === "마이너스통장";
  /**
   * 금액 칸의 단위는 **고른 통화**를 따른다. 라벨에 `(원)` 이 박혀 있어 USD 를 골라도
   * 원화처럼 보였다(QA 12차) — 잔액도 한도도 이 폼의 통화로 적는 값이다
   * (초과 안내가 이미 `formatOriginalAmount(…, currency)` 로 나간다).
   *
   * 표기 규칙은 `currencyUnit` 한 곳에 있다 — 앱도 같은 규칙을 쓴다.
   */
  const unit = currencyUnit(currency);
  /**
   * 한도 초과 — **저장은 막지 않는다**(사용자 결정, QA #125). 넘겼다는 사실만 보인다.
   *
   * 서버 검사도 넣지 않는다. 한도는 카드사·은행이 정하는 값이고 우리가 아는 건
   * 사용자가 적어 둔 숫자다 — 막아 버리면 실제로 한도를 올린 사람이 사용액을 못 고친다.
   * 반대로 조용히 넘어가면 한도를 잘못 적어 둔 걸 아무도 모르므로, 화면에만 세운다.
   *
   * 신용카드 사용액과 마이너스통장 사용액이 같은 `credit_limit` 을 쓰므로 두 자리가
   * 같은 문구를 쓴다. 한도를 안 적었으면(0) 견줄 값이 없어 아무 말도 안 한다.
   */
  const isCreditCardEdit = editingGroup === "card" && cardType === "CREDIT";
  /** 신용카드로 저장돼 있던 자산을 고치는 중 — 이월 금액·결제일 규칙이 여기에만 걸린다. */
  const isExistingCreditCard =
    !isNew && item?.assetType === "CREDIT_CARD" && isCreditCardEdit;
  /** 이월 거래가 든 회차의 결제일이 됐다 — 이월 금액 칸은 읽기 전용이다(D15). */
  const carryoverLocked =
    isExistingCreditCard && item?.carryoverLocked === true;
  /** 지금 미결제 잔액 — 이월 칸 옆에 읽기 전용으로 둔다(D7). 선결제로 남은 돈은 0 이다. */
  const currentUnpaid = isExistingCreditCard
    ? Math.max(0, -(item?.balance ?? 0))
    : 0;
  /**
   * 결제 대기 청구분 칸(2026-09-22 사용자 결정). 결제일 전에 카드를 등록하면 실제 카드사는
   * 지난달 청구분을 다가오는 결제일에, 이번 달 쓴 금액을 그다음 결제일에 뺀다 — 한 칸으로
   * 받으면 전부 다음 달에 빠져 한 달 동안 통장 잔액이 실제보다 많았다. 그래서 두 칸으로 받는다.
   *  - 새 카드: 오늘이 이번 달 결제일 전이면 연다(결제일을 바꾸면 따라 바뀐다)
   *  - 기존 카드: 서버가 칸을 줄 때만 — 청구분이 있거나 등록한 달의 그 회차가 아직 열려 있을 때.
   *    그 회차 결제일이 되면 잠긴다(D15 와 같다)
   */
  const newCardBillWindow =
    isNew && isCreditCardEdit
      ? pendingBillWindow(
          todayLocalKey(),
          paymentDay.trim() ? parseInt(paymentDay, 10) : null,
        )
      : null;
  const dueField: { paymentDate: string; locked: boolean } | null =
    newCardBillWindow
      ? { paymentDate: newCardBillWindow.dueDate, locked: false }
      : isExistingCreditCard && item?.dueCarryover?.paymentDate
        ? {
            paymentDate: item.dueCarryover.paymentDate,
            locked: item.dueCarryover.locked === true,
          }
        : null;
  const dueAmount = dueField ? parseAmount(dueStr) : 0;
  const limitAmount =
    isCreditCardEdit || isOverdraft ? parseAmount(creditLimit) : 0;
  /**
   * 한도와 견줄 사용액. 기존 신용카드는 칸이 이월 금액이라 칸 값만으로는 사용액이 아니다 —
   * 지금 미결제 잔액에서 이월을 고친 만큼을 더하고 뺀 값이 저장 뒤 사용액이다.
   */
  const usageForLimit = isExistingCreditCard
    ? Math.max(
        0,
        currentUnpaid -
          Math.abs(item?.carryoverAmount ?? 0) +
          parseAmount(balanceStr) -
          Math.abs(item?.dueCarryover?.amount ?? 0) +
          dueAmount,
      )
    : parseAmount(balanceStr) + dueAmount;
  const overLimitBy =
    limitAmount > 0 ? Math.max(0, usageForLimit - limitAmount) : 0;

  // 바뀐 값 — 닫기 · 뒤로 가기 전에 "작성한 내용이 사라져요" 를 묻는다. 종류는 따로 본다(1단계가 고른 종류만으로는 쓴 글이 아니다).
  // 찾기 글(query · stockQ · cardKeyword)은 쓴 값이 아니라 빼고, 보유 줄의 react key 도 뺀다.
  const changed =
    valuesKey({
      name,
      memo,
      isIncludedInTotal,
      isAmountHidden,
      balanceStr,
      dueStr,
      currencyPick,
      exchangeRate,
      brandPick,
      holdings,
      selectedCard,
      creditLimit,
      paymentDay,
      paymentAssetRowId,
      paymentNone,
    }) !== valuesKey({ ...init, currencyPick: null });
  const kindChanged = kind !== init.kind;

  /** 쓴 값을 버리고 처음으로 — 추가 2단계에서 ← 로 1단계에 돌아갈 때(종류는 고른 채 둔다) */
  const reset = () => {
    unlockedRef.current = false;
    paymentDayConfirmedRef.current = false;
    setBrand(init.brandPick);
    setName(init.name);
    setMemo(init.memo);
    setIsIncludedInTotal(init.isIncludedInTotal);
    setIsAmountHidden(init.isAmountHidden);
    setShowErrors(false);
    setBalanceStr(init.balanceStr);
    setDueStr(init.dueStr);
    setCurrency(null);
    setExchangeRate(init.exchangeRate);
    setHoldings(init.holdings);
    setSelectedCard(init.selectedCard);
    setCreditLimit(init.creditLimit);
    setPaymentDay(init.paymentDay);
    setPaymentAssetRowId(init.paymentAssetRowId);
    setPaymentNone(init.paymentNone);
  };

  return {
    item,
    kind,
    setKind,
    changed,
    kindChanged,
    reset,
    uid,
    t,
    i18n,
    tCommon,
    isNew,
    editingGroup,
    defaultCurrency,
    defaultCurrencyReady,
    ensureDefaultCurrency,
    brand,
    setBrand,
    name,
    setName,
    memo,
    setMemo,
    isIncludedInTotal,
    setIsIncludedInTotal,
    isAmountHidden,
    setIsAmountHidden,
    needsUnlock,
    unlockedRef,
    balanceStr,
    setBalanceStr,
    dueStr,
    setDueStr,
    paymentDayConfirmedRef,
    paymentDayConfirm,
    setPaymentDayConfirm,
    currencyPick,
    setCurrency,
    currency,
    exchangeRate,
    setExchangeRate,
    isForeign,
    accountSub,
    holdings,
    setHoldings,
    features,
    liveEnabled,
    holdingSymbols,
    priceActive,
    activeHoldingSymbols,
    live,
    holdingValueOf,
    holdingsTotal,
    cardType,
    selectedCard,
    setSelectedCard,
    creditLimit,
    setCreditLimit,
    paymentDay,
    setPaymentDay,
    paymentAssetRowId,
    setPaymentAssetRowId,
    paymentNone,
    setPaymentNone,
    assetsData,
    assetsQ,
    bankAccounts,
    cardCompanyName,
    cardBrandColor,
    brandHoldingType,
    allowStock,
    manualHoldingType,
    manualAddTypes,
    brandColor,
    nameTrim,
    nameIssueKind,
    nameErr,
    canSubmit,
    issues,
    showErrors,
    setShowErrors,
    submitTick,
    setSubmitTick,
    isOverdraft,
    unit,
    isCreditCardEdit,
    isExistingCreditCard,
    carryoverLocked,
    currentUnpaid,
    newCardBillWindow,
    dueField,
    dueAmount,
    limitAmount,
    usageForLimit,
    overLimitBy,
  };
}

export type AssetForm = ReturnType<typeof useAssetForm>;
