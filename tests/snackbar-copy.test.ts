import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * 스낵바 글(snackbar.md 글 — Writing v106, 2026-11-07 B4).
 *
 * - 해요체 문장에 마침표.
 * - [다시 시도] 액션이 붙은 실패 스낵바는 한 문장(버튼과 같은 말을 되풀이하지 않고 폰에서 두 줄이 되지 않는다).
 * - 액션이 없는 단순 실패는 두 문장 — "…못했어요. 잠시 뒤 다시 시도해주세요."(영어는 "Couldn't X. Try again later.").
 *   예외(한 문장): 다시 시도를 권하면 안 되는 자리 — "새로 고치지 못했어요." · "…됐는지 확인하지 못했어요." 계열.
 *
 * 키 목록은 코드에서 스낵바로 띄우는 글이다. 새 스낵바를 더하면 여기에 올린다.
 */
const CSV = readFileSync("i18n/translations.csv", "utf-8").split("\n");

function parseLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i]!;
    if (c === '"') {
      if (q && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else q = !q;
    } else if (c === "," && !q) {
      out.push(cur);
      cur = "";
    } else cur += c;
  }
  out.push(cur);
  return out;
}

const rows = new Map<string, { ko: string; en: string }>();
for (const line of CSV.slice(1)) {
  if (!line) continue;
  const [ns, key, ko, en] = parseLine(line);
  rows.set(`${ns}:${key}`, { ko: ko ?? "", en: en ?? "" });
}
/** 복수형 키(`key_one` · `key_other`)는 `_other` 를 본다 — 영어 `_one` 도 같은 규칙으로 따로 본다 */
const has = (id: string) =>
  rows.has(id) || rows.has(`${id}_other`) || rows.has(`${id}_one`);
const row = (id: string) => {
  const r = rows.get(id) ?? rows.get(`${id}_other`) ?? rows.get(`${id}_one`);
  if (!r) throw new Error(`CSV 에 ${id} 가 없다`);
  return r;
};

const LATER_KO = "잠시 뒤 다시 시도해주세요.";
const LATER_EN = "Try again later.";

/**
 * 코드에서 스낵바로 띄우는 글의 키를 모은다 — `snackbar.show({ message: t("key") … })` · `confirmFail({ message: t("key") … })`
 * (확인창 뒤 실패 — 늘 [다시 시도]) · `toggleFail(error, t("key"))`(액션 없음). 손으로 적은 목록 대신 호출처에서 뽑아
 * 새 스낵바가 목록에 오르지 않아도 규칙을 받게 한다. 네임스페이스는 파일의 `const { t } = useTranslation("ns")` 에서 읽는다.
 */
type Found = {
  id: string;
  kind: "confirm" | "toggle" | "show";
  critical: boolean;
  action: boolean;
  file: string;
};

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(e.name) && !/\.(test|demo)\./.test(e.name))
      out.push(p);
  }
  return out;
}

function collect(): Found[] {
  const found: Found[] = [];
  for (const file of walk("src")) {
    const src = readFileSync(file, "utf-8");
    const defNs = src.match(
      /const\s*\{\s*t\s*(?::\s*\w+)?\s*(?:,[^}]*)?\}\s*=\s*useTranslation\(\s*"(\w+)"/,
    )?.[1];
    for (const m of src.matchAll(
      /\b(confirmFail|toggleFail|snackbar\.show)\(/g,
    )) {
      // 주석 안의 예시(`* confirmFail({ message: t("deleteFailed") …`)는 건너뛴다
      const lineStart = src.lastIndexOf("\n", m.index) + 1;
      if (/^\s*(\*|\/\/)/.test(src.slice(lineStart, m.index + 1))) continue;
      let i = m.index! + m[0].length;
      let depth = 1;
      const start = i;
      for (; i < src.length && depth; i++) {
        if (src[i] === "(") depth++;
        else if (src[i] === ")") depth--;
      }
      const body = src.slice(start, i - 1);
      const kind =
        m[1] === "confirmFail"
          ? "confirm"
          : m[1] === "toggleFail"
            ? "toggle"
            : "show";
      for (const k of body.matchAll(
        /(?:i18n\.)?\bt\(\s*"(?:(\w+):)?([\w.]+)"/g,
      )) {
        const ns = k[1] ?? defNs;
        if (!ns) continue;
        // 액션 글자(`label: t("…")`)는 스낵바 글이 아니다
        if (/label:\s*$/.test(body.slice(Math.max(0, k.index! - 20), k.index!)))
          continue;
        found.push({
          id: `${ns}:${k[2]}`,
          kind,
          critical: kind !== "show" || /tone:\s*"critical"/.test(body),
          action: kind === "confirm" || /action\s*:/.test(body),
          file,
        });
      }
    }
  }
  return found;
}

const FOUND = collect().filter((f) => !f.id.startsWith("common:tags."));

/** 코드로 모으지 못하는 글 — 키를 이름 변수로 받는 공용 부품(`tag-settings`)과 상위 알림 */
const EXTRA_WITH_RETRY = ["memo:tags.deleteFailed", "todo:tags.deleteFailed"];

/** 다시 시도를 권하면 안 되는 자리 — 한 문장 */
const NO_RETRY_ADVICE = [
  "common:query.refreshFailed",
  "stats:fixed.bulk.unconfirmed",
];

/** 액션 없는 실패인데 두 문장이 아닌 것 — 뒤 문장이 다른 안내라서 */
const OWN_SECOND_SENTENCE = new Set(["download:ios.copyFailed"]);

/** 같은 키를 액션 있는 쪽과 없는 쪽이 함께 쓰던 것을 가른 쌍 — 폼 Callout 은 액션이 없어 두 문장이 맞다 */
const CALLOUT_TWO_SENTENCES = ["memo:saveFailed"];

describe("스낵바 글 — 코드 호출처에서 모은 키", () => {
  it("호출처를 충분히 모았다(가드가 비어 통과하지 않게)", () => {
    expect(FOUND.length).toBeGreaterThan(60);
    expect(new Set(FOUND.map((f) => f.kind))).toEqual(
      new Set(["confirm", "toggle", "show"]),
    );
  });

  it("모은 키는 모두 CSV 에 있다", () => {
    // 이름을 변수로 받는 공용 부품(tag-settings)의 `common:tags.*` 는 EXTRA_WITH_RETRY 가 맡는다
    const missing = [...new Set(FOUND.map((f) => f.id))].filter(
      (id) => !has(id) && !id.startsWith("common:tags."),
    );
    expect(missing).toEqual([]);
  });

  it("해요체 문장에 마침표로 끝난다(ko · en)", () => {
    const bad = [...new Set(FOUND.map((f) => f.id))].filter((id) => {
      const { ko, en } = row(id);
      return !/[.?!]$/.test(ko) || !/[.?!]$/.test(en);
    });
    expect(bad).toEqual([]);
  });

  it("[다시 시도] 가 붙는 실패(확인창 뒤 · 액션 있는 띠)는 한 문장이다", () => {
    const ids = new Set(
      FOUND.filter((f) => f.critical && f.action).map((f) => f.id),
    );
    for (const id of EXTRA_WITH_RETRY) ids.add(id);
    const bad = [...ids].filter((id) => {
      const { ko, en } = row(id);
      return ko.includes(LATER_KO) || /\. /.test(ko) || /\. /.test(en);
    });
    expect(bad).toEqual([]);
  });

  it("액션 없는 단순 실패(토글 · 액션 없는 띠)는 두 문장 — 뒤는 다시 시도", () => {
    const ids = new Set(
      FOUND.filter((f) => f.critical && !f.action).map((f) => f.id),
    );
    const bad = [...ids]
      .filter((id) => !OWN_SECOND_SENTENCE.has(id))
      .filter((id) => {
        const { ko, en } = row(id);
        return (
          !ko.endsWith(` ${LATER_KO}`) ||
          !en.endsWith(` ${LATER_EN}`) ||
          /Could not|Please/.test(en)
        );
      });
    expect(bad).toEqual([]);
  });

  it.each(NO_RETRY_ADVICE)("%s — 다시 시도를 권하지 않는다(한 문장)", (id) => {
    const { ko, en } = row(id);
    expect(ko).not.toContain("다시 시도");
    expect(en).not.toMatch(/try again/i);
    expect(ko).toMatch(/[.?!]$/);
  });

  it.each(CALLOUT_TWO_SENTENCES)(
    "%s — 폼 Callout(액션 없음)은 두 문장, 스낵바 키(saveFailedSnack)와 가른다",
    (id) => {
      expect(row(id).ko).toContain(LATER_KO);
      expect(row("memo:saveFailedSnack").ko).not.toContain(LATER_KO);
    },
  );
});
