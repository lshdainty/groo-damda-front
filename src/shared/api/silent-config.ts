import type { QuietRequestConfig } from "./base";

/** silent — 실패를 호출처가 화면 안에서 고정 글로 말한다(전역 서버 원문 토스트와 겹치지 않게, 호출처 단위) */
export type SilentOpts = { silent?: boolean };

export const silentConfig = (opts?: SilentOpts): QuietRequestConfig =>
  opts?.silent ? { silent: true } : {};
