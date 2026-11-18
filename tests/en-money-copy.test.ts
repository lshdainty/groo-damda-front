// 문장 속 돈 — 영어 문구에 "won" 을 붙이지 않고 ₩ 를 앞에 쓴다(International Design "돈", groo-design #252). 한국어는 그대로.
// 예전엔 "Amount can be up to 10 billion won." · "{{extra}} won extra" 처럼 영어에서만 화폐 이름을 글로 붙였다.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { amountLimitText } from "@/shared/lib/groo/use-amount-limit";

// namespace,key,ko,en — 쉼표가 든 값은 큰따옴표로 감싼다
const parse = (line: string): string[] => {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i]!;
    if (c === '"') {
      if (quoted && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else quoted = !quoted;
    } else if (c === "," && !quoted) {
      out.push(cur);
      cur = "";
    } else cur += c;
  }
  out.push(cur);
  return out;
};

const rows = readFileSync(
  path.join(__dirname, "../i18n/translations.csv"),
  "utf8",
)
  .split("\n")
  .slice(1)
  .filter((l) => l.trim())
  .map(parse);
const en = (ns: string, key: string) =>
  rows.find((r) => r[0] === ns && r[1] === key)?.[3];

describe("영어 문구의 돈 — won 0 · ₩ 앞", () => {
  it('영어 값에 단위 낱말 "won" 이 없다(won\'t 는 낱말이 다르다 · 화폐 이름 "Korean Won" 은 설정의 통화 목록이라 남긴다)', () => {
    const hits = rows
      .filter((r) => /\bwon\b(?!')/.test(r[3] ?? ""))
      .map((r) => `${r[0]}.${r[1]}: ${r[3]}`);
    expect(hits).toEqual([]);
  });

  it("상한 · 더치페이 나머지 · 환율 힌트는 ₩ 를 앞에, 줄이지 않는다", () => {
    expect(en("common", "amountTooLarge")).toBe(
      "Amount can be up to ₩10,000,000,000.",
    );
    expect(en("expense", "addTx.amountTooLarge")).toBe(
      "Amount can be up to ₩10,000,000,000.",
    );
    expect(en("asset", "savingGoal.errAmountTooLarge")).toBe(
      "Target amount can be up to ₩10,000,000,000.",
    );
    expect(en("dutchPay", "perPersonRest")).toContain("₩{{extra}} extra");
    expect(en("dutchPay", "peopleSummaryRest")).toContain("₩{{extra}} extra");
    expect(en("expense", "addTx.fxHint")).toBe(
      "{{original}} × {{rate}} = ₩{{krw}}",
    );
  });

  it("코드가 만드는 상한 글도 — 영어 ₩100,000,000,000 · 한국어 1,000억원 그대로", () => {
    expect(amountLimitText(100_000_000_000, true)).toBe("₩100,000,000,000");
    expect(amountLimitText(100_000_000_000, false)).toBe("1,000억원");
  });
});
