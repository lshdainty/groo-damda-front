import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/shared/ds/button";
import {
  ResponsiveDialog,
  ResponsiveDialogBody,
  ResponsiveDialogCancel,
  ResponsiveDialogContent,
  ResponsiveDialogFooter,
} from "@/shared/ds/dialog";
import { Field } from "@/shared/ds/field";
import { Input } from "@/shared/ds/input";
import { ListTile } from "@/shared/ds/list";
import {
  SegmentedControl,
  SegmentedControlItem,
} from "@/shared/ds/segmented-control";
import { PickList } from "@/shared/ui/groo/pick-list";
import { PickerRow } from "@/shared/ui/groo/picker-row";
import { Icon } from "@/shared/ui/groo/primitives";
import { isIconName } from "@/shared/lib";
import { getPaletteByColor } from "@/shared/lib/groo/chart-palette";
import {
  useMoveCategoryTransactions,
  useSplitCategoryIntoChild,
} from "@/features/expense";
import type { ExpenseCategory } from "@/entities/expense";

/** 새 하위 이름 상한 — 카테고리 이름 칸과 같은 12자(I-20 B 11) */
const CHILD_NAME_MAX = 12;

/**
 * 카테고리에 달린 거래를 다른 카테고리로 일괄 이동(D22). 목록 줄 ⋮ 의 "거래 옮기기" 에서 연다(I-20 B 11).
 *
 * <p>거래가 직접 달린 카테고리는 하위 분류를 만들 수 없다(거래는 말단에만 달 수 있어서).
 * 그 상태를 푸는 유일한 방법이다. 입력 폼 표면 — 1280 미만 시트 · 이상 대화상자 480.
 * 주 버튼은 켜 두고, 비었으면 누를 때 그 칸 아래에 오류를 보인다. 요청 · 무효화 · 완료 알림은 옛 길 그대로다.
 */
export function CategoryMoveTxDialog({
  source,
  categories,
  onClose,
}: {
  source: ExpenseCategory;
  categories: ExpenseCategory[];
  onClose: () => void;
}) {
  const { t } = useTranslation("category");
  const { t: tc } = useTranslation("common");
  const [targetRowId, setTargetRowId] = useState<number | null>(null);
  const [childName, setChildName] = useState("");
  const [show, setShow] = useState({ name: false, target: false });
  const nameRef = useRef<HTMLInputElement>(null);
  const targetRef = useRef<HTMLButtonElement>(null);
  const moveMut = useMoveCategoryTransactions();
  const splitMut = useSplitCategoryIntoChild();

  // 하위가 없는 최상위만 "새 하위 만들기" 대상 — 거래가 있어 하위를 못 만드는 교착이
  // 생기는 자리가 정확히 여기다. 하위 카테고리엔 또 하위를 만들 수 없다(최대 2단계).
  const hasChildren = categories.some((c) => c.parentRowId === source.rowId);
  const canSplit = source.parentRowId == null && !hasChildren;
  const [mode, setMode] = useState<"existing" | "new">(
    canSplit ? "new" : "existing",
  );

  // 옮길 수 있는 곳 = 같은 유형이고, 자기 자신이 아니고, 자식이 없는(말단) 카테고리.
  // 서버도 같은 규칙으로 거부하므로 여기서 미리 걸러 고를 수 없게 한다.
  const options = useMemo(() => {
    const parentIds = new Set(
      categories
        .filter((c) => c.parentRowId != null)
        .map((c) => c.parentRowId as number),
    );
    return categories.filter(
      (c) =>
        c.rowId !== source.rowId &&
        c.expenseType === source.expenseType &&
        !parentIds.has(c.rowId),
    );
  }, [categories, source]);

  const parentNameOf = (c: ExpenseCategory) =>
    c.parentRowId != null
      ? categories.find((p) => p.rowId === c.parentRowId)?.categoryName
      : undefined;
  const target = options.find((c) => c.rowId === targetRowId);

  const done = (r: { expenses: number; recurring: number; splits: number }) => {
    toast.success(
      t("moveTx.done", { count: r.expenses + r.recurring + r.splits }),
    );
    onClose();
  };

  const nameTrim = childName.trim();
  const submitting = moveMut.isPending || splitMut.isPending;
  const dirty = nameTrim.length > 0 || targetRowId != null;

  const submit = () => {
    if (submitting) return;
    if (mode === "new") {
      if (nameTrim.length === 0) {
        setShow((s) => ({ ...s, name: true }));
        nameRef.current?.focus();
        return;
      }
      splitMut.mutate(
        {
          id: source.rowId,
          childName: nameTrim,
          icon: source.icon ?? "tag",
          color: source.color ?? "#9E9E9E",
        },
        { onSuccess: done },
      );
      return;
    }
    if (targetRowId == null) {
      setShow((s) => ({ ...s, target: true }));
      targetRef.current?.focus();
      return;
    }
    moveMut.mutate(
      { id: source.rowId, targetCategoryRowId: targetRowId },
      { onSuccess: done },
    );
    // onError: 전역 인터셉터가 서버 메시지를 토스트로 노출
  };

  return (
    <ResponsiveDialog
      open
      form
      dirty={dirty}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <ResponsiveDialogContent
        title={t("moveTx.title")}
        description={t("moveTx.desc", { name: source.categoryName })}
        onOpenAutoFocus={(e) => {
          if (mode !== "new") return;
          e.preventDefault();
          nameRef.current?.focus({ preventScroll: true });
        }}
      >
        <ResponsiveDialogBody>
          {canSplit && (
            <SegmentedControl
              aria-label={t("moveTx.mode")}
              value={mode}
              onValueChange={(v) => setMode(v as typeof mode)}
              className="mb-x6"
            >
              <SegmentedControlItem value="new">
                {t("moveTx.modeNew")}
              </SegmentedControlItem>
              <SegmentedControlItem value="existing">
                {t("moveTx.modeExisting")}
              </SegmentedControlItem>
            </SegmentedControl>
          )}
          {mode === "new" ? (
            <Field
              label={t("moveTx.childName")}
              maxGraphemeCount={CHILD_NAME_MAX}
              description={t("moveTx.newHint", { name: source.categoryName })}
              invalid={show.name && nameTrim.length === 0}
              errorMessage={t("moveTx.errChildName")}
            >
              <Input
                ref={nameRef}
                value={childName}
                placeholder={t("moveTx.childPlaceholder")}
                autoComplete="off"
                onChange={(e) => {
                  setChildName(e.target.value);
                  setShow((s) => ({ ...s, name: false }));
                }}
              />
            </Field>
          ) : (
            <div>
              <div className="-mx-x6">
                <PickerRow
                  ref={targetRef}
                  title={t("moveTx.target")}
                  value={target?.categoryName}
                  placeholder={t("moveTx.targetPlaceholder")}
                  dot={
                    target ? getPaletteByColor(target.color).color : undefined
                  }
                  surfaceTitle={t("moveTx.target")}
                  scrollFog
                  errorMessage={
                    show.target && targetRowId == null
                      ? t("moveTx.errTarget")
                      : null
                  }
                >
                  {({ close }) =>
                    options.length === 0 ? (
                      <p className="m-0 py-x3 font-sans text-t4 text-fg-neutral-subtle">
                        {t("moveTx.noTarget")}
                      </p>
                    ) : (
                      <PickList
                        label={t("moveTx.target")}
                        selected={
                          targetRowId != null ? String(targetRowId) : null
                        }
                        items={options.map((c) => {
                          const palette = getPaletteByColor(c.color);
                          return {
                            value: String(c.rowId),
                            title: c.categoryName,
                            detail: parentNameOf(c),
                            prefix: (
                              <ListTile
                                style={{
                                  background: palette.bg,
                                  color: palette.color,
                                }}
                              >
                                <Icon
                                  name={isIconName(c.icon) ? c.icon : "tag"}
                                  size={20}
                                />
                              </ListTile>
                            ),
                          };
                        })}
                        onPick={(v) => {
                          setTargetRowId(Number(v));
                          setShow((s) => ({ ...s, target: false }));
                          close();
                        }}
                      />
                    )
                  }
                </PickerRow>
              </div>
              <p className="m-0 mt-x1_5 font-sans text-t4 text-fg-neutral-subtle">
                {options.length === 0 ? t("moveTx.noTarget") : t("moveTx.hint")}
              </p>
            </div>
          )}
        </ResponsiveDialogBody>
        <ResponsiveDialogFooter>
          <ResponsiveDialogCancel>{tc("cancel")}</ResponsiveDialogCancel>
          <Button loading={submitting} onClick={submit}>
            {t("moveTx.action")}
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
