import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  useLocation,
  useNavigate,
  useOutletContext,
  useParams,
} from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useConfirmFail } from "@/shared/lib/confirm-fail";
import {
  Eye,
  EyeOff,
  EllipsisVertical,
  Pencil,
  SearchX,
  Trash2,
} from "lucide-react";
import { Button } from "@/shared/ds/button";
import {
  ResponsiveMenu,
  ResponsiveMenuContent,
  ResponsiveMenuGroup,
  ResponsiveMenuItem,
  ResponsiveMenuTrigger,
} from "@/shared/ds/menu";
import { ResultSection } from "@/shared/ds/result-section";
import { Skeleton } from "@/shared/ds/skeleton";
import { useSnackbar } from "@/shared/ds/snackbar";
import { Toggle } from "@/shared/ds/toggle";
import {
  TopNavigation,
  TopNavigationActions,
  TopNavigationBackButton,
  TopNavigationIconButton,
  TopNavigationTitle,
} from "@/shared/ds/top-navigation";
import { PageHead } from "@/shared/ui/groo/page-head";
import { ParentLink } from "@/shared/ui/groo/parent-link";
import { ConfirmDialog } from "@/shared/ui/groo/dialogs";
import { BandFailure } from "@/shared/ui/groo/band-parts";
import { useAssets, useDeleteAsset, useUpdateAsset } from "@/features/asset";
import {
  AssetDetailView,
  AssetLogo48,
  useAssetDescription,
} from "@/widgets/asset-full";
import { AssetEditDialog } from "@/widgets/asset-full/ui/AssetEditDialog";
import { HideAmountsUnlockSurface } from "@/widgets/account-settings/ui/HideAmountsUnlockSurface";
import type { Asset, AssetUpdateFormValues } from "@/entities/asset";

const ASSET_LIST = "/desk/asset";
const MANAGER = "/desk/settings?section=accounts";

/** 어디서 들어왔나(`location.state.from`) — 자산 화면이면 "자산", 계좌·카드 관리면 그 이름. 주소로 바로 열면 "자산"(I-17 42) */
function useParent() {
  const { t } = useTranslation("asset");
  const { t: tl } = useTranslation("layout");
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;
  return from === "accounts"
    ? { to: MANAGER, label: t("manager.title") }
    : { to: ASSET_LIST, label: tl("asset") };
}

/** 앞 화면이 있나 — 있으면 한 걸음 뒤로, 없으면(주소로 바로 · 새로 고침) 부모 주소로 바꿔 간다 */
function useLeave(fallback: string) {
  const navigate = useNavigate();
  return () => {
    const idx = (window.history.state as { idx?: unknown } | null)?.idx;
    if (typeof idx === "number" && idx > 0) navigate(-1);
    else navigate(fallback, { replace: true });
  };
}

/**
 * 자산 상세 페이지 `/desk/asset/:assetId`(I-17 34 ~ 44) — 시트 · 대화상자가 아니라 주소가 있는 화면이다.
 * 폰: 상단 바(← + "{종류} 상세" + 아이콘 둘 [수정] [⋯]) + 흰 면 하나. 768 이상: 제목 줄 위 "‹ {부모}" → 제목 줄(로고 48 · 이름 · 설명 ·
 * 금액 가리기 Toggle · [수정] · ⋯) → 카드(1280 이상 두 칸 · 미만 한 칸 720).
 * 수정 폼 · 지금 결제 · 확인창 · 본인 확인은 이 페이지 위에 하나씩 뜬다.
 */
export function AssetDetailPage() {
  const { mobile } = useOutletContext<{ mobile: boolean }>();
  const navigate = useNavigate();
  const { assetId } = useParams();
  const { t } = useTranslation("asset");
  const parent = useParent();
  const leave = useLeave(parent.to);
  const assetsQ = useAssets({ silent: true });
  const id = Number(assetId);
  const asset: Asset | undefined = Number.isInteger(id)
    ? assetsQ.data?.assets.find((a) => a.rowId === id)
    : undefined;

  if (assetsQ.isLoading) {
    return (
      <Frame
        mobile={mobile}
        parent={parent}
        title={t("assetDetail.titleDefault")}
      >
        <div aria-hidden className="px-global-gutter pt-x4">
          <div className="flex items-center gap-x3">
            <Skeleton radius="12" className="size-x12 shrink-0" />
            <div className="flex-1">
              <Skeleton text="t6" className="w-1/2" />
              <Skeleton text="t3" className="mt-x1 w-1/3" />
            </div>
          </div>
          <Skeleton className="mt-x6 h-x8 w-2/3" radius="8" />
          <Skeleton className="mt-x6 h-x40 w-full" radius="8" />
        </div>
      </Frame>
    );
  }
  if (assetsQ.isError && !assetsQ.data) {
    return (
      <Frame
        mobile={mobile}
        parent={parent}
        title={t("assetDetail.titleDefault")}
      >
        <BandFailure
          size={mobile ? "large" : "medium"}
          title={t("assetDetail.assetLoadFailed")}
          onRetry={() => void assetsQ.refetch()}
        />
      </Frame>
    );
  }
  if (!asset) {
    return (
      <Frame
        mobile={mobile}
        parent={parent}
        title={t("assetDetail.titleDefault")}
      >
        <ResultSection
          kind="empty"
          size={mobile ? "large" : "medium"}
          icon={<SearchX aria-hidden />}
          title={t("assetDetail.notFoundTitle")}
          description={t("assetDetail.notFoundDesc")}
          primaryAction={{
            label: t("assetDetail.toAssets"),
            onClick: () => navigate(ASSET_LIST, { replace: true }),
          }}
        />
      </Frame>
    );
  }
  return <Loaded asset={asset} mobile={mobile} parent={parent} leave={leave} />;
}

function Loaded({
  asset,
  mobile,
  parent,
  leave,
}: {
  asset: Asset;
  mobile: boolean;
  parent: { to: string; label: string };
  leave: () => void;
}) {
  const { t } = useTranslation("asset");
  const { t: tc } = useTranslation("common");
  // 수정 폼 저장 실패는 폼 맨 위 Callout(고정 글)이, 숨김 토글 실패는 critical 스낵바가 알린다 — 둘 다 silent(서버 원문 토스트 없음).
  // 요청 상태가 섞이지 않게 훅 인스턴스를 나눈다(토글 실패가 폼 Callout 으로 새지 않게)
  const updateAsset = useUpdateAsset({ silent: true });
  const hideAsset = useUpdateAsset({ silent: true });
  const snackbar = useSnackbar();
  // 이중 제출 가드 — 같은 프레임의 두 번째 누름은 렌더 전 클로저라 isPending 이 아직 false 다. 누르는 순간 켜고 끝나면(성공 · 실패) 끈다
  const savingRef = useRef(false);
  const deleteAsset = useDeleteAsset();
  const confirmFail = useConfirmFail();
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [unlockOpen, setUnlockOpen] = useState(false);
  const description = useAssetDescription(asset);
  const assetHidden = asset.isAmountHidden === "Y";
  const isCard =
    asset.assetType === "CREDIT_CARD" || asset.assetType === "CHECK_CARD";
  // 삭제 확인 제목 — 자산 종류를 따른다(관리 화면 · 앱과 같은 키 · 같은 글, #508 짝 표)
  const deleteTitle = isCard
    ? t("deleteConfirm.titleCard")
    : asset.assetType === "INVESTMENT"
      ? t("deleteConfirm.titleInvest")
      : t("deleteConfirm.titleAccount");
  const title = isCard
    ? t("assetDetail.titleCard")
    : asset.assetType === "INVESTMENT"
      ? t("assetDetail.titleInvest")
      : t("assetDetail.titleAccount");

  // 이 자산만 가렸는지를 켜고 끈다 — 켜는 건 바로, 푸는 건 본인 확인을 거친다(카드 가리기와 같은 규칙)
  // 실패하면 값은 서버 것 그대로(Toggle 은 asset 에서 읽는다 = 되돌림) + critical 스낵바 한 문장, [다시 시도] 없음
  const applyHidden = (next: "Y" | "N") =>
    hideAsset.mutate(
      {
        id: asset.rowId,
        // 이름 · 종류를 함께 싣는 건 폼 타입이 필수로 요구해서다. 서버 PUT 은 "키가 없으면 유지" 라 지금 값 그대로다
        data: {
          assetName: asset.assetName,
          assetType: asset.assetType,
          isAmountHidden: next,
        },
      },
      {
        onError: () =>
          snackbar.show({
            message: t("assetDetail.hideFailed"),
            tone: "critical",
          }),
      },
    );

  const saveEdit = (values: AssetUpdateFormValues) => {
    if (savingRef.current) return;
    savingRef.current = true;
    updateAsset.reset();
    updateAsset.mutate(
      { id: asset.rowId, data: values },
      {
        onSettled: () => (savingRef.current = false),
        onSuccess: () => setEditing(false),
      },
    );
  };

  const moreName = t("assetDetail.moreOf", { name: asset.assetName });
  const menu = (trigger: ReactNode) => (
    <ResponsiveMenu>
      <ResponsiveMenuTrigger asChild>{trigger}</ResponsiveMenuTrigger>
      <ResponsiveMenuContent title={asset.assetName} align="end">
        <ResponsiveMenuGroup>
          <ResponsiveMenuItem
            label={tc("delete")}
            icon={<Trash2 aria-hidden />}
            tone="critical"
            onSelect={() => setConfirmDelete(true)}
          />
        </ResponsiveMenuGroup>
      </ResponsiveMenuContent>
    </ResponsiveMenu>
  );

  const head = mobile ? (
    <TopNavigation type="standard">
      <TopNavigationBackButton fallbackHref={parent.to} onClick={leave} />
      <TopNavigationTitle>{title}</TopNavigationTitle>
      <TopNavigationActions>
        <TopNavigationIconButton
          aria-label={tc("edit")}
          onClick={() => setEditing(true)}
        >
          <Pencil aria-hidden />
        </TopNavigationIconButton>
        {menu(
          <TopNavigationIconButton aria-label={moreName}>
            <EllipsisVertical aria-hidden />
          </TopNavigationIconButton>,
        )}
      </TopNavigationActions>
    </TopNavigation>
  ) : null;

  const body = (
    <AssetDetailView
      asset={asset}
      desk={!mobile}
      mobile={mobile}
      onEdit={() => setEditing(true)}
    />
  );

  return (
    <>
      {mobile ? (
        <>
          {head}
          <div className="flex flex-1 flex-col bg-bg-layer-default">{body}</div>
        </>
      ) : (
        <DeskFrame parent={parent}>
          <PageHead
            style={{ marginBottom: "var(--spacing-x6)" }}
            leading={<AssetLogo48 asset={asset} />}
            title={asset.assetName}
            description={description || undefined}
            actions={
              <>
                {/* 이 자산의 속성을 켜고 끈다 — 이름은 고정 "금액 가리기", 아이콘은 지금 상태(가렸으면 eye-off) */}
                <Toggle
                  aria-label={t("assetDetail.hideAmounts")}
                  pressed={assetHidden}
                  icon={
                    assetHidden ? <EyeOff aria-hidden /> : <Eye aria-hidden />
                  }
                  onPressedChange={(next) => {
                    if (next) applyHidden("Y");
                    else setUnlockOpen(true);
                  }}
                />
                <Button
                  type="button"
                  variant="neutralOutline"
                  size="small"
                  onClick={() => setEditing(true)}
                >
                  {tc("edit")}
                </Button>
                {menu(
                  <Button
                    type="button"
                    variant="ghost"
                    layout="iconOnly"
                    aria-label={moreName}
                  >
                    <EllipsisVertical aria-hidden />
                  </Button>,
                )}
              </>
            }
          />
          {body}
        </DeskFrame>
      )}

      {editing && (
        <AssetEditDialog
          item={asset}
          onClose={() => {
            updateAsset.reset();
            setEditing(false);
          }}
          onCreate={() => undefined}
          onUpdate={saveEdit}
          isSubmitting={updateAsset.isPending}
          saveFailed={updateAsset.isError}
          saveError={updateAsset.error}
        />
      )}
      {confirmDelete && (
        <ConfirmDialog
          title={deleteTitle}
          message={t("deleteConfirm.messageDetail", { name: asset.assetName })}
          confirmLabel={t("deleteConfirm.confirm")}
          danger
          loading={deleteAsset.isPending}
          onCancel={() => {
            if (!deleteAsset.isPending) setConfirmDelete(false);
          }}
          onConfirm={() =>
            deleteAsset.mutateAsync(asset.rowId).then(
              // 지우면 ← 와 같은 길로 돌아간다 — 돌아간 목록에서 그 줄이 사라진 모습
              () => {
                setConfirmDelete(false);
                leave();
              },
              // 실패 — 확인창을 닫고 critical 스낵바. [다시 시도] 는 묻지 않고 바로 재요청
              (error: unknown) => {
                setConfirmDelete(false);
                confirmFail({
                  error,
                  message: t("deleteConfirm.failed"),
                  retry: () => deleteAsset.mutateAsync(asset.rowId),
                  // 스낵바를 띄운 채 이미 화면을 떠났으면 한 번 더 뒤로 가지 않는다
                  onRetried: () => {
                    if (mounted.current) leave();
                  },
                });
              },
            )
          }
        />
      )}
      <HideAmountsUnlockSurface
        open={unlockOpen}
        onOpenChange={setUnlockOpen}
        onVerified={() => applyHidden("N")}
      />
    </>
  );
}

/** 768 이상 본문 틀 — 위 20 · 좌우 32 · 아래 56, 768 ~ 1279 한 칸 720 · 1280 이상 두 칸 최대 1040 가운데. "‹ {부모}" 아래 4 */
function DeskFrame({
  parent,
  children,
}: {
  parent: { to: string; label: string };
  children: ReactNode;
}) {
  return (
    <div
      data-slot="asset-detail-desktop"
      className="px-[var(--layout-margin)] pb-screen-bottom pt-nav-to-title"
    >
      <div className="mx-auto w-full max-w-[var(--layout-max-low)] lg:max-w-[var(--layout-max-medium)]">
        <div className="mb-x1">
          <ParentLink to={parent.to} label={parent.label} />
        </div>
        {children}
      </div>
    </div>
  );
}

/** 불러오는 중 · 실패 · 없음 — 틀(폰 상단 바 · 데스크톱 "‹ {부모}" 와 제목 줄 자리)은 그리고 본문 자리만 바꾼다 */
function Frame({
  mobile,
  parent,
  title,
  children,
}: {
  mobile: boolean;
  parent: { to: string; label: string };
  title: string;
  children: ReactNode;
}) {
  const { t } = useTranslation("layout");
  const leave = useLeave(parent.to);
  if (mobile)
    return (
      <>
        <TopNavigation type="standard">
          <TopNavigationBackButton fallbackHref={parent.to} onClick={leave} />
          <TopNavigationTitle>{title}</TopNavigationTitle>
        </TopNavigation>
        <div className="flex flex-1 flex-col bg-bg-layer-default">
          {children}
        </div>
      </>
    );
  return (
    <DeskFrame parent={parent}>
      <PageHead
        style={{ marginBottom: "var(--spacing-x6)" }}
        title={t("assetDetail")}
      />
      {children}
    </DeskFrame>
  );
}
