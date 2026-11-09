import { useEffect, useState } from "react";
import {
  DESKTOP_QUERY,
  TABLET_QUERY,
  detect,
  type DeviceSize,
} from "./viewport";

export type { DeviceSize };

export function useDeviceSize(): DeviceSize {
  const [size, setSize] = useState<DeviceSize>(detect());
  useEffect(() => {
    if (
      typeof window === "undefined" ||
      typeof window.matchMedia !== "function"
    )
      return;
    // matchMedia 는 브레이크포인트 경계를 실제로 넘을 때만 발화 → 스크롤바(±15px) 진동으로
    // resize 가 연달아 떠도 카테고리(mobile/tablet/desktop)가 흔들리지 않는다.
    const tabletMql = window.matchMedia(TABLET_QUERY);
    const desktopMql = window.matchMedia(DESKTOP_QUERY);
    // 값이 실제로 바뀔 때만 setState — 동일 카테고리면 no-op(리마운트 유발 안 함).
    const onChange = () =>
      setSize((prev) => {
        const next = detect();
        return next === prev ? prev : next;
      });
    tabletMql.addEventListener("change", onChange);
    desktopMql.addEventListener("change", onChange);
    // 마운트 시점 실제 값 동기화(초기 state 이후 폭이 바뀌었을 수 있음).
    onChange();
    return () => {
      tabletMql.removeEventListener("change", onChange);
      desktopMql.removeEventListener("change", onChange);
    };
  }, []);
  return size;
}
