// 같은 쿼리 키를 참조(사이드바)와 주 데이터(화면)로 함께 읽을 때 — Query.meta 는 마지막 관찰자 것으로 덮이므로
// 참조 판정은 그 질의를 보는 관찰자 전체로 한다(I-wrap-b6 나.5-b 해법 B).
import {
  QueryClientProvider,
  focusManager,
  useQuery,
} from "@tanstack/react-query";
import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { createAppQueryClient } from "@/app/providers/query-client";
import { REFERENCE_META, isReferenceObserved } from "@/shared/api/reference";
import {
  onRefreshFailure,
  shouldNotifyRefreshFailure,
} from "@/shared/api/refresh-failure";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let mode: "ok" | "fail" = "ok";
const fn = async () => {
  await Promise.resolve();
  if (mode === "fail") throw new Error("boom");
  return { v: 1 };
};
const mkClient = () => {
  const qc = createAppQueryClient();
  qc.setDefaultOptions({
    queries: { staleTime: 0, retry: false, refetchOnWindowFocus: true },
  });
  return qc;
};
const Ref = ({ k }: { k: string }) => {
  useQuery({ queryKey: [k], queryFn: fn, meta: REFERENCE_META });
  return null;
};
const Primary = ({ k }: { k: string }) => {
  useQuery({ queryKey: [k], queryFn: fn });
  return null;
};
const wrap = (qc: ReturnType<typeof mkClient>, ui: ReactNode) => (
  <QueryClientProvider client={qc}>{ui}</QueryClientProvider>
);
const flush = () =>
  act(async () => {
    await new Promise((r) => setTimeout(r, 20));
  });
const mount = (ui: ReactNode) => {
  const root = createRoot(document.createElement("div"));
  act(() => root.render(ui));
  return {
    rerender: (u: ReactNode) => act(() => root.render(u)),
    unmount: () => act(() => root.unmount()),
  };
};

afterEach(() => {
  mode = "ok";
});

describe("참조 판정은 관찰자별", () => {
  it("사이드바(참조)가 값을 들고 화면(주)이 뒤에 붙은 채 탭 복귀 재조회가 실패하면 새로 고침 실패 알림이 1회", async () => {
    const qc = mkClient();
    let notices = 0;
    const off = onRefreshFailure(() => {
      notices += 1;
    });
    const { rerender, unmount } = mount(wrap(qc, <Ref k="a" />));
    await flush();
    rerender(
      wrap(
        qc,
        <>
          <Ref k="a" />
          <Primary k="a" />
        </>,
      ),
    );
    await flush();
    mode = "fail";
    await act(async () => {
      focusManager.setFocused(false);
      focusManager.setFocused(true);
      await new Promise((r) => setTimeout(r, 30));
    });
    off();
    unmount();
    expect(notices).toBe(1);
  });

  it("화면(주)이 값 없이 실패한 채 참조 시트가 뒤늦게 붙어도 참조 실패 이벤트는 0", async () => {
    mode = "fail";
    const qc = mkClient();
    let refErrors = 0;
    qc.getQueryCache().subscribe((e) => {
      if (
        e.type === "updated" &&
        e.action.type === "error" &&
        isReferenceObserved(e.query) &&
        e.query.state.data === undefined
      )
        refErrors += 1;
    });
    const { rerender, unmount } = mount(wrap(qc, <Primary k="b" />));
    await flush();
    rerender(
      wrap(
        qc,
        <>
          <Primary k="b" />
          <Ref k="b" />
        </>,
      ),
    );
    await flush();
    unmount();
    expect(refErrors).toBe(0);
  });

  describe("관찰자 조합 진리표", () => {
    const query = (
      metas: (Record<string, unknown> | undefined)[],
      ownMeta: Record<string, unknown> | undefined,
    ) => ({
      meta: ownMeta,
      observers: metas.map((meta) => ({ options: { meta } })),
    });
    const ref = REFERENCE_META;
    it.each([
      ["참조만", [ref], undefined, true],
      ["참조 둘", [ref, ref], undefined, true],
      ["주만", [undefined], ref, false],
      ["참조 + 주 (meta 가 참조로 덮여도)", [ref, undefined], ref, false],
      ["주 + 참조 (meta 가 주로 덮여도)", [undefined, ref], undefined, false],
    ])("%s", (_n, metas, own, expected) => {
      expect(isReferenceObserved(query(metas, own))).toBe(expected);
    });
    it("관찰자 없음 — 질의 자신의 meta 를 따른다", () => {
      expect(isReferenceObserved(query([], ref))).toBe(true);
      expect(isReferenceObserved(query([], undefined))).toBe(false);
      expect(isReferenceObserved({ meta: ref })).toBe(true);
    });
    it("새로 고침 실패 알림 판정에도 반영된다", () => {
      const q = (metas: (Record<string, unknown> | undefined)[]) => ({
        ...query(metas, ref),
        queryHash: "h",
        state: { data: { v: 1 } },
        getObserversCount: () => metas.length,
      });
      const err = new Error("x");
      expect(shouldNotifyRefreshFailure(err, q([ref]))).toBe(false);
      expect(shouldNotifyRefreshFailure(err, q([ref, undefined]))).toBe(true);
    });
  });
});
