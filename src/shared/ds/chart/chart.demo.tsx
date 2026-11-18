import { niceValueAxis } from "@/shared/lib/groo/axisWidth";
import { useState, type ReactNode } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";
import { ReceiptText } from "lucide-react";

import { DemoBlock, DemoRow, Specimen } from "@/shared/ds/catalog/DemoKit";
import { ResultSection } from "@/shared/ds/result-section";
import { Skeleton } from "@/shared/ds/skeleton";

import {
  Chart,
  ChartDataTable,
  ChartDonutCenter,
  ChartDonutLegend,
  ChartLegendTiles,
  ChartTooltip,
  ChartTooltipContent,
} from "./chart";
import {
  ChartHeatmap,
  type ChartHeatmapColumn,
  type ChartHeatmapRow,
} from "./chart-heatmap";
import { chartXAxisProps } from "./chart-x-axis";
import {
  assignChartColors,
  chartAxisProps,
  chartDonutRadii,
  chartGridProps,
  formatAxisWon,
  formatWon,
  type ChartColor,
} from "./chart-variants";

// 카드 본문 자리 — Card 가 아직 없어 면 · 모서리 16 · 여백 24 로 감싼다(스펙: 차트는 카드 본문 안에 둔다)
const CardBody = ({
  children,
  width,
}: {
  children: ReactNode;
  width?: number;
}) => (
  <div
    className="rounded-r4 border border-stroke-neutral-weak bg-bg-layer-default p-x6"
    style={{ width }}
  >
    {children}
  </div>
);

const PALETTE: ChartColor[] = [
  "blue",
  "green",
  "orange",
  "violet",
  "pink",
  "indigo",
  "red",
  "yellow",
  "brown",
  "gray",
];

const day = (n: number) => `${n}일`;
const headDay = (label: React.ReactNode) => `10월 ${String(label)}`;

// 오늘(8일)에서 끝나는 날짜별 수입 · 지출 — 오늘 뒤는 0 으로 채우지 않는다
type Row = { day: string; income: number; expense: number };

const DAYS: Row[] = (
  [
    [0, 18000],
    [4200000, 36000],
    [0, 12000],
    [120000, 86400],
    [0, 54000],
    [35000, 9800],
    [0, 41000],
    [86000, 64500],
  ] as const
).map(([income, expense], i) => ({
  day: day(i + 1),
  income,
  expense,
}));

const sumOf = (rows: { income: number; expense: number }[]) => ({
  income: rows.reduce((a, r) => a + r.income, 0),
  expense: rows.reduce((a, r) => a + r.expense, 0),
});

/** 수입 · 지출 추이 — 지표 타일 + 이중 축 선(영역) 차트. 타일을 누르면 계열이 켜지고 꺼진다 */
const Trend = ({
  data,
  dual = true,
  height = 200,
  specState,
  label,
  id,
  unit = formatAxisWon,
}: {
  data: Row[];
  dual?: boolean;
  height?: number;
  specState?: string;
  label?: string;
  id: string;
  unit?: (v: number, ticks: readonly number[]) => string;
}) => {
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const total = sumOf(data);
  return (
    <>
      <ChartLegendTiles
        id={id}
        items={[
          {
            key: "income",
            label: "수입",
            color: "blue",
            total: formatWon(total.income),
          },
          {
            key: "expense",
            label: "지출",
            color: "red",
            total: formatWon(total.expense),
          },
        ]}
        hidden={hidden}
        onHiddenChange={setHidden}
      />
      <Specimen
        spec="chart"
        combo={{ kind: "line", axis: dual ? "dual" : "single" }}
        state={specState}
      >
        <Chart
          label={
            label ??
            `10월 수입 · 지출 추이, 수입 ${formatWon(total.income)} · 지출 ${formatWon(total.expense)}`
          }
          legendId={id}
          height={height}
        >
          <AreaChart data={data}>
            <CartesianGrid {...chartGridProps} yAxisId="income" />
            <XAxis
              dataKey="day"
              {...chartXAxisProps(data.map((d) => ({ label: d.day })))}
            />
            <YAxis
              yAxisId="income"
              {...niceValueAxis(
                data.flatMap((d) =>
                  dual ? [d.income] : [d.income, d.expense],
                ),
                unit,
              )}
              {...chartAxisProps(dual ? { color: "blue" } : {})}
            />
            {dual && (
              <YAxis
                yAxisId="expense"
                orientation="right"
                {...niceValueAxis(
                  data.map((d) => d.expense),
                  unit,
                )}
                {...chartAxisProps({ color: "red" })}
              />
            )}
            <ChartTooltip
              content={
                <ChartTooltipContent
                  headFormatter={headDay}
                  valueFormatter={(v) => formatWon(Number(v))}
                />
              }
            />
            {!hidden.has("income") && (
              <Area
                yAxisId="income"
                dataKey="income"
                name="수입"
                stroke="var(--color-chart-blue)"
              />
            )}
            {!hidden.has("expense") && (
              <Area
                yAxisId={dual ? "expense" : "income"}
                dataKey="expense"
                name="지출"
                stroke="var(--color-chart-red)"
              />
            )}
          </AreaChart>
        </Chart>
      </Specimen>
    </>
  );
};

const WEEKS = [
  { week: "1주", income: 4200000, expense: 310000 },
  { week: "2주", income: 0, expense: 450000 },
  { week: "3주", income: 120000, expense: 280000 },
  { week: "4주", income: 86000, expense: 200000 },
];

/** 기간별 합 — 막대(같은 단위 두 계열이라 축 하나) */
const Bars = ({
  data,
  label,
  id,
  net = false,
}: {
  data: { week: string; income: number; expense: number }[];
  label: string;
  id: string;
  net?: boolean;
}) => {
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const total = data.reduce(
    (a, r) => ({ income: a.income + r.income, expense: a.expense + r.expense }),
    { income: 0, expense: 0 },
  );
  return (
    <>
      <ChartLegendTiles
        id={id}
        items={[
          {
            key: "income",
            label: "수입",
            color: "blue",
            total: formatWon(total.income),
          },
          {
            key: "expense",
            label: "지출",
            color: "red",
            total: formatWon(total.expense),
          },
        ]}
        hidden={hidden}
        onHiddenChange={setHidden}
      />
      <Specimen spec="chart" combo={{ kind: "bar" }}>
        <Chart label={label} legendId={id} height={200}>
          <BarChart data={data} barGap={4}>
            <CartesianGrid {...chartGridProps} />
            <XAxis
              dataKey="week"
              {...chartXAxisProps(data.map((d) => ({ label: d.week })))}
            />
            <YAxis
              {...niceValueAxis(
                data.flatMap((d) => [d.income, d.expense]),
                formatAxisWon,
              )}
              {...chartAxisProps()}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  valueFormatter={(v) => formatWon(Number(v))}
                />
              }
            />
            {!hidden.has("income") && (
              <Bar
                dataKey="income"
                name="수입"
                fill="var(--color-chart-blue)"
                radius={net ? [4, 4, 4, 4] : undefined}
              />
            )}
            {!hidden.has("expense") && (
              <Bar
                dataKey="expense"
                name="지출"
                fill="var(--color-chart-red)"
              />
            )}
          </BarChart>
        </Chart>
      </Specimen>
    </>
  );
};

type Category = {
  id: string;
  name: string;
  amount: number;
  saved?: ChartColor;
  hasChildren?: boolean;
};

const CATEGORIES: Category[] = [
  { id: "food", name: "식비", amount: 384400, hasChildren: true },
  { id: "traffic", name: "교통", amount: 212000, hasChildren: true },
  { id: "event", name: "경조사", amount: 150000, saved: "red" },
  { id: "sub", name: "구독", amount: 96000 },
  { id: "health", name: "의료", amount: 54000 },
  { id: "shop", name: "쇼핑", amount: 31000 },
];

const MANY: Category[] = [
  ...CATEGORIES,
  { id: "c7", name: "문화", amount: 28000 },
  { id: "c8", name: "여행", amount: 24000 },
  { id: "c9", name: "교육", amount: 21000 },
  { id: "c10", name: "반려동물", amount: 15000 },
  { id: "c11", name: "육아", amount: 12000 },
  { id: "c12", name: "기부", amount: 9000 },
];

/** 카테고리 도넛 — 가운데 합계 + 목록 범례. 저장된 색 먼저, 색 없는 항목은 쓰지 않은 색부터, 10개를 넘으면 상위 9 + 회색 기타 */
const Donut = ({
  items,
  label,
  id,
  size = 160,
  title = "10월 지출",
  specState,
}: {
  items: Category[];
  label: string;
  id: string;
  size?: number;
  title?: string;
  specState?: string;
}) => {
  const [fits, setFits] = useState(true);
  const slices = assignChartColors(items, {
    colorOf: (c) => c.saved,
    groupOthers: (rest) => ({
      id: "others",
      name: "기타",
      amount: rest.reduce((a, c) => a + c.amount, 0),
    }),
  });
  const total = items.reduce((a, c) => a + c.amount, 0);
  const totalText = formatWon(total);
  return (
    <div className="flex flex-col">
      {!fits && (
        <p
          data-slot="chart-donut-total"
          className="mb-x2 text-t5 font-bold tabular-nums text-fg-neutral"
        >
          {title} {totalText}
        </p>
      )}
      <Specimen spec="chart" combo={{ kind: "donut" }} state={specState}>
        <Chart label={label} legendId={id} height={size}>
          <PieChart>
            <Pie
              data={slices}
              dataKey="amount"
              nameKey="name"
              {...chartDonutRadii(size)}
              isAnimationActive={false}
            />
          </PieChart>
          <ChartDonutCenter
            label={title}
            amount={totalText}
            onFitChange={setFits}
          />
        </Chart>
      </Specimen>
      <ChartDonutLegend
        id={id}
        className="mt-x4"
        items={slices.map((s) => ({
          key: s.id,
          label: s.name,
          color: s.color,
          percent: `${Math.round((s.amount / total) * 100)}%`,
          amount: formatWon(s.amount),
          onClick: s.hasChildren ? () => {} : undefined,
        }))}
      />
    </div>
  );
};

const HEAT_ROWS = [
  { key: "dawn", label: "새벽", sub: "0~6시" },
  { key: "am", label: "오전", sub: "6~12시" },
  { key: "pm", label: "오후", sub: "12~18시" },
  { key: "eve", label: "저녁", sub: "18~22시" },
  { key: "night", label: "밤", sub: "22~24시" },
];
const HEAT_COLS = ["일", "월", "화", "수", "목", "금", "토"].map((d) => ({
  key: d,
  label: d,
}));
const HEAT_VALUES = [
  [0, 4000, 0, 0, 2500, 0, 12000],
  [8000, 42000, 36000, 12000, 31000, 54000, 18000],
  [21000, 98000, 64000, 48000, 72000, 81000, 134000],
  [35000, 52000, 18000, 120000, 64000, 205000, 340000],
  [null, 0, 9000, 0, 15000, 22000, 0],
];
// 가장 나쁜 값 — 1억 넘는 금액(칸 폭 112 에 999억까지 들어간다)
const HEAT_BIG = HEAT_VALUES.map((row) => row.map((v) => (v ? v * 2900 : v)));
const HEAT_HUGE = [
  [99999999999, 0, 1, 123456789, null, 5, 70000000000],
  ...HEAT_VALUES.slice(1),
];

const heatTooltipLabel = (row: ChartHeatmapRow, col: ChartHeatmapColumn) =>
  `${col.label}요일 ${row.label} ${row.sub}`;

const Heat = ({
  values,
  width,
  label,
  specState,
  valueLabel,
}: {
  values: (number | null | undefined)[][];
  width: number;
  label: string;
  specState?: string;
  valueLabel?: string;
}) => (
  <div className="max-w-full overflow-x-auto p-x2">
    <div style={{ width }}>
      <Specimen spec="chart" combo={{ kind: "heatmap" }} state={specState}>
        <ChartHeatmap
          label={label}
          rows={HEAT_ROWS}
          columns={HEAT_COLS}
          values={values}
          tooltipLabel={heatTooltipLabel}
          valueLabel={valueLabel}
        />
      </Specimen>
    </div>
  </div>
);

/** 켠 타일 견본 — 마지막 하나는 끌 수 없어(aria-disabled · 기본 커서) 셋을 둔다. 첫 타일이 재는 타일이고 가운데 타일이 올림 · 누름을 받는다 */
const ShownTiles = ({ color }: { color: ChartColor }) => {
  const fillers = (["blue", "green", "orange"] as const).filter(
    (c) => c !== color,
  );
  return (
    <ChartLegendTiles
      items={[
        { key: color, label: color, color, total: formatWon(1240000) },
        {
          key: "b",
          label: "수입",
          color: fillers[0]!,
          total: formatWon(4200000),
        },
        {
          key: "c",
          label: "저축",
          color: fillers[1]!,
          total: formatWon(300000),
        },
      ]}
    />
  );
};

const STATES = ["enabled", "hovered", "pressed"] as const;

const TooltipStatic = () => (
  <Specimen spec="chart" combo={{ kind: "line", axis: "single" }}>
    <div className="inline-flex">
      <ChartTooltipContent
        active
        label="10월 8일 (목)"
        payload={[
          {
            name: "수입",
            value: 120000,
            dataKey: "income",
            color: "var(--color-chart-blue)",
          },
          {
            name: "지출",
            value: 86400,
            dataKey: "expense",
            color: "var(--color-chart-red)",
          },
        ]}
        valueFormatter={(v) => formatWon(Number(v))}
      />
    </div>
  </Specimen>
);

/** 카탈로그(/dev/ds) — 선(이중 축 · 하나) · 막대 · 도넛 · 열지도 · 툴팁 · 지표 타일(켬 · 끔 · 호버 · 누름) · 도넛 범례 · 색 10 · 가장 나쁜 값 · 빈 · 실패 · 기다림 */
export const ChartDemo = () => (
  <div className="flex flex-col gap-x8">
    <DemoBlock title="수입 · 지출 추이 — 지표 타일(누르면 계열을 켜고 끈다, 마지막 하나는 끌 수 없다) + 이중 축(왼쪽 수입 blue · 오른쪽 지출 red) · 오늘(8일)에서 끝남 · 차트를 짚거나 ← → 로 툴팁">
      <CardBody width={520}>
        <Trend data={DAYS} id="d-trend" />
      </CardBody>
    </DemoBlock>

    <DemoBlock title="축 하나 — 같은 크기의 두 계열(눈금 글자는 회색) · 가리킴(세로 점선 + 점 + 툴팁) · 키보드 초점(상자 바깥 2px 링)">
      <div className="flex flex-wrap items-start gap-x4">
        <CardBody width={380}>
          <Trend
            data={DAYS.map((d) => ({ ...d, income: d.income / 40 }))}
            dual={false}
            id="d-single"
            label="10월 수입 · 지출 추이(같은 단위)"
          />
        </CardBody>
        <CardBody width={380}>
          <Trend
            data={DAYS}
            dual={false}
            id="d-hover"
            specState="hovered"
            label="가리킨 모습"
          />
        </CardBody>
        <CardBody width={380}>
          <Trend
            data={DAYS}
            dual={false}
            id="d-focus"
            specState="focused"
            label="키보드 초점"
          />
        </CardBody>
      </div>
    </DemoBlock>

    <DemoBlock title="기간별 합 — 막대(최대 폭 28 · 위 모서리 4 · 막대 사이 4) · 한 묶음 두 계열">
      <CardBody width={520}>
        <Bars data={WEEKS} id="d-bar" label="10월 주별 수입 · 지출" />
      </CardBody>
    </DemoBlock>

    <DemoBlock title="카테고리 비율 — 도넛(지름 160 — 두께 22) · 가운데 합계는 원까지 · 목록 범례 · 저장된 빨강(경조사)과 같은 색이 두 번 나오지 않는다 · 하위 있는 줄만 누르는 줄">
      <div className="flex flex-wrap items-start gap-x4">
        <CardBody width={380}>
          <Donut
            items={CATEGORIES}
            id="d-donut"
            label="10월 카테고리별 지출, 합계 927,400원"
          />
        </CardBody>
        <CardBody width={380}>
          <Donut
            items={CATEGORIES}
            id="d-donut-phone"
            size={120}
            label="10월 카테고리별 지출(폰 지름 120 — 두께 18)"
          />
        </CardBody>
      </div>
    </DemoBlock>

    <DemoBlock title="요일 × 시간 세기 — 열지도(칸 정사각형 · 모서리 4 · 사이 6 · 세기 다섯 단계 · 가장 큰 칸에 고리 없음). 칸 폭 112 이상(왼쪽, 1280 폭)이면 원까지, 좁으면(오른쪽, 폰) 세기 색만 — 값은 가리키거나 누르면 툴팁">
      <div className="flex flex-col gap-x4">
        <CardBody>
          <Heat
            values={HEAT_VALUES}
            width={960}
            label="10월 요일 · 시간대별 지출, 가장 많은 때 토요일 저녁"
          />
        </CardBody>
        <div className="flex flex-wrap items-start gap-x4">
          <CardBody width={340}>
            <Heat
              values={HEAT_VALUES}
              width={292}
              label="10월 요일 · 시간대별 지출(폰)"
            />
          </CardBody>
          <CardBody width={340}>
            <Heat
              values={HEAT_VALUES}
              width={292}
              specState="focused"
              label="10월 요일 · 시간대별 지출(키보드 초점)"
            />
          </CardBody>
        </div>
      </div>
    </DemoBlock>

    <DemoBlock title="툴팁 — 떠 있는 표면(테두리 없음), 머리 12 · 줄 ■ 라벨 값(값은 오른쪽 · 고정폭 · 원까지)">
      <DemoRow label="툴팁">
        <TooltipStatic />
      </DemoRow>
    </DemoBlock>

    <DemoBlock title="지표 타일 — 켠 계열(옅은 바탕 chart-색-subtle) · 끈 계열(흰 면 + 1px 테두리) × 호버 · 누름. 끈 타일만 호버에 누름 바탕">
      {(["shown", "hidden"] as const).map((legend) => (
        <DemoRow key={legend} label={legend}>
          {STATES.filter((s) =>
            legend === "hidden" ? s !== "pressed" : s !== "hovered",
          ).map((state) => (
            <div
              key={state}
              className={legend === "hidden" ? "w-[150px]" : "w-[330px]"}
            >
              <Specimen spec="chart" combo={{ legend }} state={state}>
                {legend === "hidden" ? (
                  <ChartLegendTiles
                    items={[
                      {
                        key: "expense",
                        label: "지출",
                        color: "red",
                        total: formatWon(1240000),
                      },
                    ]}
                    hidden={new Set(["expense"])}
                  />
                ) : (
                  <ShownTiles color="red" />
                )}
              </Specimen>
              <p className="text-t1 text-fg-neutral-subtle">{state}</p>
            </div>
          ))}
        </DemoRow>
      ))}
    </DemoBlock>

    <DemoBlock title="도넛 범례 줄 — 쉬는 줄 · 누르는 줄(호버 · 누름 바탕 = bg-layer-default-pressed, 카드 끝까지 내고 안쪽 6 알약)">
      <CardBody width={380}>
        {STATES.map((state) => (
          <Specimen
            key={state}
            spec="chart"
            combo={{ kind: "donut" }}
            state={state}
          >
            <ChartDonutLegend
              items={[
                {
                  key: state,
                  label: `식비 — ${state}`,
                  color: "orange",
                  percent: "41%",
                  amount: formatWon(384400),
                  onClick: () => {},
                },
              ]}
            />
          </Specimen>
        ))}
      </CardBody>
    </DemoBlock>

    <DemoBlock title="색 10 — 차트 10색(라이트 700 · 다크 800-dark) 배정 순서 blue → … → brown, 회색은 기타 전용">
      <DemoRow label="palette">
        {PALETTE.map((color) => (
          <div key={color} className="w-[330px]">
            <Specimen spec="chart" combo={{ palette: color }}>
              <ShownTiles color={color} />
            </Specimen>
          </div>
        ))}
      </DemoRow>
    </DemoBlock>

    <DemoBlock title="가장 나쁜 값 — 데이터 1개 · 모두 0 · 음수(−3,000만 축이 잘리지 않음) · 1억 넘는 금액">
      <div className="flex flex-wrap items-start gap-x4">
        <CardBody width={380}>
          <Trend
            data={[{ day: day(1), income: 0, expense: 18000 }]}
            dual={false}
            id="w-one"
            label="10월 1일 수입 · 지출(하루)"
          />
        </CardBody>
        <CardBody width={380}>
          <Trend
            data={DAYS.map((d) => ({ ...d, income: 0, expense: 0 }))}
            dual={false}
            id="w-zero"
            label="10월 수입 · 지출 추이, 모두 0원"
          />
        </CardBody>
        <CardBody width={380}>
          <Bars
            net
            id="w-neg"
            label="순자산 변화, 가장 낮은 때 −30,000,000원"
            data={[
              { week: "7월", income: -30000000, expense: -12000000 },
              { week: "8월", income: -18000000, expense: 4000000 },
              { week: "9월", income: 2000000, expense: 9000000 },
              { week: "10월", income: 10000000, expense: -5000000 },
            ]}
          />
        </CardBody>
        <CardBody width={380}>
          <Trend
            data={DAYS.map((d) => ({
              ...d,
              income: d.income * 30,
              expense: d.expense * 1400,
            }))}
            dual={false}
            id="w-big"
            label="10월 수입 · 지출 추이, 1억 넘는 금액"
          />
        </CardBody>
      </div>
    </DemoBlock>

    <DemoBlock title="항목 12개 · 가운데에 들어가지 않는 합계 — 상위 9 + 회색 기타(목록 10줄), 도넛 가운데 글을 빼고 목록 위에 합계를 둔다(줄이지 않는다)">
      <div className="flex flex-wrap items-start gap-x4">
        <CardBody width={380}>
          <Donut
            items={MANY}
            id="w-many"
            label="10월 카테고리별 지출, 항목 12개"
          />
        </CardBody>
        <CardBody width={380}>
          <Donut
            items={MANY.map((c) => ({ ...c, amount: c.amount * 90000 }))}
            id="w-huge"
            size={120}
            label="10월 카테고리별 지출, 1억 넘는 합계"
          />
        </CardBody>
      </div>
    </DemoBlock>

    <DemoBlock title="열지도 가장 나쁜 값 — 1억 넘는 금액 · 999억(칸 112 에 들어간다) · 1원 · 값 없음(—) · 폰 폭에서도 색만">
      <CardBody>
        <Heat
          values={HEAT_HUGE}
          width={960}
          label="10월 요일 · 시간대별 지출, 큰 금액"
        />
      </CardBody>
      <CardBody>
        <Heat
          values={HEAT_BIG}
          width={960}
          label="10월 요일 · 시간대별 지출, 1억 넘는 금액"
        />
      </CardBody>
    </DemoBlock>

    <DemoBlock title="빈 · 실패 · 기다림 — 카드 머리 · 타일 이름 · 범례 틀은 그리고 차트 자리만 바꾼다(빈 축 · 회색 고리 · 0 막대로 대신하지 않는다)">
      <div className="flex flex-wrap items-start gap-x4">
        <CardBody width={380}>
          <Skeleton radius="16" className="h-[200px] w-full" />
        </CardBody>
        <CardBody width={380}>
          <ResultSection
            size="medium"
            icon={<ReceiptText />}
            title="이번 달 지출이 없어요"
          />
        </CardBody>
        <CardBody width={380}>
          <ResultSection
            kind="failure"
            size="medium"
            title="추이를 불러오지 못했어요"
            description="잠시 뒤 다시 시도해주세요."
            primaryAction={{ label: "다시 시도", onClick: () => {} }}
          />
        </CardBody>
      </div>
    </DemoBlock>

    <DemoBlock title="표로 보기 — 날짜마다 값을 읽어야 하는 차트의 대체(보조 기술용 숨긴 표, 펼치면 이 모습)">
      <CardBody width={520}>
        <ChartDataTable
          visuallyHidden={false}
          caption="10월 날짜별 수입 · 지출"
          columns={["날짜", "수입", "지출"]}
          rows={DAYS.slice(0, 4).map((d) => [
            `10월 ${d.day}`,
            formatWon(d.income),
            formatWon(d.expense),
          ])}
        />
      </CardBody>
    </DemoBlock>
  </div>
);
