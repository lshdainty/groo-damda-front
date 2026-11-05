import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { formatMonthDay } from "@/shared/lib/date";
import {
  Braces,
  Calendar,
  FileText,
  Receipt,
  SquareCheckBig,
  Sheet,
  Tag,
  Target,
  Wallet,
} from "lucide-react";
import { Button } from "@/shared/ds/button";
import { Checkbox } from "@/shared/ds/checkbox";
import { Field } from "@/shared/ds/field";
import { useDsText } from "@/shared/ds/i18n";
import { ListCheckGroup, ListCheckItem, ListDivider } from "@/shared/ds/list";
import { useWideSurface } from "@/shared/ds/overlay";
import { RadioSelectBox, RadioSelectBoxGroup } from "@/shared/ds/select-box";
import { Skeleton } from "@/shared/ds/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableStatusRow,
} from "@/shared/ds/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ds/tabs";
import { ResultSection } from "@/shared/ds/result-section";
import { useSnackbar } from "@/shared/ds/snackbar";
import { downloadBlob } from "@/shared/lib/download";
import { PeriodField } from "@/widgets/transaction-search/ui/PeriodField";
import { DataImportSection } from "./DataImportSection";
import { ActionBar, DataSection } from "./DataTransferParts";
import {
  downloadExport,
  ExportStalledError,
  fetchExportCounts,
  fetchExportPreview,
  type ExportDataType,
  type ExportFormat,
  type ExportPeriod,
  type ExportPreviewTable,
} from "@/features/export/api/exportApi";

// 미리보기 표는 칸이 글 폭만큼 서고 표 상자가 가로로 스크롤한다(0 ~ 767 도 표 — table.md) — 줄을 바꿔 칸을 찌그러뜨리지 않는다
const PREVIEW_TABLE = "[&_td]:whitespace-nowrap [&_th]:whitespace-nowrap";

// ─── 데이터 종류 / 형식 / 기간 정의 ─────────────────────────────

const DATA_TYPES: {
  v: ExportDataType;
  labelKey: string;
  Icon: React.ComponentType;
}[] = [
  { v: "EXPENSE", labelKey: "section.dataType.EXPENSE", Icon: Receipt },
  { v: "ASSET", labelKey: "section.dataType.ASSET", Icon: Wallet },
  { v: "BUDGET", labelKey: "section.dataType.BUDGET", Icon: Target },
  { v: "CATEGORY", labelKey: "section.dataType.CATEGORY", Icon: Tag },
  { v: "MEMO", labelKey: "section.dataType.MEMO", Icon: FileText },
  { v: "CALENDAR", labelKey: "section.dataType.CALENDAR", Icon: Calendar },
  { v: "TODO", labelKey: "section.dataType.TODO", Icon: SquareCheckBig },
];
const ALL_TYPES: ExportDataType[] = DATA_TYPES.map((dt) => dt.v);

const FORMATS: {
  v: ExportFormat;
  label: string;
  ext: string;
  descKey: string;
  Icon: React.ComponentType;
}[] = [
  {
    v: "CSV",
    label: "CSV",
    ext: ".csv",
    descKey: "section.format.csv.desc",
    Icon: FileText,
  },
  {
    v: "EXCEL",
    label: "Excel",
    ext: ".xlsx",
    descKey: "section.format.excel.desc",
    Icon: Sheet,
  },
  {
    v: "JSON",
    label: "JSON",
    ext: ".json",
    descKey: "section.format.json.desc",
    Icon: Braces,
  },
];

const PERIODS: { v: ExportPeriod; labelKey: string }[] = [
  { v: "THIS_MONTH", labelKey: "section.period.thisMonth" },
  { v: "LAST_MONTH", labelKey: "section.period.lastMonth" },
  { v: "LAST_3_MONTHS", labelKey: "section.period.last3m" },
  { v: "THIS_YEAR", labelKey: "section.period.thisYear" },
  { v: "CUSTOM", labelKey: "section.period.custom" },
];

const SLUG_TO_EXT: Record<ExportFormat, string> = {
  CSV: "csv",
  EXCEL: "xlsx",
  JSON: "json",
};
const TYPE_SLUG: Record<ExportDataType, string> = {
  EXPENSE: "expense",
  ASSET: "asset",
  BUDGET: "budget",
  CATEGORY: "category",
  MEMO: "memo",
  CALENDAR: "calendar",
  TODO: "todo",
};

// ─── 날짜 유틸 (백엔드 PeriodResolver 와 동일 규칙) ───────────────

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const krLabel = (s: string) => formatMonthDay(s);

interface Range {
  start: string;
  end: string;
}

function resolveRange(
  period: ExportPeriod,
  customFrom: string,
  customTo: string,
): Range {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const firstOf = (yy: number, mm: number) => new Date(yy, mm, 1);
  const lastOf = (yy: number, mm: number) => new Date(yy, mm + 1, 0);
  switch (period) {
    case "THIS_MONTH":
      return { start: iso(firstOf(y, m)), end: iso(lastOf(y, m)) };
    case "LAST_MONTH":
      return { start: iso(firstOf(y, m - 1)), end: iso(lastOf(y, m - 1)) };
    case "LAST_3_MONTHS":
      return { start: iso(firstOf(y, m - 2)), end: iso(lastOf(y, m)) };
    case "THIS_YEAR":
      return { start: iso(new Date(y, 0, 1)), end: iso(lastOf(y, m)) };
    case "CUSTOM":
      return { start: customFrom, end: customTo };
  }
}

function buildFilename(
  format: ExportFormat,
  types: ExportDataType[],
  range: Range,
): string {
  const ext = SLUG_TO_EXT[format];
  const rangePart = `${range.start}_${range.end}`;
  if (format !== "EXCEL" && types.length > 1)
    return `groo-export-${rangePart}.zip`;
  const namePart = types.length === 1 ? TYPE_SLUG[types[0]!] : "export";
  return `groo-${namePart}-${rangePart}.${ext}`;
}

// ─── 메인 섹션 ─────────────────────────────────────────────────

export function DataExportSection({ mobile }: { mobile: boolean }) {
  const { t } = useTranslation("export");
  const [mode, setMode] = useState<"export" | "import">("export");

  // 내보내기 ↔ 가져오기를 바꿔도 안의 입력(고른 파일 · 기간)이 남도록 두 칸을 모두 그려 둔다(Tabs 내용 칸 — 숨김만).
  return (
    <Tabs
      value={mode}
      onValueChange={(v) => setMode(v as "export" | "import")}
      className="flex flex-col gap-x6"
    >
      <TabsList aria-label={t("section.tabsLabel")}>
        <TabsTrigger value="export">{t("export")}</TabsTrigger>
        <TabsTrigger value="import">{t("import.tab")}</TabsTrigger>
      </TabsList>
      <TabsContent value="export">
        <ExportPane mobile={mobile} />
      </TabsContent>
      <TabsContent value="import">
        <DataImportSection mobile={mobile} />
      </TabsContent>
    </Tabs>
  );
}

function ExportPane({ mobile }: { mobile: boolean }) {
  const { t } = useTranslation("export");
  const dsT = useDsText();
  const snackbar = useSnackbar();
  const wide = useWideSurface();
  const [format, setFormat] = useState<ExportFormat>("CSV");
  const [period, setPeriod] = useState<ExportPeriod>("THIS_MONTH");
  const [customFrom, setCustomFrom] = useState(
    iso(new Date(new Date().getFullYear(), new Date().getMonth(), 1)),
  );
  const [customTo, setCustomTo] = useState(iso(new Date()));
  const [selected, setSelected] = useState<ExportDataType[]>([
    "EXPENSE",
    "ASSET",
    "BUDGET",
  ]);
  const [mask, setMask] = useState(false);

  const [counts, setCounts] = useState<Record<string, number>>({});
  const [countsError, setCountsError] = useState(false);
  const [countsTry, setCountsTry] = useState(0);
  const [downloading, setDownloading] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [preview, setPreview] = useState<ExportPreviewTable[] | null>(null);
  const [previewTab, setPreviewTab] = useState<string | null>(null);

  const range = useMemo(
    () => resolveRange(period, customFrom, customTo),
    [period, customFrom, customTo],
  );
  const customInvalid =
    period === "CUSTOM" && (!customFrom || !customTo || customFrom > customTo);

  const queryBody = useCallback(
    (types: ExportDataType[]) => ({
      period,
      startDate: period === "CUSTOM" ? customFrom : undefined,
      endDate: period === "CUSTOM" ? customTo : undefined,
      types,
    }),
    [period, customFrom, customTo],
  );

  // 기간 변경 시 7종 전체 건수 재조회 (디자인: 모든 행에 건수 표시).
  useEffect(() => {
    if (customInvalid) return;
    let alive = true;
    fetchExportCounts(queryBody(ALL_TYPES))
      .then((list) => {
        if (!alive) return;
        const map: Record<string, number> = {};
        list.forEach((c) => {
          map[c.type] = c.count;
        });
        setCounts(map);
        setCountsError(false);
      })
      .catch(() => {
        // 전역 토스트에 기대지 않고 자리에서 알린다(I-05 42) — 값 자리를 비우고 묶음 아래 오류 + 다시 시도
        if (alive) setCountsError(true);
      });
    return () => {
      alive = false;
    };
  }, [queryBody, customInvalid, countsTry]);

  const toggleType = (v: ExportDataType) =>
    setSelected((prev) =>
      prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v],
    );

  const allChecked = selected.length === ALL_TYPES.length;
  const parentChecked: boolean | "indeterminate" = allChecked
    ? true
    : selected.length > 0
      ? "indeterminate"
      : false;

  const totalSelectedCount = selected.reduce(
    (sum, ty) => sum + (counts[TYPE_SLUG[ty]] ?? 0),
    0,
  );

  const handlePreview = async () => {
    if (!selected.length || customInvalid) return;
    setPreviewing(true);
    try {
      const tables = await fetchExportPreview(queryBody(selected));
      setPreview(tables);
      setPreviewTab(tables[0]?.type ?? null);
    } finally {
      setPreviewing(false);
    }
  };

  const handleExport = async () => {
    if (!selected.length || customInvalid) return;
    setDownloading(true);
    try {
      const blob = await downloadExport({
        ...queryBody(selected),
        format,
        mask,
      });
      downloadBlob(blob, buildFilename(format, selected, range));
      snackbar.show({ message: t("section.exportDone"), tone: "neutral" });
    } catch (e) {
      // 받기가 멈췄거나 서버가 거절했다 — 서버 글은 내지 않고 고정 글 + [다시 시도](기본 6초, 겹치면 새 띠가 대신한다)
      snackbar.show({
        message:
          e instanceof ExportStalledError
            ? t("section.exportStalled")
            : t("section.exportFailed"),
        tone: "critical",
        action: { label: dsT("common.retry"), onClick: handleExport },
      });
    } finally {
      setDownloading(false);
    }
  };

  const activeTab =
    preview?.find((tb) => tb.type === previewTab) ?? preview?.[0] ?? null;
  const buttonSize = wide ? "medium" : "large";

  const maskCheckbox = (
    <Checkbox
      checked={mask}
      onCheckedChange={(c) => setMask(c === true)}
      label={t("section.maskSensitive")}
    />
  );
  const actionBar = (
    <ActionBar mobile={mobile}>
      <Button
        variant="neutralWeak"
        size={buttonSize}
        onClick={handlePreview}
        loading={previewing}
        disabled={!selected.length || customInvalid}
      >
        {t("preview")}
      </Button>
      <Button
        variant="neutralSolid"
        size={buttonSize}
        onClick={handleExport}
        loading={downloading}
        disabled={!selected.length || customInvalid}
      >
        {t("export")}
      </Button>
    </ActionBar>
  );

  return (
    <div className={mobile ? "flex flex-col gap-x6" : "flex flex-col gap-x2"}>
      {/* 1. 기간 — 모든 폭 1열 가로형(Q5 5B + 사용자 결정 10-23 Q1-A — 데스크톱 · 태블릿도 폰과 같게, "직접" 칸 값이 잘리지 않는다) */}
      <DataSection mobile={mobile} title={t("section.periodSelect")}>
        {(titleId) => (
          <RadioSelectBoxGroup
            aria-labelledby={titleId}
            columns={1}
            value={period}
            onValueChange={(v) => setPeriod(v as ExportPeriod)}
          >
            {PERIODS.map((p) => {
              const r = resolveRange(p.v, customFrom, customTo);
              const sub =
                p.v === "CUSTOM"
                  ? t("section.customSelect")
                  : `${krLabel(r.start)}~${krLabel(r.end)}`;
              return (
                <RadioSelectBox
                  key={p.v}
                  value={p.v}
                  label={t(p.labelKey)}
                  description={sub}
                  layout="horizontal"
                  footer={
                    p.v === "CUSTOM" ? (
                      <PeriodField
                        from={customFrom}
                        to={customTo}
                        label={t("section.customRangeLabel")}
                        invalid={customInvalid}
                        errorMessage={t("section.rangeIncomplete")}
                        onChange={(next) => {
                          setCustomFrom(next.from);
                          setCustomTo(next.to);
                        }}
                      />
                    ) : undefined
                  }
                />
              );
            })}
          </RadioSelectBoxGroup>
        )}
      </DataSection>

      {/* 2. 데이터 종류 — 맨 위 부모 "모두" + 체크 묶음 */}
      <DataSection
        mobile={mobile}
        title={t("section.dataTypeTitle", { count: selected.length })}
        description={t("section.dataTypeDesc")}
        list
      >
        {(titleId) => (
          <>
            {/* 오류 글 · [다시 시도] 는 줄과 같은 왼쪽 24(목록 구역은 여백 없는 카드 · 폰은 페이지 여백 밖까지 폄) */}
            <Field
              invalid={countsError}
              errorMessage={t("section.countsFailed")}
              className="[&>[data-slot=field-footer]]:px-global-gutter"
            >
              <ListCheckGroup aria-labelledby={titleId}>
                <ListCheckItem
                  title={t("section.dataTypeAll")}
                  markPosition="suffix"
                  checked={parentChecked}
                  onCheckedChange={(c) =>
                    setSelected(c === true ? [...ALL_TYPES] : [])
                  }
                />
                <ListDivider />
                {DATA_TYPES.map((dt) => {
                  const cnt = counts[TYPE_SLUG[dt.v]];
                  const IconComp = dt.Icon;
                  return (
                    <ListCheckItem
                      key={dt.v}
                      prefix={<IconComp />}
                      title={t(dt.labelKey)}
                      markPosition="suffix"
                      suffixValue={
                        cnt != null ? (
                          t("section.countGeon", {
                            count: cnt.toLocaleString(),
                          })
                        ) : countsError ? undefined : (
                          <Skeleton text="t5" className="w-x10" />
                        )
                      }
                      checked={selected.includes(dt.v)}
                      onCheckedChange={() => toggleType(dt.v)}
                    />
                  );
                })}
              </ListCheckGroup>
            </Field>
            {countsError && (
              <div className="px-global-gutter pb-x3">
                <Button
                  variant="ghost"
                  size="small"
                  flush="left"
                  onClick={() => setCountsTry((n) => n + 1)}
                >
                  {dsT("common.retry")}
                </Button>
              </div>
            )}
          </>
        )}
      </DataSection>

      {/* 3. 파일 형식 — 폰은 1열 가로형, 데스크톱 · 태블릿은 3열 */}
      <DataSection
        mobile={mobile}
        title={t("fileFormat")}
        footer={
          mobile ? undefined : (
            <>
              {maskCheckbox}
              {actionBar}
            </>
          )
        }
      >
        {(titleId) => (
          <RadioSelectBoxGroup
            aria-labelledby={titleId}
            columns={mobile ? 1 : 3}
            value={format}
            onValueChange={(v) => setFormat(v as ExportFormat)}
          >
            {FORMATS.map((f) => {
              const IconComp = f.Icon;
              return (
                <RadioSelectBox
                  key={f.v}
                  value={f.v}
                  prefix={<IconComp />}
                  label={`${f.label} (${f.ext})`}
                  description={t(f.descKey)}
                  layout={mobile ? "horizontal" : "vertical"}
                  // 3열은 정보를 줄이고 컨트롤(라디오)을 뺀다(select-box.md:47 · 예제 :216 — 이 화면의 파일 형식)
                  control={mobile ? "radio" : "none"}
                />
              );
            })}
          </RadioSelectBoxGroup>
        )}
      </DataSection>

      {/* 민감 정보 가리기 + 액션 — 데스크톱은 마지막 카드 안 바닥 오른쪽, 폰은 화면 바닥 고정 */}
      {mobile && maskCheckbox}

      {/* 미리보기 결과 — 모든 폭에서 표(0 ~ 767 은 표와 함께 가로 스크롤) */}
      {preview && activeTab && (
        <DataSection mobile={mobile} title={t("preview")}>
          {() => (
            <Tabs
              value={activeTab.type}
              onValueChange={setPreviewTab}
              className="flex flex-col gap-x3"
            >
              <TabsList layout="hug" aria-label={t("section.previewTabs")}>
                {preview.map((tbl) => (
                  <TabsTrigger key={tbl.type} value={tbl.type}>
                    {tbl.displayName} {tbl.totalCount.toLocaleString()}
                  </TabsTrigger>
                ))}
              </TabsList>
              {preview.map((tbl) => (
                <TabsContent key={tbl.type} value={tbl.type}>
                  <Table
                    tableClassName={PREVIEW_TABLE}
                    caption={`${t("preview")} ${tbl.displayName}`}
                  >
                    <TableHeader>
                      <TableRow>
                        {tbl.headers.map((h) => (
                          <TableHead key={h}>{h}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tbl.rows.length === 0 ? (
                        <TableStatusRow>
                          <ResultSection
                            size="medium"
                            icon={<FileText />}
                            title={t("section.previewEmptyTitle")}
                            description={t("section.noData")}
                          />
                        </TableStatusRow>
                      ) : (
                        tbl.rows.map((row, ri) => (
                          <TableRow key={ri}>
                            {row.map((cell, ci) => (
                              <TableCell key={ci}>{cell}</TableCell>
                            ))}
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </TabsContent>
              ))}
              <p className="m-0 text-t4 text-fg-neutral-subtle">
                {t("section.previewFooter", {
                  rows: activeTab.rows.length.toLocaleString(),
                  // 고른 종류 수 — 서버가 빈 종류의 표를 빼도 바뀌지 않는다(앱과 같은 셈). 합계는 고른 종류 건수 합(빈 종류 0)
                  types: selected.length.toLocaleString(),
                  total: totalSelectedCount.toLocaleString(),
                })}
              </p>
            </Tabs>
          )}
        </DataSection>
      )}
      {/* 폰 바닥 바는 pane 의 마지막 자식 — 미리보기가 떠도 화면 바닥을 떠나지 않는다 */}
      {mobile && actionBar}
    </div>
  );
}
