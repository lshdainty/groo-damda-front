import { readFileSync } from "node:fs";
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
const row = (id: string) => {
  const r = rows.get(id);
  if (!r) throw new Error(`CSV 에 ${id} 가 없다`);
  return r;
};

const LATER_KO = "잠시 뒤 다시 시도해주세요.";
const LATER_EN = "Try again later.";

/** 마침표 없이 끝나던 성공 · 실패 스낵바 */
const WITH_PERIOD = [
  "category:moveTx.done",
  "expense:savePreset.saved",
  "calendar:shareSection.joinedNamed",
  "calendar:shareSection.toast.codeCopied",
  "calendar:shareSection.toast.codeRegenerated",
  "recurring:toastPaused",
  "recurring:toastResumed",
  "recurring:toastDeleted",
  "recurring:toastSaved",
  "recurring:toastAdded",
  "expense:preset.deleteFailed",
];

/** [다시 시도] 가 붙는 스낵바 — 한 문장 */
const WITH_RETRY = [
  "memo:deleteFailed",
  "memo:saveFailedSnack",
  "memo:tags.deleteFailed",
  "todo:tags.deleteFailed",
];

/** 액션 없는 단순 실패 스낵바 — 두 문장 */
const NO_ACTION = [
  "todo:toggleFailed",
  "calendar:filter.visibilityFailed",
  "calendar:shareSection.roleFailed",
  "calendar:shareSection.colorFailed",
  "calendar:deleteConfirm.failed",
  "asset:assetDetail.hideFailed",
  "notification:settingsSaveFailed",
  "category:reorderFailed",
  "settings:prefs.saveFailed",
  "settings:account.toast.linkReturnError",
  "stocks:watch.addFail",
  "stocks:watch.removeFail",
  "stats:fixed.bulk.failed",
  "memo:pinFailed",
];

/** 다시 시도를 권하면 안 되는 자리 — 한 문장 */
const NO_RETRY_ADVICE = [
  "common:query.refreshFailed",
  "stats:fixed.bulk.unconfirmed",
];

describe("스낵바 글", () => {
  it.each([...WITH_PERIOD, ...WITH_RETRY, ...NO_ACTION, ...NO_RETRY_ADVICE])(
    "%s — 마침표로 끝난다",
    (id) => {
      const { ko, en } = row(id);
      expect(ko).toMatch(/[.?!]$/);
      expect(en).toMatch(/[.?!]$/);
    },
  );

  it.each(WITH_RETRY)("%s — [다시 시도] 가 붙으면 한 문장", (id) => {
    const { ko, en } = row(id);
    expect(ko).not.toContain(LATER_KO);
    expect(ko.match(/\. /g)).toBeNull();
    expect(en.match(/\. /g)).toBeNull();
  });

  it.each(NO_ACTION)("%s — 액션이 없으면 두 문장(뒤는 다시 시도)", (id) => {
    const { ko, en } = row(id);
    expect(ko.endsWith(` ${LATER_KO}`)).toBe(true);
    expect(en.endsWith(` ${LATER_EN}`)).toBe(true);
    expect(en).not.toMatch(/Could not|Please/);
  });

  it.each(NO_RETRY_ADVICE)("%s — 다시 시도를 권하지 않는다", (id) => {
    const { ko, en } = row(id);
    expect(ko).not.toContain("다시 시도");
    expect(en).not.toMatch(/try again/i);
  });

  it("메모 저장 실패는 스낵바(한 문장)와 폼 Callout(두 문장)이 키를 가른다", () => {
    expect(row("memo:saveFailed").ko).toContain(LATER_KO);
    expect(row("memo:saveFailedSnack").ko).not.toContain(LATER_KO);
  });
});
