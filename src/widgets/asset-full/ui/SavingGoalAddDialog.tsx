import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { MAX_AMOUNT, parseAmount } from "@/shared/lib/groo/amount";
import { nameIssue } from "@/shared/lib/groo/name-policy";
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
import { firstUnusedColor } from "@/shared/ds/color-swatch";
import { AmountInput } from "@/shared/ui/groo/amount-input";
import { CHART_PAIRS, chartColorOf } from "@/shared/lib/groo/chart-palette";
import {
  useContributeSavingGoal,
  useCreateSavingGoal,
  useSavingGoals,
  useUpdateSavingGoal,
} from "@/features/savingGoal";
import type { SavingGoal } from "@/entities/savingGoal";
import {
  GoalColorRow,
  GoalDeadlineRow,
  GoalIconRow,
} from "./SavingGoalPickers";

/** 목표 이름 상한 — 카테고리·라벨·태그와 같은 12자. 카드 한 줄에 들어가는 길이다. */
const GOAL_NAME_MAX = 12;

const digitsOf = (n: number | undefined) => (n ? String(n) : "");

interface SavingGoalAddDialogProps {
  /** null/undefined → 생성 모드, 객체 → 수정 모드 */
  goal?: SavingGoal | null;
  onClose: () => void;
}

type Errors = {
  name?: string;
  target?: string;
  current?: string;
};

/**
 * 저축 목표 추가 · 수정 폼(I-19 D). 치는 값(이름 · 목표 금액 · 현재 모은 금액)은 칸, 고르는 값(목표일 · 아이콘 · 색)은 줄.
 * 1280 이상 대화상자 480 · 미만 Bottom Sheet. 주 버튼은 켜 두고 누를 때 칸 아래에 오류를 보인다. 저장 본문 · 순서는 그대로다.
 */
export function SavingGoalAddDialog({
  goal,
  onClose,
}: SavingGoalAddDialogProps) {
  const { t } = useTranslation("asset");
  const { t: tc } = useTranslation("common");
  const isEdit = !!goal;

  const createMut = useCreateSavingGoal();
  const updateMut = useUpdateSavingGoal();
  const contributeMut = useContributeSavingGoal();
  // 목록 화면에서만 열리므로 캐시 재사용 — 추가 요청이 나가지 않는다.
  const goalsQ = useSavingGoals();
  const goals = goalsQ.data?.goals ?? [];

  const [initial] = useState(() => ({
    title: goal?.title ?? "",
    target: digitsOf(goal?.targetAmount),
    current: digitsOf(goal?.currentAmount),
    deadline: goal?.deadlineDate ?? "",
    icon: goal?.icon || "piggy-bank",
    // 새 목표는 같은 목록이 아직 쓰지 않은 첫 색 — 늘 빨강으로 시작하지 않는다(color-swatch.md:98)
    color:
      goal?.color ??
      (() => {
        const key = firstUnusedColor(goals.map((g) => chartColorOf(g.color)));
        return CHART_PAIRS.find((p) => p.key === key)!.base;
      })(),
  }));
  const [title, setTitle] = useState(initial.title);
  const [target, setTarget] = useState(initial.target);
  const [current, setCurrent] = useState(initial.current);
  const [deadline, setDeadline] = useState(initial.deadline);
  const [icon, setIcon] = useState(initial.icon);
  const [color, setColor] = useState(initial.color);
  const [errors, setErrors] = useState<Errors>({});

  const nameRef = useRef<HTMLInputElement>(null);
  const targetRef = useRef<HTMLInputElement>(null);
  const currentRef = useRef<HTMLInputElement>(null);

  const dirty =
    title !== initial.title ||
    target !== initial.target ||
    current !== initial.current ||
    deadline !== initial.deadline ||
    icon !== initial.icon ||
    color !== initial.color;

  const saving =
    createMut.isPending || updateMut.isPending || contributeMut.isPending;

  const validate = (): Errors => {
    const out: Errors = {};
    const takenTitles = goals
      .filter((g) => g.rowId !== goal?.rowId)
      .map((g) => g.title);
    const issue = nameIssue(title, GOAL_NAME_MAX, takenTitles);
    if (issue === "required") out.name = t("savingGoal.errName");
    else if (issue === "tooLong") out.name = t("savingGoal.errNameTooLong");
    else if (issue === "duplicate") out.name = t("savingGoal.errNameDuplicate");
    const targetNum = parseAmount(target);
    const currentNum = parseAmount(current);
    if (targetNum <= 0) out.target = t("savingGoal.errAmount");
    else if (targetNum > MAX_AMOUNT)
      out.target = t("savingGoal.errAmountTooLarge");
    else if (currentNum > targetNum)
      out.current = t("savingGoal.errCurrentExceeds");
    return out;
  };

  const handleSubmit = () => {
    if (saving) return;
    const found = validate();
    setErrors(found);
    if (found.name) return nameRef.current?.focus();
    if (found.target) return targetRef.current?.focus();
    if (found.current) return currentRef.current?.focus();

    const trimmed = title.trim();
    const targetNum = parseAmount(target);
    const currentNum = parseAmount(current);

    if (isEdit && goal) {
      updateMut.mutate(
        {
          id: goal.rowId,
          data: {
            title: trimmed,
            targetAmount: targetNum,
            deadlineDate: deadline || null,
            icon,
            color,
          },
        },
        {
          onSuccess: () => {
            const diff = currentNum - goal.currentAmount;
            if (diff !== 0) {
              contributeMut.mutate(
                { id: goal.rowId, data: { amount: diff } },
                { onSuccess: () => onClose() },
              );
            } else {
              onClose();
            }
          },
        },
      );
    } else {
      createMut.mutate(
        {
          title: trimmed,
          targetAmount: targetNum,
          deadlineDate: deadline || null,
          icon,
          color,
          currency: "KRW",
        },
        {
          onSuccess: (created) => {
            if (currentNum > 0) {
              contributeMut.mutate(
                { id: created.rowId, data: { amount: currentNum } },
                { onSuccess: () => onClose() },
              );
            } else {
              onClose();
            }
          },
        },
      );
    }
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
        title={isEdit ? t("savingGoal.titleEdit") : t("savingGoal.titleAdd")}
        // 새 목표만 이름 칸에 초점 — 수정은 표면이 받는다(폰에서 키보드가 가리지 않게)
        onOpenAutoFocus={(e) => {
          if (isEdit) return;
          e.preventDefault();
          nameRef.current?.focus({ preventScroll: true });
        }}
      >
        <ResponsiveDialogBody>
          <div className="flex flex-col gap-x6">
            <Field
              label={t("savingGoal.name")}
              maxGraphemeCount={GOAL_NAME_MAX}
              invalid={!!errors.name}
              errorMessage={errors.name}
            >
              <Input
                ref={nameRef}
                value={title}
                placeholder={t("savingGoal.namePlaceholder")}
                autoComplete="off"
                onChange={(e) => {
                  setTitle(e.target.value);
                  setErrors((s) => ({ ...s, name: undefined }));
                }}
              />
            </Field>
            <Field
              label={t("savingGoal.targetAmount")}
              invalid={!!errors.target}
              errorMessage={errors.target}
            >
              <AmountInput
                ref={targetRef}
                value={target}
                onValueChange={(v) => {
                  setTarget(v);
                  setErrors((s) => ({
                    ...s,
                    target: undefined,
                    current: undefined,
                  }));
                }}
              />
            </Field>
            <Field
              label={t("savingGoal.currentAmount")}
              indicator={t("savingGoal.optional")}
              invalid={!!errors.current}
              errorMessage={errors.current}
            >
              <AmountInput
                ref={currentRef}
                value={current}
                onValueChange={(v) => {
                  setCurrent(v);
                  setErrors((s) => ({ ...s, current: undefined }));
                }}
              />
            </Field>
          </div>
          <div className="-mx-x6 mb-x2 mt-x3">
            <GoalDeadlineRow value={deadline} onChange={setDeadline} />
            <GoalIconRow value={icon} onChange={setIcon} />
            <GoalColorRow value={color} onChange={setColor} />
          </div>
        </ResponsiveDialogBody>
        <ResponsiveDialogFooter>
          <ResponsiveDialogCancel>{tc("cancel")}</ResponsiveDialogCancel>
          <Button loading={saving} onClick={handleSubmit}>
            {isEdit ? tc("save") : tc("add")}
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
