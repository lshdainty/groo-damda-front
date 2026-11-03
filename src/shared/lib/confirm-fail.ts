import { useTranslation } from "react-i18next";
import { useSnackbar, type SnackbarApi } from "@/shared/ds/snackbar";

/**
 * 확인창 뒤 요청이 실패했을 때의 표시 — 디자인 확정(alert-dialog.md): **확인창 닫기 + critical Snackbar(6초) +
 * [다시 시도](다시 묻지 않고 같은 요청을 바로)**. Snackbar 는 시트 · 확인창과 겹치지 않게 확인창을 닫은 뒤에 띄운다.
 *
 * 쓰는 자리는 삭제 · 취소 · 해제 · 환불 취소 같은 확인창 뒤 요청이다. 폼 저장 실패는 이게 아니다 — 창을 연 채 고쳐야 하니
 * 폼 맨 위 Callout 이 맞다.
 *
 * - 요청은 **silent** 로 보낸다(`QuietRequestConfig` 의 `silent: true`) — 전역 서버 원문 토스트와 겹치지 않게.
 * - 글(`message`)은 호출처가 준다(해요체 + 마침표, 서버 글 아님).
 * - 확인창을 닫는 쪽은 `AlertConfirm` 의 `onError` 다 — 실패하면 확인창을 닫은 뒤 부른다.
 *
 * ```tsx
 * const confirmFail = useConfirmFail();
 * const deleteFailed = (b: Item) =>
 *   confirmFail({ message: t("deleteFailed"), retry: () => deleteMut.mutateAsync(b.rowId) });
 * <AlertConfirm
 *   onConfirm={() => deleteMut.mutateAsync(b.rowId)}
 *   onError={() => deleteFailed(b)}
 *   onClose={…}
 * />
 * ```
 */
export interface ConfirmFailOptions {
  /** 실패 글 — 해요체 + 마침표. 서버가 보낸 글 · 영어 · 코드는 쓰지 않는다 */
  message: string;
  /** 다시 시도로 하는 요청 — 묻지 않고 바로 한다. 실패하면 던진다(같은 띠가 다시 뜬다) */
  retry: () => Promise<unknown>;
  /** [다시 시도] 글자 — 훅이 `common.retry` 로 채운다 */
  retryLabel: string;
  /** 다시 시도가 성공했을 때(목록 정리 · 시트 닫기 …) */
  onRetried?: () => void;
}

/** critical Snackbar + [다시 시도]. 다시 시도가 또 실패하면 같은 띠를 다시 띄운다 */
export function showConfirmFail(
  snackbar: SnackbarApi,
  { message, retry, retryLabel, onRetried }: ConfirmFailOptions,
): void {
  snackbar.show({
    message,
    tone: "critical",
    action: {
      label: retryLabel,
      onClick: () => {
        retry().then(
          () => onRetried?.(),
          () =>
            showConfirmFail(snackbar, {
              message,
              retry,
              retryLabel,
              onRetried,
            }),
        );
      },
    },
  });
}

/** 컴포넌트에서 쓰는 길 — `common.retry` 와 Snackbar 를 알아서 묶는다 */
export function useConfirmFail(): (
  options: Omit<ConfirmFailOptions, "retryLabel">,
) => void {
  const snackbar = useSnackbar();
  const { t } = useTranslation("common");
  return (options) =>
    showConfirmFail(snackbar, { ...options, retryLabel: t("retry") });
}
