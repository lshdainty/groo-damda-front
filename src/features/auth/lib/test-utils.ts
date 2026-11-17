// 로그인 · 로그아웃 테스트가 같이 쓰는 도우미 — 최상위 이동(`window.location.href = …`)을 잰다.
// jsdom 은 주소 이동을 하지 않는다. 쓰기만 가로채고 읽기(origin · pathname · search)는 실제 주소 그대로다.
import { vi } from "vitest";

export function captureLocationHref() {
  const real = window.location;
  const sets: string[] = [];
  const fake = {
    get origin() {
      return real.origin;
    },
    get pathname() {
      return real.pathname;
    },
    get search() {
      return real.search;
    },
    get href() {
      return real.href;
    },
    set href(value: string) {
      sets.push(value);
    },
  } as unknown as Location;
  const spy = vi.spyOn(window, "location", "get").mockReturnValue(fake);
  return {
    /** 이동하려던 주소들 — 순서대로 */
    sets,
    /** 마지막으로 이동하려던 주소 */
    last: () => sets[sets.length - 1],
    restore: () => spy.mockRestore(),
  };
}
