import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Check, Minus, Sparkles, TrendingUp } from "lucide-react";
import { ConfirmDialog, ModalShell } from "@/shared/ui/groo/dialogs";
import { ModalFooter } from "@/shared/ui/groo/modal-footer";
import { Badge } from "@/shared/ui/badge";
import { Card } from "@/shared/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/shared/ui/toggle-group";
import { KRW, money, wonPrefix } from "@/shared/lib/groo/format";
import { toLocalDateKey } from "@/shared/lib/date";
import {
  useMyFeatures,
  useMySubscription,
  useSubscribe,
  useCancelSubscription,
  useSubscriptionPlans,
} from "@/features/subscription/model/useSubscription";

interface SubFeature {
  labelKey: string;
  free: boolean;
  pro: boolean;
  star?: boolean;
}

// Pro 가 실제로 더 주는 것은 증권 하나다 — 플랜 features 는 `["SECURITIES"]` 뿐이고
// 서버·웹 게이트도 증권 API·시세 스냅샷·증권 탭·자산 실시간 평가에만 걸려 있다.
// 거래 건수·가져오기/내보내기·캘린더 공유·카드 혜택에는 어떤 제한도 없으므로
// 여기에 적지 않는다 — 표에만 있는 제한은 광고가 된다(QA #161).
const SUB_FEATURES: SubFeature[] = [
  { labelKey: "feature.core", free: true, pro: true },
  { labelKey: "feature.budget", free: true, pro: true },
  { labelKey: "feature.securities", free: false, pro: true, star: true },
];

function FeatureCell({ val, accent }: { val: boolean; accent?: boolean }) {
  if (val)
    return (
      <Check
        size={15}
        style={{
          color: accent ? "var(--fg-brand)" : "var(--status-success-fg)",
        }}
      />
    );
  return <Minus size={15} style={{ color: "var(--fg-disabled)" }} />;
}

/**
 * 구독 관리 모달 — Free/Pro 플랜 비교 + 결제 주기 + 기능 비교표.
 * PG 미연동이라 'Pro 시작하기'는 self-grant(useSubscribe)로 즉시 구독된다.
 */
export function SubscriptionDialog({
  onClose,
  mobile,
}: {
  onClose: () => void;
  mobile: boolean;
}) {
  const { t } = useTranslation("subscription");
  const { t: tCommon } = useTranslation("common");
  const featuresQ = useMyFeatures();
  const subQ = useMySubscription();
  const plansQ = useSubscriptionPlans();
  const subscribe = useSubscribe();
  const cancel = useCancelSubscription();

  const [cycle, setCycle] = useState<"monthly" | "yearly">("monthly");
  const [confirmOpen, setConfirmOpen] = useState(false);

  const isPro = featuresQ.data?.features?.includes("SECURITIES") ?? false;
  const sub = subQ.data;
  // currentPeriodEnd 는 서버가 시간대 없이 주는 `[UTC]` (백엔드 UserSubscription 의
  // LocalDateTime). 자르면 UTC 날짜가 나와 KST(+9)에서 하루 이르게 보인다 —
  // 설정 화면(SettingsPage)의 '다음 결제'와 같은 값이라 같은 방식으로 읽어야
  // 두 화면이 다른 날짜를 말하지 않는다.
  // 못 읽는 값이면 원문 앞 10자로 떨어뜨린다 — 앱(subscription_sheet.dart·account_screen.dart)과
  // 같은 폴백이다. null 로 두면 날짜가 통째로 사라져 앱은 날짜를 보여 주는데 웹만 안 보여 준다.
  const periodEnd = sub?.currentPeriodEnd
    ? (toLocalDateKey(sub.currentPeriodEnd) ??
      sub.currentPeriodEnd.slice(0, 10))
    : null;
  // 해지해도 서버는 자동갱신만 끄고 **기간 끝까지 Pro 를 유지한다**(desk-back #332).
  // 그래서 유예 기간에도 이 배너는 Pro 로 서고 날짜도 그대로 남는데, 그날은 더 이상
  // 결제일이 아니라 **종료일**이다 — "다음 결제 10-11" 은 있지도 않은 결제를 예고한다.
  // 자동갱신이 꺼져 있을 때만 종료일로 말하고, 켜져 있으면(=정상 구독) 종전 문구가 맞다.
  // `=== false` 로 좁히는 건 값이 안 왔을 때(undefined) 기존 동작을 그대로 두려는 것이다.
  const periodLabel = periodEnd
    ? sub?.autoRenew === false
      ? t("activeUntil", { date: periodEnd })
      : t("nextBill", { date: periodEnd })
    : null;
  const upgradePlan = plansQ.data?.[0];

  const proMonthly = 9_900;
  const proYearly = 99_000;
  const proPrice = cycle === "monthly" ? proMonthly : proYearly;
  const proPerMonth =
    cycle === "monthly" ? proMonthly : Math.round(proYearly / 12);
  const savePct = Math.round((1 - proYearly / (proMonthly * 12)) * 100);

  const onSubscribe = () =>
    subscribe.mutate(upgradePlan?.planCode ?? "SECURITIES", {
      onSuccess: () => {
        toast.success(t("toast.subscribed"));
        onClose();
      },
      onError: () => toast.error(t("toast.subscribeFailed")),
    });
  const onCancel = () =>
    cancel.mutate(undefined, {
      onSuccess: () => {
        toast.success(t("toast.canceled"));
        onClose();
      },
      onError: () => toast.error(t("toast.cancelFailed")),
    });

  // 앱 시트 footer 정합 — [닫기 | 구독 해지(danger)] / [닫기 | Pro 시작하기(primary)].
  // 구독 해지는 ModalFooter 주액션(destructive)으로 두고, 확인 다이얼로그는 controlled 로 띄운다.
  const Footer = isPro ? (
    <ModalFooter
      fullWidth
      onCancel={onClose}
      cancelLabel={tCommon("close")}
      onSave={() => setConfirmOpen(true)}
      saveLabel={t("cancelSub")}
      saveVariant="destructive"
    />
  ) : (
    <ModalFooter
      fullWidth
      onCancel={onClose}
      cancelLabel={tCommon("close")}
      onSave={onSubscribe}
      saveLabel={t("startPro")}
      saving={subscribe.isPending}
    />
  );

  return (
    <ModalShell
      title={t("title")}
      onClose={onClose}
      size="lg"
      footer={Footer}
      mobile={mobile}
    >
      {/* 현재 플랜 배너 — Card.brand (bg-brand-subtle + soft brand border) */}
      <Card
        variant="brand"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          padding: "16px",
          marginBottom: 16,
          borderColor: "var(--border-brand-soft)",
        }}
      >
        <span
          style={{
            width: 44,
            height: 44,
            borderRadius: "var(--radius-md)",
            flexShrink: 0,
            background: "var(--bg-brand)",
            color: "var(--fg-on-brand)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Sparkles size={20} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: "var(--text-body-md)",
              fontWeight: 700,
              color: "var(--fg-primary)",
            }}
          >
            {isPro ? t("proInUse") : t("freeInUse")}
          </div>
          <div
            style={{
              fontSize: "var(--text-caption)",
              color: "var(--fg-secondary)",
              marginTop: 2,
            }}
          >
            {isPro
              ? periodLabel
                ? `${periodLabel} · ${money(proMonthly)}`
                : `${money(proMonthly)}`
              : t("freeLocked")}
          </div>
        </div>
      </Card>

      {/* 증권 스포트라이트 — Card.muted + page 톤 override (앱 bgSunken 정합: surface 보다
          어두운 sunken. 웹 --bg-muted 는 다크에서 surface 보다 밝아 앱과 반대라 --bg-canvas 사용) */}
      <Card
        variant="muted"
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 12,
          padding: "14px 16px",
          marginBottom: 18,
          background: "var(--bg-canvas)",
        }}
      >
        <span
          style={{
            width: 36,
            height: 36,
            borderRadius: "var(--radius-md)",
            flexShrink: 0,
            background: "var(--status-danger-subtle)",
            color: "var(--status-danger-fg)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <TrendingUp size={18} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: "var(--text-body-sm)",
              fontWeight: 700,
              color: "var(--fg-primary)",
            }}
          >
            {t("spotlightTitle")}
          </div>
          <div
            style={{
              fontSize: "var(--text-caption)",
              color: "var(--fg-secondary)",
              marginTop: 3,
              lineHeight: 1.5,
            }}
          >
            {t("spotlightDesc")}
          </div>
        </div>
      </Card>

      {/* 결제 주기 토글 — ToggleGroup segmented (앱 PSegmented 정합) */}
      <ToggleGroup
        type="single"
        variant="segmented"
        value={cycle}
        onValueChange={(v) => v && setCycle(v as "monthly" | "yearly")}
        style={{ marginBottom: 14 }}
      >
        <ToggleGroupItem value="monthly" variant="segmented">
          {t("cycleMonthly")}
        </ToggleGroupItem>
        <ToggleGroupItem value="yearly" variant="segmented">
          {t("cycleYearly", { pct: savePct })}
        </ToggleGroupItem>
      </ToggleGroup>

      {/* 플랜 비교 카드 — 모바일(drawer)에서도 앱처럼 항상 2열 나란히 */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 12,
          marginBottom: 18,
        }}
      >
        <Card variant="bordered" style={{ padding: 16 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 8,
            }}
          >
            <span
              style={{
                fontSize: "var(--text-body-sm)",
                fontWeight: 700,
                color: "var(--fg-primary)",
              }}
            >
              Free
            </span>
            {!isPro && <Badge variant="secondary">{t("currentPlan")}</Badge>}
          </div>
          <div
            className="num"
            style={{
              fontSize: "var(--text-display-sm)",
              fontWeight: 700,
              color: "var(--fg-primary)",
              letterSpacing: "-0.02em",
            }}
          >
            0원
          </div>
          <div
            style={{
              fontSize: "var(--text-caption)",
              color: "var(--fg-tertiary)",
              marginTop: 2,
            }}
          >
            {t("freeDesc")}
          </div>
        </Card>
        <Card
          variant="bordered"
          style={{
            padding: 16,
            borderColor: "var(--border-brand)",
            borderWidth: 2,
            position: "relative",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 8,
            }}
          >
            <span
              style={{
                fontSize: "var(--text-body-sm)",
                fontWeight: 700,
                color: "var(--fg-brand)",
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <Sparkles size={13} /> Pro
            </span>
            {isPro && <Badge variant="default">{t("currentPlan")}</Badge>}
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
            <span
              className="num"
              style={{
                fontSize: "var(--text-display-sm)",
                fontWeight: 700,
                color: "var(--fg-primary)",
                letterSpacing: "-0.02em",
              }}
            >
              {money(proPrice)}
            </span>
            <span
              style={{
                fontSize: "var(--text-caption)",
                color: "var(--fg-tertiary)",
              }}
            >
              / {cycle === "monthly" ? t("perMonth") : t("perYear")}
            </span>
          </div>
          <div
            style={{
              fontSize: "var(--text-caption)",
              color: "var(--fg-tertiary)",
              marginTop: 2,
            }}
          >
            {cycle === "yearly"
              ? t("pricePerMonthNote", {
                  price: `${wonPrefix()}${KRW(proPerMonth)}`,
                  pct: savePct,
                })
              : t("monthlyBilling")}
          </div>
        </Card>
      </div>

      {/* 기능 비교표 — Card.bordered (행 모서리 라운딩은 overflow:hidden 으로 clip) */}
      <div
        style={{
          fontSize: "var(--text-caption)",
          fontWeight: 700,
          color: "var(--fg-tertiary)",
          letterSpacing: "0.04em",
          marginBottom: 8,
        }}
      >
        {t("comparisonTitle")}
      </div>
      <Card variant="bordered" style={{ overflow: "hidden" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 52px 52px",
            alignItems: "center",
            padding: "8px 14px",
            background: "var(--bg-table-head)",
          }}
        >
          <span
            style={{
              fontSize: "var(--text-caption)",
              color: "var(--fg-tertiary)",
              fontWeight: 600,
            }}
          >
            {t("colFeature")}
          </span>
          <span
            style={{
              fontSize: "var(--text-caption)",
              color: "var(--fg-tertiary)",
              fontWeight: 600,
              textAlign: "center",
            }}
          >
            Free
          </span>
          <span
            style={{
              fontSize: "var(--text-caption)",
              color: "var(--fg-brand)",
              fontWeight: 700,
              textAlign: "center",
            }}
          >
            Pro
          </span>
        </div>
        {SUB_FEATURES.map((f, i) => (
          <div
            key={i}
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 52px 52px",
              alignItems: "center",
              padding: "11px 14px",
              borderTop: "1px solid var(--border-subtle)",
              background: f.star ? "var(--bg-brand-subtle)" : "transparent",
            }}
          >
            <span
              style={{
                fontSize: "var(--text-label-sm)",
                color: "var(--fg-primary)",
                fontWeight: f.star ? 700 : 500,
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                minWidth: 0,
              }}
            >
              {f.star && (
                <TrendingUp
                  size={13}
                  style={{ color: "var(--status-danger-fg)", flexShrink: 0 }}
                />
              )}
              {t(f.labelKey)}
            </span>
            <span
              style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <FeatureCell val={f.free} />
            </span>
            <span
              style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <FeatureCell val={f.pro} accent={f.star} />
            </span>
          </div>
        ))}
      </Card>

      {/* 구독 해지 확인 — footer '구독 해지'(destructive) 클릭 시 controlled 로 표시 */}
      {confirmOpen && (
        <ConfirmDialog
          title={t("cancelConfirmTitle")}
          message={t("cancelConfirmDesc", {
            date: periodEnd ?? t("expiryDate"),
          })}
          confirmLabel={t("cancelSub")}
          cancelLabel={t("keepSub")}
          danger
          loading={cancel.isPending}
          onCancel={() => setConfirmOpen(false)}
          onConfirm={onCancel}
        />
      )}
    </ModalShell>
  );
}
