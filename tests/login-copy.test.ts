// 로그인 화면 문구 — "SSO" 대신 "그루 계정"(Q12 12B, I-05 75). 사명은 영어 문구에서도 한글이다.
// 설명서(desk-guide)와 한 벌이라 글자를 리터럴로 잠근다.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// namespace,key,ko,en — 쉼표가 든 값은 큰따옴표로 감싼다(로그아웃한 뒤 안내의 영어 문장이 그렇다)
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
  .filter((l) => l.startsWith("login,"))
  .map((l) => {
    const [, key, ko, en] = parse(l);
    return { key: key!, ko: ko!, en: en! };
  });

const row = (key: string) => {
  const found = rows.find((r) => r.key === key);
  if (!found) throw new Error(`login,${key} 없음`);
  return { ko: found.ko, en: found.en };
};

describe("로그인 문구(75)", () => {
  it("ko · en 모든 login 문구에 SSO 가 없다", () => {
    for (const { ko, en } of rows) {
      expect(ko).not.toMatch(/SSO/i);
      expect(en).not.toMatch(/SSO/i);
    }
  });

  it("부제 · 버튼 글이 결정 12B 그대로다", () => {
    expect(row("sso.description")).toEqual({
      ko: "그루 계정으로 로그인해주세요.",
      en: "Sign in with your 그루 account.",
    });
    expect(row("sso.login")).toEqual({
      ko: "그루 계정으로 로그인",
      en: "Sign in with 그루",
    });
  });
});

// 로그아웃한 뒤 안내(보안 점검 CLI-6) — 담다만 로그아웃하고 그루 계정은 남는다는 것을 말한다.
describe("로그아웃한 뒤 문구", () => {
  const KEYS = [
    "signedOut.title",
    "signedOut.grooAccountHint",
    "signedOut.grooAccountLogout",
    "signedOut.grooAccountDone",
  ];

  it("ko · en 이 모두 있다 — 화면이 쓰는 키가 CSV 에서 빠지면 키 이름이 그대로 보인다", () => {
    for (const key of KEYS) {
      expect(row(key).ko, key).not.toBe("");
      expect(row(key).en, key).not.toBe("");
    }
  });
});
