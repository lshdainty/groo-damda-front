import { useSaveFailureText } from "@/shared/lib/save-failure-text";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { MAX_AMOUNT, parseAmount } from "@/shared/lib/groo/amount";
import { nameIssue } from "@/shared/lib/groo/name-policy";
import { Button } from "@/shared/ds/button";
import { Callout } from "@/shared/ds/callout";
import { useConfirmFail } from "@/shared/lib/confirm-fail";
import { useScrollToError } from "@/shared/hooks/useScrollToError";
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

  // 저장 실패는 전역 서버 원문 토스트 대신 폼 맨 위 Callout(고정 글)이 알린다 — 요청은 silent, 폼은 열린 채 · 쓴 값 그대로
  const createMut = useCreateSavingGoal({ silent: true });
  const updateMut = useUpdateSavingGoal({ silent: true });
  const contributeMut = useContributeSavingGoal({ silent: true });
  // 목록 화면에서만 열리므로 캐시 재사용 — 추가 요청이 나가지 않는다.
  // 이름 중복 검사용 기존 목표 목록 — 폼 안의 참조 목록이라 실패해도 폼은 그대로 두고, 저장할 때 다시 받는다(handleSubmit)
  const goalsQ = useSavingGoals({ silent: true });
  const goals = goalsQ.data?.goals ?? [];
  // 저장할 때 다시 받다 또 실패했다 — 요청은 보내지 않고 폼 Callout 으로 알린다
  const [refFailed, setRefFailed] = useState(false);

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

  const sft = useSaveFailureText();
  const saveFailed =
    createMut.isError || updateMut.isError || contributeMut.isError;
  const saveError =
    createMut.error ?? updateMut.error ?? contributeMut.error ?? undefined;
  const errorRef = useScrollToError<HTMLDivElement>(
    saveFailed || refFailed,
    saveError ?? refFailed,
  );
  const clearSaveError = () => {
    createMut.reset();
    updateMut.reset();
    contributeMut.reset();
  };
  // 이중 제출 가드 — 같은 프레임의 두 번째 누름은 렌더 전 클로저라 isPending 이 아직 false 다.
  // 누르는 순간 켜고, 요청이 끝나는 갈래(성공 · 실패 · 납입까지 이어지는 뒤 요청)마다 끈다
  const confirmFail = useConfirmFail();
  const savingRef = useRef(false);
  const release = () => {
    savingRef.current = false;
  };

  const validate = (goalList = goals): Errors => {
    const out: Errors = {};
    const takenTitles = goalList
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

  const handleSubmit = (goalList = goals) => {
    if (saving || savingRef.current) return;
    if (goalsQ.isError && !goalsQ.data) {
      // 이름 중복을 가릴 수 없다 — 한 번 다시 받고, 그래도 안 되면 저장하지 않는다
      setRefFailed(false);
      savingRef.current = true;
      void goalsQ.refetch().then((r) => {
        savingRef.current = false;
        if (r.isError) setRefFailed(true);
        else handleSubmit(r.data?.goals ?? []);
      });
      return;
    }
    const found = validate(goalList);
    setErrors(found);
    if (found.name) return nameRef.current?.focus();
    if (found.target) return targetRef.current?.focus();
    if (found.current) return currentRef.current?.focus();

    savingRef.current = true;
    clearSaveError();
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
          onError: release,
          onSuccess: () => {
            const diff = currentNum - goal.currentAmount;
            if (diff !== 0) {
              contributeMut.mutate(
                { id: goal.rowId, data: { amount: diff } },
                { onSuccess: () => onClose(), onSettled: release },
              );
            } else {
              release();
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
          onError: release,
          // 만들기가 성공하면 목표는 있는 것 — 폼을 닫는다. 첫 납입이 실패해도 폼은 열지 않고(다시 누르면 같은 목표가 또 만들어진다)
          // 스낵바 [다시 시도] 가 만든 목표 id 로 납입만 다시 보낸다
          onSuccess: (created) => {
            release();
            onClose();
            if (currentNum > 0) {
              const pay = () =>
                contributeMut.mutateAsync({
                  id: created.rowId,
                  data: { amount: currentNum },
                });
              pay().catch(() =>
                confirmFail({
                  message: t("savingGoal.firstContributeFailed"),
                  retry: pay,
                }),
              );
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
      busy={saving}
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
          {(saveFailed || refFailed) && (
            <div ref={errorRef}>
              <Callout tone="critical" role="alert" className="mb-x4">
                {saveFailed
                  ? sft(saveError, t("savingGoal.saveFailed"))
                  : tc("query.referenceSaveFailed")}
              </Callout>
            </div>
          )}
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
          <Button loading={saving} onClick={() => handleSubmit()}>
            {isEdit ? tc("save") : tc("add")}
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
