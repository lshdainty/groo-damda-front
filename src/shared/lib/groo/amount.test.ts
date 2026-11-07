import { describe, it, expect, vi } from "vitest";
import {
  MAX_AMOUNT,
  MAX_BALANCE,
  blockNonDigitKey,
  parseAmount,
  readAmountInput,
  sanitizeAmountInput,
} from "./amount";

/**
 * 저장 직전 정리(`sanitizeAmountInput`) — 알림 없는 순수 함수다. 칸에 치는 동안의 계약은 `readAmountInput`.
 *
 * 금액 칸의 계약을 고정한다.
 *
 * QA #12 는 "안내는 100억인데 999억이 타이핑된다" 였다 — 자리수(`slice(0,11)`)로만
 * 자르고 값을 안 봤기 때문이다. 그래서 여기 테스트는 **자리수가 아니라 값**을 본다.
 */
describe("sanitizeAmountInput", () => {
  it("100억을 넘기면 상한으로 떨어진다 — 11자리(999억)가 통과하던 자리", () => {
    expect(sanitizeAmountInput("99999999999")).toBe(String(MAX_AMOUNT));
  });

  it("12자리 붙여넣기도 상한으로 떨어진다 — 자리수 자르기로는 못 막던 경로", () => {
    expect(sanitizeAmountInput("999999999999")).toBe(String(MAX_AMOUNT));
  });

  it("정확히 100억은 그대로 통과한다(경계)", () => {
    expect(sanitizeAmountInput("10000000000")).toBe("10000000000");
  });

  it("소수점 뒤는 지우는 게 아니라 버린다 — 1000.5 는 10005 가 아니다", () => {
    expect(sanitizeAmountInput("1000.5")).toBe("1000");
  });

  it("선행 0 을 없앤다 — 기본값 0 에 500 을 쳐서 0500 이 되던 잔액 칸(QA #18)", () => {
    expect(sanitizeAmountInput("0500")).toBe("500");
  });

  it("0 하나는 남는다 — 뒤에 숫자가 없으면 지울 게 없다", () => {
    expect(sanitizeAmountInput("0")).toBe("0");
  });

  it("부호는 삼킨다 — 부호는 거래 종류가 정한다(설명서 계약)", () => {
    expect(sanitizeAmountInput("-5")).toBe("5");
  });

  it("잔액 칸은 1,000억까지 — 상한이 인자로 갈린다", () => {
    expect(sanitizeAmountInput("99999999999", MAX_BALANCE)).toBe("99999999999");
    expect(sanitizeAmountInput("999999999999", MAX_BALANCE)).toBe(
      String(MAX_BALANCE),
    );
  });

  it("빈 문자열·기호만이면 빈 문자열", () => {
    expect(sanitizeAmountInput("")).toBe("");
    expect(sanitizeAmountInput("-.")).toBe("");
  });
});

/**
 * 칸에 치는 동안 — 상한을 넘는 입력은 **받지 않고 값은 그대로**, 알림은 칸 아래 오류(`tooLarge`)로 한다.
 * QA #130 은 15자리를 치면 아무 말 없이 100억이 되는 것이었고, 그 뒤엔 깎고 토스트를 띄웠다(화면 맨 위 — 칸에서 멀다).
 * 2026-11-07 디자인시스템 결정으로 깎지 않고 받지 않는다.
 */
describe("readAmountInput", () => {
  it("상한 안은 그대로 받는다", () => {
    expect(readAmountInput("1500", "150")).toEqual({
      value: "1500",
      tooLarge: false,
    });
    expect(readAmountInput("10000000000", "1000000000")).toEqual({
      value: "10000000000",
      tooLarge: false,
    });
  });

  it("100억을 넘는 입력은 받지 않는다 — 값은 앞의 값 그대로, tooLarge", () => {
    expect(readAmountInput("100000000001", "10000000000")).toEqual({
      value: "10000000000",
      tooLarge: true,
    });
  });

  it("15자리 붙여넣기도 통째로 받지 않는다 — 깎아서 100억으로 만들지 않는다", () => {
    expect(readAmountInput("999999999999999", "")).toEqual({
      value: "",
      tooLarge: true,
    });
    expect(readAmountInput("999999999999999", "250")).toEqual({
      value: "250",
      tooLarge: true,
    });
  });

  it("잔액 칸은 1,000억까지 — 상한이 인자로 갈린다", () => {
    expect(readAmountInput("99999999999", "", MAX_BALANCE).tooLarge).toBe(
      false,
    );
    expect(readAmountInput("999999999999", "5", MAX_BALANCE)).toEqual({
      value: "5",
      tooLarge: true,
    });
  });

  it("소수점 뒤 · 선행 0 · 부호는 sanitize 와 같다", () => {
    expect(readAmountInput("1000.5", "").value).toBe("1000");
    expect(readAmountInput("0500", "").value).toBe("500");
    expect(readAmountInput("-5", "").value).toBe("5");
    expect(readAmountInput("", "5")).toEqual({ value: "", tooLarge: false });
  });
});

describe("parseAmount", () => {
  it("빈 값은 0", () => {
    expect(parseAmount("")).toBe(0);
  });

  it("콤마가 섞여도 값으로 읽는다 — parseInt('1,000') 은 1 이었다", () => {
    expect(parseAmount("1,000")).toBe(1000);
  });

  /**
   * 여기서 클램프하면 `parseAmount(x) > MAX_AMOUNT` 게이트가 영원히 거짓이 된다.
   * 거래 시트의 외화 자동 환산은 sanitize 를 안 거치는 유일한 경로라, 그 게이트가
   * 죽으면 100억 초과 금액이 그대로 서버로 나간다.
   */
  it("상한으로 깎지 않는다 — 상한 판정은 호출부가 한다", () => {
    expect(parseAmount("99999999999")).toBe(99999999999);
    expect(parseAmount(String(MAX_AMOUNT + 1))).toBeGreaterThan(MAX_AMOUNT);
  });
});

describe("blockNonDigitKey", () => {
  const key = (
    k: string,
    mod: Partial<{ ctrlKey: boolean; metaKey: boolean; altKey: boolean }> = {},
  ) => ({
    key: k,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    preventDefault: vi.fn(),
    ...mod,
  });

  it.each([".", "-", "e", "+", " ", "a"])("'%s' 는 못 찍는다", (k) => {
    const e = key(k);
    blockNonDigitKey(e);
    expect(e.preventDefault).toHaveBeenCalled();
  });

  it.each(["0", "5", "9"])("숫자 '%s' 는 통과한다", (k) => {
    const e = key(k);
    blockNonDigitKey(e);
    expect(e.preventDefault).not.toHaveBeenCalled();
  });

  it.each(["Backspace", "ArrowLeft", "Tab", "Delete", "Unidentified"])(
    "편집·이동 키 '%s' 는 통과한다",
    (k) => {
      const e = key(k);
      blockNonDigitKey(e);
      expect(e.preventDefault).not.toHaveBeenCalled();
    },
  );

  it("Ctrl+V·Cmd+A 는 통과한다 — 붙여넣기를 막으면 안 된다", () => {
    const ctrlV = key("v", { ctrlKey: true });
    blockNonDigitKey(ctrlV);
    expect(ctrlV.preventDefault).not.toHaveBeenCalled();

    const cmdA = key("a", { metaKey: true });
    blockNonDigitKey(cmdA);
    expect(cmdA.preventDefault).not.toHaveBeenCalled();
  });
});
