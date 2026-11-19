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
/** 높이를 박는 클래스(최소 높이 제외) — 글 자리에 붙으면 글 줄 높이를 덮는다. min-h 는 "그보다 작아지지 않음"이라 글을 따라 커진다 */
const FIXED_HEIGHT = /(?:^|\s)h-(\[[^\]]+\]|x\d+(?:_\d)?|full)(?=\s|$)/;

/**
 * 모양 자리 — 높이를 클래스로 박아 둔 것(글이 아니라 커지지 않는다). 파일: 높이 클래스. 새 모양 자리는 까닭과 함께 여기에 더한다.
 */
const SHAPES: Record<string, string[]> = {
  // 진행 · 예산 막대 8
  "src/pages/asset/ui/asset-parts.tsx": ["h-[8px]"],
  "src/pages/budget/ui/budget-parts.tsx": ["h-[8px]", "h-[180px]"], // 막대 · 차트
  "src/pages/dashboard/ui/home-parts.tsx": ["h-[8px]"],
  "src/pages/stats/ui/fixed-parts.tsx": ["h-[8px]"],
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
    const bad = all.filter((u) => u.text && FIXED_HEIGHT.test(u.cls));
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
    ).toEqual([null, "t5", "t3", "t3"]);
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

/**
 * 블록 스켈레톤 판정(skeleton.md "틀은 먼저, 데이터 자리만 스켈레톤" · Do) — ① 틀 부품(스위치 · 정렬 · 고르는 칸 · 바닥 버튼)은
 * 스켈레톤으로 덮지 않고 실제 부품을 막힌 상태로 그린다 ② 데이터를 담는 줄 · 카드는 블록 하나로 덮지 않고, 실제 줄과 같은 부품
 * (같은 최소 높이 · 위아래 여백 · 사이) 안에 글 줄(text="tN")과 모양만 둔다 — 그러면 100% 에서는 실제 줄과 높이가 같고, 큰 글자에서는
 * 함께 커진다. jsdom 은 레이아웃이 없어 "같은 부품을 쓰는가"를 소스로, 칩 · 비율 막대는 셈으로 본다.
 */
const read = (file: string) => readFileSync(path.join(ROOT, file), "utf8");
/** 로딩 갈래 소스 — 첫 표지(start)부터 끝 표지(end)까지 */
const slice = (file: string, start: string, end: string) => {
  const src = read(file);
  const a = src.indexOf(start);
  expect(a, `${file}: ${start}`).toBeGreaterThanOrEqual(0);
  const b = src.indexOf(end, a + start.length);
  expect(b, `${file}: ${end}`).toBeGreaterThan(a);
  return src.slice(a, b);
};

describe("블록 스켈레톤 — 틀은 실제 부품, 데이터 줄은 실제 줄 안의 글 줄", () => {
  it("틀 부품 자리에 Skeleton 이 없다 — 스위치 · 정렬 · 고르는 칸 · 바닥 버튼은 막힌 실제 부품", () => {
    const sw = slice(
      "src/widgets/notification-manage/ui/NotificationsManager.tsx",
      "if (loading)",
      "/** 값 줄",
    );
    expect(sw).toContain("<ListSwitchItem");
    expect(sw).toMatch(/\bdisabled\b/);
    expect(sw).not.toMatch(/<Skeleton radius="full"/);

    const preset = slice(
      "src/widgets/preset-manage/ui/PresetManager.tsx",
      "function PresetListSkeleton",
      "\n}\n",
    );
    expect(preset).toContain("{sortControl}");
    expect(preset).not.toMatch(/h-x10/);

    const appear = slice(
      "src/widgets/account-settings/ui/AppearanceSection.tsx",
      "// 불러오는 동안 — 고르는 칸(Input Button)",
      ") : wide ? (",
    );
    expect(appear).toContain("trigger");
    expect(appear).not.toContain("<Skeleton");

    const billing = slice(
      "src/widgets/asset-full/ui/detail/CardBilling.tsx",
      "if (c.isLoading)",
      "if (c.isError)",
    );
    expect(billing).toMatch(/<Button[^>]*disabled/);
    expect(billing).not.toMatch(/h-x10/);
  });

  it("데이터 줄은 실제 줄과 같은 부품 안에 글 줄 — 블록 하나로 덮지 않는다", () => {
    const cases: [string, string, string, RegExp][] = [
      [
        "src/features/expense/ui/FixedBulk.tsx",
        "if (q.isLoading)",
        "} else if",
        /<ListCheckItem/,
      ],
      [
        "src/features/subscription/ui/ApiTokenStep.tsx",
        "{isLoading && (",
        "{tokens &&",
        /<ListItem/,
      ],
      [
        "src/features/subscription/ui/SecuritiesLinkDialog.tsx",
        "{loading && (",
        "{failed &&",
        /<ListItem/,
      ],
      [
        "src/pages/card-benefit/ui/CardDetailContent.tsx",
        "export function DetailSkeleton",
        "export function CardDetailContent",
        /<AccordionPlainItem/,
      ],
      [
        "src/widgets/add-tx/ui/TxStep1.tsx",
        "f.templatesQ.isPending ?",
        "loadFailed(",
        /<ChipGroup/,
      ],
      [
        "src/pages/search/ui/SearchPage.tsx",
        "query.isLoading || query.isFetching",
        "groups.length === 0",
        /<LedgerDayHead>[\s\S]*<ListItem/,
      ],
      [
        "src/widgets/notification-manage/ui/NotificationsMenu.tsx",
        "isLoading ? (",
        "isError",
        /<ListItem/,
      ],
      [
        "src/pages/stocks/ui/detail/detail-parts.tsx",
        "function TableSkeleton",
        "// ---- 일별",
        /<tr key=\{i\} className=\{ROW\}>/,
      ],
    ];
    for (const [file, start, end, part] of cases) {
      const body = slice(file, start, end);
      expect(body, file).toMatch(part);
      expect(body, file).toMatch(/<Skeleton[^>]*text="t\d+"/);
      // 블록 하나로 덮던 높이(52 · 56 · 64 · 74 · 36 · 48 · 40 · 24)가 남지 않는다
      expect(body, file).not.toMatch(/<Skeleton[^>]*className="[^"]*\bh-\[/);
    }
    // 호가 표 — 줄 사이를 따로 두지 않는다(실제 표 줄 32 와 같은 높이)
    expect(
      slice(
        "src/pages/stocks/ui/detail/detail-parts.tsx",
        "function TableSkeleton",
        "// ---- 일별",
      ),
    ).not.toMatch(/gap-x/);
  });

  it("칩 · 비율 막대 — 100% 에서 실제와 같은 높이, 300% 에서 함께 커진다", () => {
    // 칩 medium — 실제: 글 줄(t4) + 위아래 8.5(최소 36). 스켈레톤: text t4 + box-content py-[8.5px]
    const chip = slice(
      "src/widgets/add-tx/ui/TxStep1.tsx",
      "f.templatesQ.isPending ?",
      "loadFailed(",
    );
    expect(chip).toMatch(/text="t4"/);
    expect(chip).toMatch(/box-content/);
    expect(chip).toMatch(/py-\[8\.5px\]/);
    const chipHeight = (scale: number) =>
      Math.max(36, lineHeight("t4", scale) + 17);
    const chipSkeleton = (scale: number) => lineHeight("t4", scale) + 8.5 * 2;
    expect(chipSkeleton(1)).toBe(chipHeight(1));
    expect(chipSkeleton(3)).toBe(chipHeight(3));
    // 비율 막대 — 실제: min-h 28 안에 % 글(t2). 스켈레톤: text t2 + min-h-[28px]
    const bar = read("src/pages/stats/ui/fixed-parts.tsx");
    expect(bar).toMatch(
      /<Skeleton\s+text="t2"\s+className="min-h-\[28px\] w-full"/,
    );
    expect(bar).toMatch(/className="flex min-h-\[28px\]/);
    const barHeight = (scale: number) => Math.max(28, lineHeight("t2", scale));
    expect(barHeight(1)).toBe(28);
    expect(barHeight(3)).toBe(48);
  });
});
