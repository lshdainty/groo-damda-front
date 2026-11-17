import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AppRoot } from "@/app";
import { installChunkReload } from "@/app/chunk-reload";
import { trackInputModality } from "@/shared/lib/input-modality";
import "./index.css";
import "./shared/styles/groo.css";

// 초점 링은 키보드로 왔을 때만 — 스크립트가 옮긴 초점도 직전 입력이 포인터면 링을 그리지 않는다(index.css focus-visible)
trackInputModality();

// 새 배포 직후 옛 화면 코드 조각 404 — 한 번 새로 고쳐 새 조각을 받는다(app/chunk-reload.ts)
installChunkReload();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppRoot />
  </StrictMode>,
);
