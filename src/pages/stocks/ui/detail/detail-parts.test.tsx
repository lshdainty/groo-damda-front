// 상세 매매 단추 · 안내 (I-13 20 · 21)
import { act } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}
const toastInfo = vi.hoisted(() => vi.fn());
vi.mock("sonner", () => ({ toast: { info: toastInfo, error: vi.fn() } }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string, o?: Record<string, unknown>) =>
      o?.name ? `${k}|${o.name}` : k,
  }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));

const { TradeTail, NamuNotice, InvestorBand, QuotesBand } =
  await import("./detail-parts");
let host: HTMLDivElement | null = null;
afterEach(() => {
  host?.remove();
  toastInfo.mockClear();
});
function mount(n: React.ReactNode) {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.appendChild(host);
  act(() => createRoot(host!).render(n));
  return host;
}

describe("매매 단추 — 국내 통념 색 + 주문 전이라 막힘(D3 B)", () => {
  it("매도 brandSolid · 매수 criticalSolid · large 48 · 한 줄에 반씩 · 사이 8", () => {
    const el = mount(<TradeTail isUs={false} />);
    const [sell, buy] = [...el.querySelectorAll("button")];
    expect(sell!.textContent).toBe("trade.sell");
    expect(sell!.className).toContain("bg-bg-brand-solid");
    expect(buy!.className).toContain("bg-bg-critical-solid");
    expect(sell!.className).toContain("min-h-[48px]");
    expect(sell!.className).toContain("flex-1");
    expect(sell!.parentElement!.className).toContain("gap-x2");
  });
  it("두 단추는 disabled 이고 스펙의 비활성 전용 색(bg-disabled · fg-disabled)을 쓴다", () => {
    const el = mount(<TradeTail isUs />);
    for (const b of el.querySelectorAll("button")) {
      expect(b.hasAttribute("disabled")).toBe(true);
      expect(b.className).toContain("disabled:bg-bg-disabled");
      expect(b.className).toContain("disabled:text-fg-disabled");
    }
  });
  it("이유 줄 '주문은 곧 열려요.' 가 있고 두 단추가 aria-describedby 로 잇는다", () => {
    const el = mount(<TradeTail isUs={false} />);
    const buttons = [...el.querySelectorAll("button")];
    const ids = buttons.map((b) => b.getAttribute("aria-describedby"));
    expect(ids[0]).toBeTruthy();
    expect(ids[1]).toBe(ids[0]);
    const reason = el.querySelector(`[id="${ids[0]}"]`)!;
    expect(reason.textContent).toBe("trade.pending");
  });
  it("눌러도 토스트가 뜨지 않는다", () => {
    const el = mount(<TradeTail isUs />);
    for (const b of el.querySelectorAll("button")) act(() => b.click());
    expect(toastInfo).not.toHaveBeenCalled();
  });
  it("수수료 안내는 시장에 따라 다르고 안내 두 줄이 있다", () => {
    const kr = mount(<TradeTail isUs={false} />).textContent!;
    expect(kr).toContain("fee.kr");
    expect(kr).toContain("disclaimer.line1");
    expect(kr).toContain("disclaimer.line2");
  });
});

describe("나무 상세 안내", () => {
  it("둘째 줄만 — 토스증권 문구(첫째 줄)가 없다", () => {
    const t = mount(<NamuNotice />).textContent;
    expect(t).toBe("disclaimer.line2");
  });
});

describe("투자자별 매매동향 폰 띠 (I-13b 22)", () => {
  const q = (data: unknown[] | undefined, extra = {}) => ({
    data: data as never,
    isPending: false,
    isError: false,
    refetch: () => {},
    ...extra,
  });
  const rowsOf = (individual: string | null, foreigner = "0", inst = "700") => [
    { date: "2026-10-23", individual, foreigner, institution: inst },
  ];

  it("줄 다섯 · 오른쪽 세 줄 · 순매수 ▲ · 순매도 ▼ · 부호 없음", () => {
    const rows = Array.from({ length: 6 }, (_, i) => ({
      date: `2026-10-${String(23 - i).padStart(2, "0")}`,
      individual: "-12345",
      foreigner: "5000",
      institution: "700",
    }));
    const el = mount(<InvestorBand q={q(rows)} />);
    expect(el.querySelectorAll("li").length).toBe(5);
    const first = el.querySelector("li")!.textContent!;
    expect(first).toContain("12,345");
    expect(first).not.toContain("-");
    expect(first).not.toContain("+");
  });
  it("null 은 '—' 만 · '변화 없음' 이 아니다 (H1 — 값 없음을 변화 없음이라 하지 않는다)", () => {
    const el = mount(<InvestorBand q={q(rowsOf(null))} />);
    const t = el.querySelector("li")!.textContent!;
    expect(t).toContain("—");
    expect(t).not.toContain("delta.flat");
    expect(t).not.toContain("변화 없음");
    expect(t).not.toContain("▲ —");
  });
  it("0 은 '0' 만 — 화살표도 '변화 없음' 도 없다", () => {
    const el = mount(<InvestorBand q={q(rowsOf("0", "0", "0"))} />);
    const t = el.querySelector("li")!.textContent!;
    expect(t).not.toContain("변화 없음");
    expect(t).not.toContain("▲");
    expect(t).not.toContain("▼");
    expect((t.match(/0/g) ?? []).length).toBeGreaterThanOrEqual(3);
    // 값 칸은 중립 보조색
    const zero = [...el.querySelectorAll("span")].find(
      (e) => e.children.length === 0 && e.textContent === "0",
    )!;
    expect(zero.className).toContain("text-fg-neutral-subtle");
  });
  it("순매수 · 순매도 값 칸은 방향 역할 색(▲ critical · ▼ informative)", () => {
    const el = mount(<InvestorBand q={q(rowsOf("12345", "-9876", "700"))} />);
    const html = el.innerHTML;
    expect(html).toContain("text-fg-critical");
    expect(html).toContain("text-fg-informative");
  });
  it("빈 목록은 안내 줄", () => {
    const el = mount(<InvestorBand q={q([])} />);
    expect(el.textContent).toContain("investor.empty");
  });
  it("아직 시작 전(isPending)이면 '없어요' 가 아니라 Skeleton (M1)", () => {
    const el = mount(<InvestorBand q={q(undefined, { isPending: true })} />);
    expect(el.textContent).not.toContain("investor.empty");
    expect(el.querySelector("[aria-busy]")).not.toBeNull();
  });
  it("실패(받아 둔 값 없음)는 실패 한 벌, 받아 둔 값이 있으면 그 값 그대로", () => {
    const failed = mount(<InvestorBand q={q(undefined, { isError: true })} />);
    expect(failed.textContent).toContain("investor.failTitle");
    const stale = mount(
      <InvestorBand q={q(rowsOf("100"), { isError: true })} />,
    );
    expect(stale.textContent).not.toContain("investor.failTitle");
    expect(stale.textContent).toContain("100");
  });
});

describe("호가 · 체결 — 나무는 칸이 비어 올 수 있다 (M4)", () => {
  const book = (asks: unknown[], bids: unknown[]) => ({
    data: { timestamp: null, currency: "KRW", asks, bids } as never,
    isPending: false,
    isError: false,
    refetch: () => {},
  });
  const render = (b: ReturnType<typeof book>) =>
    mount(
      <QueryClientProvider client={new QueryClient()}>
        <QuotesBand
          broker="NAMU"
          market="KR"
          symbol="A"
          currency="KRW"
          lastPrice={1000}
          changePct={null}
          namuBook={b}
        />
      </QueryClientProvider>,
    );
  it("가격이 null 인 줄은 그리지 않고, 수량이 null 이면 '—' · 막대 폭 0 — NaN 이 없다", () => {
    const el = render(
      book(
        [
          { price: null, volume: "10" },
          { price: "1010", volume: null },
        ],
        [{ price: "990", volume: "20" }],
      ),
    );
    const html = el.innerHTML;
    expect(html).not.toContain("NaN");
    expect(el.textContent).toContain("1,010원");
    expect(el.textContent).toContain("—");
    expect(el.textContent).toContain("990원");
    const bars = [...el.querySelectorAll("span[aria-hidden]")] as HTMLElement[];
    expect(bars.some((b) => b.style.width === "0%")).toBe(true);
    expect(bars.every((b) => !b.style.width.includes("NaN"))).toBe(true);
  });
  it("잔량은 쉼표 뒤 <wbr> 로만 줄을 바꾸고 말줄임 · 폭 0 칸을 쓰지 않는다 — 글자를 줄이지 않는다(DESIGN.md 돈)", () => {
    const el = render(
      book(
        [{ price: "1010", volume: "12345678" }],
        [{ price: "990", volume: "1234567" }],
      ),
    );
    expect(el.querySelectorAll("tbody td wbr").length).toBeGreaterThanOrEqual(
      2,
    );
    expect(el.textContent).toContain("12,345,678");
    expect(el.textContent).toContain("1,234,567");
    expect(el.innerHTML).not.toContain("truncate");
    expect(el.innerHTML).not.toContain("max-w-0");
    expect(el.innerHTML).not.toContain("text-ellipsis");
  });
  it("모든 칸이 null 이면 '호가 정보가 없어요'", () => {
    const el = render(book([{ price: null, volume: null }], []));
    expect(el.textContent).toContain("quotes.orderbookEmpty");
    expect(el.innerHTML).not.toContain("NaN");
  });
  it("호가 질의 값이 아직 없으면(isPending) 기다림", () => {
    const el = render({
      data: undefined as never,
      isPending: true,
      isError: false,
      refetch: () => {},
    });
    expect(el.textContent).not.toContain("quotes.orderbookEmpty");
    expect(el.querySelector("[aria-busy]")).not.toBeNull();
  });
});
