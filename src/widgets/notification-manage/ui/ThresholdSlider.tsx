import { Slider } from "@/shared/ui/slider";

/**
 * 예산 경고 기준 슬라이더 — 끄는 값(`value`)을 부르는 쪽이 쥐고 있어 머리 값 · 채움 · 손잡이가 함께 따라간다.
 * 손을 뗄 때(onValueCommit) 한 번 저장한다. 요청 중에도 막지 않는다(스펙 slider.yaml "끄는 동안은 화면(채움 · 손잡이 · 머리 값 · 말풍선)만
 * 따라가고 손을 뗄 때 한 번 저장 · 요청 중에도 막지 않는다", 사용자 결정 2026-10-09) — 막힘은 불러오는 동안(`disabled`)만이다.
 */
export function ThresholdSlider({
  value,
  disabled,
  onDrag,
  onCommit,
  describedBy,
  labelledBy,
}: {
  /** 지금 보이는 값 — 끄는 동안은 끄는 값, 아니면 서버 값 */
  value: number;
  disabled?: boolean;
  /** 끄는 동안 값이 바뀔 때마다(화면만 따라간다) */
  onDrag: (next: number) => void;
  /** 손을 뗄 때 한 번 */
  onCommit: (next: number) => void;
  /** 오류 글의 id — 손잡이(role=slider)가 설명으로 읽는다 */
  describedBy?: string;
  /** 머리 글("경고로 표시할 사용률")의 id — 손잡이의 이름 */
  labelledBy?: string;
}) {
  return (
    <Slider
      min={50}
      max={100}
      step={5}
      // 눈금 점은 두지 않는다 — 양 끝 표식(50% · 100%)만(I-15 50)
      value={[value]}
      onValueChange={([v]) => onDrag(v!)}
      onValueCommit={([v]) => onCommit(v!)}
      disabled={disabled}
      aria-describedby={describedBy}
      aria-labelledby={labelledBy}
    />
  );
}
