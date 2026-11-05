import { money } from "@/shared/lib/groo/format";
import { formatOriginalAmount } from "@/shared/lib/groo/currency";
import type { TxForm } from "../model/use-tx-form";

/** 쓰는 동안 쉼표 — 정수 부분만. 소수점은 그대로 둔다 */
export const formatDecimal = (raw: string): string => {
  if (!raw) return "";
  const [head = "", tail] = raw.split(".");
  const ints = head === "" ? "" : Number(head).toLocaleString("en-US");
  return tail === undefined ? ints : `${ints || "0"}.${tail}`;
};

/** 현지 금액 칸 입력 정리 — 숫자와 점 하나, 소수 둘째 자리까지, 정수 12자리까지 */
export const sanitizeDecimal = (value: string, maxDecimals = 2): string => {
  const cleaned = value.replace(/[^0-9.]/g, "");
  const dot = cleaned.indexOf(".");
  let head = dot === -1 ? cleaned : cleaned.slice(0, dot);
  let tail = dot === -1 ? undefined : cleaned.slice(dot + 1).replace(/\./g, "");
  head = head.replace(/^0+(?=\d)/, "").slice(0, 12);
  if (tail !== undefined) tail = tail.slice(0, maxDecimals);
  return tail === undefined ? head : `${head}.${tail}`;
};

/** 칸 뒤에 붙는 금액 글 — 외화면 "$98,765.43", 아니면 "128,000,000원" */
export function amountText(f: TxForm): string {
  if (f.isForeignTx) {
    const n = parseFloat(f.origAmount);
    return Number.isFinite(n)
      ? formatOriginalAmount(n, f.origCurrency, "en-US")
      : "";
  }
  // 0 이면 빈 글 — 줄 값이 "0원" 대신 "없음" 으로 보인다(금액을 지우고 완료한 때)
  if (f.amountNumber <= 0) return "";
  // 이체는 보내는 계좌 통화(I-13) — 외화 계좌에서 보내면 "$1,000.00"
  return f.isTransfer ? f.transferMoney(f.amountNumber) : money(f.amountNumber);
}
