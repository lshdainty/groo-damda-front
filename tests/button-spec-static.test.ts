import { describe, expect, it } from "vitest";
import { globSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * 화면이 Button 에 주는 값이 groo-design `specs/components/button.md` 를 어기지 않는지 — 파일을 읽어 본다.
 *
 * 1. 확인을 여는 [삭제](ghost + `ghostColor="critical"`)는 빨간 글자를 ghostColor 가 정한다.
 *    - flush 를 쓰지 않는다 — "flush 는 ghostColor 를 덮습니다 — 빨간 글자를 지켜야 하는 삭제(critical)에는
 *      쓰지 않습니다"(가장자리 맞춤). 덮이면 글자가 neutralSubtle 회색이 된다.
 *    - className 으로 글자색(text-fg-* · hover:text-* …)을 덮지 않는다 — 스펙 토큰을 inline 으로 덮는 것이고,
 *      flush 로 지운 빨강을 되살리던 자리(정산 상세, #618)가 이 모양이었다.
 *    - 음수 여백으로 글 시작을 가장자리에 당기지 않는다 — 모달 footer 예시는 `className="mr-auto"` 뿐이고
 *      상자 여백을 그대로 둔다(바닥 FormFooter 의 `-ml-x5` · 캘린더 관리의 `-ml-x3_5` 가 이 모양이었다).
 * 2. flush 는 ghost + **앞 아이콘**이 가장자리의 첫 · 끝 요소일 때만 쓴다 — "글자만 있는 ghost 에는 쓰지 않습니다".
 *    예외는 없다 — 칸 머리 보조 액션("예시 보기")도 글자만이라 flush 를 쓰지 않는다(field.md, groo-design#240).
 * 3. 시트 바닥 왼쪽 [삭제] 는 글자만큼이고 남은 폭은 주 버튼이 채운다(bottom-sheet.md "머리 · 본문 · 바닥" · "코드",
 *    groo-design#268) — 버튼에 `data-fit="content"` 를 주면 ResponsivePair 가 반 폭 바탕을 주지 않는다.
 *    - 글이 있는 ghost critical 은 data-fit 을 단다. 시트 바닥이 아닌 자리(화면 · 카드 · 대화상자만의 바닥)는 아래 표에 까닭과 함께 적는다.
 *    - data-fit 을 단 바닥은 버튼을 div 로 감싸지 않는다 — 감싸면 선택자(`[&>[data-fit=content]]`)가 빠지고, 주 버튼 라벨이
 *      남은 폭에 들지 않을 때 세로로 쌓는 판정(button.md "긴 라벨")도 빠진다.
 *    - 바닥의 [삭제] 는 ghost critical 이다 — 다른 꼴(neutralWeak 반 폭 등)로 두지 않는다(button.md 모달 footer ·
 *      bottom-sheet.md "닫기 버튼과 바닥 버튼"). 할 일 상세가 neutralWeak 반 폭이었다.
 *
 * 테스트 파일은 보지 않는다 — 시험이 일부러 그리는 모양이 있다.
 */

const ROOT = process.cwd();
const FILES = globSync("src/**/*.tsx", { cwd: ROOT }).filter(
  (p) => !p.endsWith(".test.tsx"),
);

/** 주석 안의 예시 코드는 위반이 아니다 — 줄 수는 그대로 둔다(위반 줄 번호를 알리려고) */
function stripComments(src: string): string {
  const blank = (m: string) => m.replace(/[^\n]/g, " ");
  return src
    .replace(/\/\*[\s\S]*?\*\//g, blank)
    .replace(/^\s*\/\/.*$/gm, blank);
}

/** `<Button` 의 여는 태그 끝(`>` 다음 자리)과 스스로 닫는지 — 속성 값의 `{…}` · 따옴표 안 `>` 는 건너뛴다 */
function openTagEnd(src: string, start: number) {
  let depth = 0;
  let quote: string | null = null;
  for (let i = start; i < src.length; i++) {
    const ch = src[i];
    if (quote) {
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      // 중괄호 밖의 '…' 는 JSX 속성 값이 아니다(아포스트로피) — 큰따옴표만 값으로 본다
      if (depth > 0 || ch === '"') quote = ch;
      continue;
    }
    if (ch === "{") depth++;
    else if (ch === "}") depth--;
    else if (ch === ">" && depth === 0)
      return { end: i + 1, selfClosing: src[i - 1] === "/" };
  }
  return { end: src.length, selfClosing: true };
}

interface ButtonUse {
  file: string;
  line: number;
  tag: string;
  children: string;
}

/** 파일 안의 `<Button …>…</Button>` 을 모두 — 안에 든 Button 도 따로 센다 */
function buttons(file: string): ButtonUse[] {
  const src = stripComments(readFileSync(join(ROOT, file), "utf8"));
  const out: ButtonUse[] = [];
  for (const m of src.matchAll(/<Button(?=[\s/>])/g)) {
    const { end, selfClosing } = openTagEnd(src, m.index);
    let children = "";
    if (!selfClosing) {
      // 짝이 맞는 </Button> 까지
      let depth = 1;
      const re = /<Button(?=[\s/>])|<\/Button>/g;
      re.lastIndex = end;
      for (let n = re.exec(src); n; n = re.exec(src)) {
        if (n[0] === "</Button>") {
          if (--depth === 0) {
            children = src.slice(end, n.index);
            break;
          }
        } else if (!openTagEnd(src, n.index).selfClosing) depth++;
      }
    }
    out.push({
      file,
      line: src.slice(0, m.index).split("\n").length,
      tag: src.slice(m.index, end),
      children,
    });
  }
  return out;
}

const ALL = FILES.flatMap(buttons);
const where = (b: ButtonUse) => `${b.file}:${b.line}`;

/** className 값(문자열 · {…} 식) 안의 클래스 이름들 — 따옴표 안 낱말만 */
function classTokens(tag: string): string[] {
  const at = tag.search(/\bclassName=/);
  if (at === -1) return [];
  const rest = tag.slice(at + "className=".length);
  let value: string;
  if (rest.startsWith('"')) value = rest.slice(0, rest.indexOf('"', 1) + 1);
  else {
    let depth = 0;
    let i = 0;
    for (; i < rest.length; i++) {
      if (rest[i] === "{") depth++;
      else if (rest[i] === "}" && --depth === 0) break;
    }
    value = rest.slice(0, i + 1);
  }
  const strings = value.match(/"[^"]*"|'[^']*'|`[^`]*`/g) ?? [];
  return strings.flatMap((s) => s.slice(1, -1).split(/\s+/).filter(Boolean));
}

/** `hover:` · `lg:` · `group-…:` 같은 앞머리를 뗀 클래스 */
const base = (cls: string) => cls.slice(cls.lastIndexOf(":") + 1);

// 글자 크기(t1 …) · 정렬 · 줄바꿈은 글자색이 아니다
const NOT_COLOR =
  /^text-(t\d+|left|right|center|start|end|justify|wrap|nowrap|balance|pretty|ellipsis|clip)$/;
const isTextColor = (cls: string) =>
  base(cls).startsWith("text-") && !NOT_COLOR.test(base(cls));
const isNegativeMargin = (cls: string) => /^-m[trblxyse]?-/.test(base(cls));

/** 첫 자식이 아이콘(대문자 이름의 스스로 닫는 요소)인가 — asChild 면 감싼 요소(Link 등) 안을 본다 */
function startsWithIcon(b: ButtonUse): boolean {
  let body = b.children.trim();
  if (/\basChild\b/.test(b.tag) && body.startsWith("<")) {
    body = body.slice(openTagEnd(body, 0).end).trim();
  }
  return /^<[A-Z][\w.]*(\s[^>]*)?\/>/.test(body);
}

const critical = ALL.filter((b) => /ghostColor="critical"/.test(b.tag));
const flushed = ALL.filter((b) => /\bflush=/.test(b.tag));

describe("Button 은 button.md 를 따른다(파일 검사)", () => {
  it("검사가 Button 을 실제로 찾는다", () => {
    // 찾는 식이 깨져 0 건이면 아래 시험이 모두 초록불이 난다
    expect(critical.length).toBeGreaterThan(10);
    expect(flushed.length).toBeGreaterThan(0);
  });

  it("ghost critical(삭제)에는 flush 가 없다", () => {
    expect(critical.filter((b) => /\bflush=/.test(b.tag)).map(where)).toEqual(
      [],
    );
  });

  it("ghost critical(삭제)의 className 에 글자색 덮기가 없다", () => {
    expect(
      critical
        .filter((b) => classTokens(b.tag).some(isTextColor))
        .map((b) => `${where(b)} ${classTokens(b.tag).filter(isTextColor)}`),
    ).toEqual([]);
  });

  it("ghost critical(삭제)을 음수 여백으로 가장자리에 당기지 않는다", () => {
    expect(
      critical
        .filter((b) => classTokens(b.tag).some(isNegativeMargin))
        .map(
          (b) => `${where(b)} ${classTokens(b.tag).filter(isNegativeMargin)}`,
        ),
    ).toEqual([]);
  });

  it("flush 는 앞 아이콘이 있는 ghost 에만 쓴다(글자만 · 뒤 아이콘만이면 쓰지 않는다)", () => {
    expect(flushed.filter((b) => !startsWithIcon(b)).map(where)).toEqual([]);
  });
});

// 시트 바닥이 아닌 ghost critical(글 있는 것) — 파일마다 몇 개인지. 여기 없는 자리는 모두 data-fit 을 단다
const NOT_SHEET_FOOTER: Record<string, number> = {
  // 요금제 화면 바닥의 [구독 해지] — 화면 단추(폰은 폭 전체), 시트 바닥이 아니다
  "src/widgets/account-settings/ui/SubscriptionSection.tsx": 1,
  // [모든 기기에서 로그아웃] — 목록 아래 폭 전체 · 카드 바닥 줄 오른쪽
  "src/widgets/account-settings/ui/DevicesSection.tsx": 2,
  // [캘린더 삭제] — 설정 화면 안의 버튼
  "src/widgets/calendar-manage/ui/CalendarManagePage.tsx": 1,
  // 옆 칸(카드) 바닥 — ResponsivePair 가 아니다(mr-auto)
  "src/widgets/calendar/ui/day-panel.tsx": 1,
  // 1280 이상 대화상자 바닥만 그린다(mr-auto) — 시트 쪽은 sheet-panel · 아래 시트 바닥이 맡는다
  "src/widgets/calendar/ui/event-form/dialog-panel.tsx": 1,
  "src/widgets/calendar/ui/event-detail/event-detail-surface.tsx": 1,
};

/** 바닥 부품(시트 · 반응형 대화상자)의 여는 태그부터 닫는 태그까지 */
function footers(file: string) {
  const src = stripComments(readFileSync(join(ROOT, file), "utf8"));
  return [
    ...src.matchAll(
      /<(ResponsiveDialogFooter|BottomSheetFooter)(?=[\s>])[\s\S]*?<\/\1>/g,
    ),
  ].map((m) => ({
    where: `${file}:${src.slice(0, m.index).split("\n").length}`,
    body: m[0],
  }));
}

describe("시트 바닥 왼쪽 [삭제] 는 글자만큼(bottom-sheet.md 코드 — data-fit)", () => {
  const texty = critical.filter((b) => !/layout="iconOnly"/.test(b.tag));

  it('글이 있는 ghost critical 은 data-fit="content" 를 단다 — 시트 바닥이 아닌 자리만 표에 적는다', () => {
    const missing: Record<string, number> = {};
    for (const b of texty)
      if (!/\bdata-fit="content"/.test(b.tag))
        missing[b.file] = (missing[b.file] ?? 0) + 1;
    expect(missing).toEqual(NOT_SHEET_FOOTER);
  });

  it("data-fit 을 단 [삭제] 가 있다(찾는 식이 깨지지 않았다)", () => {
    expect(
      texty.filter((b) => /\bdata-fit="content"/.test(b.tag)).length,
    ).toBeGreaterThan(5);
  });

  it("바닥(시트 · 반응형 대화상자)의 [삭제] 는 ghost critical 이다 — neutralWeak 등 다른 꼴로 두지 않는다", () => {
    const dels = FILES.flatMap(footers).flatMap((f) =>
      [...f.body.matchAll(/<Button(?=[\s/>])[\s\S]*?<\/Button>/g)]
        .filter((b) => /\(\s*"delete"\s*\)/.test(b[0]))
        .map((b) => ({ where: f.where, button: b[0] })),
    );
    // 찾는 식이 깨져 0 건이면 초록불이 난다
    expect(dels.length).toBeGreaterThan(5);
    expect(
      dels
        .filter(
          (d) =>
            !/variant="ghost"/.test(d.button) ||
            !/ghostColor="critical"/.test(d.button),
        )
        .map((d) => d.where),
    ).toEqual([]);
  });

  it("data-fit 을 단 바닥은 버튼을 div 로 감싸지 않는다(바로 아래 자식이어야 반 폭 · 쌓기 판정이 먹는다)", () => {
    const wrapped = FILES.flatMap(footers)
      .filter((f) => /data-fit="content"|\{del\}|\{cancel\}/.test(f.body))
      .filter((f) => /<div\b/.test(f.body))
      .map((f) => f.where);
    expect(wrapped).toEqual([]);
  });
});
