import { Fragment, type ReactNode } from "react";
import { Check } from "lucide-react";
import { useTranslation } from "react-i18next";

import { getPaletteByColor } from "@/shared/lib/groo/chart-palette";
import { Icon } from "@/shared/ui/groo/primitives";
import { LogoTile } from "@/shared/ds/logo-tile";
import { List, ListButtonItem, ListHeader, ListTile } from "@/shared/ds/list";
import { ResultSection } from "@/shared/ds/result-section";
import { Skeleton } from "@/shared/ds/skeleton";
import type { TxForm } from "../model/use-tx-form";
import type { Asset } from "@/entities/asset";

/** 고르기 시트 · 팝오버 안의 불러오는 중 줄 — Skeleton 넷 */
export function PickSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-x4 px-global-gutter py-x2">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-x3">
          <Skeleton radius="12" className="size-10 shrink-0" />
          <Skeleton text="t5" className="w-2/3" />
        </div>
      ))}
    </div>
  );
}

/** 고르기 안 실패 — 서버 원문을 그리지 않는다. 폼 줄 값은 그대로 */
function PickFailure({
  title,
  onRetry,
}: {
  title: string;
  onRetry: () => void;
}) {
  const { t: tc } = useTranslation("common");
  return (
    <ResultSection
      kind="failure"
      size="medium"
      title={title}
      description={tc("loadFailedDesc")}
      primaryAction={{ label: tc("retry"), onClick: onRetry }}
    />
  );
}

function PickEmpty({ children }: { children: ReactNode }) {
  return (
    <p className="m-0 px-global-gutter py-x3 font-sans text-t4 text-fg-neutral-subtle">
      {children}
    </p>
  );
}

/**
 * 카테고리 고르기 (D 22) — 지금 종류 · 말단만. 하위가 있는 상위는 목록 제목이고 그 하위를 고른다.
 * 누르면 바로 넣고 닫힌다. 고른 줄은 오른쪽 체크.
 */
export function CategoryPickBody({
  f,
  close,
}: {
  f: TxForm;
  close: () => void;
}) {
  const { t } = useTranslation("expense");
  if (f.categoriesQ.isPending) return <PickSkeleton />;
  if (f.categoriesQ.isError)
    return (
      <PickFailure
        title={t("addTx.categoryLoadFailed")}
        onRetry={() => void f.categoriesQ.refetch()}
      />
    );
  const ofType = f.categories
    .filter((c) => c.expenseType === f.type)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const tops = ofType.filter((c) => c.parentRowId == null);
  if (tops.length === 0)
    return <PickEmpty>{t("addTx.noCategoryOfType")}</PickEmpty>;
  const rowFor = (c: (typeof ofType)[number]) => {
    const palette = getPaletteByColor(c.color);
    const on = f.categoryRowId === c.rowId;
    return (
      <ListButtonItem
        key={c.rowId}
        title={c.categoryName}
        aria-current={on ? true : undefined}
        prefix={
          <ListTile style={{ background: palette.bg, color: palette.color }}>
            <Icon name={c.icon ?? "tag"} size={20} />
          </ListTile>
        }
        suffix={on ? <Check aria-hidden /> : undefined}
        onClick={() => {
          if (!on) {
            f.setCategoryRowId(c.rowId);
            f.clearPresetMark();
          }
          close();
        }}
      />
    );
  };
  return (
    <div className="-mx-x6">
      {tops.map((top) => {
        const kids = ofType.filter((c) => c.parentRowId === top.rowId);
        if (kids.length === 0)
          return (
            <List key={top.rowId} aria-label={top.categoryName}>
              {rowFor(top)}
            </List>
          );
        return (
          <Fragment key={top.rowId}>
            <ListHeader variant="mediumWeak" as="h3">
              {top.categoryName}
            </ListHeader>
            <List aria-label={top.categoryName}>{kids.map(rowFor)}</List>
          </Fragment>
        );
      })}
    </div>
  );
}

const ASSET_ORDER = (a: Asset, b: Asset) => a.sortOrder - b.sortOrder;

/** 줄 하나 — Logo Tile 40 + 이름 + 설명(기관) */
function AssetLine({
  asset,
  on,
  onPick,
}: {
  asset: Asset;
  on: boolean;
  onPick: () => void;
}) {
  return (
    <ListButtonItem
      title={asset.assetName}
      detail={asset.institution ?? undefined}
      aria-current={on ? true : undefined}
      prefix={
        <LogoTile
          name={asset.institution || asset.assetName}
          face={asset.institution ? "institution" : "name"}
          size={40}
        />
      }
      suffix={on ? <Check aria-hidden /> : undefined}
      onClick={onPick}
    />
  );
}

/**
 * 계좌·카드 고르기 — 맨 앞 "계좌·카드 없음" + 지금 거르기 그대로(결제 수단별 · 지출에서 예적금 빼기).
 * 허용 계좌가 0 이면 시트 안 안내(R9). `exclude` 는 이체에서 반대쪽 계좌를 뺀다.
 */
export function AssetPickBody({
  f,
  value,
  onPick,
  close,
  list,
  allowNone = false,
  noneLabel,
}: {
  f: TxForm;
  value: number | null;
  onPick: (rowId: number | null) => void;
  close: () => void;
  /** 고를 수 있는 자산 목록 */
  list: Asset[];
  allowNone?: boolean;
  noneLabel?: string;
}) {
  const { t } = useTranslation("expense");
  if (f.assetsQ.isPending) return <PickSkeleton />;
  if (f.assetsQ.isError)
    return (
      <PickFailure
        title={t("addTx.assetLoadFailed")}
        onRetry={() => void f.assetsQ.refetch()}
      />
    );
  const sorted = [...list].sort(ASSET_ORDER);
  return (
    <div className="-mx-x6">
      {sorted.length === 0 && (
        <PickEmpty>{t("addTx.noPickableAsset")}</PickEmpty>
      )}
      <List aria-label={t("addTx.account")}>
        {allowNone && (
          <ListButtonItem
            title={noneLabel ?? t("addTx.noAccountOption")}
            aria-current={value == null ? true : undefined}
            suffix={value == null ? <Check aria-hidden /> : undefined}
            onClick={() => {
              if (value != null) onPick(null);
              close();
            }}
          />
        )}
        {sorted.map((a) => (
          <AssetLine
            key={a.rowId}
            asset={a}
            on={value === a.rowId}
            onPick={() => {
              if (value !== a.rowId) onPick(a.rowId);
              close();
            }}
          />
        ))}
      </List>
    </div>
  );
}

/** 단순 하나 고르기 — 결제 수단 · 할부 */
export function SimplePickBody<V extends string>({
  label,
  items,
  value,
  onPick,
  close,
}: {
  label: string;
  items: { value: V; label: string }[];
  value: V;
  onPick: (v: V) => void;
  close: () => void;
}) {
  return (
    <div className="-mx-x6">
      <List aria-label={label}>
        {items.map((it) => (
          <ListButtonItem
            key={it.value}
            title={it.label}
            aria-current={it.value === value ? true : undefined}
            suffix={it.value === value ? <Check aria-hidden /> : undefined}
            onClick={() => {
              if (it.value !== value) onPick(it.value);
              close();
            }}
          />
        ))}
      </List>
    </div>
  );
}
