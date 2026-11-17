import tailwindcss from "@tailwindcss/vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import babel from "@rolldown/plugin-babel";
import path from "path";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    react(),
    // React Compiler — 렌더 결과를 자동으로 메모이즈한다. 손으로 `useMemo`/`useCallback`
    // 을 다는 자리를 컴파일러가 대신 판단한다. 892 곳 중 841 곳(94%)이 적용된다.
    //
    // **비용은 첫 화면이 아니라 라우트에 붙는다.** 실측(gzip):
    //   초기 로딩  405 KB → 406 KB   (+1 KB)
    //   전체       1,012 KB → 1,229 KB (+217 KB, 전부 지연 로딩 청크)
    //   라우트당   +4.5 ~ 17 KB (SettingsPage 만 +56 KB)
    //
    // 217 KB 는 전부 컴파일러가 넣은 메모이제이션 코드다 — babel 을 그대로 돌리되
    // 컴파일만 끄면(`compilationMode: "annotation"`) 1,012 KB 로 기준선과 같았다.
    // 파이프라인 자체는 공짜라, 무거우면 켜고 끄는 게 아니라 이 옵션 하나만 보면 된다.
    //
    // rolldown 을 쓰므로 vite 의 babel 훅이 아니라 이 플러그인을 통해 물린다.
    babel({ presets: [reactCompilerPreset()] }),
    tailwindcss(),
  ],
  server: {
    // host 는 적지 않는다 — 기본값(localhost)이어야 같은 네트워크의 다른 기기가 개발 서버에
    // 닿지 못한다. 실제 기기로 볼 때만 `npm run dev:host` 로 연다.
    port: 3002,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    target: "es2020",
    rollupOptions: {
      output: {
        manualChunks(id) {
          // lucide 개별 아이콘(1892개) 을 단일 청크로 병합 → 요청 폭주 차단
          if (id.includes("lucide-react/dist/esm/icons/"))
            return "lucide-icons";
        },
      },
    },
  },
});
