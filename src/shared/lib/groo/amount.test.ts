import { describe, it, expect, vi } from "vitest";
import {
  MAX_AMOUNT,
  MAX_BALANCE,
  blockNonDigitKey,
  parseAmount,
  readAmountInput,
} from "./amount";

/**
 * 칸에 치는 동안 — 상한을 넘는 입력은 **받지 않고 값은 그대로**, 알림은 칸 아래 오류(`tooLarge`)로 한다.
 * QA #130 은 15자리를 치면 아무 말 없이 100억이 되는 것이었고, 그 뒤엔 깎고 토스트를 띄웠다(화면 맨 위 — 칸에서 멀다).
 * 2026-11-07 디자인시스템 결정으로 깎지 않고 받지 않는다.
 */
describe("readAmountInput", () => {
  it("상한 안은 그대로 받는다", () => {
    expect(readAmountInput("1500", "150")).toEqual({
      value: "1500",
      accepted: true,
      tooLarge: false,
    });
    expect(readAmountInput("10000000000", "1000000000")).toEqual({
      value: "10000000000",
      accepted: true,
      tooLarge: false,
    });
  });

  it("100억을 넘는 입력은 받지 않는다 — 값은 앞의 값 그대로", () => {
    expect(readAmountInput("100000000001", "10000000000")).toEqual({
      value: "10000000000",
      accepted: false,
      tooLarge: false,
    });
  });

  it("15자리 붙여넣기도 통째로 받지 않는다 — 깎아서 100억으로 만들지 않는다", () => {
    expect(readAmountInput("999999999999999", "").accepted).toBe(false);
    expect(readAmountInput("999999999999999", "250")).toMatchObject({
      value: "250",
      accepted: false,
    });
  });

  it("값을 줄이는 입력은 늘 받는다 — 옛 초과 값에서 한 자리씩 줄여 나간다", () => {
    // 상한 전에 저장된 123조 — 한 자리를 지워도 아직 상한 위: 받고, 오류는 계속(tooLarge)
    expect(readAmountInput("12345678901234", "123456789012345")).toEqual({
      value: "12345678901234",
      accepted: true,
      tooLarge: true,
    });
    // 줄이다 상한 안이 되면 오류가 없다
    expect(readAmountInput("9999999999", "10000000001")).toEqual({
      value: "9999999999",
      accepted: true,
      tooLarge: false,
    });
    // 같은 값 · 늘리는 입력(옛 초과 값에 한 자리 더)은 받지 않는다
    expect(
      readAmountInput("1234567890123456", "123456789012345"),
    ).toMatchObject({ accepted: false, tooLarge: true });
  });

  it("잔액 칸은 1,000억까지 — 상한이 인자로 갈린다", () => {
    expect(readAmountInput("99999999999", "", MAX_BALANCE).accepted).toBe(true);
    expect(readAmountInput("999999999999", "5", MAX_BALANCE)).toMatchObject({
      value: "5",
      accepted: false,
    });
  });

  it("소수점 뒤 · 선행 0 · 부호는 버린다", () => {
    expect(readAmountInput("1000.5", "").value).toBe("1000");
    expect(readAmountInput("0500", "").value).toBe("500");
    expect(readAmountInput("-5", "").value).toBe("5");
    expect(readAmountInput("", "5")).toMatchObject({
      value: "",
      accepted: true,
    });
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
