import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ArrowRightLeft,
  EllipsisVertical,
  Folder,
  ListTree,
  Palette,
  Plus,
  Tag,
  Tags,
  Trash2,
} from "lucide-react";
import { useLeaveConfirm } from "@/shared/ds/alert-dialog";
import { Button } from "@/shared/ds/button";
import { firstUnusedColor } from "@/shared/ds/color-swatch";
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
  ResponsiveMenu,
  ResponsiveMenuContent,
  ResponsiveMenuGroup,
  ResponsiveMenuItem,
  ResponsiveMenuTrigger,
} from "@/shared/ds/menu";
import { PickList } from "@/shared/ui/groo/pick-list";
import { PickerRow } from "@/shared/ui/groo/picker-row";
import { Icon } from "@/shared/ui/groo/primitives";
import { isIconName } from "@/shared/lib";
import {
  ColorPickerRow,
  IconPickerRow,
} from "@/shared/ui/groo/icon-color-rows";
import {
  CHART_PAIRS,
  chartColorOf,
  getPaletteByColor,
} from "@/shared/lib/groo/chart-palette";
import { nameIssue } from "@/shared/lib/groo/name-policy";
import type {
  ExpenseCategory,
  ExpenseCategoryFormValues,
  ExpenseType,
} from "@/entities/expense";

/** @deprecated retained only for legacy re-exports; prefer ExpenseCategory. */
export interface CategoryItem {
  id: string;
  label: string;
  icon: string;
  color: string;
  bg: string;
  kind: "expense" | "income";
  count: number;
}

/** 카테고리 이름 상한 — 목록 줄 한 칸에 들어가는 길이(서버 상한은 더 넓다) */
export const CATEGORY_NAME_MAX = 12;

const ROOT = "root";

const baseOf = (key: ReturnType<typeof firstUnusedColor>) =>
  CHART_PAIRS.find((p) => p.key === key)!.base;

/** 같은 종류 카테고리가 아직 쓰지 않은 첫 색(color-swatch.md:98) — 늘 빨강으로 시작하지 않는다 */
function nextColor(existing: ExpenseCategory[], kind: ExpenseType) {
  return baseOf(
    firstUnusedColor(
      existing
        .filter((c) => c.expenseType === kind)
        .map((c) => chartColorOf(c.color)),
    ),
  );
}

/**
 * 카테고리 추가 · 수정 폼(D21, I-20 B 12) — 맨 위 한 줄에 미리보기 타일 + 이름 칸, 그 아래 고르는 값 넷(종류 · 상위 · 색상 · 아이콘)은 줄이다.
 * 1280 이상 대화상자 480 · 미만 Bottom Sheet. 주 버튼은 켜 두고 누를 때 칸 아래에 오류를 보인다.
 * 삭제 · 거래 옮기기는 목록 줄 ⋮ 에 있고 이 폼에 두지 않는다. 저장 본문 · 순서(`sortOrder`)는 그대로다.
 */
export function CategoryEditDialog({
  cat,
  defaultKind,
  defaultParentRowId,
  onClose,
  onSave,
  onAddChild,
  onMoveTx,
  onDelete,
  existing,
  submitting,
}: {
  cat: ExpenseCategory | null;
  defaultKind: ExpenseType;
  defaultParentRowId?: number | null;
  onClose: () => void;
  onSave: (values: ExpenseCategoryFormValues) => void;
  /** 수정 시트 머리 ⋮ 의 동작(10-25 줄 끝 ⋮ 원칙) — 새 카테고리에는 머리 ⋮ 가 없다 */
  onAddChild?: (parent: ExpenseCategory) => void;
  onMoveTx?: (cat: ExpenseCategory) => void;
  onDelete?: (cat: ExpenseCategory) => void;
  existing: ExpenseCategory[];
  submitting?: boolean;
}) {
  const { t } = useTranslation("category");
  const { t: tc } = useTranslation("common");
  const { t: te } = useTranslation("expense");
  const isNew = !cat;

  const [initial] = useState(() => {
    const kind = cat?.expenseType ?? defaultKind;
    return {
      name: cat?.categoryName ?? "",
      kind,
      parentRowId: cat?.parentRowId ?? defaultParentRowId ?? null,
      // 고치는 카테고리는 저장된 색을 그대로 — 팔레트 밖 색도 빨강으로 바꾸지 않는다
      color: cat?.color ?? nextColor(existing, kind),
      icon: cat?.icon || "tag",
    };
  });
  const [label, setLabel] = useState(initial.name);
  const [kind, setKind] = useState<ExpenseType>(initial.kind);
  const [parentRowId, setParentRowId] = useState<number | null>(
    initial.parentRowId,
  );
  // 새 카테고리는 색을 고르기 전까지 고른 종류의 첫 안 쓴 색을 따라간다
  const [pickedColor, setPickedColor] = useState<string | null>(null);
  const [icon, setIcon] = useState(initial.icon);
  const [nameError, setNameError] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  const color =
    pickedColor ?? (isNew ? nextColor(existing, kind) : initial.color);
  const labelTrim = label.trim();

  // 상위 후보: 같은 종류의 최상위, 본인 제외
  const parentOptions = existing.filter(
    (c) =>
      c.expenseType === kind && c.parentRowId == null && c.rowId !== cat?.rowId,
  );
  const parent = existing.find((c) => c.rowId === parentRowId);

  const dirty =
    label !== initial.name ||
    kind !== initial.kind ||
    parentRowId !== initial.parentRowId ||
    (isNew ? pickedColor != null : color !== initial.color) ||
    icon !== initial.icon;

  const palette = getPaletteByColor(color);

  // 머리 ⋮ 의 세 동작은 수정 시트를 떠난다 — 바뀐 값이 있으면 닫을 때와 같은 "작성한 내용이 사라져요" 를 먼저 묻는다
  const pendingRef = useRef<(() => void) | null>(null);
  const contentRef = useRef<HTMLElement | null>(null);
  const leave = useLeaveConfirm({
    dirty,
    leave: () => {
      const run = pendingRef.current;
      pendingRef.current = null;
      run?.();
    },
    contentRef,
  });
  const leaveThen = (run: () => void) => {
    pendingRef.current = run;
    leave.request();
  };

  const submit = () => {
    if (submitting) return;
    // 같은 상위 · 같은 종류 안에서만 이름이 겹치면 안 된다(서버 규칙과 같다)
    const taken = existing
      .filter(
        (c) =>
          c.rowId !== cat?.rowId &&
          c.expenseType === kind &&
          (c.parentRowId ?? null) === parentRowId,
      )
      .map((c) => c.categoryName);
    const issue = nameIssue(label, CATEGORY_NAME_MAX, taken);
    if (issue) {
      setNameError(
        issue === "required"
          ? t("nameRequired")
          : issue === "tooLong"
            ? t("nameTooLong")
            : t("nameDuplicate"),
      );
      nameRef.current?.focus();
      return;
    }
    onSave({
      categoryName: labelTrim,
      icon,
      color,
      expenseType: kind,
      sortOrder: cat?.sortOrder,
      parentRowId,
    });
  };

  const tile = (c: ExpenseCategory) => {
    const p = getPaletteByColor(c.color);
    return (
      <ListTile style={{ background: p.bg, color: p.color }}>
        <Icon name={isIconName(c.icon) ? c.icon : "tag"} size={20} />
      </ListTile>
    );
  };

  const kindText = kind === "EXPENSE" ? te("expense") : te("income");
  // 최상위의 수정: 강등 금지 — 보기만 "최상위". 하위의 수정: 다른 최상위로만(승격 금지)
  const parentReadOnly = !isNew && cat?.parentRowId == null;

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
        title={isNew ? te("addCategory") : t("editTitle")}
        // 머리 오른쪽 ⋮ — ds 머리 동작 자리(닫기 왼쪽 사이 4 · 닫기 없는 입력 폼은 오른쪽 끝). 새 카테고리에는 없다
        headerAction={
          cat ? (
            <ResponsiveMenu>
              <ResponsiveMenuTrigger asChild>
                <Button
                  variant="ghost"
                  ghostColor="neutralSubtle"
                  layout="iconOnly"
                  size="small"
                  aria-label={t("moreOf", { name: cat.categoryName })}
                >
                  <EllipsisVertical aria-hidden />
                </Button>
              </ResponsiveMenuTrigger>
              <ResponsiveMenuContent title={cat.categoryName} align="end">
                <ResponsiveMenuGroup>
                  {/* 2단계까지 — 하위 줄에는 하위 추가를 두지 않는다 */}
                  {cat.parentRowId == null && (
                    <ResponsiveMenuItem
                      label={t("addSub")}
                      icon={<Plus aria-hidden />}
                      onSelect={() => leaveThen(() => onAddChild?.(cat))}
                    />
                  )}
                  {/* 하위가 있는 부모에는 거래가 달릴 수 없어 옮길 것이 0 이다 */}
                  {!cat.hasChildren && (
                    <ResponsiveMenuItem
                      label={t("moveTx.entry")}
                      icon={<ArrowRightLeft aria-hidden />}
                      onSelect={() => leaveThen(() => onMoveTx?.(cat))}
                    />
                  )}
                </ResponsiveMenuGroup>
                <ResponsiveMenuGroup>
                  <ResponsiveMenuItem
                    label={tc("delete")}
                    icon={<Trash2 aria-hidden />}
                    tone="critical"
                    onSelect={() => leaveThen(() => onDelete?.(cat))}
                  />
                </ResponsiveMenuGroup>
              </ResponsiveMenuContent>
            </ResponsiveMenu>
          ) : undefined
        }
        // 새 카테고리만 이름 칸에 초점 — 수정은 표면이 받는다(폰에서 키보드가 가리지 않게)
        onOpenAutoFocus={(e) => {
          if (!isNew) return;
          e.preventDefault();
          nameRef.current?.focus({ preventScroll: true });
        }}
      >
        <ResponsiveDialogBody>
          <div className="mb-x2 flex items-start gap-x3">
            <span
              aria-hidden
              data-slot="category-preview-tile"
              className="inline-grid size-x13 shrink-0 place-items-center rounded-r4 [&>svg]:size-5"
              style={{ background: palette.bg, color: palette.color }}
            >
              <Icon name={isIconName(icon) ? icon : "tag"} size={20} />
            </span>
            <Field
              className="min-w-0 flex-1"
              maxGraphemeCount={CATEGORY_NAME_MAX}
              invalid={nameError != null}
              errorMessage={nameError}
            >
              <Input
                ref={nameRef}
                size="large"
                aria-label={t("name")}
                value={label}
                placeholder={t("namePlaceholder")}
                autoComplete="off"
                onChange={(e) => {
                  setLabel(e.target.value);
                  setNameError(null);
                }}
              />
            </Field>
          </div>
          <div className="-mx-x6">
            {isNew ? (
              <PickerRow
                title={t("kindLabel")}
                prefix={<Folder />}
                value={kindText}
                surfaceTitle={t("kindLabel")}
              >
                {({ close }) => (
                  <PickList
                    label={t("kindLabel")}
                    selected={kind}
                    items={[
                      { value: "EXPENSE", title: te("expense") },
                      { value: "INCOME", title: te("income") },
                    ]}
                    onPick={(v) => {
                      const next = v as ExpenseType;
                      if (next !== kind) {
                        setKind(next);
                        // 다른 종류의 상위가 남으면 서버가 거절한다 — 최상위로 되돌린다
                        setParentRowId(null);
                      }
                      close();
                    }}
                  />
                )}
              </PickerRow>
            ) : (
              <PickerRow
                readOnly
                title={t("kindLabel")}
                prefix={<Folder />}
                value={kindText}
                surfaceTitle={t("kindLabel")}
              />
            )}
            {parentReadOnly ? (
              <PickerRow
                readOnly
                title={t("parentCategory")}
                prefix={<Tags />}
                value={t("rootOption")}
                surfaceTitle={t("parentCategory")}
              />
            ) : (
              <PickerRow
                title={t("parentCategory")}
                prefix={<Tags />}
                value={parent ? parent.categoryName : t("rootOption")}
                dot={parent ? getPaletteByColor(parent.color).color : undefined}
                surfaceTitle={t("parentCategory")}
                scrollFog
              >
                {({ close }) => (
                  <>
                    {!isNew && (
                      <p className="m-0 py-x3 font-sans text-t4 text-fg-neutral-subtle">
                        {t("parentMoveHint")}
                      </p>
                    )}
                    <PickList
                      label={t("parentCategory")}
                      selected={
                        parentRowId == null ? ROOT : String(parentRowId)
                      }
                      items={[
                        ...(isNew
                          ? [
                              {
                                value: ROOT,
                                title: t("rootOption"),
                                // 다른 줄과 같은 40 타일 — 중립 바탕 + 나무 위 아이콘(제목이 한 세로선에 선다)
                                prefix: (
                                  <ListTile className="bg-chart-gray-weak text-chart-gray">
                                    <ListTree aria-hidden />
                                  </ListTile>
                                ),
                              },
                            ]
                          : []),
                        ...parentOptions.map((c) => ({
                          value: String(c.rowId),
                          title: c.categoryName,
                          prefix: tile(c),
                        })),
                      ]}
                      onPick={(v) => {
                        setParentRowId(v === ROOT ? null : Number(v));
                        close();
                      }}
                    />
                  </>
                )}
              </PickerRow>
            )}
            <ColorPickerRow
              title={t("color")}
              prefix={<Palette />}
              value={color}
              onChange={setPickedColor}
            />
            <IconPickerRow
              title={t("iconLabel")}
              prefix={<Tag />}
              value={icon}
              onChange={setIcon}
            />
          </div>
        </ResponsiveDialogBody>
        <ResponsiveDialogFooter>
          <ResponsiveDialogCancel>{tc("cancel")}</ResponsiveDialogCancel>
          <Button loading={submitting} onClick={submit}>
            {isNew ? t("submitAdd") : tc("save")}
          </Button>
        </ResponsiveDialogFooter>
        {leave.node}
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
