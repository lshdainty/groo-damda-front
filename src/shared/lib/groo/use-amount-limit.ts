import { useState } from "react";
import { useTranslation } from "react-i18next";
import { MAX_AMOUNT, readAmountInput } from "./amount";

/**
 * 금액 칸의 상한 오류 — 넘는 입력은 받지 않고(값은 그대로) 칸 아래에 critical 오류를 보인다.
 * 오류는 **지금 값에서 나온다**: 값이 상한 위면 보이고(상한 전에 저장된 옛 값을 열었을 때 포함), 거절한 입력이면 그 값이
 * 그대로인 동안 보이며, 칸 밖에서 값이 바뀌면(프리셋 칩 · 비우기 · 초기화) 다시 계산해 상한 안이면 지운다.
 * 값을 줄이는 입력은 늘 받는다(`readAmountInput`) — 줄여 나가다 상한 안이 되면 사라진다.
 *
 * 글은 기존 `amountTooLarge`("금액은 100억원까지 입력할 수 있어요.")를 쓴다. 상한이 100억이 아닌 칸(잔액 1,000억)은
 * 숫자만 갈아 끼운 `amountTooLargeAt` — 같은 문장 틀이다.
 *
 * - `read(raw, prev)` — 칸의 onChange 에서. 받을 값(`value`)과 받았는지(`accepted`)를 돌려준다
 * - `message` — 지금 보일 오류 글(없으면 null)
 * - `tick` — 거절한 횟수. Field 가 "최근 일이 이긴다" 를 가를 때 쓴다(거절한 순간엔 상한 오류가 폼 오류를 이긴다)
 */
export function useAmountLimit(value: string, max: number = MAX_AMOUNT) {
  const { t, i18n } = useTranslation("common");
  // 거절했을 때의 값 — 그 값이 그대로인 동안만 오류를 보인다(null 이면 거절한 적 없음)
  const [rejectedAt, setRejectedAt] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const read = (raw: string) => {
    const r = readAmountInput(raw, value, max);
    if (r.accepted) setRejectedAt(null);
    else {
      setRejectedAt(value);
      setTick((n) => n + 1);
    }
    return { value: r.value, accepted: r.accepted };
  };

  const over = Number(value || 0) > max || rejectedAt === value;
  const message = over
    ? max === MAX_AMOUNT
      ? t("amountTooLarge")
      : t("amountTooLargeAt", {
          max: amountLimitText(max, (i18n.language ?? "").startsWith("en")),
        })
    : null;

  return { read, message, tick };
}

/** 상한을 글로 — ko "100억원" · "1,000억원" / en "10 billion won" · "100 billion won". 억 단위로 떨어지는 상한만 다룬다 */
export function amountLimitText(max: number, en: boolean): string {
  if (en) return `${(max / 1e9).toLocaleString("en-US")} billion won`;
  return `${(max / 1e8).toLocaleString("en-US")}억원`;
}
