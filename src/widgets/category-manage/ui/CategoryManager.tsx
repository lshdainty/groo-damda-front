import { useId, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Search } from "lucide-react";
import {
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates, arrayMove } from "@dnd-kit/sortable";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from "@/shared/ds/alert-dialog";
import { Button } from "@/shared/ds/button";
import { Card } from "@/shared/ds/card";
import { Input } from "@/shared/ds/input";
import { useSnackbar } from "@/shared/ds/snackbar";
import { useConfirmFail } from "@/shared/lib/confirm-fail";
import { ListHeader } from "@/shared/ds/list";
import { Tabs, TabsList, TabsTrigger } from "@/shared/ds/tabs";
import { BandEmpty, BandFailure } from "@/shared/ui/groo/band-parts";
import { ManagerHead } from "@/shared/ui/groo/manager-layout";
import {
  useExpenseCategories,
  useCreateExpenseCategory,
  useUpdateExpenseCategory,
  useDeleteExpenseCategory,
  useReorderExpenseCategories,
  useExpenseBudgets,
  useRangeSummary,
} from "@/features/expense";
import { useRecurringTransactions } from "@/features/recurring-transaction";
import { KRW } from "@/shared/lib/groo/format";
import type {
  ExpenseCategory,
  ExpenseCategoryFormValues,
  ExpenseType,
} from "@/entities/expense";
import { CategoryEditDialog } from "./CategoryEditDialog";
import { CategoryListSkeleton, CategoryTree } from "./CategoryTree";
import { CategoryMoveTxDialog } from "@/features/expense/ui/CategoryMoveTxDialog";

type EditingState =
  ExpenseCategory | { kind: "new"; parentRowId?: number | null } | null;

/**
 * 카테고리 관리(I-20 B) — 탭(지출 · 수입) → 밑줄 검색칸 → 목록 제목("지출 카테고리 n개" + 순서 바꾸기) → 나무 줄(줄 끝 ⋮).
 * 폰은 흰 면 하나(머리 오른쪽 "추가" 가 새 카테고리), 데스크톱은 제목 줄 [카테고리 추가] + 카드 하나다.
 */
export function CategoryManager({
  mobile,
  addRequest = 0,
}: {
  mobile: boolean;
  /** 바깥(설정 폰 머리 "추가")이 올리면 새 카테고리 폼을 연다 */
  addRequest?: number;
}) {
  const { t } = useTranslation("category");
  const { t: tc } = useTranslation("common");
  const { t: te } = useTranslation("expense");
  const titleId = useId();
  const categoriesQ = useExpenseCategories();
  const { data: categories, isLoading } = categoriesQ;
  // 저장 실패는 서버 원문 토스트 대신 폼 맨 위 Callout(고정 글), 삭제는 확인창을 닫고 스낵바 + [다시 시도], 순서는 되돌리고 스낵바
  const createMut = useCreateExpenseCategory({ silent: true });
  const updateMut = useUpdateExpenseCategory({ silent: true });
  const deleteMut = useDeleteExpenseCategory({ silent: true });
  const reorderMut = useReorderExpenseCategories({ silent: true });
  const snackbar = useSnackbar();
  const confirmFail = useConfirmFail();
  // 삭제 확인이 "이 카테고리를 쓰는 반복 거래" 개수를 말한다 — 못 받으면 개수 문장만 뺀다(확인창을 막지 않는다)
  const { data: recurrings } = useRecurringTransactions(undefined, {
    reference: true,
  });

  // 목록 제목의 "순서 바꾸기" ↔ "완료" — 켜면 순서 모드(폰 · 데스크톱 같다)
  const [reorder, setReorder] = useState(false);

  const [tab, setTab] = useState<ExpenseType>("EXPENSE");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<EditingState>(null);
  const [confirmDelete, setConfirmDelete] = useState<ExpenseCategory | null>(
    null,
  );
  const [movingTx, setMovingTx] = useState<ExpenseCategory | null>(null);
  // 표면이 닫힌 뒤 초점을 돌려 둘 줄 — 수정 시트와 함께 ⋮ 가 사라지므로 그 카테고리 줄로 돌린다(삭제 뒤에는 이웃 줄 · 없으면 목록 머리)
  const lastRowRef = useRef<number | null>(null);
  const focusRow = (id: number | null) => {
    window.setTimeout(() => {
      const row =
        id == null
          ? null
          : document.querySelector<HTMLElement>(`[data-category-row="${id}"]`);
      (row ?? document.getElementById(titleId))?.focus({
        preventScroll: false,
      });
    }, 200);
  };
  const neighborOf = (id: number): number | null => {
    const ids = Array.from(
      document.querySelectorAll<HTMLElement>("[data-category-row]"),
    ).map((el) => Number(el.dataset.categoryRow));
    const i = ids.indexOf(id);
    return ids[i + 1] ?? ids[i - 1] ?? null;
  };
  const closeEdit = () => {
    createMut.reset();
    updateMut.reset();
    setEditing(null);
    focusRow(lastRowRef.current);
  };
  // 자식 이동 시 새 부모 예산 초과 확인 — 승인하면 저장 진행.
  const [pendingMove, setPendingMove] = useState<{
    values: ExpenseCategoryFormValues;
    id: number;
    parentName: string;
    over: number;
  } | null>(null);

  // 이번 달 예산/지출 — 이동 초과 경고용(삭제 확인은 모든 달 예산이 지워지므로 이번 달을 보지 않는다).
  const cmNow = new Date();
  const cmYM = { year: cmNow.getFullYear(), month: cmNow.getMonth() + 1 };
  const cmStart = `${cmYM.year}-${String(cmYM.month).padStart(2, "0")}-01`;
  const cmEnd = `${cmYM.year}-${String(cmYM.month).padStart(2, "0")}-${String(new Date(cmYM.year, cmYM.month, 0).getDate()).padStart(2, "0")}`;
  const { data: budgets } = useExpenseBudgets(cmYM, {
    reference: true,
  });
  const { data: rangeSummary } = useRangeSummary(cmStart, cmEnd, undefined, {
    reference: true,
  });

  const budgetOf = (categoryRowId: number): number | null =>
    budgets?.find((b) => b.categoryRowId === categoryRowId)?.budgetAmount ??
    null;
  // 카테고리 본인 + 자식 지출 roll-up (백엔드 categoryBreakdown 의 parentCategoryRowId 기준).
  const spentRollup = (categoryRowId: number): number =>
    (rangeSummary?.categoryBreakdown ?? [])
      .filter(
        (c) =>
          c.categoryRowId === categoryRowId ||
          c.parentCategoryRowId === categoryRowId,
      )
      .reduce((s, c) => s + c.totalAmount, 0);
  const ownSpent = (categoryRowId: number): number =>
    (rangeSummary?.categoryBreakdown ?? [])
      .filter((c) => c.categoryRowId === categoryRowId)
      .reduce((s, c) => s + c.totalAmount, 0);

  const list = useMemo(() => categories ?? [], [categories]);

  const counts = useMemo(
    () => ({
      expense: list.filter((c) => c.expenseType === "EXPENSE").length,
      income: list.filter((c) => c.expenseType === "INCOME").length,
    }),
    [list],
  );

  // 현재 탭의 부모-자식 트리 구성 (검색어 매칭된 것만 노출)
  type Tree = { parent: ExpenseCategory; children: ExpenseCategory[] }[];
  const tree: Tree = useMemo(() => {
    const inTab = list.filter((c) => c.expenseType === tab);
    const sorted = inTab.slice().sort((a, b) => a.sortOrder - b.sortOrder);
    const byParent = new Map<number, ExpenseCategory[]>();
    const parents: ExpenseCategory[] = [];
    for (const c of sorted) {
      if (c.parentRowId == null) parents.push(c);
      else {
        const arr = byParent.get(c.parentRowId) ?? [];
        arr.push(c);
        byParent.set(c.parentRowId, arr);
      }
    }
    const q = query.trim();
    return parents
      .map((p) => {
        const children = byParent.get(p.rowId) ?? [];
        if (q === "") return { parent: p, children };
        // 검색: 부모 또는 자식 중 하나라도 매칭되면 해당 그룹 노출
        const parentMatch = p.categoryName.includes(q);
        const filteredChildren = parentMatch
          ? children
          : children.filter((c) => c.categoryName.includes(q));
        if (!parentMatch && filteredChildren.length === 0) return null;
        return { parent: p, children: filteredChildren };
      })
      .filter(
        (x): x is { parent: ExpenseCategory; children: ExpenseCategory[] } =>
          x != null,
      );
  }, [list, tab, query]);

  const submitting = createMut.isPending || updateMut.isPending;

  // 바깥(설정 폰 머리 "추가")이 올린 횟수가 바뀐 순간에만 새 폼을 연다. 렌더 중 조정이라 커밋을 한 번 더 태우지 않는다.
  const [seenAddRequest, setSeenAddRequest] = useState(addRequest);
  if (seenAddRequest !== addRequest) {
    setSeenAddRequest(addRequest);
    setEditing({ kind: "new" });
  }

  const startReorder = (on: boolean) => {
    setReorder(on);
    // 필터된 일부만 보며 정렬하는 혼란을 막는다 — 순서 모드에 들어갈 때 검색을 비운다
    if (on) setQuery("");
  };

  const saveFailed = createMut.isError || updateMut.isError;
  const saveError = createMut.error ?? updateMut.error ?? undefined;
  const clearSaveError = () => {
    createMut.reset();
    updateMut.reset();
  };
  // 이중 제출 가드 — 같은 프레임의 두 번째 누름은 렌더 전 클로저라 isPending 이 아직 false 다. 누르는 순간 켜고 끝나면(성공 · 실패) 끈다
  const savingRef = useRef(false);
  const settle = {
    onSettled: () => {
      savingRef.current = false;
    },
  };

  const doUpdate = (id: number, values: ExpenseCategoryFormValues) => {
    if (savingRef.current) return;
    savingRef.current = true;
    clearSaveError();
    updateMut.mutate({ id, data: values }, { ...settle, onSuccess: closeEdit });
  };

  const onSave = (values: ExpenseCategoryFormValues) => {
    if (editing && "rowId" in editing) {
      // 자식을 다른 부모로 이동 — 새 부모 예산 초과 시 한 번 확인 (룰3).
      const movedToNewParent =
        values.parentRowId != null &&
        values.parentRowId !== editing.parentRowId;
      if (movedToNewParent) {
        const newParentBudget = budgetOf(values.parentRowId!);
        if (newParentBudget != null) {
          const projected =
            spentRollup(values.parentRowId!) + ownSpent(editing.rowId);
          if (projected > newParentBudget) {
            const parent = list.find((c) => c.rowId === values.parentRowId);
            setPendingMove({
              values,
              id: editing.rowId,
              parentName: parent?.categoryName ?? t("parentFallback"),
              over: projected - newParentBudget,
            });
            return;
          }
        }
      }
      doUpdate(editing.rowId, values);
    } else {
      if (savingRef.current) return;
      savingRef.current = true;
      clearSaveError();
      createMut.mutate(values, { ...settle, onSuccess: closeEdit });
    }
  };

  // DnD: 같은 형제 레벨(최상위 또는 같은 부모)끼리만 정렬 가능
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = (ev: DragEndEvent, siblingIds: number[]) => {
    const { active, over } = ev;
    if (!over || active.id === over.id) return;
    const oldIndex = siblingIds.indexOf(Number(active.id));
    const newIndex = siblingIds.indexOf(Number(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    const reordered = arrayMove(siblingIds, oldIndex, newIndex);
    const items = reordered.map((id, idx) => {
      const cat = list.find((c) => c.rowId === id)!;
      return {
        categoryRowId: id,
        sortOrder: idx,
        parentRowId: cat.parentRowId,
      };
    });
    // 훅이 이전 순서로 되돌린다 — 되돌린 자리에서 고정 글로 알린다(다시 시도 없음)
    reorderMut.mutate(items, {
      onError: () =>
        snackbar.show({ message: t("reorderFailed"), tone: "critical" }),
    });
  };

  const recurringUsing = (c: ExpenseCategory) =>
    recurrings?.filter((r) => r.categoryRowId === c.rowId).length ?? 0;

  const failed = !isLoading && categories === undefined;
  const count = tab === "EXPENSE" ? counts.expense : counts.income;

  const tabs = (
    <Tabs value={tab} onValueChange={(v) => setTab(v as ExpenseType)}>
      <TabsList
        aria-label={te("category")}
        layout={mobile ? "fill" : "hug"}
        size="medium"
      >
        <TabsTrigger value="EXPENSE">{te("expense")}</TabsTrigger>
        <TabsTrigger value="INCOME">{te("income")}</TabsTrigger>
      </TabsList>
    </Tabs>
  );

  // 검색칸 자리 — 순서 모드에서는 안내 한 줄이 대신한다
  const searchRow = reorder ? (
    <p className="m-0 px-global-gutter pb-x2 pt-x2 font-sans text-t4 text-fg-neutral-subtle">
      {t("reorderHint")}
    </p>
  ) : (
    <div className="px-global-gutter pb-x2 pt-x2">
      <Input
        variant="underline"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t("searchPlaceholder")}
        aria-label={t("searchPlaceholder")}
        prefixIcon={<Search />}
        clearable
        autoComplete="off"
        enterKeyHint="search"
      />
    </div>
  );

  const listTitle = !isLoading && categories && (
    <ListHeader as="div">
      <h2
        id={titleId}
        tabIndex={-1}
        className="m-0 tracking-normal text-inherit [font:inherit]"
      >
        {t("listTitle", {
          kind: tab === "EXPENSE" ? t("expenseCategory") : t("incomeCategory"),
          count,
        })}
      </h2>
      <Button
        type="button"
        variant="ghost"
        ghostColor="neutralMuted"
        size="small"
        onClick={() => startReorder(!reorder)}
      >
        {reorder ? t("reorderDone") : t("reorderEdit")}
      </Button>
    </ListHeader>
  );

  const listBody = isLoading ? (
    <CategoryListSkeleton />
  ) : failed ? (
    <BandFailure
      title={t("loadFailed")}
      onRetry={() => void categoriesQ.refetch()}
      className="px-x6"
    />
  ) : list.length === 0 ? (
    <BandEmpty>{t("empty")}</BandEmpty>
  ) : tree.length === 0 ? (
    <BandEmpty>{t("noSearchResults")}</BandEmpty>
  ) : (
    <CategoryTree
      tree={tree}
      reorder={reorder}
      sensors={sensors}
      onReorder={handleDragEnd}
      ariaLabelledBy={titleId}
      actions={{
        onEdit: (c) => {
          lastRowRef.current = c.rowId;
          setEditing(c);
        },
      }}
    />
  );

  const body = (
    <>
      {tabs}
      {searchRow}
      {listTitle}
      {listBody}
    </>
  );

  return (
    <>
      {mobile ? (
        <div className="flex flex-col pb-x6">{body}</div>
      ) : (
        <>
          <ManagerHead
            title={te("categories")}
            description={t("manager.description")}
            actions={
              // 제목 줄 오른쪽 주 동작 = Button small neutralOutline + 앞 아이콘 14, 글은 동작 이름(I-16 28 · S3)
              <Button
                variant="neutralOutline"
                size="small"
                onClick={() => setEditing({ kind: "new" })}
              >
                <Plus aria-hidden />
                {te("addCategory")}
              </Button>
            }
          />
          <Card body="list">{body}</Card>
        </>
      )}

      {movingTx && (
        <CategoryMoveTxDialog
          source={movingTx}
          categories={list}
          onClose={() => {
            setMovingTx(null);
            focusRow(movingTx.rowId);
          }}
        />
      )}
      {editing && (
        <CategoryEditDialog
          // 수정 → 하위 추가처럼 같은 자리에서 다른 폼으로 바뀌면 폼 상태를 새로 시작한다
          key={
            "rowId" in editing
              ? `edit-${editing.rowId}`
              : `new-${editing.parentRowId ?? "root"}`
          }
          cat={editing && "rowId" in editing ? editing : null}
          defaultKind={tab}
          defaultParentRowId={
            editing && "kind" in editing ? (editing.parentRowId ?? null) : null
          }
          onClose={closeEdit}
          onSave={onSave}
          // 수정 시트 머리 ⋮ — 시트를 닫고 새 폼 · 시트 · 확인창을 연다(폼 위 폼은 겹치지 않는다)
          onAddChild={(parent) => {
            lastRowRef.current = parent.rowId;
            setEditing({ kind: "new", parentRowId: parent.rowId });
          }}
          onMoveTx={(c) => {
            setEditing(null);
            setMovingTx(c);
          }}
          onDelete={(c) => {
            setEditing(null);
            setConfirmDelete(c);
          }}
          existing={list}
          submitting={submitting}
          saveFailed={saveFailed}
          saveError={saveError}
        />
      )}

      {/* 하위가 있어 삭제가 막힘 — 고를 것이 없으니 확인 하나(acknowledge) */}
      <AlertDialog
        open={confirmDelete?.hasChildren === true}
        onOpenChange={(open) => {
          if (!open) {
            focusRow(confirmDelete?.rowId ?? null);
            setConfirmDelete(null);
          }
        }}
      >
        {confirmDelete?.hasChildren && (
          <AlertDialogContent>
            <AlertDialogTitle>{t("deleteBlockedTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("deleteHasChildren", { name: confirmDelete.categoryName })}
            </AlertDialogDescription>
            <AlertDialogFooter>
              <AlertDialogAction>{tc("confirm")}</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        )}
      </AlertDialog>

      {/* 삭제 확인 — 거래가 남고 예산이 함께 지워진다는 서버 동작대로 말한다(처음 두 문장은 늘 같다) */}
      <AlertDialog
        open={confirmDelete != null && !confirmDelete.hasChildren}
        onOpenChange={(open) => {
          if (!open && !deleteMut.isPending) {
            focusRow(confirmDelete?.rowId ?? null);
            setConfirmDelete(null);
          }
        }}
      >
        {confirmDelete && !confirmDelete.hasChildren && (
          <AlertDialogContent>
            <AlertDialogTitle>
              {t("deleteConfirm", { name: confirmDelete.categoryName })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("deleteMessage")}
              {recurringUsing(confirmDelete) > 0 &&
                ` ${t("deleteRecurring", { count: recurringUsing(confirmDelete) })}`}
            </AlertDialogDescription>
            <AlertDialogFooter>
              <AlertDialogCancel>{tc("cancel")}</AlertDialogCancel>
              <AlertDialogAction
                variant="criticalSolid"
                loading={deleteMut.isPending}
                onClick={(e) => {
                  e.preventDefault();
                  const next = neighborOf(confirmDelete.rowId);
                  const target = confirmDelete;
                  const remove = () => deleteMut.mutateAsync(target.rowId);
                  remove().then(
                    () => {
                      setConfirmDelete(null);
                      focusRow(next);
                    },
                    () => {
                      // 확인창을 닫고 critical 스낵바 + [다시 시도](묻지 않고 같은 삭제)
                      setConfirmDelete(null);
                      confirmFail({
                        message: t("deleteFailed"),
                        retry: remove,
                        onRetried: () => focusRow(next),
                      });
                    },
                  );
                }}
              >
                {tc("delete")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        )}
      </AlertDialog>

      <AlertDialog
        open={pendingMove != null}
        onOpenChange={(open) => {
          if (!open) setPendingMove(null);
        }}
      >
        {pendingMove && (
          <AlertDialogContent>
            <AlertDialogTitle>{t("overBudgetTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("overBudgetMessage", {
                parent: pendingMove.parentName,
                amount: KRW(pendingMove.over),
              })}
            </AlertDialogDescription>
            <AlertDialogFooter>
              <AlertDialogCancel>{tc("cancel")}</AlertDialogCancel>
              <AlertDialogAction
                loading={updateMut.isPending}
                onClick={() => {
                  doUpdate(pendingMove.id, pendingMove.values);
                  setPendingMove(null);
                }}
              >
                {t("move")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        )}
      </AlertDialog>
    </>
  );
}
