import { describe, it, expect } from "vitest";
import { isReloginRequiredError } from "./relogin-required-error";

describe("isReloginRequiredError", () => {
  it("AUTH_030 이면 담다에서 로그아웃한 그 로그인으로 본다", () => {
    expect(
      isReloginRequiredError({
        response: { status: 401, data: { code: "AUTH_030" } },
      }),
    ).toBe(true);
  });

  it("다른 401(AUTH_004 등)은 보통의 로그인 실패다 — 비밀번호를 다시 받는 재시도로 보내면 안 된다", () => {
    expect(
      isReloginRequiredError({
        response: { status: 401, data: { code: "AUTH_004" } },
      }),
    ).toBe(false);
    expect(
      isReloginRequiredError({ response: { data: { code: "USER_021" } } }),
    ).toBe(false);
  });

  // 문구가 아니라 코드로 판정한다 — 문구는 로케일마다 다르고 서버가 고치면 따라 바뀐다.
  it("코드가 없으면 아니다", () => {
    expect(
      isReloginRequiredError({
        response: { status: 401, data: { message: "다시 로그인해주세요" } },
      }),
    ).toBe(false);
  });

  it("응답 없는 오류(네트워크 끊김 등)도 아니다", () => {
    expect(isReloginRequiredError(new Error("Network Error"))).toBe(false);
    expect(isReloginRequiredError(null)).toBe(false);
    expect(isReloginRequiredError(undefined)).toBe(false);
  });
});
