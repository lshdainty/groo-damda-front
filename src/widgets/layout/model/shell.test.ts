import { describe, expect, it } from "vitest";

import {
  isAssetDetailPath,
  isFullscreenPath,
  isMoneyPath,
  screenFloor,
  screenTitleKey,
} from "./shell";

// 폰 화면 바탕(02-005 C) — 카드 화면 · 띠 화면 · 흰 화면
describe("screenFloor", () => {
  it.each([
    ["/desk", "bands"],
    ["/desk/asset", "bands"],
    ["/desk/stats", "bands"],
    ["/desk/budget", "bands"],
    ["/desk/expense", "white"],
    ["/desk/calendar", "white"],
    ["/desk/more", "white"],
    ["/desk/search", "strip"],
    // 증권은 띠 화면이다(I-13 5) — 상세 · 포트폴리오 주소도 같다
    ["/desk/stocks", "bands"],
    ["/desk/stocks/toss", "bands"],
    ["/desk/stocks/toss/A900001", "bands"],
  ])("%s → %s", (path, floor) => {
    expect(screenFloor(path)).toBe(floor);
  });
  it("캘린더는 흰 면 하나 — 하위 길도 같다(I-09 1-A, 앱과 같게)", () => {
    expect(screenFloor("/desk/calendar")).toBe("white");
    expect(screenFloor("/desk/calendar/manage")).toBe("white");
  });
  it("card-benefit 는 /desk/card 아래가 아니다", () => {
    expect(screenFloor("/desk/card-benefit")).toBe("strip");
  });
  it("옛 카드 상세 길(/desk/card/:id)은 띠 화면이 아니다 — 걷었다", () => {
    expect(screenFloor("/desk/card/12")).toBe("strip");
  });
});

describe("screenTitleKey", () => {
  it("가계부 묶음은 모두 가계부다", () => {
    expect(screenTitleKey("/desk/stats")).toBe("expense");
  });
  it("밤하늘 · 관측 리포트는 화면 이름이 문서 제목이고 풀스크린이다(I-11 3)", () => {
    expect(screenTitleKey("/desk/todo/night-sky")).toBe("nightSky");
    expect(screenTitleKey("/desk/todo/night-sky/report")).toBe("forestReport");
    expect(isFullscreenPath("/desk/todo/night-sky/report")).toBe(true);
  });
  it("증권 상세 · 포트폴리오 구성은 화면 이름이 문서 제목이고 풀스크린이다(I-13 17)", () => {
    expect(screenTitleKey("/desk/stocks/toss/A900001")).toBe("stockDetail");
    expect(screenTitleKey("/desk/stocks/toss/BRK.B")).toBe("stockDetail");
    expect(screenTitleKey("/desk/stocks/toss/portfolio")).toBe(
      "stockPortfolio",
    );
    expect(screenTitleKey("/desk/stocks/toss")).toBe("stocks");
    expect(isFullscreenPath("/desk/stocks/toss/A900001")).toBe(true);
  });
  it("그 밖 할 일 하위 주소는 여전히 할 일이다", () => {
    expect(screenTitleKey("/desk/todo")).toBe("todoNav");
  });
});

// 자산 상세 페이지(I-17 34) — `/desk/asset` 와 `/desk/asset/12` 두 주소의 판정 표
describe("자산 상세 주소", () => {
  it("두 주소의 판정이 갈린다", () => {
    expect(isAssetDetailPath("/desk/asset")).toBe(false);
    expect(isAssetDetailPath("/desk/asset/12")).toBe(true);
    expect(isAssetDetailPath("/desk/asset/12/")).toBe(true);
    expect(isAssetDetailPath("/desk/asset/12/edit")).toBe(false);
    // 가계부 묶음(위 Line Tabs · 머리 "가계부") — 목록만 묶음이고 상세는 아니다
    expect(isMoneyPath("/desk/asset")).toBe(true);
    expect(isMoneyPath("/desk/asset/12")).toBe(false);
    // 풀스크린 — 폰은 페이지가 제 상단 바를 그린다
    expect(isFullscreenPath("/desk/asset")).toBe(false);
    expect(isFullscreenPath("/desk/asset/12")).toBe(true);
    // 바탕 — 상세는 흰 면 하나, 목록은 띠 그대로
    expect(screenFloor("/desk/asset")).toBe("bands");
    expect(screenFloor("/desk/asset/12")).toBe("white");
    // 문서 제목 "자산 상세 - 그루 담다" · 목록은 가계부 그대로
    expect(screenTitleKey("/desk/asset/12")).toBe("assetDetail");
    expect(screenTitleKey("/desk/asset")).toBe("expense");
  });
});
