import { useTranslation } from "react-i18next";
import { useSnackbar, type SnackbarApi } from "@/shared/ds/snackbar";
import type { WriteKind } from "@/shared/api/base";
import { useUnconfirmedSnackText } from "./write-unconfirmed-text";

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
  /**
   * 실패의 오류 — **꼭 넘긴다**. 쓰기 결과를 확인하지 못했으면(응답을 못 읽음 · 응답 전에 끊김) 실패 글 대신
   * 종류별 한 문장("삭제됐는지 확인하지 못했어요." …)을 띄우고 [다시 시도] 를 두지 않는다(다시 하면 두 번 될 수 있다).
   * 목록은 저절로 다시 받는다(app/providers/query-client.ts MutationCache)
   */
  error: unknown;
  /** 확인 못 함 글의 종류 — 요청 방식(DELETE → 삭제, 그 밖 → 저장)과 다를 때 자리가 정한다(묶음 지우기 POST · 기기 로그아웃 …) */
  unconfirmedKind?: WriteKind;
  /** 확인 못 함 글을 고른다 — 훅이 `useUnconfirmedSnackText` 로 채운다 */
  unconfirmedText?: (error: unknown, kind?: WriteKind) => string | null;
}

/** critical Snackbar + [다시 시도]. 다시 시도가 또 실패하면 같은 띠를 다시 띄운다(그 실패가 확인 못 함이면 그 글로) */
export function showConfirmFail(
  snackbar: SnackbarApi,
  options: ConfirmFailOptions,
): void {
  const { message, retry, retryLabel, onRetried, error, unconfirmedKind } =
    options;
  const unconfirmed = options.unconfirmedText?.(error, unconfirmedKind);
  if (unconfirmed) {
    snackbar.show({ message: unconfirmed, tone: "critical" });
    return;
  }
  snackbar.show({
    message,
    tone: "critical",
    action: {
      label: retryLabel,
      onClick: () => {
        retry().then(
          () => onRetried?.(),
          (e: unknown) => showConfirmFail(snackbar, { ...options, error: e }),
        );
      },
    },
  });
}

/** 컴포넌트에서 쓰는 길 — `common.retry` · 확인 못 함 글 · Snackbar 를 알아서 묶는다 */
export function useConfirmFail(): (
  options: Omit<ConfirmFailOptions, "retryLabel" | "unconfirmedText">,
) => void {
  const snackbar = useSnackbar();
  const { t } = useTranslation("common");
  const unconfirmedText = useUnconfirmedSnackText();
  return (options) =>
    showConfirmFail(snackbar, {
      ...options,
      retryLabel: t("retry"),
      unconfirmedText,
    });
}

/**
 * 토글(누르는 순간 바뀌는 값 — 고정 · 표시 · 일시정지 · 관심 · 권한 · 색) 실패 — critical 스낵바, **[다시 시도] 없음**.
 * 글은 호출처가 준다 — 액션이 없으니 snackbar.md 글 대로 두 문장("…못했어요. 잠시 뒤 다시 시도해주세요.").
 * 확인 못 함이면 값을 되돌리지 않는다 — 전역 MutationCache 가 다시 받아 서버 값으로 맞추고 "바뀌었는지 확인하지 못했어요." 다
 * (I-wrap-b2b 디자인시스템 판단 ②)
 */
export function useToggleFail(): (error: unknown, message: string) => void {
  const snackbar = useSnackbar();
  const unconfirmedText = useUnconfirmedSnackText();
  return (error, message) =>
    snackbar.show({
      message: unconfirmedText(error, "toggle") ?? message,
      tone: "critical",
    });
}

/**
 * 스낵바를 직접 띄우는 자리(실패 글 + [다시 시도] 를 스스로 그리는 곳)의 앞머리 — 확인 못 한 쓰기면 종류별 한 문장을
 * [다시 시도] 없이 띄우고 true. 아니면 아무것도 하지 않고 false(호출처가 자기 실패 글을 띄운다)
 */
export function useUnconfirmedSnack(): (
  error: unknown,
  kind?: WriteKind,
) => boolean {
  const snackbar = useSnackbar();
  const unconfirmedText = useUnconfirmedSnackText();
  return (error, kind) => {
    const message = unconfirmedText(error, kind);
    if (!message) return false;
    snackbar.show({ message, tone: "critical" });
    return true;
  };
}
