import { afterEach, describe, expect, it } from "vitest";

import { captureAnchor, focusOpener } from "./overlay-utils";

// 닫힌 뒤 초점 — 연 자리(트리거 · 열 때 초점이 있던 곳)가 사라졌으면 그 줄 → 목록 머리 → main (alert-dialog.md 닫힌 뒤)

afterEach(() => {
  document.body.innerHTML = "";
});

function page() {
  document.body.innerHTML = `
    <main>
      <section>
        <h2 id="head">자주 쓰는 거래</h2>
        <ul id="list">
          <li id="row1"><span>점심</span><button id="menu1">더보기</button></li>
          <li id="row2"><span>커피</span><button id="menu2">더보기</button></li>
        </ul>
      </section>
    </main>`;
  const $ = (id: string) => document.getElementById(id)!;
  return { $ };
}

describe("focusOpener — 연 자리가 남아 있으면 거기로", () => {
  it("트리거가 문서에 있으면 트리거로 간다(옛 동작 그대로)", () => {
    const { $ } = page();
    focusOpener($("menu1"), captureAnchor($("menu2")));
    expect(document.activeElement).toBe($("menu1"));
  });

  it("트리거가 없고 열 때 초점이 있던 곳이 남아 있으면 그곳으로", () => {
    const { $ } = page();
    focusOpener(null, captureAnchor($("menu2")));
    expect(document.activeElement).toBe($("menu2"));
  });

  it("옛 호출(요소만 줌)도 같다", () => {
    const { $ } = page();
    focusOpener(null, $("menu2"));
    expect(document.activeElement).toBe($("menu2"));
  });
});

describe("focusOpener — 연 자리가 사라졌으면 그 줄 → 목록 머리 → main", () => {
  it("연 자리(⋮)만 사라지고 줄이 남았으면 줄 안의 첫 초점 가능한 곳", () => {
    const { $ } = page();
    $("row1").insertAdjacentHTML(
      "beforeend",
      '<a href="#x" id="link1">열기</a>',
    );
    const anchor = captureAnchor($("menu1"));
    $("menu1").remove();
    focusOpener($("menu1"), anchor);
    expect(document.activeElement).toBe($("link1"));
  });

  it("줄 안에 초점 가능한 곳이 없으면 줄 자체에(tabindex -1)", () => {
    const { $ } = page();
    const anchor = captureAnchor($("menu1"));
    $("menu1").remove();
    focusOpener(null, anchor);
    expect(document.activeElement).toBe($("row1"));
    expect($("row1").getAttribute("tabindex")).toBe("-1");
  });

  it("줄이 지워졌으면 목록 머리(제목)로", () => {
    const { $ } = page();
    const anchor = captureAnchor($("menu1"));
    $("row1").remove();
    focusOpener($("menu1"), anchor);
    expect(document.activeElement).toBe($("head"));
  });

  it("머리도 없으면 main 으로", () => {
    const { $ } = page();
    const anchor = captureAnchor($("menu1"));
    $("row1").remove();
    $("head").remove();
    focusOpener(null, anchor);
    expect(document.activeElement).toBe(document.querySelector("main"));
  });

  it("줄 둘레를 잡지 못했어도(줄 밖에서 열었다) main 으로 빠진다 — body 로 떨어지지 않는다", () => {
    page();
    const orphan = document.createElement("button");
    document.querySelector("main")!.appendChild(orphan);
    const anchor = captureAnchor(orphan);
    orphan.remove();
    focusOpener(null, anchor);
    expect(document.activeElement).toBe(document.querySelector("main"));
  });

  it("표는 표 머리(thead)로", () => {
    document.body.innerHTML = `
      <main><table><thead id="thead"><tr><th>이름</th></tr></thead>
        <tbody><tr id="r1"><td><button id="b1">⋮</button></td></tr></tbody></table></main>`;
    const anchor = captureAnchor(document.getElementById("b1"));
    document.getElementById("r1")!.remove();
    focusOpener(null, anchor);
    expect(document.activeElement).toBe(document.getElementById("thead"));
  });

  it("List 는 list-header 로", () => {
    document.body.innerHTML = `
      <main><div data-slot="list"><div data-slot="list-header" id="lh">목록</div>
        <ul><li data-slot="list-item" id="it1"><button id="b1">⋮</button></li></ul></div></main>`;
    const anchor = captureAnchor(document.getElementById("b1"));
    document.getElementById("it1")!.remove();
    focusOpener(null, anchor);
    expect(document.activeElement).toBe(document.getElementById("lh"));
  });
});
