import path from "path";
import { defineConfig } from "vitest/config";

// vite.config.ts 를 그대로 쓰지 않는다 — 테스트엔 tailwind/react 플러그인이 필요 없고,
// 빌드 설정을 테스트 사정으로 흔들지 않으려는 것도 있다. alias 만 맞추면 된다.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "jsdom",
    // 레포 설정을 검사하는 테스트는 src 밖에 둔다 — 안에 두면 FSD 게이트가
    // 그 파일까지 어느 계층으로 분류하려 든다.
    include: ["src/**/*.test.{ts,tsx}", "tests/**/*.test.ts"],
    // 언어 한국어 고정 · jsdom 에 없는 API 를 채운다 — 까닭은 파일 머리에
    setupFiles: ["./tests/vitest.setup.ts"],
  },
});
