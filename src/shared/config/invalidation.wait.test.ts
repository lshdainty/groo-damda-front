// `invalidateFor` 의 기다리기 옵션 — 일정 저장 · 삭제 뒤 상세가 옛 값을 보이지 않게(I-09b W4). 옵션이 없으면 예전 그대로(기다리지 않는다).
import type { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";

import { INVALIDATION_MAP, invalidateFor } from "./invalidation";

function fakeClient() {
  const resolvers: (() => void)[] = [];
  const keys: unknown[] = [];
  const client = {
    invalidateQueries: ({ queryKey }: { queryKey: unknown }) => {
      keys.push(queryKey);
      return new Promise<void>((resolve) => resolvers.push(resolve));
    },
  } as unknown as QueryClient;
  return { client, resolvers, keys };
}

describe("invalidateFor { wait: true }", () => {
  it("표가 가리키는 키마다 비우고, 다시 받기가 모두 끝나야 약속이 풀린다", async () => {
    const { client, resolvers, keys } = fakeClient();
    let done = false;
    const p = invalidateFor(client, "calendar-event", { wait: true }).then(
      () => {
        done = true;
      },
    );
    expect(keys).toHaveLength(INVALIDATION_MAP["calendar-event"].length);
    await Promise.resolve();
    expect(done).toBe(false);
    resolvers.slice(0, -1).forEach((r) => r());
    await Promise.resolve();
    expect(done).toBe(false);
    resolvers[resolvers.length - 1]!();
    await p;
    expect(done).toBe(true);
  });

  it("옵션이 없으면 기다리지 않고 아무것도 돌려주지 않는다 — 다른 호출처는 그대로", () => {
    const { client, keys } = fakeClient();
    const ret = invalidateFor(client, "calendar-event");
    expect(ret).toBeUndefined();
    expect(keys).toHaveLength(INVALIDATION_MAP["calendar-event"].length);
  });
});
