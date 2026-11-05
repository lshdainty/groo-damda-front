import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Check, Minus, Sparkles, TrendingUp } from "lucide-react";

import { Badge } from "@/shared/ds/badge";
import { Button } from "@/shared/ds/button";
import { Callout } from "@/shared/ds/callout";
import { Card } from "@/shared/ds/card";
import { withCommaBreaks } from "@/shared/ds/i18n";
import { List, ListHeader, ListItem } from "@/shared/ds/list";
import { ResultSection } from "@/shared/ds/result-section";
import {
  SegmentedControl,
  SegmentedControlItem,
} from "@/shared/ds/segmented-control";
import { Skeleton } from "@/shared/ds/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableRowHeader,
  useTableLayout,
} from "@/shared/ds/table";
import {
  TopNavigation,
  TopNavigationBackButton,
  TopNavigationTitle,
} from "@/shared/ds/top-navigation";
import { AlertConfirm } from "@/shared/ui/groo/alert-confirm";
import { SnackbarAvoidOverlap } from "@/shared/ds/snackbar";
import { useCoverBottomNav } from "@/shared/ui/groo/use-cover-bottom-nav";
import { ManagerHead } from "@/shared/ui/groo/manager-layout";
import { toLocalDateKey } from "@/shared/lib/date";
import { KRW, money, wonPrefix } from "@/shared/lib/groo/format";
import { useConfirmFail } from "@/shared/lib/confirm-fail";
import {
  useCancelSubscription,
  useMyFeatures,
  useMySubscription,
  useSubscribe,
  useSubscriptionPlans,
} from "@/features/subscription/model/useSubscription";
import {
  cycleOfDuration,
  pickCyclePlans,
  resolveSubPlan,
  yearlySavePct,
  type Cycle,
} from "@/features/subscription/lib/plan-cycles";
import { SUB_FEATURES } from "@/features/subscription/lib/features";

const FREE = "Free";
const PRO = "Pro";

/** 못 받은 요청인가 — 데이터가 있는 채로 다시 받기만 실패한 것은 실패가 아니다 */
const broken = (q: { isError: boolean; data: unknown }) =>
  q.isError && q.data === undefined;

/**
 * 구독 관리 구역(I-14 G) — 설정 > 계정 > 구독·결제에서 들어오는 페이지. 예전 구독 대화상자의 몸 · 질의 · 뮤테이션을 옮겼다.
 *
 * 폰은 제 껍데기(ds Top Navigation + 흰 면 스크롤 본문 + 바닥 띠)를 그린다 — 바닥에 고정 버튼이 있어 공용 설정 껍데기에
 * 들어가지 않는다(금액 가리기와 같은 갈래). 768 이상은 설정 본문 칸에 "‹ 계정"(틀) → 제목(`ManagerHead`) → 카드 하나 +
 * 카드 바닥 줄이다. PG 가 없어 'Pro 시작하기' 는 self-grant(useSubscribe)로 즉시 구독된다.
 *
 * 가격은 서버가 준다(요금제 행의 `price` · `durationMonths`). 화면에 숫자를 박지 않는다 — 할인율도 월간 · 연간 가격에서 계산한다.
 */
export function SubscriptionSection({
  mobile,
  onBack,
}: {
  mobile: boolean;
  /** 폰 ← — 들어온 화면으로(History), 앞 화면이 없으면 계정으로 */
  onBack?: () => void;
}) {
  const { t } = useTranslation("subscription");
  const { t: tDs } = useTranslation("ds");
  const layout = useTableLayout();
  const featuresQ = useMyFeatures();
  const subQ = useMySubscription();
  const plansQ = useSubscriptionPlans();
  const subscribe = useSubscribe();
  const cancel = useCancelSubscription();
  const confirmFail = useConfirmFail();
  const compareId = useId();
  // 폰 껍데기가 탭 바를 덮는 동안 탭 바는 inert — 스낵바가 바닥 버튼 위 8 에 서게(J5)
  useCoverBottomNav(mobile);

  const [chosen, setChosen] = useState<Cycle | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const failed = broken(featuresQ) || broken(subQ) || broken(plansQ);
  const loading =
    !failed && (featuresQ.isLoading || subQ.isLoading || plansQ.isLoading);
  const refetching =
    featuresQ.isRefetching || subQ.isRefetching || plansQ.isRefetching;
  const retry = () => {
    void featuresQ.refetch();
    void subQ.refetch();
    void plansQ.refetch();
  };

  const isPro = featuresQ.data?.features?.includes("SECURITIES") ?? false;
  const sub = subQ.data;
  // currentPeriodEnd 는 서버가 시간대 없이 주는 `[UTC]` (백엔드 UserSubscription 의 LocalDateTime). 자르면 UTC 날짜가 나와
  // KST(+9)에서 하루 이르게 보인다 — 계정의 '다음 결제'와 같은 값이라 같은 방식으로 읽어야 두 화면이 다른 날짜를 말하지 않는다.
  // 못 읽는 값이면 원문 앞 10자로 떨어뜨린다(앱과 같은 폴백).
  const periodEnd = sub?.currentPeriodEnd
    ? (toLocalDateKey(sub.currentPeriodEnd) ??
      sub.currentPeriodEnd.slice(0, 10))
    : null;
  // 해지해도 서버는 자동갱신만 끄고 **기간 끝까지 Pro 를 유지한다**(desk-back #332). 그래서 유예 기간에도 Pro 로 서고 날짜도
  // 남는데, 그날은 결제일이 아니라 **종료일**이다 — "다음 결제 10-11" 은 있지도 않은 결제를 예고한다.
  // `=== false` 로 좁히는 건 값이 안 왔을 때(undefined) 기존 동작을 그대로 두려는 것이다.
  const periodLabel = periodEnd
    ? sub?.autoRenew === false
      ? t("activeUntil", { date: periodEnd })
      : t("nextBill", { date: periodEnd })
    : null;

  // 월간 · 연간 행 — 둘 중 하나가 없으면 주기 고르기 없이 있는 것 하나로 보인다
  const { monthly, yearly } = pickCyclePlans(plansQ.data);
  const hasBoth = monthly != null && yearly != null;
  const pct = hasBoth ? yearlySavePct(monthly.price!, yearly.price!) : 0;
  // 할인 표시("%↓" · "n% 절약")는 셈할 월간 행이 있고 정말 싸질 때만 — 0 이하면 없다
  const showPct = hasBoth && pct > 0;
  // 내 구독의 가격 · 기간 — /me 값이 정상 경로, 없으면 planCode 로 요금제 목록에서(옛 서버 · 값이 안 온 경우)
  const own = resolveSubPlan(sub, plansQ.data);
  const ownCycle = cycleOfDuration(own.durationMonths);
  const cycle: Cycle = hasBoth
    ? (chosen ?? ownCycle)
    : monthly
      ? "monthly"
      : "yearly";
  const selected = cycle === "yearly" ? yearly : monthly;
  // 요금제가 하나도 없다 — 팔 것이 없다(서버가 목록을 비워 줌). 실패로 말하고 시작 단추는 그리지 않는다
  const plansEmpty = !loading && !failed && !monthly && !yearly;

  const unit = (months: number | null | undefined) =>
    months === 12 ? t("perYear") : t("perMonth");
  const priceText = (
    price: number | null | undefined,
    months?: number | null,
  ) => (price != null ? `${money(price)} / ${unit(months)}` : null);

  const onSubscribe = () => {
    if (!selected) return;
    subscribe.mutate(selected.planCode, {
      onSuccess: () => toast.success(t("toast.subscribed")),
      onError: () => toast.error(t("toast.subscribeFailed")),
    });
  };
  const canceled = () => toast.success(t("toast.canceled"));
  const doCancel = () => cancel.mutateAsync(undefined);

  const planBadge = (
    <>
      <span className="sr-only">, </span>
      <Badge variant="weak" tone="neutral" className="ml-x1 align-[2px]">
        {t("currentPlan")}
      </Badge>
    </>
  );

  // ── 지금 플랜 · 요금 ──────────────────────────────────────────
  const currentPrice = priceText(own.price, own.durationMonths);
  const currentPlan = loading ? (
    <SkeletonRows count={1} />
  ) : (
    <List>
      <ListItem
        align="top"
        prefix={<Sparkles aria-hidden />}
        title={isPro ? t("proInUse") : t("freeInUse")}
        detail={
          isPro ? (
            <>
              {periodLabel}
              {periodLabel && currentPrice ? " · " : null}
              {currentPrice && withCommaBreaks(currentPrice)}
            </>
          ) : (
            t("freeLocked")
          )
        }
      />
    </List>
  );

  const prices = loading ? (
    <SkeletonRows count={2} />
  ) : plansEmpty ? (
    <ResultSection
      kind="failure"
      size="medium"
      title={t("noPlans")}
      description={t("loadErrorHint")}
      primaryAction={{
        label: tDs("common.retry"),
        onClick: retry,
        loading: refetching,
      }}
    />
  ) : (
    <List>
      <ListItem
        className="tabular-nums"
        title={
          <>
            {FREE}
            {!isPro && planBadge}
          </>
        }
        detail={t("freeDesc")}
        suffix={money(0)}
      />
      <ListItem
        className="tabular-nums"
        title={
          <>
            {PRO}
            {/* 고른 주기가 지금 구독 주기와 같을 때만 — 다른 주기를 보는 동안은 그 가격만 */}
            {isPro && cycle === ownCycle && planBadge}
          </>
        }
        detail={
          cycle === "yearly" && selected?.price != null
            ? showPct
              ? t("pricePerMonthNote", {
                  price: `${wonPrefix()}${KRW(Math.round(selected.price / 12))}`,
                  pct,
                })
              : t("yearlyBilling")
            : t("monthlyBilling")
        }
        suffix={
          selected?.price != null
            ? priceText(selected.price, selected.durationMonths)!
            : undefined
        }
      />
    </List>
  );

  // ── 기능 비교 ─────────────────────────────────────────────────
  const compare =
    layout === "table" ? (
      <Table caption={t("comparisonTitle")}>
        <TableHeader>
          <TableRow>
            <TableHead>{t("colFeature")}</TableHead>
            <TableHead align="end">{FREE}</TableHead>
            <TableHead align="end">{PRO}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {SUB_FEATURES.map((f) => (
            <TableRow key={f.labelKey}>
              <TableRowHeader>{t(f.labelKey)}</TableRowHeader>
              <TableCell align="end">
                <FeatureMark on={f.free} />
              </TableCell>
              <TableCell align="end">
                <FeatureMark on={f.pro} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    ) : (
      <List aria-labelledby={compareId}>
        {SUB_FEATURES.map((f) => (
          <ListItem
            key={f.labelKey}
            title={t(f.labelKey)}
            suffix={f.free ? `${FREE} · ${PRO}` : PRO}
          />
        ))}
      </List>
    );

  const body = (
    <>
      {failed ? (
        <ResultSection
          kind="failure"
          size="medium"
          title={t("loadError")}
          description={t("loadErrorHint")}
          primaryAction={{
            label: tDs("common.retry"),
            onClick: retry,
            loading: refetching,
          }}
        />
      ) : (
        currentPlan
      )}

      {/* 안내 — 서버 값이 아니라 늘 보인다. 흰 면 위 Callout */}
      <div className="px-global-gutter pt-x2 pb-x4">
        {/* 제목은 짧은 말만 — 문장은 본문 한 문단(callout.md) */}
        <Callout tone="informative" icon={<TrendingUp aria-hidden />}>
          {t("spotlight")}
        </Callout>
      </div>

      {!failed && (
        <>
          {!loading && hasBoth && (
            <div className="px-global-gutter pb-x4">
              <SegmentedControl
                aria-label={t("cycleAria")}
                value={cycle}
                onValueChange={(v) => setChosen(v as Cycle)}
              >
                <SegmentedControlItem value="monthly">
                  {t("cycleMonthly")}
                </SegmentedControlItem>
                <SegmentedControlItem value="yearly">
                  {showPct ? t("cycleYearly", { pct }) : t("cycleYearlyPlain")}
                </SegmentedControlItem>
              </SegmentedControl>
            </div>
          )}
          {prices}
        </>
      )}

      <ListHeader id={compareId} variant="boldSolid" className="mt-x6">
        {t("comparisonTitle")}
      </ListHeader>
      {compare}
    </>
  );

  // 바닥 단추 — 불러오는 중 · 실패 · (Free 인데 팔 요금제가 없음)에는 누를 것이 없다
  const ready = !loading && !failed && !(plansEmpty && !isPro);
  const action = isPro ? (
    <Button
      variant="ghost"
      ghostColor="critical"
      size={mobile ? "large" : "small"}
      className={mobile ? "w-full" : undefined}
      onClick={() => setConfirmOpen(true)}
    >
      {t("cancelSub")}
    </Button>
  ) : (
    <Button
      variant="neutralSolid"
      size={mobile ? "large" : "small"}
      className={mobile ? "w-full" : undefined}
      loading={subscribe.isPending}
      disabled={!selected}
      onClick={onSubscribe}
    >
      {t("startPro")}
    </Button>
  );

  const confirm = confirmOpen && (
    <AlertConfirm
      title={t("cancelConfirmTitle")}
      message={t("cancelConfirmDesc", { date: periodEnd ?? t("expiryDate") })}
      confirmLabel={t("cancelSub")}
      cancelLabel={t("keepSub")}
      onConfirm={async () => {
        await doCancel();
        canceled();
      }}
      onError={() =>
        confirmFail({
          message: t("toast.cancelFailed"),
          retry: doCancel,
          onRetried: canceled,
        })
      }
      onClose={() => setConfirmOpen(false)}
    />
  );

  if (mobile) {
    return (
      <div
        data-slot="subscription-page"
        className="fixed inset-0 z-(--z-modal) flex flex-col bg-bg-layer-default"
      >
        <TopNavigation type="standard">
          <TopNavigationBackButton
            fallbackHref="/desk/settings?section=account"
            onClick={onBack}
          />
          <TopNavigationTitle>{t("title")}</TopNavigationTitle>
        </TopNavigation>
        {/* 본문 아래 여백 = 띠 높이는 flex 가 맡는다 — 본문이 띠 위에서 끝까지 스크롤된다 */}
        <div className="min-h-0 flex-1 overflow-y-auto pb-x6">{body}</div>
        {ready && (
          // 바닥 띠 — 스낵바는 이 띠 위 8 에 선다(SnackbarAvoidOverlap). 아래 16 + 안전 영역
          <SnackbarAvoidOverlap>
            <div className="shrink-0 border-t border-stroke-neutral-subtle px-global-gutter pt-x3 pb-[calc(var(--spacing-x4)+env(safe-area-inset-bottom))]">
              {action}
            </div>
          </SnackbarAvoidOverlap>
        )}
        {confirm}
      </div>
    );
  }

  return (
    <>
      <ManagerHead title={t("title")} />
      <Card body="list" className={ready ? "pb-0" : undefined}>
        {body}
        {ready && (
          // 카드 바닥 줄 — 위 끝까지 선(표의 마지막 줄 선) · 좌우 24 · 위아래 12 · 오른쪽 맞춤.
          // 글 단추(해지)는 버튼 좌우 14 + 오른쪽 10 = 글 끝이 카드 안 24, 채운 단추(시작)는 상자 끝이 보이므로 블리드 없이 24
          <div
            className={`flex justify-end py-x3 pl-x6 ${isPro ? "pr-x2_5" : "pr-x6"}`}
          >
            {action}
          </div>
        )}
      </Card>
      {confirm}
    </>
  );
}

/** 있음 ✓ 18 / 없음 − 18 — 이름 "있음" · "없음"(화면 읽기용) */
function FeatureMark({ on }: { on: boolean }) {
  const { t } = useTranslation("subscription");
  return on ? (
    <>
      <Check aria-hidden className="inline size-[18px] text-fg-neutral" />
      <span className="sr-only">{t("featureYes")}</span>
    </>
  ) : (
    <>
      <Minus aria-hidden className="inline size-[18px] text-fg-disabled" />
      <span className="sr-only">{t("featureNo")}</span>
    </>
  );
}

/** 불러오는 중 — 줄 모양 그대로(앞 22 사각 · 제목 t5 · 설명 t3, 위아래 12 · 좌우 24) */
function SkeletonRows({ count }: { count: number }) {
  return (
    <div data-subscription-skeleton aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex items-start px-global-gutter py-x3">
          <Skeleton radius="4" className="mr-x3 size-[22px] shrink-0" />
          <div className="flex min-w-0 flex-1 flex-col gap-x0_5">
            <Skeleton radius="4" text="t5" className="w-2/5" />
            <Skeleton radius="4" text="t3" className="w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}
