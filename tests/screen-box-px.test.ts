// 화면 쪽(ds 밖)의 상자 · 아이콘 · 색 점 · 진행 막대도 px 다 — DESIGN.md Typography "상자 · 아이콘 · 원은 px"(groo-design #263):
// 아이콘 · 컨트롤 모양은 웹 · 앱 모두 px 이고, rem 인 Tailwind 숫자 유틸(`size-4` · `[&_svg]:size-4` · `size-2` · `h-2`)을 쓰지 않는다.
// 숫자 유틸은 rem(`size-4` = 1rem)이라 글자 크기 300% 에서 아이콘 · 점 · 막대가 세 배가 된다.
// src/shared/ds 안은 box-px.test.ts 가 지키고, 이 시험은 화면 · 위젯 · 기능 · 엔티티 · 옛 공용 부품(shared/ui) · 앱 셸을 지킨다.
//
// 글을 담는 상자의 크기를 일부러 글에 맞춘 rem 임의값(`min-w-[8rem]` — 문장 칸이 이보다 좁으면 줄을 내린다)은 숫자 유틸이 아니라
// 여기서 막지 않는다. 아이콘 · 점 크기(`size-[…rem]`)만 임의값도 막는다.
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
  "src/shared/lib",
];
const SKIP = /\.(test|demo|measure)\.|\.test-utils\./;

// box-px.test.ts 와 같은 식 — 변형 접두(`lg:` · `[&_svg]:` · `before:`)를 붙인 것까지 잡는다. 0 · 분수(w-1/2)는 rem 이 아니다
const REM_SIZE =
  /(?<![\w-])(?:[\w[\]&>_=@()/-]+:)*(?:size|h|w|min-h|min-w|max-h|max-w)-(?!0(?![.\d]))\d+(?:\.\d+)?(?![\w[\]/.-])/g;
// 아이콘 · 점 크기를 rem 임의값으로 — size-[1rem]
const REM_ICON = /(?<![\w-])(?:[\w[\]&>_=@()/-]+:)*size-\[\d+(?:\.\d+)?rem\]/g;

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name) && !SKIP.test(name)) out.push(p);
  }
  return out;
}

// 주석은 줄 수를 지키며 지운다 — 어긋난 자리를 줄 번호로 알린다
const strip = (s: string) =>
  s
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/(^|[^:])\/\/.*$/gm, "$1");

function scan(re: RegExp): string[] {
  const bad: string[] = [];
  for (const dir of DIRS) {
    for (const f of walk(path.join(ROOT, dir))) {
      strip(readFileSync(f, "utf8"))
        .split("\n")
        .forEach((line, i) => {
          for (const m of line.matchAll(re)) {
            bad.push(`${path.relative(ROOT, f)}:${i + 1}: ${m[0]}`);
          }
        });
    }
  }
  return bad;
}

describe("화면 쪽 상자 · 아이콘 · 색 점 · 막대는 px 다", () => {
  it("Tailwind 숫자 크기 유틸(rem)이 남아 있지 않다", () => {
    expect(scan(REM_SIZE)).toEqual([]);
  });

  it("아이콘 · 점 크기를 rem 임의값으로 적은 곳이 없다", () => {
    expect(scan(REM_ICON)).toEqual([]);
  });

  it("시험이 실제로 잡는다 — 아이콘 · 점 · 막대 · 변형 접두", () => {
    const hits = (s: string) => [...s.matchAll(REM_SIZE)].map((m) => m[0]);
    expect(
      hits(
        'className="size-4 shrink-0" "[&_svg]:size-4" "lg:size-5" "h-2 w-full" "before:size-11" "min-h-11"',
      ),
    ).toEqual([
      "size-4",
      "[&_svg]:size-4",
      "lg:size-5",
      "h-2",
      "before:size-11",
      "min-h-11",
    ]);
    // px · 토큰 · 분수 · 0 · 글 줄 기준은 잡지 않는다
    expect(
      hits(
        "size-[16px] h-[8px] w-x4 w-1/2 min-w-0 h-(--text-t1--line-height) w-full",
      ),
    ).toEqual([]);
    expect([..."size-[1rem]".matchAll(REM_ICON)]).toHaveLength(1);
  });
});
