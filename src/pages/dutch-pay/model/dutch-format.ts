import { KRW, isEn } from "@/shared/lib/groo/format";
import { wonPre } from "@/shared/lib/groo/hide-amounts-core";

/** "61,333원"(영문은 숫자만) — 글 안에 넣는 금액 */
export const wonText = (n: number) =>
  `${wonPre()}${KRW(n)}${isEn() ? "" : "원"}`;
