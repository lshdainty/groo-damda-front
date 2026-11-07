import { Eye, EyeOff } from "lucide-react";
import { Field } from "@/shared/ds/field";
import { Input } from "@/shared/ds/input";
import { Toggle } from "@/shared/ds/toggle";

/**
 * 자격증명 한 칸 — 기본은 가려져 있고 눈 단추(Toggle)로 잠깐 벗겨 본다.
 *
 * **API Key 도 Secret 과 같은 자격증명의 반쪽이다.** 한동안 Key 만 평문이라
 * 어깨너머로 읽혔다. 두 칸이 같은 컴포넌트를 쓰면 한쪽만 다시 벗겨지는 일이 안 생긴다.
 *
 * 라벨은 **서버가 준다**(`connection.keyLabel` / `secretLabel`) — 토스는 "Client ID",
 * 나무는 "App Key". 그래서 여기에 이름을 박지 않고 받는다.
 *
 * 보임 여부(`revealed`)는 **부르는 쪽이 든다** — 시트 ↔ 대화상자가 바뀌어 이 칸이 새로 그려져도 쓰던 값 · 눈이 남는다.
 * 눈 단추는 Toggle(보이는 40 · 누르는 44, toggle.md) — 이름은 고정("App Key 보기"), 켬은 aria-pressed, 가렸으면 eye-off.
 */
export function SecretField({
  label,
  value,
  onChange,
  revealed,
  onRevealedChange,
  toggleAriaLabel,
}: {
  /** 서버가 준 라벨 — 칸의 이름이다(자리 글은 두지 않는다). */
  label: string;
  value: string;
  onChange: (v: string) => void;
  revealed: boolean;
  onRevealedChange: (v: boolean) => void;
  /** 칸이 둘이라 토글 이름도 달라야 스크린리더가 구분한다. */
  toggleAriaLabel: string;
}) {
  return (
    <Field label={label}>
      <Input
        type={revealed ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        // 브라우저·확장에 자격증명이 남지 않게 — 붙여넣기는 그대로 둔다. 자리 글은 두지 않는다(라벨이 이름)
        autoComplete="off"
        spellCheck={false}
        suffixAction={
          <Toggle
            aria-label={toggleAriaLabel}
            pressed={revealed}
            onPressedChange={onRevealedChange}
            icon={<EyeOff aria-hidden />}
            pressedIcon={<Eye aria-hidden />}
          />
        }
      />
    </Field>
  );
}
