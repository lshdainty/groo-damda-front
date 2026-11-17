import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { globSync } from "node:fs";
import { join } from "node:path";

/**
 * 대화상자 footer 에 `<Button>` 을 손으로 놓지 않는다.
 *
 * 대화상자는 footer 를 ReactNode prop 으로 받을 뿐이라, 화면마다 버튼을 직접
 * 놓으면 그때마다 규격이 갈렸다 — `size` 를 빠뜨려 36(좌우 16·14px)이 나오고, 취소가
 * `outline`·`ghost` 가 되고, 삭제가 `flush="left"`(좌 padding 0)로 여백선에 붙었다.
 * 데스크톱·태블릿 20종 실측(2026-09-16)에서 같은 footer 안에 두 크기가 섞여 있었다.
 *
 * 규격은 `ModalFooter` · `ModalViewFooter` 한 벌에만 적혀 있으면 된다. 여기서는
 * **그 둘을 지나지 않는 footer 가 새로 생기지 않는지**만 본다.
 */

/** `{` 부터 짝이 맞는 `}` 까지 — JSX prop 값 하나를 통째로 꺼낸다. */
function braced(src: string, openIdx: number): string {
  let depth = 0;
  for (let i = openIdx; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") {
      depth--;
      if (depth === 0) return src.slice(openIdx, i + 1);
    }
  }
  return src.slice(openIdx);
}

/** `leftSlot={...}` 은 footer 버튼이 아니라 좌측 임의 요소다 — 규격 밖이라 들어낸다. */
function withoutLeftSlot(expr: string): string {
  let out = expr;
  for (;;) {
    const at = out.indexOf("leftSlot={");
    if (at === -1) return out;
    const val = braced(out, at + "leftSlot=".length);
    out = out.slice(0, at) + out.slice(at + "leftSlot=".length + val.length);
  }
}

/** 주석 안의 예시 코드는 규격 위반이 아니다. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

/** `footer={...}` 의 값. `footer={Footer}` 처럼 이름만 있으면 그 `const` 정의를 따라간다. */
function footerExpressions(src: string): string[] {
  const out: string[] = [];
  for (const m of src.matchAll(/\bfooter=\{/g)) {
    const expr = braced(src, m.index + "footer=".length);
    const name = expr.slice(1, -1).trim();
    if (/^[A-Za-z_$][\w$]*$/.test(name)) {
      const decl = src.indexOf(`const ${name} =`);
      // 정의는 화살표·삼항·JSX 어느 모양이든 다음 `const`/함수 선언 전까지로 본다.
      if (decl !== -1) {
        const rest = src.slice(decl + 6);
        const end = rest.search(
          /\n(?: {2})?(?:const |function |return |export )/,
        );
        out.push(end === -1 ? rest : rest.slice(0, end));
        continue;
      }
    }
    out.push(expr);
  }
  return out;
}

const FILES = globSync("src/**/*.tsx", { cwd: process.cwd() })
  .map((p) => join(process.cwd(), p))
  .filter((p) => !p.endsWith(".test.tsx"));

describe("대화상자 footer 는 표준 위젯을 지난다", () => {
  it("footer prop 안에 <Button> 을 직접 놓은 곳이 없다", () => {
    const offenders: string[] = [];
    for (const file of FILES) {
      const src = readFileSync(file, "utf8");
      if (!src.includes("footer={")) continue;
      for (const expr of footerExpressions(src)) {
        if (/<Button[\s/>]/.test(withoutLeftSlot(expr))) {
          offenders.push(file.replace(`${process.cwd()}/`, ""));
          break;
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("leftSlot 의 ghost 버튼은 flush 를 쓴다", () => {
    // footer 왼쪽의 두 버튼은 규칙이 반대다 — 삭제는 dangerSoft **채움**이라 fill 이 이미
    // edge 까지 닿아 flush 가 필요 없고(modal-footer 가 그렇게 그린다), leftSlot 의
    // ghost+아이콘은 아이콘을 본문 콘텐츠 열에 맞춰야 해서 flush 를 쓴다(dialog.md footer).
    const offenders: string[] = [];
    for (const file of FILES) {
      const src = readFileSync(file, "utf8");
      if (!src.includes("leftSlot={")) continue;
      for (const m of src.matchAll(/\bleftSlot=\{/g)) {
        const expr = braced(src, m.index + "leftSlot=".length);
        if (!/variant="ghost"/.test(expr)) continue;
        if (!/flush="(left|right)"/.test(expr)) {
          offenders.push(file.replace(`${process.cwd()}/`, ""));
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("footer 규격은 modal-footer.tsx 한 곳에만 적혀 있다", () => {
    // `flush`(좌우 padding 0)는 footer 밖의 광학 정렬용이다 — footer 에서 쓰면
    // 글자가 여백선에 붙는다.
    const modalFooter = readFileSync(
      join(process.cwd(), "src/shared/ui/groo/modal-footer.tsx"),
      "utf8",
    );
    expect(stripComments(modalFooter)).not.toMatch(/flush=/);
  });
});
