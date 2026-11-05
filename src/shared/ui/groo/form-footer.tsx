import { cn } from "@/shared/lib/cn";
import { Button } from "@/shared/ds/button";
import {
  ResponsiveDialogCancel,
  ResponsiveDialogFooter,
} from "@/shared/ds/dialog";
import { useWideSurface } from "@/shared/ds/overlay";

/**
 * 폼 시트 · 대화상자 바닥(ResponsiveDialog form) — 저장 · 취소 한 벌에 [삭제] 를 더할 수 있다(button.md "모달 footer — 삭제는 왼쪽
 * ghost + critical, 저장은 오른쪽"). 1280 이상 대화상자: 왼쪽 [삭제] · 오른쪽 [취소][저장] small 36. 미만 시트: 왼쪽 [삭제] large 48(글자만큼) ·
 * 나머지 폭 [저장] large 48(취소는 위 닫기 버튼이 맡는다). `onDelete` 가 없으면(새 항목) 평소 바닥과 같다.
 * [삭제] 는 `flush` 를 쓰지 않는다 — flush 는 글자색을 neutralSubtle 로 덮어 빨간 글자가 사라진다(button.md).
 */
export function FormFooter({
  cancelLabel,
  submitLabel,
  onSubmit,
  loading,
  submitDisabled,
  deleteLabel,
  onDelete,
  flushDelete = false,
}: {
  cancelLabel: string;
  submitLabel: string;
  onSubmit: () => void;
  loading?: boolean;
  submitDisabled?: boolean;
  /** 있으면 바닥 왼쪽에 [삭제] — 수정일 때만 준다 */
  deleteLabel?: string;
  onDelete?: () => void;
  /**
   * 시트 바닥 [삭제] 의 글 시작을 시트 좌우 여백(24)에 세운다 — large 의 안쪽 가로 여백(px-x5 20)만큼 왼쪽으로 뺀다.
   * 대화상자(small 36)는 그대로다(바닥 규칙에 블리드 값이 없다)
   */
  flushDelete?: boolean;
}) {
  const wide = useWideSurface();
  const size = wide ? "small" : "large";
  return (
    <ResponsiveDialogFooter>
      <div className="flex w-full items-center gap-x2">
        {onDelete && (
          <Button
            variant="ghost"
            ghostColor="critical"
            // 시트는 large 48(글자만큼 폭), 대화상자는 small 36 — 주 버튼과 같은 크기(bottom-sheet.md 바닥 · button.md 모달 footer)
            size={size}
            className={cn("shrink-0", flushDelete && !wide && "-ml-x5")}
            onClick={onDelete}
          >
            {deleteLabel}
          </Button>
        )}
        <div
          className={
            wide ? "ml-auto flex items-center gap-x2" : "flex min-w-0 flex-1"
          }
        >
          <ResponsiveDialogCancel size="small">
            {cancelLabel}
          </ResponsiveDialogCancel>
          <Button
            size={size}
            className={wide ? undefined : "flex-1"}
            loading={loading}
            disabled={submitDisabled}
            onClick={onSubmit}
          >
            {submitLabel}
          </Button>
        </div>
      </div>
    </ResponsiveDialogFooter>
  );
}
