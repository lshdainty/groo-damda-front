import { KRW } from "@/shared/lib/groo/format";
import { MaskAmount, WonUnit } from "@/shared/lib/groo/hide-amounts";
import { wonPre } from "@/shared/lib/groo/hide-amounts-core";

export type BalanceTooltipProps = {
  active?: boolean;
  payload?: {
    value?: number;
    payload?: { label?: string; weekStart?: string };
  }[];
  seriesLabel: string;
};

export function BalanceTooltip({
  active,
  payload,
  seriesLabel,
}: BalanceTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const first = payload[0];
  const val = Number(first?.value ?? 0);
  const label = first?.payload?.label ?? "";
  const weekStart = first?.payload?.weekStart ?? "";
  return (
    <div
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border-subtle)",
        borderRadius: "var(--radius-tile)",
        boxShadow: "var(--shadow-md)",
        padding: "8px 12px",
        fontSize: "var(--text-caption)",
        minWidth: 140,
      }}
    >
      <div
        style={{
          fontSize: "var(--text-badge)",
          color: "var(--fg-tertiary)",
          fontWeight: "600",
          marginBottom: 4,
        }}
      >
        {label}
        {weekStart && (
          <span style={{ marginLeft: 6 }}>· {weekStart.slice(5)}</span>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: "var(--radius-xs)",
            background: "var(--color-balance)",
          }}
        />
        <span
          style={{
            fontSize: "var(--text-badge)",
            color: "var(--fg-secondary)",
          }}
        >
          {seriesLabel}
        </span>
        <span
          className="num"
          style={{
            marginLeft: "auto",
            fontSize: "var(--text-caption)",
            fontWeight: "700",
          }}
        >
          <MaskAmount card="asset.detail">
            {wonPre()}
            {KRW(val)}
          </MaskAmount>
          <WonUnit card="asset.detail" />
        </span>
      </div>
    </div>
  );
}
