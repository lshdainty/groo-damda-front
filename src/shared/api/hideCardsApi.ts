import { apiClient, SAFE_TO_RETRY, type QuietRequestConfig } from "./base";
import type { ApiResponse } from "@/shared/types";

/**
 * 금액 가리기 목록 — 기기가 아니라 **계정**에 붙는다.
 *
 * 예전에는 localStorage 에만 있어서 폰에서 가려도 웹으로 로그인하면 금액이 그대로 보였다.
 */
export const hideCardsApi = {
  /**
   * @returns `null` 이면 **아직 한 번도 올린 적 없음** — 빈 배열(사용자가 다 풀었음)과 뜻이 다르다.
   *          이 둘을 뭉개면 배포 첫 실행에 가려 뒀던 금액이 드러난다.
   */
  get: async (): Promise<string[] | null> => {
    const resp: ApiResponse<{ hideCards: string[] | null }> =
      await apiClient.get("/v1/users/me/hide-cards");
    return resp.data?.hideCards ?? null;
  },

  /** 통째로 교체. 부분 갱신이 아니다. */
  put: async (hideCards: string[]): Promise<void> => {
    // 실패는 호출한 쪽이 성공 여부로 받아 자기 자리에서 알린다
    const resp: ApiResponse = await apiClient.put(
      "/v1/users/me/hide-cards",
      { hideCards },
      // 통째로 교체라 다시 해도 같은 결과 — 응답을 못 받아도 확인 못 함 없이 실패 + [다시 시도](앱 저장 실패 범위 밖, 판단 ⑤ 와 같은 규칙)
      { silent: true, ...SAFE_TO_RETRY } satisfies QuietRequestConfig,
    );
    if (!resp.success) throw new Error(resp.message);
  },
};
