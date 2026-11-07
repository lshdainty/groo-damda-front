import type { QuietRequestConfig } from "./base";

/** silent — 이 요청의 실패를 호출처가 화면 안에서 고정 글로 말한다는 표식(동작은 없다 — base.ts QuietRequestConfig) */
export type SilentOpts = { silent?: boolean };

export const silentConfig = (opts?: SilentOpts): QuietRequestConfig =>
  opts?.silent ? { silent: true } : {};
