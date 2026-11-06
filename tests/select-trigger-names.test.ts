import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * 제품 화면의 선택 칸(`<SelectTrigger>` = role=combobox)은 이름이 있어야 한다.
 *
 * combobox 는 내용으로 이름을 얻지 못한다(name from author) — 값 글자만 있으면 보조 기술이 "콤보박스" 라고만 읽는다.
 * 보이는 칸 이름(라벨 · 제목 글)을 `aria-labelledby="{라벨 id} {트리거 id}"` 로 잇는다(라벨 + 값). 라벨이 없는 자리는 aria-label.
 * I-03 이 거래 추가 시트 · 카테고리 편집을, I-04 가 나머지 21곳을 이었다. 새 선택 칸이 이름 없이 들어오면 여기서 막는다.
 *
 * 소스 글을 읽는 검사다 — 각 태그에 이름 속성이 있고, 가리키는 id 가 같은 파일 안에 실제로 달려 있는지(오타로 끊기지 않았는지)를 본다.
 */
const SRC = "src";
const SKIP = ["src/shared/ds/", "src/shared/ui/select.tsx", ".test.", ".demo."];

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name).split(path.sep).join("/");
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith(".tsx")) out.push(p);
  }
  return out;
}

const files = walk(SRC).filter((p) => !SKIP.some((s) => p.includes(s)));

/** `<SelectTrigger ... >` 여는 태그 글 — 속성 안의 `=>` · 템플릿 `>` 는 없다고 본다(이 저장소의 쓰임) */
function triggers(src: string): { tag: string; line: number }[] {
  const out: { tag: string; line: number }[] = [];
  const re = /<SelectTrigger\b([\s\S]*?)>/g;
  for (let m = re.exec(src); m; m = re.exec(src))
    out.push({ tag: m[1]!, line: src.slice(0, m.index).split("\n").length });
  return out;
}

describe("선택 칸 이름 — 제품 화면의 SelectTrigger", () => {
  const all = files.flatMap((f) => {
    const src = readFileSync(f, "utf-8");
    return triggers(src).map((t) => ({ f, src, ...t }));
  });

  it("검사 대상이 있다(스캔이 죽지 않았다)", () => {
    // 스캔이 죽지 않았다는 보호 장치 — 카테고리 편집 폼의 종류 · 상위 선택 칸 둘을 PickerRow(줄 칸)로 바꿔 26 → 24 로 줄었다(I-20 B 12)
    // 옛 SelectTrigger 쓰는 곳은 화면이 ds Select 로 옮겨 갈수록 준다(일정 폼 09-2 에서 둘 줄어 19 · ds 이관 뒤 2) — 스캔이 죽지 않았는지만 본다.
    // 하한은 "스캔이 파일을 읽었다" 를 재는 값이다 — 남은 옛 칸이 0 이 되면 이 시험 묶음째 걷는다
    expect(files.length).toBeGreaterThan(100);
    expect(all.length).toBeGreaterThanOrEqual(1);
  });

  it("모든 선택 칸이 aria-labelledby 또는 aria-label 을 가진다", () => {
    const bad = all
      // AddTxSheet 는 `{...nameOf("x").trigger}` 로 펼친다 — 그 쪽은 AddTxSheet.comboboxNames.test.tsx 가 DOM 에서 잰다
      .filter((t) => !/aria-labelledby=|aria-label=|\.\.\.nameOf\(/.test(t.tag))
      .map((t) => `${t.f}:${t.line}`);
    expect(bad).toEqual([]);
  });

  it("aria-labelledby 가 가리키는 id 는 같은 파일 안에 달려 있다 — 라벨 id 와 트리거 자신의 id", () => {
    const missing: string[] = [];
    for (const t of all) {
      const m = /aria-labelledby=\{`([^`]*)`\}|aria-labelledby="([^"]*)"/.exec(
        t.tag,
      );
      if (!m) continue;
      const refs = (m[1] ?? m[2]!).split(" ").filter(Boolean);
      for (const ref of refs) {
        // 템플릿 `${uid}cal-label` 이나 `asset-edit-currency` — 같은 글이 id= (또는 제목 부품의 titleId=) 로 달려 있어야 한다
        const escaped = ref.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const hasLoose =
          t.src.includes(`id={\`${ref}\`}`) ||
          t.src.includes(`id="${ref}"`) ||
          new RegExp("(?:id|titleId)=\\{`" + escaped + "`\\}").test(t.src);
        if (!hasLoose) missing.push(`${t.f}:${t.line} → ${ref}`);
      }
    }
    expect(missing).toEqual([]);
  });
});
