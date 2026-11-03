import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * 구독 배너의 **날짜 문구 두 벌**이 CSV 에 같이 서 있는지 본다.
 *
 * 해지해도 기간 끝까지 Pro 를 유지하게 서버가 바뀌면서(desk-back #332), 같은 날짜를
 * 두 가지로 말해야 한다 — 자동갱신이 켜졌으면 `nextBill`(다음 결제), 꺼졌으면
 * `activeUntil`(종료일). **한쪽만 남기면 반대쪽 구독이 거짓말을 한다.**
 *
 * 화면 테스트(SubscriptionDialog.grace.test.tsx)는 t() 를 키 그대로 흘려보내므로
 * CSV 행이 사라져도 안 깨진다 — 행의 존재는 여기서 잠근다.
 *
 * 번역 원본은 CSV 하나다(`src/locales/**` 는 생성물). 그래서 여기만 본다.
 */
const CSV = "i18n/translations.csv";
const DIALOG = "src/features/subscription/ui/SubscriptionDialog.tsx";
const SETTINGS = "src/widgets/account-settings/ui/AccountSection.tsx";

/** CSV 한 줄 → [ko, en]. 없으면 undefined. */
function row(ns: string, key: string): string[] | undefined {
  const line = readFileSync(CSV, "utf-8")
    .split("\n")
    .find((l) => l.startsWith(`${ns},${key},`));
  return line?.split(",").slice(2);
}

describe("구독 배너의 날짜 문구", () => {
  it("자동갱신이 켜진 구독은 종전대로 '다음 결제'로 말한다", () => {
    const cells = row("subscription", "nextBill");
    expect(cells, `${CSV} 에 subscription,nextBill 행이 없다`).toBeDefined();
    const [ko, en] = cells!;

    expect(ko).toContain("{{date}}");
    expect(en).toContain("{{date}}");
  });

  it("해지한 구독은 결제일이 아니라 종료일로 말한다", () => {
    const cells = row("subscription", "activeUntil");
    expect(cells, `${CSV} 에 subscription,activeUntil 행이 없다`).toBeDefined();
    const [ko, en] = cells!;

    expect(ko).toContain("{{date}}");
    // 영문 값에 쉼표가 들어가면 큰따옴표로 감싸야 한다 — 안 감싸면 CSV 파서가
    // 거기서 칸을 끊어 뒤가 조용히 잘린다. 잘리면 `{{date}}` 가 먼저 사라진다.
    expect(en).toContain("{{date}}");
    // '결제'로 읽히면 고친 의미가 도로 사라진다.
    expect(ko).not.toContain("결제");
    expect(en.toLowerCase()).not.toContain("billing");
  });

  it("다이얼로그가 두 키를 다 쓴다", () => {
    const src = readFileSync(DIALOG, "utf-8");

    expect(src).toContain('t("nextBill"');
    expect(src).toContain('t("activeUntil"');
  });
});

/**
 * 같은 날짜를 **설정 화면도** 말한다 — 거기만 '다음 결제' 로 남으면 두 화면이 다른
 * 말을 한다. 배너와 달리 이 줄은 뒤에 `· Pro 이용 중` 이 붙는 한 줄짜리라, 키를
 * 공유하지 못하고 `settings` 네임스페이스에 같은 모양의 행을 하나 더 둔다.
 */
describe("설정 화면 구독 줄의 날짜 문구", () => {
  it("자동갱신이 켜진 구독은 종전대로 '다음 결제'로 말한다", () => {
    const cells = row("settings", "account.sub.proActiveBill");
    expect(
      cells,
      `${CSV} 에 settings,account.sub.proActiveBill 행이 없다`,
    ).toBeDefined();
    const [ko, en] = cells!;

    expect(ko).toContain("{{date}}");
    expect(en).toContain("{{date}}");
  });

  it("해지한 구독은 결제일이 아니라 종료일로 말한다", () => {
    const cells = row("settings", "account.sub.proActiveUntil");
    expect(
      cells,
      `${CSV} 에 settings,account.sub.proActiveUntil 행이 없다`,
    ).toBeDefined();
    const [ko, en] = cells!;

    expect(ko).toContain("{{date}}");
    // 영문 값에 쉼표가 들어가면 큰따옴표로 감싸야 한다 — 안 감싸면 CSV 파서가
    // 거기서 칸을 끊어 뒤가 조용히 잘린다. 잘리면 `{{date}}` 가 먼저 사라진다.
    expect(en).toContain("{{date}}");
    // '결제'로 읽히면 고친 의미가 도로 사라진다.
    expect(ko).not.toContain("결제");
    expect(en.toLowerCase()).not.toContain("billing");
    // 줄 하나가 날짜와 상태를 같이 말하는 모양이다 — 앞부분만 바꾼다.
    expect(ko).toContain("Pro 이용 중");
    expect(en).toContain("On Pro");
  });

  it("설정 화면이 두 키를 다 쓴다", () => {
    const src = readFileSync(SETTINGS, "utf-8");

    expect(src).toContain('t("account.sub.proActiveBill"');
    expect(src).toContain('t("account.sub.proActiveUntil"');
  });
});
