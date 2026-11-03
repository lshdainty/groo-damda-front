import * as React from "react";

import { Input, type InputProps } from "@/shared/ds/input";
import { formatDecimal, sanitizeDecimal } from "../lib/amount-format";

/**
 * 소수 칸 — 값은 쉼표 없는 숫자 문자열("1388.75")로 들고, 칸에는 쓰는 동안 정수 부분에 쉼표를 찍는다("1,388.75").
 * 소수 키보드 · 숫자와 점 하나만 · 쉼표를 붙여 넣어도 지워 보낸다. 쉼표가 끼면 글자 위치가 밀리므로 캐럿을 "캐럿 앞의 숫자 · 점 개수" 로 되돌린다
 * (AmountInput 과 같은 방식 — 중간에 지우거나 끼워도 커서가 끝으로 튀지 않는다).
 */
export interface DecimalInputProps extends Omit<
  InputProps,
  "value" | "onChange" | "inputMode" | "type"
> {
  /** 쉼표 없는 숫자 문자열 */
  value: string;
  onValueChange: (raw: string) => void;
  /** 소수 자리 상한 — 현지 금액 2 · 환율 4 */
  maxDecimals?: number;
}

export const DecimalInput = React.forwardRef<
  HTMLInputElement,
  DecimalInputProps
>(
  (
    { value, onValueChange, maxDecimals = 2, placeholder = "0", ...props },
    ref,
  ) => {
    const own = React.useRef<HTMLInputElement>(null);
    const caret = React.useRef<number | null>(null);
    const shown = formatDecimal(value);

    React.useLayoutEffect(() => {
      const el = own.current;
      const before = caret.current;
      if (!el || before == null) return;
      caret.current = null;
      if (el.ownerDocument.activeElement !== el) return;
      let seen = 0;
      let pos = 0;
      while (pos < shown.length && seen < before) {
        if (/[\d.]/.test(shown[pos]!)) seen += 1;
        pos += 1;
      }
      el.setSelectionRange(pos, pos);
    });

    return (
      <Input
        ref={(node) => {
          own.current = node;
          if (typeof ref === "function") ref(node);
          else if (ref) ref.current = node;
        }}
        inputMode="decimal"
        autoComplete="off"
        placeholder={placeholder}
        value={shown}
        onChange={(e) => {
          const raw = e.target.value;
          const at = e.target.selectionStart ?? raw.length;
          caret.current = raw.slice(0, at).replace(/[^\d.]/g, "").length;
          onValueChange(sanitizeDecimal(raw, maxDecimals));
        }}
        {...props}
      />
    );
  },
);
DecimalInput.displayName = "DecimalInput";
