import { Button } from "@/shared/ds/button";
import {
  ResponsiveDialogCancel,
  ResponsiveDialogFooter,
} from "@/shared/ds/dialog";
import { useWideSurface } from "@/shared/ds/overlay";

/**
 * 폼 시트 · 대화상자 바닥(ResponsiveDialog form) — 저장 · 취소 한 벌에 [삭제] 를 더할 수 있다(button.md "모달 footer — 삭제는 왼쪽
 * ghost + critical, 저장은 오른쪽"). 1280 이상 대화상자: 왼쪽 [삭제] · 오른쪽 [취소][저장] small 36. 미만 시트: 왼쪽 [삭제] large 48(글자만큼,
 * data-fit="content") · 나머지 폭 [저장] large 48(취소는 위 닫기 버튼이 맡는다). `onDelete` 가 없으면(새 항목) 평소 바닥과 같다.
 * [삭제] 는 `flush` 를 쓰지 않는다 — flush 는 글자색을 neutralSubtle 로 덮어 빨간 글자가 사라진다(button.md).
 * 음수 여백으로 글 시작을 바닥 가장자리에 맞추지도 않는다 — 상자 여백 그대로 왼쪽에 선다(button.md 모달 footer 예시).
 */
export function FormFooter({
  cancelLabel,
  submitLabel,
  onSubmit,
  loading,
  submitDisabled,
  deleteLabel,
  onDelete,
}: {
  cancelLabel: string;
  submitLabel: string;
  onSubmit: () => void;
  loading?: boolean;
  submitDisabled?: boolean;
  /** 있으면 바닥 왼쪽에 [삭제] — 수정일 때만 준다 */
  deleteLabel?: string;
  onDelete?: () => void;
}) {
  const wide = useWideSurface();
  // 버튼을 바닥의 바로 아래 자식으로 둔다 — 크기는 바닥이 준다(대화상자 small 36 · 시트 large 48), 시트 바닥은 짝 버튼
  // 부품(ResponsivePair)이라 [삭제] 는 data-fit="content" 로 글자만큼, [저장] 이 남은 폭을 채우고, [저장] 라벨이 남은 폭에
  // 들지 않으면 세로로 쌓아 [저장] 이 위로 간다(bottom-sheet.md 코드 · button.md 긴 라벨). 감싸는 div 를 두면 이 판정이 빠진다
  return (
    <ResponsiveDialogFooter>
      {onDelete && (
        <Button
          variant="ghost"
          ghostColor="critical"
          data-fit="content"
          // 대화상자는 왼쪽 끝, 나머지([취소][저장])는 오른쪽 — 대화상자 바닥은 오른쪽 정렬이다(button.md 모달 footer)
          className={wide ? "mr-auto" : undefined}
          onClick={onDelete}
        >
          {deleteLabel}
        </Button>
      )}
      <ResponsiveDialogCancel>{cancelLabel}</ResponsiveDialogCancel>
      <Button loading={loading} disabled={submitDisabled} onClick={onSubmit}>
        {submitLabel}
      </Button>
    </ResponsiveDialogFooter>
  );
}
