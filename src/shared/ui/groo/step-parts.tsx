import { useTranslation } from "react-i18next";

import { Button } from "@/shared/ds/button";

/**
 * 같은 시트 · 대화상자 안에서 한 단계 들어가는 폼(I-09 29 · I-17 7 · I-20 C 19)의 공용 조각.
 * 왼쪽 ← 와 제목은 ds `ResponsiveDialogContent` 의 `onBack` 이 맡고, 오른쪽은 "완료" 글 버튼이다.
 * 시트는 닫기 원 자리를 쓰고(그 단계가 열린 동안 닫기 원은 없다 — `showCloseButton={false}`), 1280 이상 입력 폼 대화상자는
 * 닫기 단추가 없어 머리 오른쪽 동작 자리(`headerAction`)를 쓴다.
 */
export function StepDoneButton({
  onClick,
  label,
}: {
  onClick: () => void;
  /** 기본 "완료" */
  label?: string;
}) {
  const { t: tc } = useTranslation("common");
  return (
    <Button
      variant="ghost"
      ghostColor="neutral"
      size="small"
      onClick={onClick}
      className="font-bold"
    >
      {label ?? tc("done")}
    </Button>
  );
}

/** 시트 머리 오른쪽(닫기 원 자리)에 "완료" 를 얹는다 — 시트 안에서만 */
export function SheetStepDone({
  onClick,
  label,
}: {
  onClick: () => void;
  label?: string;
}) {
  return (
    <div
      data-slot="sheet-step-done"
      className="absolute right-[calc(var(--spacing-global-gutter)-8px)] top-[calc(var(--spacing-x6)+14px)] z-1 -translate-y-1/2"
    >
      <StepDoneButton onClick={onClick} label={label} />
    </div>
  );
}
