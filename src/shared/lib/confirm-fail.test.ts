import { describe, expect, it, vi } from "vitest";
import type { SnackbarApi, SnackbarOptions } from "@/shared/ds/snackbar";
import { showConfirmFail } from "./confirm-fail";

function fakeSnackbar() {
  const shown: SnackbarOptions[] = [];
  const api: SnackbarApi = {
    show: (o) => void shown.push(o),
    dismiss: () => {},
  };
  return { api, shown };
}

describe("showConfirmFail", () => {
  it("critical Snackbar 에 [다시 시도] 액션을 단다", () => {
    const { api, shown } = fakeSnackbar();
    showConfirmFail(api, {
      message: "삭제하지 못했어요.",
      retry: vi.fn().mockResolvedValue(undefined),
      retryLabel: "다시 시도",
    });
    expect(shown).toHaveLength(1);
    expect(shown[0]).toMatchObject({
      message: "삭제하지 못했어요.",
      tone: "critical",
      action: { label: "다시 시도" },
    });
  });

  it("다시 시도는 묻지 않고 요청을 바로 하고, 성공하면 onRetried 를 부른다", async () => {
    const { api, shown } = fakeSnackbar();
    const retry = vi.fn().mockResolvedValue(undefined);
    const onRetried = vi.fn();
    showConfirmFail(api, {
      message: "m",
      retry,
      retryLabel: "다시 시도",
      onRetried,
    });
    shown[0]!.action!.onClick();
    await Promise.resolve();
    await Promise.resolve();
    expect(retry).toHaveBeenCalledTimes(1);
    expect(onRetried).toHaveBeenCalledTimes(1);
    expect(shown).toHaveLength(1);
  });

  it("다시 시도가 또 실패하면 같은 띠를 다시 띄운다", async () => {
    const { api, shown } = fakeSnackbar();
    const retry = vi.fn().mockRejectedValue(new Error("boom"));
    const onRetried = vi.fn();
    showConfirmFail(api, {
      message: "m",
      retry,
      retryLabel: "다시 시도",
      onRetried,
    });
    shown[0]!.action!.onClick();
    await Promise.resolve();
    await Promise.resolve();
    expect(retry).toHaveBeenCalledTimes(1);
    expect(onRetried).not.toHaveBeenCalled();
    expect(shown).toHaveLength(2);
    expect(shown[1]).toMatchObject({ message: "m", tone: "critical" });
  });

  it("쓰기 결과를 확인하지 못했으면 실패 글 대신 '확인하지 못했어요', [다시 시도] 없음(두 번 될 수 있다)", async () => {
    const { WriteUnconfirmedError } = await import("@/shared/api/base");
    const { api, shown } = fakeSnackbar();
    const retry = vi.fn();
    showConfirmFail(api, {
      message: "결제를 취소하지 못했어요.",
      retry,
      retryLabel: "다시 시도",
      error: new WriteUnconfirmedError(0),
      unconfirmedMessage:
        "저장됐는지 확인하지 못했어요. 목록에서 확인해주세요.",
    });
    expect(shown).toEqual([
      {
        message: "저장됐는지 확인하지 못했어요. 목록에서 확인해주세요.",
        tone: "critical",
      },
    ]);
  });
});
