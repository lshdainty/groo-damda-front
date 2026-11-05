import { useRef, useState, type ReactNode } from "react";
import {
  ChevronRight,
  CircleCheck,
  Plus,
  Tags,
  TriangleAlert,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/shared/ds/button";
import { useWideSurface } from "@/shared/ds/overlay";
import { Callout } from "@/shared/ds/callout";
import { Field } from "@/shared/ds/field";
import { Input } from "@/shared/ds/input";
import {
  List,
  ListButtonItem,
  ListHeader,
  ListItem,
  ListTile,
} from "@/shared/ds/list";
import { ResultSection } from "@/shared/ds/result-section";
import { TagGroup, TagGroupItem } from "@/shared/ds/tag-group";
import { MAX_AMOUNT } from "@/shared/lib/groo/amount";
import { getPaletteByColor } from "@/shared/lib/groo/chart-palette";
import { useConfirmFail } from "@/shared/lib/confirm-fail";
import { KRW, isEn } from "@/shared/lib/groo/format";
import { wonPre } from "@/shared/lib/groo/hide-amounts-core";
import { kindOfExpense } from "@/shared/lib/groo/hide-amounts-cards";
import { Icon } from "@/shared/ui/groo/primitives";
import { AmountInput } from "@/shared/ui/groo/amount-input";
import { ConfirmDialog } from "@/shared/ui/groo/dialogs";
import { useExpenseCategories } from "@/features/expense";
import {
  useDeleteAllExpenseSplits,
  useExpenseSplits,
  useReplaceExpenseSplits,
} from "@/features/expense-split";
import {
  evenRows,
  largestRows,
  newSplitUid,
  proportionalRows,
  rowsToPayload,
  seedSplitRows,
  sumRows,
  type SplitRow,
} from "@/features/expense-split/lib/split-rows";
import type { Expense, ExpenseCategory } from "@/entities/expense";
import type { ExpenseSplitFormValue } from "@/entities/expense-split";
import { PickRow } from "./tx-parts";
import { LeafCategoryPick } from "./split-parts";
import { Won } from "@/shared/ui/groo/won-text";
import { PickSkeleton } from "./pick-bodies";
import type { TxEmbedParts } from "./use-tx-sheet-parts";

const NAME_MAX = 50;

interface ItemDraft {
  /** 고치는 항목의 uid — 새 항목이면 null */
  uid: string | null;
  categoryRowId: number | null;
  label: string;
  amount: string;
}

export interface SplitStepOptions {
  /** 이 단계가 열려 있다 — 아니면 아무것도 불러오지 않고 상태를 비운다 */
  enabled: boolean;
  expense: Expense | null;
  /** 맞추기 모드 — 바뀐 총액(수정 폼의 새 금액) */
  overrideTotal?: number;
  /** 맞추기 모드 — 바꾸기 전 총액 */
  recordedTotal?: number;
  /** 맞추기 모드 — 폼이 들고 있는 분할 */
  initialSplits?: ExpenseSplitFormValue[];
  /** 주면 맞추기 모드: 서버에 보내지 않고 이 콜백으로 돌려준다 */
  onReconciled?: (splits: ExpenseSplitFormValue[]) => void;
  /** 상세 모드: 저장 · 풀기가 끝났다 — 호스트가 상세로 돌아간다 */
  onSaved?: () => void;
  /** 이 단계를 나간다(바뀐 값은 호스트가 먼저 물었다) */
  onExit: () => void;
}

/**
 * 거래 나누기 단계 (I-21 F 34 ~ 38) — 상세 안 한 단계와 수정 폼의 맞추기 단계가 같은 부품을 쓴다.
 * 원 거래 줄 → (맞추기 Callout) → "나눈 내역 {n}개" + 균등 분배 → 항목 줄 → 항목 추가 → 내역 분할 풀기 → 바닥 위 남은 금액 → [저장].
 * 항목을 누르면 같은 표면 한 단계(항목 n)로 들어가 "완료" 에 넣고 ← 는 버린다.
 */
export function useSplitStep(o: SplitStepOptions): TxEmbedParts {
  const { t } = useTranslation("expense");
  const { t: tc } = useTranslation("common");
  const wide = useWideSurface();
  const confirmFail = useConfirmFail();
  const { expense } = o;
  const reconcileMode = !!o.onReconciled;
  const open = o.enabled && expense != null;
  const persistedTotal = expense ? Math.abs(expense.amount) : 0;
  const targetTotal = o.overrideTotal ?? persistedTotal;
  const totalChanged =
    o.overrideTotal != null &&
    o.overrideTotal !== (o.recordedTotal ?? persistedTotal);
  const kind = kindOfExpense(expense?.expenseType ?? "EXPENSE");

  const splitsQ = useExpenseSplits(
    open && !o.initialSplits ? expense.rowId : null,
  );
  const categoriesQ = useExpenseCategories({ reference: true });
  const replaceMut = useReplaceExpenseSplits();
  const deleteAllMut = useDeleteAllExpenseSplits();
  const categories: ExpenseCategory[] = categoriesQ.data ?? [];

  const [rows, setRows] = useState<SplitRow[] | null>(null);
  const [initialKey, setInitialKey] = useState("");
  const [item, setItem] = useState<ItemDraft | null>(null);
  const [itemOrigin, setItemOrigin] = useState("");
  const [itemErrors, setItemErrors] = useState(false);
  const removingRef = useRef(false);
  const [showErrors, setShowErrors] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const savingRef = useRef(false);
  const bodyRef = useRef<HTMLDivElement | null>(null);

  // 닫히면 비운다 — 다시 열 때 처음 값으로(렌더 중 한 번만 맞춘다)
  if (!open && (rows !== null || item !== null)) {
    setRows(null);
    setItem(null);
    setShowErrors(false);
    setSaveFailed(false);
    setConfirmRemove(false);
  }
  // 비동기로 온 분할(또는 편집 중 값)로 딱 한 번 시드한다
  if (open && rows === null) {
    const seed = seedSplitRows(
      o.initialSplits,
      splitsQ.data,
      targetTotal,
      expense,
    );
    if (seed) {
      setRows(seed);
      setInitialKey(JSON.stringify(rowsToPayload(seed)));
    }
  }

  const list = rows ?? [];
  const sum = sumRows(list);
  const remainder = targetTotal - sum;
  const rowsComplete = list.every(
    (r) => r.categoryRowId != null && Number(r.amount) > 0,
  );
  const hasPersisted = (splitsQ.data?.length ?? 0) > 0;

  const catOf = (id: number | null) =>
    id == null ? undefined : categories.find((c) => c.rowId === id);
  const parentOf = (c: ExpenseCategory | undefined) =>
    c?.parentRowId
      ? categories.find((p) => p.rowId === c.parentRowId)
      : undefined;

  const setList = (next: SplitRow[]) => {
    setRows(next);
    setSaveFailed(false);
  };

  // ── 항목 단계 ──
  const draftKey = (d: ItemDraft) =>
    JSON.stringify([d.categoryRowId, d.label, d.amount]);
  const openItem = (r: SplitRow | null) => {
    const d: ItemDraft = r
      ? {
          uid: r.uid,
          categoryRowId: r.categoryRowId,
          label: r.label,
          amount: r.amount,
        }
      : {
          uid: null,
          categoryRowId: expense?.categoryRowId ?? null,
          label: "",
          amount: String(Math.max(0, remainder)),
        };
    setItem(d);
    setItemOrigin(draftKey(d));
    setItemErrors(false);
  };
  const commitItem = () => {
    if (!item) return;
    // 카테고리 · 금액이 비면 말없이 멈추지 않고 칸 아래 오류
    if (item.categoryRowId == null || !(Number(item.amount) > 0)) {
      setItemErrors(true);
      return;
    }
    const amount = String(Math.min(Number(item.amount) || 0, MAX_AMOUNT));
    if (item.uid == null) {
      setList([
        ...list,
        {
          uid: newSplitUid(),
          categoryRowId: item.categoryRowId,
          label: item.label,
          amount,
        },
      ]);
    } else {
      setList(
        list.map((r) =>
          r.uid === item.uid
            ? {
                ...r,
                categoryRowId: item.categoryRowId,
                label: item.label,
                amount,
              }
            : r,
        ),
      );
    }
    setItem(null);
  };
  const removeItem = () => {
    if (item?.uid != null) setList(list.filter((r) => r.uid !== item.uid));
    setItem(null);
  };

  // ── 저장 ──
  const errors = {
    min: list.length < 2,
    remain: remainder !== 0,
    row: !rowsComplete,
  };
  const errorText = !showErrors
    ? null
    : errors.remain
      ? t("splitStep.errRemain")
      : errors.min
        ? t("splitStep.errMin")
        : errors.row
          ? t("splitStep.errRow")
          : null;

  const save = async () => {
    if (savingRef.current || !expense) return;
    savingRef.current = true;
    setSaving(true);
    try {
      setShowErrors(true);
      if (errors.min || errors.remain || errors.row) return;
      const payload = rowsToPayload(list);
      if (o.onReconciled) {
        o.onReconciled(payload);
        return;
      }
      setSaveFailed(false);
      try {
        await replaceMut.mutateAsync({
          expenseId: expense.rowId,
          splits: payload,
          silent: true,
        });
      } catch {
        setSaveFailed(true);
        bodyRef.current?.scrollTo({ top: 0 });
        return;
      }
      o.onSaved?.();
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const runRemove = () =>
    deleteAllMut.mutateAsync({ expenseId: expense?.rowId ?? 0, silent: true });
  const doRemove = async () => {
    if (removingRef.current) return;
    removingRef.current = true;
    try {
      await runRemove();
      setConfirmRemove(false);
      o.onSaved?.();
    } catch {
      setConfirmRemove(false);
      confirmFail({
        message: t("splitStep.removeFailed"),
        retry: runRemove,
        onRetried: o.onSaved,
      });
    } finally {
      removingRef.current = false;
    }
  };

  // ── 맞추기 ──
  const strategies = [
    {
      key: "prop",
      label: t("splitTx.strategy.prop.title"),
      run: () => setList(proportionalRows(list, targetTotal)),
    },
    {
      key: "largest",
      label: t("splitTx.strategy.largest.title"),
      run: () => setList(largestRows(list, targetTotal)),
    },
    ...(remainder > 0
      ? [
          {
            key: "add",
            label: t("splitTx.strategy.add.title"),
            run: () =>
              setList([
                ...list,
                {
                  uid: newSplitUid(),
                  categoryRowId: expense?.categoryRowId ?? null,
                  amount: String(remainder),
                  label: t("splitTx.extraAmount"),
                },
              ]),
          },
        ]
      : []),
  ];

  const listDirty =
    rows !== null && JSON.stringify(rowsToPayload(rows)) !== initialKey;
  const dirty = item ? draftKey(item) !== itemOrigin : listDirty;
  // 닫기(X)는 안쪽 단계에서도 흐름 전체의 변경을 본다
  const dirtyAll = listDirty || (item != null && draftKey(item) !== itemOrigin);

  // ── 본문 ──
  const loading =
    categoriesQ.isPending || (!o.initialSplits && splitsQ.isPending);
  const loadFailed = !o.initialSplits && splitsQ.isError;
  const fmt = (n: number) => `${wonPre()}${KRW(n)}${isEn() ? "" : "원"}`;

  let body: ReactNode = null;
  if (expense) {
    if (loadFailed) {
      body = (
        <ResultSection
          size="medium"
          kind="failure"
          title={t("txDetail.splitLoadFailed")}
          description={tc("loadFailedDesc")}
          primaryAction={{
            label: tc("retry"),
            onClick: () => void splitsQ.refetch(),
            loading: splitsQ.isFetching,
          }}
        />
      );
    } else if (loading || rows === null) {
      body = <PickSkeleton />;
    } else if (item) {
      const others = list
        .filter((r) => r.uid !== item.uid)
        .reduce((s, r) => s + (Number(r.amount) || 0), 0);
      const cat = catOf(item.categoryRowId);
      const parent = parentOf(cat);
      body = (
        <div data-testid="split-item-step">
          <List>
            <PickRow
              title={t("category")}
              prefix={<Tags />}
              value={
                cat
                  ? parent
                    ? `${parent.categoryName} · ${cat.categoryName}`
                    : cat.categoryName
                  : null
              }
              placeholder={t("splitStep.categoryPick")}
              errorMessage={
                itemErrors && item.categoryRowId == null
                  ? t("splitStep.errCategory")
                  : null
              }
            >
              {({ close }) => (
                <LeafCategoryPick
                  categories={categories}
                  type={expense.expenseType}
                  value={item.categoryRowId}
                  failed={categoriesQ.isError}
                  onRetry={() => void categoriesQ.refetch()}
                  onPick={(id) => {
                    setItem({ ...item, categoryRowId: id });
                    close();
                  }}
                />
              )}
            </PickRow>
          </List>
          <Field
            label={t("splitStep.nameLabel")}
            indicator={t("splitStep.optional")}
            maxGraphemeCount={NAME_MAX}
            className="px-global-gutter pt-x3"
          >
            <Input
              size="large"
              value={item.label}
              placeholder={t("splitTx.itemNamePlaceholder")}
              onChange={(e) => setItem({ ...item, label: e.target.value })}
            />
          </Field>
          <Field
            label={t("form.amount")}
            invalid={itemErrors && !(Number(item.amount) > 0)}
            errorMessage={
              itemErrors && !(Number(item.amount) > 0)
                ? t("splitStep.errAmount")
                : undefined
            }
            description={t("splitStep.amountHelp", {
              rest: fmt(others),
              total: fmt(targetTotal),
            })}
            className="px-global-gutter pb-x3 pt-x4"
          >
            <AmountInput
              variant="underline"
              value={item.amount}
              max={MAX_AMOUNT}
              onValueChange={(v) => setItem({ ...item, amount: v })}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commitItem();
                }
              }}
            />
          </Field>
          {item.uid != null && (
            <List>
              <ListButtonItem
                data-testid="split-item-remove"
                title={
                  <span className="font-bold text-fg-critical">
                    {t("splitStep.removeItem")}
                  </span>
                }
                onClick={removeItem}
              />
            </List>
          )}
        </div>
      );
    } else {
      const cat0 = catOf(expense.categoryRowId);
      const pal0 = getPaletteByColor(cat0?.color ?? expense.categoryColor);
      body = (
        <>
          {saveFailed && (
            <div className="px-global-gutter pb-x3 pt-x1">
              <Callout tone="critical" role="alert">
                {t("addTx.saveFailed")}
              </Callout>
            </div>
          )}
          <List data-slot="split-source">
            <ListItem
              prefix={
                <ListTile
                  aria-hidden
                  style={{ background: pal0.bg, color: pal0.color }}
                >
                  <Icon
                    name={cat0?.icon ?? expense.categoryIcon ?? "tag"}
                    size={20}
                  />
                </ListTile>
              }
              title={
                expense.merchant ??
                expense.description ??
                cat0?.categoryName ??
                t("transaction")
              }
              detail={
                totalChanged ? (
                  <span>
                    <span className="sr-only">
                      {t("splitStep.oldTotal", {
                        amount: fmt(o.recordedTotal ?? persistedTotal),
                      })}
                    </span>
                    <s aria-hidden>{fmt(o.recordedTotal ?? persistedTotal)}</s>
                    <span aria-hidden> → {fmt(targetTotal)}</span>
                  </span>
                ) : (
                  t("splitTx.sourceTransaction")
                )
              }
              suffix={
                <Won
                  n={targetTotal}
                  kind={kind}
                  className="whitespace-nowrap font-bold tabular-nums text-fg-neutral"
                />
              }
            />
          </List>
          {reconcileMode && remainder !== 0 && (
            <div className="px-global-gutter pb-x3 pt-x1">
              <Callout tone="warning" title={t("splitStep.reconcileTitle")}>
                <span>
                  {t("splitStep.reconcileBody", {
                    sum: fmt(sum),
                    total: fmt(targetTotal),
                    diffText:
                      remainder < 0
                        ? t("splitStep.diffOver", {
                            diff: fmt(-remainder),
                          })
                        : t("splitStep.diffShort", { diff: fmt(remainder) }),
                  })}
                </span>
                <span className="mt-x2 flex flex-wrap gap-x2">
                  {strategies.map((s) => (
                    <Button
                      key={s.key}
                      data-testid={`reconcile-${s.key}`}
                      variant="neutralOutline"
                      size="small"
                      onClick={s.run}
                    >
                      {s.label}
                    </Button>
                  ))}
                </span>
              </Callout>
            </div>
          )}
          <ListHeader as="div" variant="boldSolid" className="mt-x1">
            <h3 className="m-0 font-[inherit] text-[length:inherit] [font-weight:inherit]">
              {t("splitStep.listTitle", { count: list.length })}
            </h3>
            <Button
              variant="ghost"
              ghostColor="neutral"
              size="xsmall"
              onClick={() => setList(evenRows(list, targetTotal))}
            >
              {t("splitTx.splitEvenly")}
            </Button>
          </ListHeader>
          <List data-slot="split-items">
            {list.map((r, i) => {
              const c = catOf(r.categoryRowId);
              const p = parentOf(c);
              const pal = getPaletteByColor(c?.color);
              const amt = Number(r.amount) || 0;
              const pct =
                targetTotal > 0 ? Math.round((amt / targetTotal) * 100) : 0;
              return (
                <ListButtonItem
                  key={r.uid}
                  data-testid={`split-item-${i}`}
                  prefix={
                    <ListTile
                      aria-hidden
                      style={{ background: pal.bg, color: pal.color }}
                    >
                      <Icon name={c?.icon ?? "tag"} size={20} />
                    </ListTile>
                  }
                  title={
                    r.label.trim() ||
                    (c?.categoryName ?? t("splitTx.unselected"))
                  }
                  detail={
                    <TagGroup size="t3" truncate>
                      {p && <TagGroupItem>{p.categoryName}</TagGroupItem>}
                      <TagGroupItem>
                        {c?.categoryName ?? t("splitTx.unselected")}
                      </TagGroupItem>
                      <TagGroupItem shrink={0}>{`${pct}%`}</TagGroupItem>
                    </TagGroup>
                  }
                  suffix={
                    <>
                      <Won
                        n={amt}
                        kind={kind}
                        className="whitespace-nowrap font-bold tabular-nums text-fg-neutral"
                      />
                      <ChevronRight
                        aria-hidden
                        size={18}
                        className="text-fg-neutral-subtle"
                      />
                    </>
                  }
                  onClick={() => openItem(r)}
                />
              );
            })}
            <ListButtonItem
              data-testid="split-add"
              prefix={
                <span
                  aria-hidden
                  className="inline-grid size-10 place-items-center rounded-r4 border border-stroke-neutral-weak text-fg-brand"
                >
                  <Plus size={22} />
                </span>
              }
              title={
                <span className="font-bold text-fg-brand">
                  {t("splitTx.addItem")}
                </span>
              }
              onClick={() => openItem(null)}
            />
          </List>
          {!reconcileMode && hasPersisted && (
            <List>
              <ListButtonItem
                data-testid="split-remove-all"
                title={
                  <span className="font-bold text-fg-critical">
                    {t("splitStep.removeAll")}
                  </span>
                }
                onClick={() => setConfirmRemove(true)}
              />
            </List>
          )}
        </>
      );
    }
  }

  // ── 바닥 위 남은 금액 ──
  const above =
    expense && !item && rows !== null && !loadFailed ? (
      <div data-slot="split-remaining" className="px-global-gutter pb-x2 pt-x2">
        <p
          className={
            remainder === 0
              ? "m-0 flex items-center justify-between font-sans text-t4 text-fg-positive"
              : "m-0 flex items-center justify-between font-sans text-t4 text-fg-warning-contrast"
          }
        >
          <span className="text-fg-neutral">{t("splitStep.remaining")}</span>
          <span className="inline-flex items-center gap-x1 font-bold tabular-nums">
            {remainder === 0 ? (
              <>
                <CircleCheck aria-hidden size={16} />
                <Won n={0} kind={kind} />
              </>
            ) : (
              <>
                <TriangleAlert aria-hidden size={16} />
                {remainder > 0
                  ? t("splitStep.short", { amount: fmt(remainder) })
                  : t("splitStep.over", { amount: fmt(-remainder) })}
              </>
            )}
          </span>
        </p>
        {errorText && (
          <p
            role="alert"
            className="m-0 mt-x1 font-sans text-t3 text-fg-critical"
          >
            {errorText}
          </p>
        )}
      </div>
    ) : null;

  const primary = item ? null : (
    <Button
      variant="neutralSolid"
      loading={saving}
      disabled={rows === null}
      onClick={() => void save()}
    >
      {tc("save")}
    </Button>
  );
  const parts: TxEmbedParts = {
    title: item
      ? t("splitTx.itemN", {
          n:
            item.uid == null
              ? list.length + 1
              : list.findIndex((r) => r.uid === item.uid) + 1,
        })
      : t("splitTitle"),
    body: (
      <>
        {body}
        {confirmRemove && (
          <ConfirmDialog
            title={t("splitStep.removeConfirmTitle")}
            message={t("splitStep.removeConfirmBody")}
            confirmLabel={t("splitStep.removeConfirm")}
            danger
            loading={deleteAllMut.isPending}
            onCancel={() => !deleteAllMut.isPending && setConfirmRemove(false)}
            onConfirm={() => void doRemove()}
          />
        )}
      </>
    ),
    primary,
    footer: (requestBack) =>
      wide ? (
        <>
          <Button variant="neutralWeak" onClick={requestBack}>
            {tc("cancel")}
          </Button>
          {item ? <Button onClick={commitItem}>{tc("done")}</Button> : primary}
        </>
      ) : (
        primary
      ),
    dirty,
    dirtyAll,
    onBack: () => {
      if (saving) return;
      if (item) setItem(null);
      else o.onExit();
    },
    inSub: item != null,
    onDone: commitItem,
    overlays: null,
    bodyRef,
    above,
    busy: saving,
  };
  return parts;
}
