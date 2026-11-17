import { ChevronRight, Plus } from "lucide-react";

import { DemoBlock, DemoRow, Specimen } from "@/shared/ds/catalog/DemoKit";

import { Button } from "./button";

const VARIANTS = [
  "brandSolid",
  "neutralSolid",
  "neutralWeak",
  "criticalSolid",
  "brandOutline",
  "neutralOutline",
  "ghost",
] as const;
const SIZES = ["xsmall", "small", "medium", "large"] as const;
const GHOST_COLORS = ["neutral", "neutralSubtle", "brand", "critical"] as const;
// 검사기가 올리고 · 누르고 · 탭해서 재는 상태와, 그대로 그리는 상태
const STATES = [
  "enabled",
  "hovered",
  "pressed",
  "focused",
  "loading",
  "disabled",
] as const;

/** 카탈로그(/dev/ds) — 변형 × 크기 × 배치, ghost 글자색, 상태, 가장자리 맞춤 */
export const ButtonDemo = () => (
  <div className="flex flex-col gap-x8">
    <DemoBlock title="변형 × 크기 — 글자(앞 아이콘) · 아이콘만">
      {VARIANTS.map((variant) => (
        <DemoRow key={variant} label={variant}>
          {SIZES.map((size) => (
            <Specimen
              key={size}
              spec="button"
              combo={{ variant, size, layout: "withText" }}
            >
              <Button variant={variant} size={size}>
                <Plus aria-hidden />
                추가
              </Button>
            </Specimen>
          ))}
          {SIZES.map((size) => (
            <Specimen
              key={`${size}-icon`}
              spec="button"
              combo={{ variant, size, layout: "iconOnly" }}
            >
              <Button
                variant={variant}
                size={size}
                layout="iconOnly"
                aria-label="추가"
              >
                <Plus aria-hidden />
              </Button>
            </Specimen>
          ))}
        </DemoRow>
      ))}
    </DemoBlock>

    <DemoBlock title="ghost 글자색 — 배경 · 누름은 ghost 그대로">
      <DemoRow label="ghostColor">
        {GHOST_COLORS.map((ghostColor) => (
          <Specimen
            key={ghostColor}
            spec="button"
            combo={{
              variant: "ghost",
              size: "medium",
              layout: "withText",
              ghostColor,
            }}
          >
            <Button variant="ghost" ghostColor={ghostColor}>
              {ghostColor}
              <ChevronRight aria-hidden />
            </Button>
          </Specimen>
        ))}
      </DemoRow>
    </DemoBlock>

    <DemoBlock title="상태 — 올림 · 누름 · 키보드 포커스는 직접 해 본다(검사기는 실제로 올리고 누른다)">
      {VARIANTS.map((variant) => (
        <DemoRow key={variant} label={variant}>
          {STATES.map((state) => (
            <Specimen
              key={state}
              spec="button"
              combo={{ variant, size: "medium", layout: "withText" }}
              state={state}
            >
              <Button
                variant={variant}
                loading={state === "loading"}
                disabled={state === "disabled"}
              >
                {state}
              </Button>
            </Specimen>
          ))}
        </DemoRow>
      ))}
    </DemoBlock>

    {/* 대상은 ghost + 앞 아이콘뿐이다 — 글자만 있는 ghost 에는 쓰지 않는다(button.md "가장자리 맞춤") */}
    <DemoBlock title="가장자리 맞춤(flush) — 그 방향 가로 여백만 0, ghost 는 글자색으로만 반응한다">
      <DemoRow label="flush">
        <Button variant="ghost" flush="left">
          <Plus aria-hidden />
          왼쪽 맞춤
        </Button>
        <Button variant="ghost" flush="right">
          <Plus aria-hidden />
          오른쪽 맞춤
        </Button>
      </DemoRow>
    </DemoBlock>
  </div>
);
