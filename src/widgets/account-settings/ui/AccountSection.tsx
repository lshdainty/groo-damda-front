import { lazy, Suspense, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ChevronRight,
  Eye,
  EyeOff,
  KeyRound,
  Link2,
  LogOut,
  Monitor,
  Sparkles,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { Avatar } from "@/shared/ds/avatar";
import { Badge } from "@/shared/ds/badge";
import { Button } from "@/shared/ds/button";
import { Callout } from "@/shared/ds/callout";
import { Card, CardHeader, CardTitle } from "@/shared/ds/card";
import { List, ListButtonItem, ListHeader, ListItem } from "@/shared/ds/list";
import { Skeleton } from "@/shared/ds/skeleton";
import { ConfirmDialog } from "@/shared/ui/groo/dialogs";
import { isEn } from "@/shared/lib/groo/format";
import { parseServerUtc, toLocalDateKey } from "@/shared/lib/date";
import { ALL_HIDE_CARDS } from "@/shared/lib/groo/hide-amounts-cards";
import { useHiddenCards } from "@/shared/lib/groo/hide-amounts-core";
import { useCurrentUser, WithdrawDialog } from "@/features/user";
import { useAuth } from "@/features/auth";
import { SubscriptionDialog } from "@/features/subscription/ui/SubscriptionDialog";
import { SecuritiesLinkDialog } from "@/features/subscription/ui/SecuritiesLinkDialog";
import {
  useMyFeatures,
  useMySubscription,
} from "@/features/subscription/model/useSubscription";
import {
  oauthLinkApi,
  useOAuthProviders,
  useUnlinkOAuth,
} from "@/features/oauth-link";

/*
 * 비밀번호 변경 대화상자만 지연 로딩한다.
 *
 * 이 대화상자가 레포에서 **유일하게 zod 를 쓰는 곳**이라, 같이 묶이면 설정 화면에
 * 들어오기만 해도 검증 라이브러리를 통째로 받는다(gzip 19 KB). 실제로 여는 사람은
 * 비밀번호를 바꿀 때뿐이라 그때 받는다.
 */
const PasswordChangeDialog = lazy(() =>
  import("@/widgets/sidebar/ui/PasswordChangeDialog").then((m) => ({
    default: m.PasswordChangeDialog,
  })),
);

/**
 * 계정 구역(I-14 B · C) — 폰은 흰 면 하나(머리 → 목록 제목 + 줄), 768 이상은 프로필 가로 카드 + 묶음마다 카드(사이 8).
 * 줄은 두 갈래가 같은 부품(ds List)이고 감싸는 것(흰 면 · 카드)만 다르다.
 */
export function AccountSection({
  mobile,
  onOpenHideAmounts,
  onOpenDevices,
}: {
  mobile: boolean;
  /** 보안 > 금액 가리기 — 카드 37장을 훑는 목록이라 자기 화면으로 보낸다. */
  onOpenHideAmounts: () => void;
  onOpenDevices: () => void;
}) {
  const { t } = useTranslation("settings");
  const { t: tu } = useTranslation("user");
  const { data: user } = useCurrentUser();
  const { logout } = useAuth();
  const [pwDialogOpen, setPwDialogOpen] = useState(false);
  // 다시 로그인해야 돌아올 수 있다 — 앱은 이미 한 번 더 묻는다.
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [confirmWithdraw, setConfirmWithdraw] = useState(false);
  const [subOpen, setSubOpen] = useState(false);
  const [securitiesOpen, setSecuritiesOpen] = useState(false);

  const hiddenCount = useHiddenCards().size;

  const featuresQ = useMyFeatures();
  const subQ = useMySubscription();
  const isPro = featuresQ.data?.features?.includes("SECURITIES") ?? false;
  // currentPeriodEnd 는 서버가 시간대 없이 주는 `[UTC]` (백엔드 UserSubscription 의
  // LocalDateTime). 문자열을 자르면 UTC 날짜가 그대로 나와, UTC 15:00 이후에 갱신된
  // 구독은 KST(+9)에서 다음 결제일이 **항상 하루 이르게** 보인다. 로컬 날짜로 옮긴다.
  // 못 읽는 값이면 원문 앞 10자로 떨어뜨린다 — 앱과 같은 폴백이다.
  const periodEnd = subQ.data?.currentPeriodEnd;
  const nextBill = periodEnd
    ? (toLocalDateKey(periodEnd) ?? periodEnd.slice(0, 10))
    : null;

  // 가입 시각은 서버가 시간대 없이 주는 `[UTC]` — 그대로 읽으면 로컬로 둔갑해
  // 월말·월초 가입자가 한 달 이른/늦은 달로 보인다.
  const joinedAt = parseServerUtc(user?.joinedAt);
  const joinedText = joinedAt
    ? t("account.joined", {
        date: isEn()
          ? joinedAt.toLocaleDateString("en", {
              year: "numeric",
              month: "short",
            })
          : `${joinedAt.getFullYear()}년 ${joinedAt.getMonth() + 1}월`,
      })
    : null;

  const name = user?.userName ?? t("account.defaultName");
  const email = user?.userEmail ?? "";

  const badge = (
    <Badge variant="weak" tone={isPro ? "brand" : "neutral"}>
      {isPro ? "Pro" : "Free"}
    </Badge>
  );
  // [수정] 은 개인정보 변경 자리라 아직 열리지 않는다 — 누르는 동작이 있는 척하지 않고 막은 단추 + 이유 Callout 이다
  // (D3 B). 단추의 설명(aria-describedby)이 Callout 이라 읽는 이름과 이유가 이어진다.
  const editReasonId = useId();
  const editButton = (
    <Button
      variant="neutralWeak"
      size="small"
      disabled
      aria-describedby={editReasonId}
    >
      {t("account.edit")}
    </Button>
  );
  const editReason = (
    <Callout id={editReasonId} tone="informative">
      {t("account.editSoon")}
    </Callout>
  );

  return (
    <div
      className={
        mobile
          ? "pb-[calc(var(--spacing-x6)+env(safe-area-inset-bottom))]"
          : "flex flex-col gap-x2"
      }
    >
      {mobile ? (
        <div
          data-account-head
          className="flex flex-col items-center px-global-gutter pt-x6 text-center"
        >
          <Avatar name={name} size={80} />
          <div className="mt-x3 max-w-full break-keep font-sans text-t7 font-bold text-fg-neutral [overflow-wrap:anywhere]">
            {name}
          </div>
          {email && (
            <div className="mt-x1 max-w-full font-sans text-t4 text-fg-neutral-subtle [overflow-wrap:anywhere]">
              {email}
            </div>
          )}
          <div className="mt-x3 flex items-center gap-x2">
            {editButton}
            {badge}
          </div>
          {joinedText && (
            <div className="mt-x2 font-sans text-t3 text-fg-neutral-subtle">
              {joinedText}
            </div>
          )}
          <div className="mt-x4 w-full text-start">{editReason}</div>
        </div>
      ) : (
        <Card data-account-head>
          <div className="flex items-center gap-x5">
            <Avatar name={name} size={80} className="shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="break-keep font-sans text-t7 font-bold text-fg-neutral [overflow-wrap:anywhere]">
                {name}
              </div>
              {email && (
                <div className="mt-x1 font-sans text-t4 text-fg-neutral-subtle [overflow-wrap:anywhere]">
                  {email}
                </div>
              )}
              {joinedText && (
                <div className="mt-x1 font-sans text-t3 text-fg-neutral-subtle">
                  {joinedText}
                </div>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-x2">
              {badge}
              {editButton}
            </div>
          </div>
          <div className="mt-x4">{editReason}</div>
        </Card>
      )}

      {/* 보안 */}
      <AccountGroup mobile={mobile} label={t("account.group.security")}>
        <ListButtonItem
          prefix={<KeyRound aria-hidden />}
          title={tu("passwordChange")}
          detail={t("account.password.desc")}
          onClick={() => setPwDialogOpen(true)}
        />
        {/* 금액 가리기 — 들어가 보지 않아도 몇 장을 가렸는지 줄에서 보인다. */}
        <ListButtonItem
          prefix={
            hiddenCount > 0 ? <EyeOff aria-hidden /> : <Eye aria-hidden />
          }
          title={t("hideAmounts.label")}
          suffix={
            <>
              <span className="num">
                {hiddenCount} / {ALL_HIDE_CARDS.length}
              </span>
              <ChevronRight aria-hidden />
            </>
          }
          onClick={onOpenHideAmounts}
        />
        <ListButtonItem
          prefix={<Monitor aria-hidden />}
          title={t("account.devices.label")}
          suffix={
            <>
              {t("account.devices.desc")}
              <ChevronRight aria-hidden />
            </>
          }
          onClick={onOpenDevices}
        />
      </AccountGroup>

      {/* 연결된 계정 — 연결할 수 있는 소셜은 Google 하나다(I-14 10). */}
      <AccountGroup mobile={mobile} label={t("account.group.connected")}>
        <GoogleRow />
      </AccountGroup>

      {/* 구독·결제 */}
      <AccountGroup mobile={mobile} label={t("account.group.subscription")}>
        <SubscriptionRow
          isPro={isPro}
          nextBill={nextBill}
          autoRenew={subQ.data?.autoRenew}
          onClick={() => setSubOpen(true)}
        />
      </AccountGroup>

      {/* 증권 데이터 연동 — 구독(Pro) 시에만. 증권사가 둘 이상이라 다이얼로그로 분리했다. */}
      {isPro && (
        <AccountGroup mobile={mobile} label={t("account.group.securities")}>
          <ListButtonItem
            prefix={<Link2 aria-hidden />}
            title={t("account.securities.label")}
            detail={t("account.securities.desc")}
            suffix={<ChevronRight aria-hidden />}
            onClick={() => setSecuritiesOpen(true)}
          />
        </AccountGroup>
      )}

      {/* 계정 관리 */}
      <AccountGroup mobile={mobile} label={t("account.group.manage")}>
        <ListButtonItem
          prefix={<LogOut aria-hidden />}
          title={t("account.logout.label")}
          detail={t("account.logout.desc")}
          onClick={() => setConfirmLogout(true)}
        />
        <ListButtonItem
          prefix={<Trash2 aria-hidden className="text-fg-critical" />}
          title={
            <span className="text-fg-critical">
              {t("account.withdraw.label")}
            </span>
          }
          detail={t("account.withdraw.desc")}
          onClick={() => setConfirmWithdraw(true)}
        />
      </AccountGroup>

      {confirmLogout && (
        <ConfirmDialog
          title={t("account.logout.label")}
          message={t("account.logout.confirmMessage")}
          confirmLabel={t("account.logout.label")}
          onCancel={() => setConfirmLogout(false)}
          onConfirm={() => logout()}
        />
      )}

      {confirmWithdraw && (
        <WithdrawDialog
          onClose={() => setConfirmWithdraw(false)}
          // 해지한 사람을 로그인 화면으로 떨어뜨리지 않는다 — 안내 화면으로 보낸다.
          // 보던 자리도 적어 두지 않는다(`remember: false`) — 돌아갈 자리가 없다.
          onWithdrawn={() =>
            logout({ returnTo: "/withdrawn", remember: false })
          }
        />
      )}

      {/* 비밀번호 변경 — 열 때 받는다(위 lazy 주석 참고) */}
      {pwDialogOpen && (
        <Suspense fallback={null}>
          <PasswordChangeDialog open onOpenChange={setPwDialogOpen} />
        </Suspense>
      )}

      {/* 구독 관리 — 14-2 가 페이지로 바꾼다 */}
      {subOpen && (
        <SubscriptionDialog onClose={() => setSubOpen(false)} mobile={mobile} />
      )}
      {securitiesOpen && (
        <SecuritiesLinkDialog
          onClose={() => setSecuritiesOpen(false)}
          mobile={mobile}
        />
      )}
    </div>
  );
}

/**
 * 묶음 — 폰은 목록 제목(boldSolid, 위 16) + 목록, 768 이상은 카드 한 장(머리는 카드 안, 카드 사이 8).
 * 줄은 두 갈래가 같은 부품이다.
 */
function AccountGroup({
  label,
  mobile,
  children,
}: {
  label: string;
  mobile: boolean;
  children: React.ReactNode;
}) {
  const headId = useId();
  if (mobile) {
    return (
      <>
        <ListHeader id={headId} variant="boldSolid" className="mt-x4">
          {label}
        </ListHeader>
        <List aria-labelledby={headId}>{children}</List>
      </>
    );
  }
  return (
    <Card body="list">
      <CardHeader>
        <CardTitle>{label}</CardTitle>
      </CardHeader>
      <List aria-label={label}>{children}</List>
    </Card>
  );
}

/**
 * Google 줄 — 남는 연결된 계정 줄(I-14 10). 서버 목록은 카카오 · 네이버도 주지만 연결할 수 없어 `GOOGLE` 하나만 그린다.
 * 줄 자체는 누르지 않고 뒤 버튼만 누른다. 실패 글은 서버 글 대신 고정 글이다.
 */
function GoogleRow() {
  const { t } = useTranslation("settings");
  const { t: tDs } = useTranslation("ds");
  const providersQ = useOAuthProviders();
  const unlinkGoogle = useUnlinkOAuth();
  const [linking, setLinking] = useState(false);
  const linkingRef = useRef(false);
  const google = providersQ.data?.find((p) => p.type === "GOOGLE");
  const linked = google?.linked ?? false;

  const onLink = async () => {
    if (linkingRef.current) return;
    linkingRef.current = true;
    setLinking(true);
    try {
      // returnUrl = 현재 설정 페이지 절대 URL. 연동 후 그루 계정이 여기로 ?linked/?linkError 를 달고 복귀.
      const { startUrl } = await oauthLinkApi.startLink(
        "google",
        window.location.origin + window.location.pathname,
      );
      window.location.href = startUrl;
    } catch {
      toast.error(t("account.toast.linkError"), { id: "oauth-link-error" });
      linkingRef.current = false;
      setLinking(false);
    }
  };

  const onUnlink = () => {
    unlinkGoogle.mutate("google", {
      // onSuccess 에서 provider 목록 재조회(invalidate) → 상태 자동 갱신.
      onSuccess: () => toast.success(t("account.toast.unlinked")),
      // 다시 하면 되는 가벼운 실패라 "다시 시도" 를 붙인다(snackbar.md)
      onError: () =>
        toast.error(t("account.toast.unlinkError"), {
          id: "oauth-unlink-error",
          action: { label: tDs("common.retry"), onClick: onUnlink },
        }),
    });
  };

  const loading = providersQ.isLoading;
  const failed = providersQ.isError;

  let detail: React.ReactNode;
  if (loading) detail = <Skeleton radius="4" text="t3" className="w-24" />;
  else if (failed) detail = t("account.providersError");
  else detail = linked ? t("account.linked") : t("account.notLinked");

  // 보이는 줄 높이를 다른 줄(46)과 같게 — 버튼(36)의 위아래 7 을 줄 여백에 겹친다. 바탕이 보이는 버튼이라 오른쪽은 겹치지 않는다:
  // 상자 끝이 줄 안 끝선(24)에 닿아 줄의 값 끝과 같다(글만 보이는 버튼의 글 끝 맞춤 블리드를 쓰지 않는다).
  const buttonClass = "-my-[7px]";
  let action: React.ReactNode;
  if (failed) {
    action = (
      <Button
        variant="neutralWeak"
        size="small"
        className={buttonClass}
        loading={providersQ.isRefetching}
        onClick={() => void providersQ.refetch()}
      >
        {tDs("common.retry")}
      </Button>
    );
  } else if (linked) {
    action = (
      <Button
        variant="neutralWeak"
        size="small"
        className={buttonClass}
        disabled={loading}
        loading={unlinkGoogle.isPending}
        onClick={onUnlink}
      >
        {t("account.unlink")}
      </Button>
    );
  } else {
    action = (
      <Button
        variant="neutralWeak"
        size="small"
        className={buttonClass}
        disabled={loading}
        loading={linking}
        onClick={() => void onLink()}
      >
        {t("account.link")}
      </Button>
    );
  }

  return (
    <ListItem
      prefix={
        <span
          aria-hidden
          className="inline-grid size-[22px] place-items-center font-sans text-t5 font-bold text-fg-neutral"
        >
          G
        </span>
      }
      title="Google"
      detail={detail}
      suffix={action}
    />
  );
}

/**
 * 구독·결제 줄 — 담다 Pro. 14-1 은 지금 구독 대화상자를 연다(꺾쇠 없음 · 가격은 지금 값, 14-2 가 서버 값 · 꺾쇠로).
 * 설명이 두 줄을 넘을 수 있어 맞춤 위.
 */
export function SubscriptionRow({
  isPro,
  nextBill,
  autoRenew,
  onClick,
}: {
  isPro: boolean;
  nextBill: string | null;
  /**
   * 구독의 자동갱신 여부. 조회가 아직 안 왔으면 `undefined` — 그땐 종전대로 말한다.
   */
  autoRenew?: boolean;
  onClick: () => void;
  /** 예전 호출처 호환 — 줄 부품이 같아져 쓰지 않는다 */
  mobile?: boolean;
}) {
  const { t } = useTranslation("settings");
  // 해지해도 서버는 자동갱신만 끄고 **기간 끝까지 Pro 를 유지한다**(desk-back #332).
  // 그래서 이 줄은 유예 기간에도 Pro 로 서고 날짜도 그대로 남는데, 그날은 더 이상
  // 결제일이 아니라 **종료일**이다. `=== false` 로 좁히는 건 값이 안 왔을 때(undefined) 기존 동작을 그대로 두려는 것이다.
  const periodLabel = nextBill
    ? autoRenew === false
      ? t("account.sub.proActiveUntil", { date: nextBill })
      : t("account.sub.proActiveBill", { date: nextBill })
    : t("account.sub.proActive");
  return (
    <ListButtonItem
      align="top"
      prefix={<Sparkles aria-hidden />}
      title="담다 Pro"
      detail={isPro ? periodLabel : t("account.sub.proPromo")}
      suffix={isPro ? `9,900원 ${t("account.sub.perMonth")}` : undefined}
      onClick={onClick}
    />
  );
}
