import { useState } from "react";
import { useTranslation } from "react-i18next";
import { MAX_AMOUNT, readAmountInput } from "./amount";

/**
 * 금액 칸의 상한 오류 — 넘는 입력은 받지 않고(값은 그대로) 칸 아래에 critical 오류를 보인다.
 * 오류는 **다음 유효한 입력에서 사라진다**(`read` 가 상한 안의 값을 읽으면 지운다).
 *
 * 글은 기존 `amountTooLarge`("금액은 100억원까지 입력할 수 있어요.")를 쓴다. 상한이 100억이 아닌 칸(잔액 1,000억)은
 * 숫자만 갈아 끼운 `amountTooLargeAt` — 같은 문장 틀이다.
 *
 * - `read(raw, prev)` — 칸의 onChange 에서. 받을 값을 돌려주고, 받지 않았으면 `accepted` 가 false 다
 * - `message` — 지금 보일 오류 글(없으면 null)
 */
export function useAmountLimit(max: number = MAX_AMOUNT) {
  const { t, i18n } = useTranslation("common");
  const [over, setOver] = useState(false);
  // 같은 오류가 이어져도(over 가 true 로 그대로) 다시 그리게 한다 — 받지 않은 값을 칸이 원래 글로 되돌려야 한다
  const [, setTick] = useState(0);

  const read = (raw: string, prev: string) => {
    const r = readAmountInput(raw, prev, max);
    setOver(r.tooLarge);
    if (r.tooLarge) setTick((n) => n + 1);
    return { value: r.value, accepted: !r.tooLarge };
  };

  const message = over
    ? max === MAX_AMOUNT
      ? t("amountTooLarge")
      : t("amountTooLargeAt", {
          max: amountLimitText(max, (i18n.language ?? "").startsWith("en")),
        })
    : null;

  return { read, message, clear: () => setOver(false) };
}

/** 상한을 글로 — ko "100억원" · "1,000억원" / en "10 billion won" · "100 billion won". 억 단위로 떨어지는 상한만 다룬다 */
export function amountLimitText(max: number, en: boolean): string {
  if (en) return `${(max / 1e9).toLocaleString("en-US")} billion won`;
  return `${(max / 1e8).toLocaleString("en-US")}억원`;
}
