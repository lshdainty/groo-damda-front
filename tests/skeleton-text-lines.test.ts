// 스켈레톤 글 자리는 올 글의 줄 높이다 — skeleton.md "크기 — 글은 글줄 높이"(42줄) · "글자 크기 설정"(312줄).
//   · 읽는 글 자리 — `text="tN"`(rem 줄 높이) — 글자 크기 설정을 따라 커진다
//   · 틀 안 글 자리(달력 칸 · 7일 띠 · 차트 눈금 · 배지) — `text="tN-static"`(px 줄 높이) — 그대로
//   · 글이 아닌 모양 자리(아바타 원 · 그림 · 아이콘 · 막대 · 카드 · 칸) — px 그대로
// #651 에서 화면의 rem 숫자 유틸을 px 로 바꿀 때 글 자리 스켈레톤의 높이(h-4 → h-[16px])도 px 로 굳었다. 이 시험은 화면 쪽
// 스켈레톤을 전수로 읽어 ① 300% 에서 글 자리는 세 배 · static · 모양 자리는 그대로인지 ② 높이를 클래스로 박은 스켈레톤이 아래
// "모양 자리" 목록 밖에서 새로 생기지 않는지 본다(글 자리를 px 로 다시 박으면 실패 — 모양이면 목록에 까닭과 함께 더한다).
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "..");
const DIRS = [
  "src/pages",
  "src/widgets",
  "src/features",
  "src/entities",
  "src/app",
  "src/shared/ui",
];

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx$/.test(name) && !/\.(test|demo)\./.test(name)) out.push(p);
  }
  return out;
}

interface Use {
  where: string;
  text: string | null;
  cls: string;
}

/** 화면 쪽 <Skeleton …> 여는 꼬리표 — text · className 을 읽는다 */
function uses(): Use[] {
  const out: Use[] = [];
  for (const dir of DIRS) {
    for (const f of walk(path.join(ROOT, dir))) {
      const src = readFileSync(f, "utf8");
      for (const m of src.matchAll(/<Skeleton\b((?:[^>{]|\{[^}]*\})*)\/?>/g)) {
        const attrs = m[1]!;
        const line = src.slice(0, m.index).split("\n").length;
        out.push({
          where: `${path.relative(ROOT, f)}:${line}`,
          text: /text="([^"]+)"/.exec(attrs)?.[1] ?? null,
          cls: /className="([^"]*)"/.exec(attrs)?.[1] ?? "",
        });
      }
    }
  }
  return out;
}

/** 글 줄 높이 토큰(px) — groo-tokens.css. rem 은 글자 배율을 따르고, -static 은 px 그대로 */
const TOKENS = readFileSync(
  path.join(ROOT, "src/shared/styles/groo-tokens.css"),
  "utf8",
);
function lineHeight(token: string, scale: number): number {
  const m = new RegExp(
    `--text-${token}--line-height:\\s*([\\d.]+)(rem|px)`,
  ).exec(TOKENS);
  if (!m) throw new Error(`줄 높이 토큰이 없다: ${token}`);
  return m[2] === "rem" ? Number(m[1]) * 16 * scale : Number(m[1]);
}

/** 높이 클래스(px · 간격 토큰 · 꽉 채움) — 변형 없는 것만 */
const HEIGHT = /(?:^|\s)(?:min-)?h-(\[[^\]]+\]|x\d+(?:_\d)?|full)(?=\s|$)/;

/**
 * 모양 자리 — 높이를 클래스로 박아 둔 것(글이 아니라 커지지 않는다). 파일: 높이 클래스. 새 모양 자리는 까닭과 함께 여기에 더한다.
 */
const SHAPES: Record<string, string[]> = {
  // 진행 · 예산 막대 8
  "src/pages/asset/ui/asset-parts.tsx": ["h-[8px]"],
  "src/pages/budget/ui/budget-parts.tsx": ["h-[8px]", "h-[180px]"], // 막대 · 차트
  "src/pages/dashboard/ui/home-parts.tsx": ["h-[8px]"],
  "src/pages/stats/ui/fixed-parts.tsx": ["h-[28px]", "h-[8px]"], // 고정 · 변동 비율 막대 · 막대
  "src/pages/stats/ui/stats-compare-parts.tsx": ["h-[8px]"],
  "src/pages/stats/ui/stats-parts.tsx": ["h-[8px]"],
  "src/pages/stats/ui/stats-trend-parts.tsx": ["h-[8px]"],
  "src/widgets/asset-full/ui/SavingGoalManager.tsx": ["h-[8px]"],
  "src/widgets/budget-manage/ui/BudgetManager.tsx": ["h-[8px]"],
  // 차트 · 그림
  "src/pages/asset-detail/ui/AssetDetailPage.tsx": ["h-x40"],
  "src/pages/dashboard/ui/HomeDesktop.tsx": ["h-[280px]"],
  "src/pages/night-sky/ui/NightSkyPage.tsx": ["h-[168px]", "h-[220px]"],
  "src/widgets/constellation/ui/report-parts.tsx": ["h-[120px]"],
  // 고르는 상자 · 카드 · 입력 칸 · 버튼 · 칩 · 스위치 · 단계 고르기(통짜 부품 모양)
  "src/features/expense/ui/FixedBulk.tsx": ["h-[52px]"],
  "src/features/subscription/ui/ApiTokenStep.tsx": ["h-[56px]"],
  "src/features/subscription/ui/SecuritiesLinkDialog.tsx": ["h-[64px]"],
  "src/pages/card-benefit/ui/CardDetailContent.tsx": ["h-[74px]"],
  "src/widgets/account-settings/ui/AppearanceSection.tsx": ["h-x10"],
  "src/widgets/add-tx/ui/TxStep1.tsx": ["h-[36px]"],
  "src/widgets/asset-full/ui/detail/CardBilling.tsx": ["h-x10"],
  "src/widgets/notification-manage/ui/NotificationsManager.tsx": ["h-[32px]"],
  "src/widgets/preset-manage/ui/PresetManager.tsx": ["h-x10"],
  // 캘린더 칸 안 일정 칩 · 하루 종일 줄 · 시간 격자 일정 덩어리(칸 틀)
  "src/widgets/calendar/ui/month-view/calendar-month-view-desktop-skeleton.tsx":
    ["h-x5"],
  "src/widgets/calendar/ui/month-view/calendar-month-view-mobile-skeleton.tsx":
    ["h-x4_5"],
  "src/widgets/calendar/ui/week-view/calendar-week-view-skeleton.tsx": [
    "h-[20px]",
    "h-full",
  ],
};

describe("스켈레톤 글 자리는 올 글의 줄 높이", () => {
  const all = uses();

  it("전수로 읽었다 — 화면 쪽 스켈레톤이 있다", () => {
    expect(all.length).toBeGreaterThan(200);
  });

  it("글 자리(text) 스켈레톤은 높이를 클래스로 덮지 않는다 — 덮으면 올 글과 함께 커지지 않는다", () => {
    const bad = all.filter((u) => u.text && HEIGHT.test(u.cls));
    expect(bad.map((u) => `${u.where} ${u.cls}`)).toEqual([]);
  });

  it("높이를 클래스로 박은 스켈레톤은 모양 자리 목록 안에만 있다 — 글 자리를 px 로 박지 않는다", () => {
    const bad = all
      .filter((u) => !u.text && HEIGHT.test(u.cls))
      .filter((u) => {
        const file = u.where.replace(/:\d+$/, "");
        const h = `h-${HEIGHT.exec(u.cls)![1]}`;
        return !(SHAPES[file] ?? []).includes(h);
      });
    expect(bad.map((u) => `${u.where} ${u.cls}`)).toEqual([]);
  });

  it("300% — 글 자리는 세 배, -static 글 자리 · 모양 자리는 100% 와 같다", () => {
    let grow = 0;
    let fixed = 0;
    for (const u of all) {
      if (u.text) {
        const statik = u.text.endsWith("-static");
        const h1 = lineHeight(u.text, 1);
        const h3 = lineHeight(u.text, 3);
        if (statik) {
          expect(h3, u.where).toBe(h1);
          fixed++;
        } else {
          expect(h3, u.where).toBe(h1 * 3);
          grow++;
        }
      } else {
        // 모양 자리 — px · 간격 토큰(px) · 꽉 채움 · style 높이. rem 높이가 없다
        expect(u.cls, u.where).not.toMatch(/rem\]/);
      }
    }
    expect(grow).toBeGreaterThan(200);
    expect(fixed).toBeGreaterThan(5);
  });

  it("고친 자리 — 검색 · 호가 표 · 투자자 값 · 알림 메뉴 · 반복 거래 · 큰 금액 · 주 보기 날짜 · 시각", () => {
    const at = (file: string) =>
      all.filter((u) => u.where.startsWith(file)).map((u) => u.text);
    expect(at("src/pages/search/ui/SearchPage.tsx")).toEqual(
      expect.arrayContaining(["t4", "t5", "t3"]),
    );
    expect(at("src/pages/stocks/ui/detail/detail-parts.tsx")).toEqual(
      expect.arrayContaining(["t4", "t3"]),
    );
    expect(
      at("src/widgets/notification-manage/ui/NotificationsMenu.tsx"),
    ).toEqual(["t5", "t3"]);
    expect(at("src/widgets/recurring-manage/ui/RecurringManager.tsx")).toEqual(
      expect.arrayContaining(["t4", "t5", "t3"]),
    );
    expect(at("src/widgets/asset-full/ui/detail/CardBilling.tsx")).toContain(
      "t9",
    );
    expect(at("src/pages/asset-detail/ui/AssetDetailPage.tsx")).toContain("t9");
    expect(
      at("src/widgets/calendar/ui/week-view/calendar-week-view-skeleton.tsx"),
    ).toEqual(expect.arrayContaining(["t2-static"]));
  });
});
