// `?linked=` 는 표에 있는 값만 이름이 된다 — 임의 글 · 프로토타입 키로는 알림이 없다(앱과 같다).
import { describe, expect, it } from "vitest";
import { linkedProviderName } from "./oauth-return";

describe("linkedProviderName", () => {
  it("Google 은 대소문자와 상관없이 이름이 된다", () => {
    expect(linkedProviderName("google")).toBe("Google");
    expect(linkedProviderName("GOOGLE")).toBe("Google");
  });
  it("연결할 수 없는 소셜 · 임의 글 · 프로토타입 키는 null", () => {
    for (const v of [
      "kakao",
      "naver",
      "아무글",
      "constructor",
      "__proto__",
      "toString",
      "",
    ]) {
      expect(linkedProviderName(v), v).toBeNull();
    }
  });
});
