// 글자 크기 두 갈래 — groo-design #260 · #261 · #263 · #264(DESIGN.md Typography "글자 크기 설정을 따르는 것과 그대로 두는 것").
//   · 그대로 두는 것(-static · px) — 차트 눈금 · 막대 위 값 · 도넛 가운데 · 배지 · 하단 탭 바 라벨 · Segmented 칸 글 · 알림 점 · 달력 칸 안 글 ·
//     표의 쪽 번호 · 슬라이더 눈금 표식 · 사진 위 표식(장수 · 첨부 대표 띠) · 카드 그림 안 글
//   · 커지는 것(rem) — 시트 · 툴팁 줄 · "표로 보기" · 지표 타일 합계 · 버튼 글 · 사이드 메뉴 항목 이름
// 300%(처음부터 · 뜬 뒤)에서 그대로 두는 쪽의 글 크기가 100% 와 같고, 커지는 쪽은 세 배가 되는지 본다. jsdom 은 레이아웃이 없어 글자
// 크기를 글자 클래스 · 값으로 푼다(브라우저가 rem · px 토큰을 푸는 셈 — weekday-fit.test-utils). 달력 · 열지도는 따로
// (weekday-fit.compiled.test · calendar-week-grid.test), 차트 축 그리기는 axisWidth.compiled.test 가 본다.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AXIS_TICK_FONT_SIZE } from "@/shared/lib/groo/axisWidth";

import { Badge } from "./badge";
import { LABEL as BOTTOM_NAV_LABEL } from "./bottom-navigation/bottom-navigation-variants";
import {
  SHEET_DESCRIPTION,
  SHEET_TITLE,
} from "./bottom-sheet/bottom-sheet-variants";
import { Button } from "./button";
import { BADGE as ATTACHMENT_COVER_BADGE } from "./attachment-input/attachment-input-variants";
import {
  CHART_TICK_SIZE,
  ChartDataTable,
  ChartDonutCenter,
  ChartLegendTiles,
} from "./chart";
import { ChartTooltipRow } from "./chart/chart-tooltip-row";
import {
  changeTextScale,
  classFontPx,
  cssFontPx,
  fontPx,
  fontPxAt100,
  grid,
  installWeekGridHarness,
} from "./date-picker/weekday-fit.test-utils";
import {
  CARD_FACE_ISSUER,
  CARD_FACE_NAME,
  imageFrameIndicatorVariants,
} from "./image-frame/image-frame-variants";
import { notificationBadgeVariants } from "./notification-badge/notification-badge-variants";
import { PAGINATION_LABEL } from "./pagination/pagination-variants";
import { ITEM_LABEL as SIDE_NAV_ITEM_LABEL } from "./side-navigation/side-navigation-variants";
import { Skeleton } from "./skeleton";
import { Slider } from "./slider";
import { segmentedControlItemVariants } from "./segmented-control/segmented-control-variants";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  installWeekGridHarness();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
});

const render = () =>
  act(() =>
    root.render(
      <>
        <Badge data-testid="badge">예정</Badge>
        <Badge size="large" data-testid="badge-large">
          신용
        </Badge>
        <Button data-testid="button">저장</Button>
        <ChartLegendTiles
          items={[
            { key: "in", label: "수입", color: "blue", total: "4,200,000원" },
            { key: "out", label: "지출", color: "red", total: "1,240,000원" },
          ]}
        />
        <ChartDataTable
          caption="10월 수입 · 지출"
          columns={["날짜", "수입"]}
          rows={[["10. 1.", "1,000원"]]}
          visuallyHidden={false}
        />
        <ChartTooltipRow swatch="red" name="지출" value="12,000원" />
        <ChartDonutCenter label="10월 지출" amount="1,240,000원" />
        <Slider aria-label="글자 크기" min={0} max={100} defaultValue={50} />
      </>,
    ),
  );

const q = (selector: string) => container.querySelector(selector);

/** 그대로 두는 쪽 — 렌더한 요소 */
const staticEls = () => [
  q("[data-testid=badge]"),
  q("[data-testid=badge-large]"),
  q("[data-slot=chart-donut-center-label]"),
  q("[data-slot=chart-donut-center-amount]"),
  q("[data-slot=slider-marker]"),
];
/** 커지는 쪽 — 렌더한 요소 */
const growingEls = () => [
  q("[data-testid=button]"),
  q("[data-slot=chart-legend-total]"),
  q("[data-slot=chart-legend-name]"),
  q("[data-slot=chart-data-table] td"),
  q("[data-slot=chart-data-table] caption"),
  q("[data-slot=chart-tooltip-row]"),
];

const expectTwoKinds = () => {
  expect(grid.scale).toBe(3);
  for (const el of staticEls()) {
    expect(el).not.toBeNull();
    expect(fontPx(el)).toBe(fontPxAt100(el));
  }
  // 슬라이더 눈금 표식 줄 높이도 static — 글이 그대로라 표식 줄도 그대로
  expect(q("[data-slot=slider-markers]")!.className).toContain(
    "h-[var(--text-t3-static--line-height)]",
  );
  for (const el of growingEls()) {
    expect(el).not.toBeNull();
    expect(fontPx(el)).toBe(fontPxAt100(el) * 3);
  }
};

describe("글자 크기 두 갈래 — 300%", () => {
  it("처음부터 300% — 배지 · 도넛 가운데 · 슬라이더 눈금 표식은 100% 와 같고, 버튼 · 지표 타일 합계 · 표로 보기 · 툴팁 줄은 세 배", () => {
    grid.scale = 3;
    render();
    expectTwoKinds();
  });

  it("뜬 뒤 100% → 300% — 같은 두 갈래", async () => {
    render();
    await changeTextScale(3);
    expectTwoKinds();
  });

  it("틀 부품의 글 — 하단 탭 바 라벨 · Segmented 칸 글 · 알림 점 · 배지는 static, 시트 제목 · 내용은 rem", () => {
    grid.scale = 3;
    const fixed = [
      BOTTOM_NAV_LABEL,
      segmentedControlItemVariants(),
      notificationBadgeVariants({ size: "large" }),
    ];
    for (const cls of fixed) {
      expect(classFontPx(cls, 1)).not.toBeNull();
      expect(classFontPx(cls)).toBe(classFontPx(cls, 1));
    }
    for (const cls of [SHEET_TITLE, SHEET_DESCRIPTION]) {
      expect(classFontPx(cls, 1)).not.toBeNull();
      expect(classFontPx(cls)).toBe(classFontPx(cls, 1)! * 3);
    }
  });

  // 막대 위 값(예산 이행률)은 pages/budget percent-labels.test 가 본다(FSD — shared 가 pages 를 부르지 않는다)
  it("차트 그림 안 글 — 눈금(SVG · 세로축 폭을 재는 글)은 300% 에도 100% 와 같다", () => {
    for (const value of [CHART_TICK_SIZE, AXIS_TICK_FONT_SIZE]) {
      expect(cssFontPx(value, 3)).toBe(11);
      expect(cssFontPx(value, 1)).toBe(11);
    }
  });
});

describe("글자 크기 두 갈래 — 부품 단위(groo-design #263 · #264)", () => {
  it("그대로 두는 부위 — 쪽 번호 · 사진 위 장수 · 첨부 대표 띠 · 카드 그림 안 회사 · 카드 이름은 300% 에도 100% 와 같다", () => {
    grid.scale = 3;
    const fixed = [
      PAGINATION_LABEL,
      imageFrameIndicatorVariants(),
      ATTACHMENT_COVER_BADGE,
      CARD_FACE_ISSUER,
      CARD_FACE_NAME,
    ];
    for (const cls of fixed) {
      expect(classFontPx(cls, 1)).not.toBeNull();
      expect(classFontPx(cls)).toBe(classFontPx(cls, 1));
    }
    // 카드 면 large(폭 240 이상)의 글도 -static
    for (const cls of [CARD_FACE_ISSUER, CARD_FACE_NAME]) {
      expect(cls).toMatch(
        /@min-\[240px\]\/image-frame:text-t\d+-static(?=\s|$)/,
      );
    }
  });

  it("커지는 부위 — 사이드 메뉴 항목 이름은 300% 에서 세 배", () => {
    grid.scale = 3;
    expect(classFontPx(SIDE_NAV_ITEM_LABEL)).toBe(
      classFontPx(SIDE_NAV_ITEM_LABEL, 1)! * 3,
    );
  });

  it('달력 칸 아래 스켈레톤 — text="t1-static" 은 -static 줄 높이(300% 에도 15), "t1" 은 rem 줄 높이', () => {
    act(() =>
      root.render(
        <>
          <Skeleton text="t1-static" data-testid="fixed" />
          <Skeleton text="t1" data-testid="growing" />
        </>,
      ),
    );
    expect(q("[data-testid=fixed]")!.className).toContain(
      "h-(--text-t1-static--line-height)",
    );
    expect(q("[data-testid=growing]")!.className).toContain(
      "h-(--text-t1--line-height)",
    );
  });
});
