import * as React from "react";
import { MAX_AMOUNT, blockNonDigitKey } from "@/shared/lib/groo/amount";
import { useAmountLimit } from "@/shared/lib/groo/use-amount-limit";
import { useField } from "@/shared/ds/field";
import { Input, type InputProps } from "@/shared/ds/input";
import { useTranslation } from "react-i18next";
import { AmountLimitError } from "./amount-limit-error";

/**
 * 금액 칸 — ds Input 숫자(I-19 7 · 15). 값은 쉼표 없는 숫자 문자열("1500000")로 들고, 칸에는 쓰는 동안 쉼표를 찍는다
 * ("1,500,000"). 뒤 글자 "원"(suffix — 칸 이름과 함께 읽힌다) · 숫자 키보드 · 부호 · 소수점 키 막기는 지금 금액 칸 규칙 그대로다.
 *
 * 상한(`max`, 기본 100억)을 넘는 입력은 **받지 않고 값은 그대로** 둔다(2026-11-07). 칸 아래에 critical 오류
 * "금액은 100억원까지 입력할 수 있어요." 를 보이고, 다음 유효한 입력에서 사라진다. Field 안이면 Field 의 꼬리(오류가
 * 설명을 대신하고 polite 로 한 번 읽힌다)가, 밖이면 이 칸이 바로 아래에 같은 모양으로 그린다.
 *
 * 쉼표가 끼면 글자 위치가 밀리므로 캐럿을 "캐럿 앞의 숫자 개수" 로 되돌린다 — 중간에 지우거나 끼워도 커서가 끝으로 튀지 않는다.
 * 저장된 옛 값이 상한을 넘어도 열 때는 그대로 보인다(QA #48 — 몰래 고쳐 넣지 않는다). 쓰기 시작하면 상한으로 깎는다.
 */

const comma = (digits: string) =>
  digits === "" ? "" : Number(digits).toLocaleString("en-US");

export interface AmountInputProps extends Omit<
  InputProps,
  "value" | "onChange" | "suffix" | "inputMode" | "type"
> {
  /** 숫자만 든 문자열 — 쉼표 없음 */
  value: string;
  onValueChange: (digits: string) => void;
  /** 상한 — 기본 거래 한 건의 100억 */
  max?: number;
  /** 뒤 글자 — 기본 "원" */
  unit?: React.ReactNode;
}

export const AmountInput = React.forwardRef<HTMLInputElement, AmountInputProps>(
  (
    {
      value,
      onValueChange,
      max = MAX_AMOUNT,
      unit,
      onKeyDown,
      placeholder = "0",
      ...props
    },
    ref,
  ) => {
    const { t } = useTranslation("common");
    const field = useField();
    const setControlError = field?.setControlError;
    const limit = useAmountLimit(max);
    const errorId = React.useId();
    const own = React.useRef<HTMLInputElement>(null);
    const caret = React.useRef<number | null>(null);
    const shown = comma(value);

    React.useLayoutEffect(() => {
      const el = own.current;
      const digitsBefore = caret.current;
      if (!el || digitsBefore == null) return;
      caret.current = null;
      if (el.ownerDocument.activeElement !== el) return;
      // 숫자 digitsBefore 개를 지난 자리
      let seen = 0;
      let pos = 0;
      while (pos < shown.length && seen < digitsBefore) {
        if (/\d/.test(shown[pos]!)) seen += 1;
        pos += 1;
      }
      el.setSelectionRange(pos, pos);
    });

    // Field 안이면 오류를 Field 꼬리로 올린다(꼬리가 aria-invalid · aria-describedby 를 칸에 이어 준다)
    React.useEffect(() => {
      if (!setControlError) return;
      setControlError(limit.message);
      return () => setControlError(null);
    }, [setControlError, limit.message]);

    // Field 밖이면 이 칸이 직접 이어 준다
    const ownError = !field && limit.message != null;
    const input = (
      <Input
        ref={(node) => {
          own.current = node;
          if (typeof ref === "function") ref(node);
          else if (ref) ref.current = node;
        }}
        inputMode="numeric"
        autoComplete="off"
        placeholder={placeholder}
        suffix={unit ?? t("searchWon")}
        value={shown}
        onKeyDown={(e) => {
          onKeyDown?.(e);
          if (!e.defaultPrevented) blockNonDigitKey(e);
        }}
        onChange={(e) => {
          const raw = e.target.value;
          const at = e.target.selectionStart ?? raw.length;
          const before = raw.slice(0, at).replace(/\D/g, "").length;
          const next = limit.read(raw, value);
          if (!next.accepted) {
            // 받지 않은 입력 — 값은 그대로, 캐럿은 친 글자 앞에 둔다
            const added = raw.replace(/\D/g, "").length - value.length;
            caret.current = Math.max(0, before - Math.max(0, added));
            return;
          }
          caret.current = before;
          onValueChange(next.value);
        }}
        {...props}
        {...(ownError
          ? {
              "aria-invalid": true,
              "aria-describedby": [props["aria-describedby"], errorId]
                .filter(Boolean)
                .join(" "),
            }
          : {})}
      />
    );
    if (field) return input;
    return (
      <>
        {input}
        <AmountLimitError id={errorId} message={limit.message} />
      </>
    );
  },
);
AmountInput.displayName = "AmountInput";
