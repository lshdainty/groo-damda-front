// ds 부품의 기본 글 — 한국어(초기화 전 · 기본)와 영어(Intl 형식 포함). 부품 안에 한국어 상수를 두지 않는다(01-043).
import { createElement, Fragment } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import i18next from "i18next";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import enDs from "@/locales/en/ds.json";
import koDs from "@/locales/ko/ds.json";

import {
  datePickerLabels,
  formatDateValue,
  formatRangeValue,
} from "./date-picker";
import { dsMoney, dsMoneyText, dsText, withCommaBreaks } from "./i18n";
import { formatTimeValue, timePickerLabels } from "./time-picker";

const d = (y: number, m: number, day: number) => new Date(y, m - 1, day);
const TODAY = d(2026, 10, 16);

describe("ds 글 — 한국어(초기화 전)", () => {
  it("로케일 문구가 없는 환경에서도 한국어 원본이 나온다", () => {
    expect(dsText("common.close")).toBe("닫기");
    expect(dsText("pagination.status", { current: 2, total: 9 })).toBe(
      "2페이지, 전체 9페이지",
    );
  });
  it("돈 · 시각 · 날짜", () => {
    expect(dsMoney(1234567)).toBe("1,234,567원");
    expect(formatTimeValue({ hour: 15, minute: 0 })).toBe("오후 3:00");
    expect(formatDateValue(d(2026, 10, 15), TODAY)).toBe("10월 15일 (목)");
    expect(datePickerLabels().weekdays[0]).toBe("일");
  });
});

describe("ds 글 — 수 맞춤(복수형)", () => {
  it("한국어(초기화 전)는 수와 상관없이 같은 글이다", () => {
    expect(dsText("inputOtp.placeholder", { count: 1 })).toBe("1자리 숫자");
    expect(dsText("inputOtp.placeholder", { count: 6 })).toBe("6자리 숫자");
    expect(dsText("iconPicker.results", { count: 1 })).toBe("검색 결과 1개");
    expect(dsText("attachment.addedPhotos", { count: 1 })).toBe(
      "사진 1장을 붙였어요.",
    );
    expect(dsText("attachment.addedFiles", { count: 0 })).toBe(
      "파일 0개를 붙였어요.",
    );
  });
});

describe("ds 글 — 영어", () => {
  beforeAll(async () => {
    await i18next.init({
      lng: "en",
      fallbackLng: "ko",
      ns: ["ds"],
      defaultNS: "ds",
      keySeparator: false,
      interpolation: { escapeValue: false },
      resources: { en: { ds: enDs }, ko: { ds: koDs } },
    });
  });
  afterAll(async () => {
    await i18next.changeLanguage("ko");
  });

  it("접근성 이름 · 보이는 글이 영어다", () => {
    expect(dsText("common.close")).toBe("Close");
    expect(dsText("bottomNavigation.label")).toBe("Main menu");
    expect(dsText("pagination.status", { current: 2, total: 9 })).toBe(
      "Page 2 of 9",
    );
    expect(timePickerLabels().am).toBe("AM");
  });
  it("복수형 — 1 은 단수, 0 · 2 이상은 복수(inputOtp.placeholder · iconPicker.results · attachment.added*)", () => {
    expect(dsText("inputOtp.placeholder", { count: 1 })).toBe("1 digit");
    expect(dsText("inputOtp.placeholder", { count: 6 })).toBe("6 digits");
    expect(dsText("iconPicker.results", { count: 1 })).toBe("1 result");
    expect(dsText("iconPicker.results", { count: 0 })).toBe("0 results");
    expect(dsText("iconPicker.results", { count: 2 })).toBe("2 results");
    expect(dsText("attachment.addedPhotos", { count: 1 })).toBe(
      "Added 1 photo.",
    );
    expect(dsText("attachment.addedPhotos", { count: 2 })).toBe(
      "Added 2 photos.",
    );
    expect(dsText("attachment.addedFiles", { count: 1 })).toBe("Added 1 file.");
    expect(dsText("attachment.addedFiles", { count: 0 })).toBe(
      "Added 0 files.",
    );
    expect(dsText("attachment.addedItems", { count: 1 })).toBe("Added 1 item.");
    expect(dsText("attachment.addedItems", { count: 3 })).toBe(
      "Added 3 items.",
    );
  });
  it("돈은 ₩1,234,567, 시각은 3:00 PM, 날짜는 Thu, Oct 15", () => {
    expect(dsMoney(1234567)).toBe("₩1,234,567");
    expect(formatTimeValue({ hour: 15, minute: 0 })).toBe("3:00 PM");
    expect(formatDateValue(d(2026, 10, 15), TODAY)).toBe("Thu, Oct 15");
    expect(formatDateValue(d(2027, 1, 3), TODAY)).toBe("Sun, Jan 3, 2027");
  });
  it("기간은 en dash 로 잇는다(구간 기호는 로케일 문구) — 같은 달이면 끝은 날짜만", () => {
    expect(
      formatRangeValue({ start: d(2026, 10, 1), end: d(2026, 10, 31) }, TODAY),
    ).toBe("Oct 1–31");
    expect(
      formatRangeValue({ start: d(2026, 10, 29), end: d(2026, 11, 4) }, TODAY),
    ).toBe("Oct 29–Nov 4");
    expect(
      formatRangeValue({ start: d(2026, 12, 28), end: d(2027, 1, 3) }, TODAY),
    ).toBe("Dec 28, 2026–Jan 3, 2027");
    expect(datePickerLabels().rangeSeparator).toBe("–");
  });
  it("요일 · 달 이름이 영어다", () => {
    const labels = datePickerLabels();
    expect(labels.weekdaysLong[0]).toBe("Sunday");
    expect(labels.month(2026, 10)).toBe("October 2026");
    expect(labels.presetNames.thisWeek).toBe("This week");
  });
});

describe("금액 줄바꿈 — 쉼표 뒤에서만(03-D 결정 2 B)", () => {
  const html = (node: ReturnType<typeof withCommaBreaks>) =>
    renderToStaticMarkup(createElement(Fragment, null, node));
  it("세 자리 묶음 사이 쉼표 뒤마다 <wbr> 을 넣는다 — 글자는 그대로", () => {
    expect(html(withCommaBreaks("−123,456,789,012원"))).toBe(
      "−123,<wbr/>456,<wbr/>789,<wbr/>012원",
    );
    // <wbr> 은 글자가 아니다 — 보이는 글 · 복사한 글 · 읽는 이름이 원래 글 그대로다
    const el = document.createElement("span");
    el.innerHTML = html(withCommaBreaks("−123,456,789,012원"));
    expect(el.textContent).toBe("−123,456,789,012원");
  });
  it("쉼표가 없거나 숫자 사이가 아니면 글 그대로 — 글 값(이메일 · 문장)은 건드리지 않는다", () => {
    expect(html(withCommaBreaks("4,500원"))).toBe("4,<wbr/>500원");
    expect(withCommaBreaks("500원")).toBe("500원");
    expect(withCommaBreaks("서울, 강남")).toBe("서울, 강남");
    expect(withCommaBreaks("groo@example.com")).toBe("groo@example.com");
    const node = createElement("b", null, "1,234원");
    expect(withCommaBreaks(node)).toBe(node);
  });
  it("dsMoneyText 는 dsMoney 와 같은 글에 <wbr> 만 더한다", () => {
    const el = document.createElement("span");
    el.innerHTML = html(dsMoneyText(1234567));
    expect(el.textContent).toBe(dsMoney(1234567));
    expect(html(dsMoneyText(1234567))).toBe("1,<wbr/>234,<wbr/>567원");
  });
});
