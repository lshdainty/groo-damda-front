import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useConfirmFail } from "@/shared/lib/confirm-fail";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Landmark, Pencil, Plus, Trash2 } from "lucide-react";
import type {
  Asset,
  AssetFormValues,
  AssetUpdateFormValues,
} from "@/entities/asset";
import { ASSET_EDIT_PARAM } from "@/entities/asset";
import {
  useAssets,
  useCreateAsset,
  useDeleteAsset,
  useUpdateAsset,
} from "@/features/asset";
import { Button } from "@/shared/ds/button";
import { Card } from "@/shared/ds/card";
import { withCommaBreaks } from "@/shared/ds/i18n";
import { List, ListHeader } from "@/shared/ds/list";
import { ResultSection } from "@/shared/ds/result-section";
import { Skeleton } from "@/shared/ds/skeleton";
import { SwipeActions } from "@/shared/ds/swipe-actions";
import { cn } from "@/shared/lib/cn";
import { MINUS } from "@/shared/lib/groo/format";
import { won } from "@/shared/lib/groo/money-text";
import { AlertConfirm } from "@/shared/ui/groo/alert-confirm";
import { BandEmpty, BandFailure } from "@/shared/ui/groo/band-parts";
import { ManagerHead } from "@/shared/ui/groo/manager-layout";
import { groupAssets, useAssetMask } from "../lib/asset-groups";
import { useLiveAssets } from "../lib/use-live-assets";
import { AssetEditDialog } from "./AssetEditDialog";
import { AssetRow, GroupRowsSkeleton } from "./AssetRow";

/*
 * 빈 배열 상수 — `data ?? []` 는 로딩 중 매 렌더 **새 배열**이 되어, 이걸 의존성으로
 * 든 `useMemo` 가 통째로 무효화된다(memo 를 적어 둔 의미가 없어진다). 상수를 돌려주면
 * 참조가 고정된다.
 */
const EMPTY_ASSETS: Asset[] = [];

/** 이 화면의 금액 가리기 카드 — 묶음 합계 · 줄 금액이 같이 따른다(이 자산만 가린 것은 줄만) */
const CARD = "asset.manage" as const;

type EditingState = { mode: "create" } | { mode: "edit"; asset: Asset } | null;

/**
 * 계좌·카드 관리(I-17 25 ~ 33) — 탭 없이 자산 화면과 같은 묶음 넷(계좌·예금 → 투자 → 카드 → 대출)을 한 목록으로.
 * 묶음마다 목록 제목 + 합계, 줄은 자산 화면과 한 부품(AssetRow)이되 줄 끝에 화살표를 두지 않는다.
 * 폰은 흰 면 하나(머리 오른쪽 "추가" 가 폼 1단계), 데스크톱은 제목 줄 [추가] + 카드 하나다.
 * 줄 누름 = 상세, 폰은 밀기 [수정, 삭제] 가 지름길 — 좁은 줄에는 ⋮ · 연필 · 휴지통을 두지 않는다(10-25).
 */
export function AccountManager({
  mobile,
  addRequest = 0,
}: {
  mobile: boolean;
  /** 바깥(설정 폰 머리 "추가")이 올리면 폼 1단계를 연다 */
  addRequest?: number;
}) {
  const { t } = useTranslation("asset");
  const { t: tc } = useTranslation("common");
  // 실패는 화면 안 Result Section 한 벌로 말한다 — 전역 오류 토스트가 상단 바를 가리지 않게 silent
  const assetsQ = useAssets({ silent: true });
  const { data: assetsData, isLoading } = assetsQ;
  const failed = assetsQ.isError && !assetsData;
  const createAsset = useCreateAsset();
  const updateAsset = useUpdateAsset();
  const deleteAsset = useDeleteAsset();
  const confirmFail = useConfirmFail();

  const assets: Asset[] = assetsData?.assets ?? EMPTY_ASSETS;

  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  // 줄을 누르면 상세 페이지로 간다(I-17 36) — 어디서 왔는지는 state 로 넘긴다("‹ 계좌·카드 관리")
  const openDetail = (a: Asset) =>
    navigate(`/desk/asset/${a.rowId}`, { state: { from: "accounts" } });
  const [editing, setEditing] = useState<EditingState>(null);
  const [confirmDelete, setConfirmDelete] = useState<Asset | null>(null);

  // 바깥(설정 폰 머리 "추가")이 올린 횟수가 바뀐 순간에만 폼 1단계를 연다. 렌더 중 조정이라 커밋을 한 번 더 태우지 않는다.
  const [seenAddRequest, setSeenAddRequest] = useState(addRequest);
  if (seenAddRequest !== addRequest) {
    setSeenAddRequest(addRequest);
    setEditing({ mode: "create" });
  }

  /**
   * `?edit=<rowId>` 로 들어오면 그 자산의 수정 폼을 바로 연다(D9).
   *
   * 결제가 끝난 회차의 카드 거래를 환불·삭제·고쳐 쓰면 통장은 그대로라 사용자가 결제계좌
   * 잔액을 고친다 — 토스트의 [잔액 고치기] 와 자산 상세의 [수정] 이 이 주소로 온다
   * (`editAssetPath`). 폼은 여전히 이 화면 하나에만 있다.
   *
   * 값은 받아 두고 주소에서는 지운다. 남겨 두면 설정 안에서 다른 섹션에 다녀오는 것만으로
   * 폼이 혼자 다시 열린다 — 이 화면은 섹션을 옮길 때마다 새로 마운트되는데 주소는 그대로
   * 따라다닌다. 이 화면이 떠 있는 채 새 주소가 와도(설정에서 다시 누름) 받는다.
   */
  const editParam = searchParams.get(ASSET_EDIT_PARAM);
  const [pendingEdit, setPendingEdit] = useState<string | null>(editParam);
  const [seenEditParam, setSeenEditParam] = useState(editParam);
  if (editParam !== seenEditParam) {
    setSeenEditParam(editParam);
    if (editParam !== null) setPendingEdit(editParam);
  }
  useEffect(() => {
    if (!searchParams.has(ASSET_EDIT_PARAM)) return;
    const next = new URLSearchParams(searchParams);
    next.delete(ASSET_EDIT_PARAM);
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  // 자산 목록이 와야 어느 자산인지 알 수 있어 로딩이 끝나면 연다. effect 로 미루면 한 번
  // 그려진 뒤에 열려 목록이 번쩍인다 — 렌더 중에 상태를 맞추는 자리다.
  // 없는 `rowId`(지웠거나 남의 자산)면 목록만 보여 준다. 빈 폼을 여는 것보다 낫다.
  if (pendingEdit !== null && !isLoading) {
    setPendingEdit(null);
    const target = assets.find((a) => String(a.rowId) === pendingEdit);
    if (target) {
      setEditing({ mode: "edit", asset: target });
    }
  }

  // 투자 줄 금액은 자산 화면과 같은 라이브 평가(같은 훅 — 줄마다 시세 타이머를 두지 않는다)
  const { list: liveAssets } = useLiveAssets(assets);
  const groups = useMemo(() => groupAssets(liveAssets), [liveAssets]);

  const handleCreate = (values: AssetFormValues) => {
    createAsset.mutate(values, {
      onSuccess: () => setEditing(null),
    });
  };

  const handleUpdate = (values: AssetUpdateFormValues) => {
    if (!editing || editing.mode !== "edit") return;
    updateAsset.mutate(
      { id: editing.asset.rowId, data: values },
      { onSuccess: () => setEditing(null) },
    );
  };

  /**
   * 삭제 확인창 제목 — 자산 종류를 따른다. 상세와 밀기가 **같은 함수**를 부른다:
   * spec `alert-dialog` 의 "같은 동작이면 어디서 불렀든 제목·설명이 같다".
   */
  const deleteTitleOf = (asset: Asset): string =>
    asset.assetType === "CREDIT_CARD" || asset.assetType === "CHECK_CARD"
      ? t("deleteConfirm.titleCard")
      : asset.assetType === "INVESTMENT"
        ? t("deleteConfirm.titleInvest")
        : t("deleteConfirm.titleAccount");

  /** 밀기 트레이의 동작 — 의미 순서 `[수정, 삭제]` 로 넘긴다(뒤집는 건 컴포넌트가 한다). */
  const swipeActionsFor = (asset: Asset) => [
    {
      // 슬롯이 좁아 두 글자 라벨을 쓴다.
      label: tc("edit"),
      icon: <Pencil />,
      kind: "primary" as const,
      onSelect: () => setEditing({ mode: "edit", asset }),
    },
    {
      label: tc("delete"),
      icon: <Trash2 />,
      kind: "destructive" as const,
      // 지우기 전에 확인창부터 — 상세에서 지울 때와 같은 창이다.
      onSelect: () => setConfirmDelete(asset),
    },
  ];

  const isSubmitting = createAsset.isPending || updateAsset.isPending;

  // 줄에 그리는 값은 라이브 평가로 덮은 것이라, 상세 · 수정 · 삭제에는 서버가 준 원본을 넘긴다(폼이 라이브 값을 저장하지 않게)
  const originalOf = (a: Asset): Asset =>
    assets.find((x) => x.rowId === a.rowId) ?? a;

  const rowFor = (live: Asset) => {
    const asset = originalOf(live);
    return (
      <AssetRow
        key={live.rowId}
        asset={live}
        card={CARD}
        end="none"
        describe="kind"
        usageBar={false}
        onOpenDetail={() => openDetail(asset)}
        wrap={
          mobile
            ? (row: ReactNode) => (
                <SwipeActions
                  rowLabel={asset.assetName}
                  enabled
                  actions={swipeActionsFor(asset)}
                >
                  <List>{row}</List>
                </SwipeActions>
              )
            : undefined
        }
      />
    );
  };

  const sections: {
    key: string;
    title: string;
    list: Asset[];
    total: number;
    negative: boolean;
    /** 비어도 그린다(계좌·예금 · 카드) — 투자 · 대출은 있을 때만 */
    always: boolean;
  }[] = [
    {
      key: "account",
      title: t("accountDepositTitle"),
      list: groups.accounts,
      total: groups.accountsTotal,
      negative: false,
      always: true,
    },
    {
      key: "invest",
      title: t("group.invest"),
      list: groups.investments,
      total: groups.investmentsTotal,
      negative: false,
      always: false,
    },
    {
      key: "card",
      title: t("group.card"),
      list: groups.cards,
      total: groups.cardsTotal,
      negative: true,
      always: true,
    },
    {
      key: "loan",
      title: t("assetType.loan"),
      list: groups.loans,
      total: groups.loansTotal,
      negative: true,
      always: false,
    },
  ];
  const shown = sections.filter((s) => s.always || s.list.length > 0);

  let body: ReactNode;
  if (failed) {
    body = (
      <BandFailure
        title={t("manager.loadFailed")}
        onRetry={() => void assetsQ.refetch()}
        band={mobile}
        // 폰은 화면 전체가 실패 한 벌 — large(앱 · 빈 화면과 같다), 데스크톱 카드 안은 medium
        size={mobile ? "large" : "medium"}
      />
    );
  } else if (isLoading) {
    body = (
      <div aria-busy="true">
        {[t("accountDepositTitle"), t("group.card")].map((title, i) => (
          <div key={title}>
            <GroupHead
              title={<Skeleton text="t4" className="w-24" />}
              first={i === 0}
              mobile={mobile}
            />
            <GroupRowsSkeleton rows={2} />
          </div>
        ))}
      </div>
    );
  } else if (assets.length === 0) {
    body = (
      <ResultSection
        kind="empty"
        size={mobile ? "large" : "medium"}
        icon={<Landmark aria-hidden />}
        title={t("emptyTitle")}
        description={t("manager.emptyHint")}
      />
    );
  } else {
    body = shown.map((s, i) => (
      <ManageGroup
        key={s.key}
        id={`asset-manage-${s.key}`}
        title={s.title}
        total={s.total}
        negative={s.negative}
        first={i === 0}
        mobile={mobile}
      >
        {s.list.length === 0 ? (
          <div className="px-x6">
            <BandEmpty>{t("noItems")}</BandEmpty>
          </div>
        ) : mobile ? (
          <div role="group" aria-labelledby={`asset-manage-${s.key}`}>
            {s.list.map(rowFor)}
          </div>
        ) : (
          <List aria-labelledby={`asset-manage-${s.key}`}>
            {s.list.map(rowFor)}
          </List>
        )}
      </ManageGroup>
    ));
  }

  return (
    <>
      {mobile ? (
        <div className="flex flex-col pb-x6">{body}</div>
      ) : (
        <>
          <ManagerHead
            title={t("manager.title")}
            description={t("manager.description")}
            actions={
              // 제목 줄 오른쪽 주 동작 = Button small neutralOutline + 앞 아이콘, 글은 동작 이름(I-16 28 · I-17 29)
              <Button
                type="button"
                variant="neutralOutline"
                size="small"
                onClick={() => setEditing({ mode: "create" })}
              >
                <Plus aria-hidden />
                {tc("add")}
              </Button>
            }
          />
          <Card body="list">{body}</Card>
        </>
      )}

      {editing && (
        <AssetEditDialog
          item={editing.mode === "edit" ? editing.asset : null}
          onClose={() => setEditing(null)}
          onCreate={handleCreate}
          onUpdate={handleUpdate}
          isSubmitting={isSubmitting}
        />
      )}

      {confirmDelete && (
        <AlertConfirm
          title={deleteTitleOf(confirmDelete)}
          message={t("deleteConfirm.messageDetail", {
            name: confirmDelete.assetName,
          })}
          confirmLabel={t("deleteConfirm.confirm")}
          onConfirm={() => deleteAsset.mutateAsync(confirmDelete.rowId)}
          onError={() =>
            confirmFail({
              message: t("deleteConfirm.failed"),
              retry: () => deleteAsset.mutateAsync(confirmDelete.rowId),
            })
          }
          onClose={() => setConfirmDelete(null)}
        />
      )}
    </>
  );
}

/**
 * 묶음 제목 — ds 목록 제목 boldSolid. 위 여백: 폰 첫 묶음 8 · 그다음 16(T1 · T2), 카드 안 첫 묶음 0(카드 위 12 가 대신 — T5).
 * 제목 글이 눌려도 오른쪽 합계는 한 줄을 지킨다.
 */
function GroupHead({
  title,
  total,
  first,
  mobile,
}: {
  title: ReactNode;
  total?: ReactNode;
  first: boolean;
  mobile: boolean;
}) {
  return (
    <ListHeader
      as="div"
      variant="boldSolid"
      className={first ? (mobile ? "mt-x2" : undefined) : "mt-x4"}
    >
      {title}
      {total}
    </ListHeader>
  );
}

function ManageGroup({
  id,
  title,
  total,
  negative,
  first,
  mobile,
  children,
}: {
  id: string;
  title: string;
  total: number;
  negative: boolean;
  first: boolean;
  mobile: boolean;
  children: ReactNode;
}) {
  const m = useAssetMask(CARD);
  return (
    <section>
      <GroupHead
        first={first}
        mobile={mobile}
        title={
          <h2 id={id} className="m-0 font-[inherit] text-[length:inherit]">
            {title}
          </h2>
        }
        total={
          <span
            className={cn(
              "shrink-0 whitespace-nowrap text-end tabular-nums",
              "text-fg-neutral",
            )}
          >
            {withCommaBreaks(
              m(negative && total !== 0 ? MINUS + won(total) : won(total)),
            )}
          </span>
        }
      />
      {children}
    </section>
  );
}
