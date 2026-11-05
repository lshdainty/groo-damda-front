import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { FileSpreadsheet } from "lucide-react";
import { AttachmentInput } from "@/shared/ds/attachment-input";
import type {
  AttachmentEntry,
  AttachmentRejection,
} from "@/shared/ds/attachment-input";
import { Badge } from "@/shared/ds/badge";
import { Button } from "@/shared/ds/button";
import { Callout } from "@/shared/ds/callout";
import { Card } from "@/shared/ds/card";
import { Field } from "@/shared/ds/field";
import {
  List,
  ListCheckGroup,
  ListCheckItem,
  ListHeader,
  ListItem,
} from "@/shared/ds/list";
import { useWideSurface } from "@/shared/ds/overlay";
import { RadioSelectBox, RadioSelectBoxGroup } from "@/shared/ds/select-box";
import { ResultSection } from "@/shared/ds/result-section";
import { Select, SelectItem } from "@/shared/ds/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ds/table";
import { BusyOverlay } from "@/shared/ui/groo/busy-overlay";
import {
  assetKeys,
  cardKeys,
  dashboardKeys,
  expenseKeys,
} from "@/shared/config";
import {
  analyzeImport,
  executeImport,
  type ImportAnalyzeResult,
  type ImportExecuteResult,
  type ImportField,
  type ImportMapping,
  type ImportSource,
} from "@/features/import/api/importApi";
import { ActionBar, DataSection } from "./DataTransferParts";

// 미리보기 표는 칸이 글 폭만큼 서고 표 상자가 가로로 스크롤한다(0 ~ 767 도 표 — table.md) — 줄을 바꿔 칸을 찌그러뜨리지 않는다
const PREVIEW_TABLE = "[&_td]:whitespace-nowrap [&_th]:whitespace-nowrap";

// ─── 소스 프리셋 / 매핑 필드 ───────────────────────────────────
// 서버로 가는 값(v)은 서버 enum 이름이다 — 문구처럼 바꾸면 400(#461). 화면 이름은 nameKey 가 정한다.

const SOURCES: { v: ImportSource; nameKey: string; descKey: string }[] = [
  {
    v: "POREST",
    nameKey: "import.source.groo",
    descKey: "import.source.grooDesc",
  },
  {
    v: "EASYBUDGET",
    nameKey: "import.source.easybudget",
    descKey: "import.source.easybudgetDesc",
  },
  {
    v: "BANKSALAD",
    nameKey: "import.source.banksalad",
    descKey: "import.source.banksaladDesc",
  },
  {
    v: "TOSS",
    nameKey: "import.source.toss",
    descKey: "import.source.tossDesc",
  },
  {
    v: "CUSTOM",
    nameKey: "import.source.custom",
    descKey: "import.source.customDesc",
  },
];

const MAP_FIELDS: { f: ImportField; labelKey: string; required?: boolean }[] = [
  { f: "DATE", labelKey: "import.field.date", required: true },
  { f: "AMOUNT", labelKey: "import.field.amount", required: true },
  { f: "TYPE", labelKey: "import.field.type" },
  { f: "CATEGORY", labelKey: "import.field.category" },
  { f: "ASSET", labelKey: "import.field.asset" },
  { f: "MEMO", labelKey: "import.field.memo" },
  // 소스에 따라 있을 수도 없을 수도 있는 열 — 자동매핑이 잡으면 채워지고, 없으면 '사용 안 함'.
  { f: "SUBCATEGORY", labelKey: "import.field.subcategory" },
  { f: "TIME", labelKey: "import.field.time" },
  { f: "MERCHANT", labelKey: "import.field.merchant" },
  { f: "PAYMENT_METHOD", labelKey: "import.field.paymentMethod" },
];

const NONE = "none";
type Step = "upload" | "mapping" | "done";
const STEP_ORDER: Step[] = ["upload", "mapping", "done"];

/** 서버 업로드 한도(`application.yml:17` 10MB) — 고르는 순간 미리 검사한다. */
const IMPORT_MAX_BYTES = 10 * 1024 * 1024;
const IMPORT_ACCEPT = ".csv,.xlsx,.xls";
const FILE_ENTRY_ID = "import-file";

/**
 * 서버가 실패 행에 붙이는 **사유 코드**. 화면 문구가 아니다 —
 * `date`(날짜를 못 읽음) · `amount`(금액을 못 읽음) · `type`(수입/지출 판별 불가) ·
 * `parentHasTx`(대분류에 거래가 직접 달려 하위를 못 만듦) · `resolve`(카테고리·자산
 * 해석 실패) · `save`(저장 실패). 서버가 내는 값은 지금 이 여섯이 전부다.
 */
const FAIL_REASONS = [
  "date",
  "amount",
  "type",
  "parentHasTx",
  "resolve",
  "save",
] as const;

/**
 * 사유 코드 → i18n 키. **모르는 코드는 코드 그대로 흘리지 않는다** — 서버가 나중에
 * 사유를 늘려도 화면에 영문 코드(`fxRate` 따위)가 튀어나오면 안 된다. 그런 값은
 * 기본 문구로 떨어뜨린다.
 */
/** 건수 글 — 천 단위 쉼표(앱 decimalPattern 과 같게). i18n 에 숫자 형식이 없어 호출하는 쪽이 만든다 */
const fmt = (n: number) => n.toLocaleString();

function failReasonKey(reason: string): string {
  return (FAIL_REASONS as readonly string[]).includes(reason)
    ? `import.failReason.${reason}`
    : "import.failReason.unknown";
}

// ─── 메인 ──────────────────────────────────────────────────────

export function DataImportSection({ mobile }: { mobile: boolean }) {
  const { t } = useTranslation("export");
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const wide = useWideSurface();
  const [step, setStep] = useState<Step>("upload");
  const [source, setSource] = useState<ImportSource>("POREST");
  const [file, setFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  // 가져오기 실행이 실패했다 — 매핑 단계 맨 위 안내, 값은 그대로 두고 다시 누르면 된다
  const [runFailed, setRunFailed] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<ImportAnalyzeResult | null>(null);
  const [mapping, setMapping] = useState<ImportMapping>({});
  const [dupSkip, setDupSkip] = useState(true);
  const [autoCat, setAutoCat] = useState(true);
  const [executing, setExecuting] = useState(false);
  const [result, setResult] = useState<ImportExecuteResult | null>(null);

  const pickFile = async (f: File) => {
    setUploadError(null);
    setFile(f);
    setAnalyzing(true);
    try {
      const res = await analyzeImport(f, source);
      setAnalysis(res);
      setMapping(res.suggestedMapping);
      setStep("mapping");
    } catch {
      // 고른 파일은 거두고 칸 아래 고정 글로 알린다 — 다시 고르면 된다
      setFile(null);
      setUploadError(t("import.analyzeFailed"));
    } finally {
      setAnalyzing(false);
    }
  };

  // 거절(형식 · 10MB 넘음)은 칸 아래 오류 글로 알린다(전역 토스트 아님)
  const onReject = (rejections: AttachmentRejection[]) => {
    const codes = new Set(rejections.flatMap((r) => r.codes));
    setUploadError(
      codes.has("INVALID_TYPE")
        ? t("import.errorType")
        : codes.has("FILE_TOO_LARGE")
          ? t("import.errorSize")
          : t("import.errorType"),
    );
  };

  const setField = (field: ImportField, colStr: string) =>
    setMapping((prev) => {
      const next = { ...prev };
      if (colStr === NONE) delete next[field];
      else next[field] = Number(colStr);
      return next;
    });

  const canExecute =
    mapping.DATE != null &&
    (mapping.AMOUNT != null ||
      mapping.AMOUNT_OUT != null ||
      mapping.AMOUNT_IN != null);

  const runImport = async () => {
    if (!file || !canExecute) return;
    setRunFailed(false);
    setExecuting(true);
    try {
      const res = await executeImport(file, {
        source,
        mapping,
        dupSkip,
        autoCat,
      });
      // 가져오기 한 번이 거래를 수백 건 만든다 — 캐시를 비우지 않으면 가계부·통계·예산
      // (expenses) · 자산 잔액과 추이(assets) · 카드 실적(cards) · 홈 요약(dashboard)이
      // 전부 옛 값으로 남아 사용자가 손으로 새로고침해야 했다(QA #144).
      // 어느 화면이 열려 있을지 모르므로 루트 키로 통째로 무효화한다 — 지금 보고 있는
      // 화면만 다시 받고 나머지는 다음에 열릴 때 받는다.
      queryClient.invalidateQueries({ queryKey: expenseKeys.all });
      queryClient.invalidateQueries({ queryKey: assetKeys.all });
      queryClient.invalidateQueries({ queryKey: cardKeys.all });
      queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
      setResult(res);
      setStep("done");
    } catch {
      setRunFailed(true);
    } finally {
      setExecuting(false);
    }
  };

  const reset = () => {
    setStep("upload");
    setFile(null);
    setUploadError(null);
    setAnalysis(null);
    setMapping({});
    setResult(null);
  };

  const entries: AttachmentEntry[] = file
    ? [
        {
          id: FILE_ENTRY_ID,
          name: file.name,
          size: file.size,
          type: file.type,
          file,
          status: analyzing ? "uploading" : "success",
        },
      ]
    : [];
  const buttonSize = wide ? "medium" : "large";
  const mappingBar = analysis ? (
    <ActionBar mobile={mobile}>
      <Button variant="neutralWeak" size={buttonSize} onClick={reset}>
        {t("import.prev")}
      </Button>
      <Button
        variant="neutralSolid"
        size={buttonSize}
        onClick={runImport}
        disabled={!canExecute}
      >
        {t("import.doImport", {
          count: fmt(
            dupSkip
              ? analysis.validRows - analysis.duplicateCount
              : analysis.validRows,
          ),
        })}
      </Button>
    </ActionBar>
  ) : null;

  const createdTitle = result
    ? t("import.createdCatTitle", { count: fmt(result.createdCategoryCount) })
    : "";
  const failuresTitle = result
    ? t("import.failuresTitle", { count: fmt(result.failed) })
    : "";
  const doneResult = (size: "large" | "medium") =>
    result ? (
      <ResultSection
        kind="done"
        size={size}
        as="h2"
        title={t("import.doneTitle", {
          count: result.imported.toLocaleString(),
        })}
        description={t("import.doneDetail", {
          skipped: result.skipped.toLocaleString(),
          failed: result.failed.toLocaleString(),
        })}
        secondaryAction={{ label: t("import.another"), onClick: reset }}
      />
    ) : null;
  const createdList = result ? (
    <CategoryList
      t={t}
      names={result.createdCategories ?? []}
      total={result.createdCategoryCount}
    />
  ) : null;
  const failuresList = result ? (
    <>
      <List>
        {result.failures.map((f) => (
          <ListItem
            key={f.lineNo}
            title={t("import.failureLine", { line: f.lineNo })}
            detail={t(failReasonKey(f.reason))}
          />
        ))}
      </List>
      {(result.failuresTruncated || result.failed > result.failures.length) && (
        <p className="m-0 px-global-gutter pt-x3 text-t4 text-fg-neutral-subtle">
          {t("import.failuresCapped", {
            shown: fmt(result.failures.length),
            total: fmt(result.failed),
          })}
        </p>
      )}
    </>
  ) : null;

  return (
    <div className={mobile ? "flex flex-col gap-x6" : "flex flex-col gap-x2"}>
      {step !== "done" && <StepHeader step={step} t={t} />}

      {step === "upload" && (
        <>
          <DataSection
            mobile={mobile}
            title={t("import.sourceTitle")}
            description={t("import.sourceDesc")}
          >
            {(titleId) => (
              <RadioSelectBoxGroup
                aria-labelledby={titleId}
                value={source}
                onValueChange={(v) => setSource(v as ImportSource)}
              >
                {SOURCES.map((s) => (
                  <RadioSelectBox
                    key={s.v}
                    value={s.v}
                    label={t(s.nameKey)}
                    description={t(s.descKey)}
                  />
                ))}
              </RadioSelectBoxGroup>
            )}
          </DataSection>

          <DataSection
            mobile={mobile}
            title={t("import.uploadTitle")}
            description={t("import.uploadDesc")}
          >
            {() => (
              <Field invalid={uploadError != null} errorMessage={uploadError}>
                <AttachmentInput
                  layout="dropzone"
                  aria-label={t("import.uploadTitle")}
                  accept={IMPORT_ACCEPT}
                  maxFiles={1}
                  maxFileSize={IMPORT_MAX_BYTES}
                  entries={entries}
                  onFilesAccept={(added) => {
                    const f = added[0]?.file;
                    if (f) void pickFile(f);
                  }}
                  onFilesReject={onReject}
                  onRemove={reset}
                />
              </Field>
            )}
          </DataSection>

          <Callout tone="neutral">{t("import.notice")}</Callout>
        </>
      )}

      {step === "mapping" && analysis && (
        <>
          {runFailed && (
            <Callout tone="critical" role="alert">
              {t("import.runFailed")}
            </Callout>
          )}
          {/* 실행하면 반드시 실패할 행을 미리 알린다 — 넣고 나서 실패 숫자만 보면 원인을 알 수 없다. */}
          {analysis.blockedParents.length > 0 && (
            <Callout
              tone="critical"
              title={t("import.blockedTitle", {
                names: analysis.blockedParents.join(", "),
              })}
            >
              {t("import.blockedDesc")}
            </Callout>
          )}

          <DataSection mobile={mobile} title={t("import.fileTitle")} list>
            {() => (
              <List>
                <ListItem
                  prefix={<FileSpreadsheet />}
                  title={analysis.fileName}
                  detail={t("import.rowsDetected", {
                    total: fmt(analysis.totalRows),
                    valid: fmt(analysis.validRows),
                  })}
                  suffix={
                    <Button variant="ghost" size="small" onClick={reset}>
                      {t("import.change")}
                    </Button>
                  }
                />
              </List>
            )}
          </DataSection>

          <DataSection
            mobile={mobile}
            title={t("import.mapTitle")}
            description={t("import.mapDesc")}
          >
            {() => (
              <div
                className={
                  mobile
                    ? "flex flex-col gap-x4"
                    : "grid grid-cols-1 gap-x4 md:grid-cols-2"
                }
              >
                {MAP_FIELDS.map((mf) => (
                  <Field
                    key={mf.f}
                    label={t(mf.labelKey)}
                    showRequiredIndicator={mf.required}
                  >
                    <Select
                      value={
                        mapping[mf.f] != null ? String(mapping[mf.f]) : NONE
                      }
                      onValueChange={(v) => setField(mf.f, v)}
                    >
                      <SelectItem value={NONE} label={t("import.notMapped")} />
                      {analysis.columns.map((c) => (
                        <SelectItem
                          key={c.index}
                          value={String(c.index)}
                          label={c.name || `#${c.index + 1}`}
                        />
                      ))}
                    </Select>
                  </Field>
                ))}
              </div>
            )}
          </DataSection>

          <DataSection
            mobile={mobile}
            title={t("preview")}
            description={t("import.previewDesc", {
              dup: fmt(analysis.duplicateCount),
            })}
          >
            {() => (
              <Table tableClassName={PREVIEW_TABLE} caption={t("preview")}>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("import.field.date")}</TableHead>
                    <TableHead>{t("import.field.type")}</TableHead>
                    <TableHead>{t("import.field.category")}</TableHead>
                    <TableHead>{t("import.field.asset")}</TableHead>
                    <TableHead align="end">
                      {t("import.field.amount")}
                    </TableHead>
                    <TableHead>{t("import.field.memo")}</TableHead>
                    <TableHead>{t("import.statusCol")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {analysis.preview.map((r) => (
                    <TableRow key={r.lineNo}>
                      <TableCell>
                        {r.date ? r.date.slice(0, 10) : "—"}
                      </TableCell>
                      <TableCell>
                        {r.type ? (
                          <Badge
                            tone={r.type === "INCOME" ? "brand" : "neutral"}
                          >
                            {r.type === "INCOME"
                              ? t("import.income")
                              : t("import.expense")}
                          </Badge>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell>{r.category ?? "—"}</TableCell>
                      <TableCell>{r.asset ?? "—"}</TableCell>
                      <TableCell align="end">
                        {r.amount != null ? r.amount.toLocaleString() : "—"}
                      </TableCell>
                      <TableCell>{r.memo ?? ""}</TableCell>
                      <TableCell>
                        {/* 흐리게 하지 않고 상태 배지로 가른다(table.md) */}
                        {r.error ? (
                          <Badge tone="critical">
                            {t("import.errorBadge")}
                          </Badge>
                        ) : r.duplicate ? (
                          <Badge tone="neutral">{t("import.dupBadge")}</Badge>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </DataSection>

          <DataSection
            mobile={mobile}
            title={t("import.optionsTitle")}
            list
            footer={mobile ? undefined : mappingBar}
          >
            {(titleId) => (
              <>
                <ListCheckGroup aria-labelledby={titleId}>
                  <ListCheckItem
                    title={t("import.optDupSkip")}
                    detail={t("import.optDupSkipDesc", {
                      dup: fmt(analysis.duplicateCount),
                    })}
                    checked={dupSkip}
                    onCheckedChange={(c) => setDupSkip(c === true)}
                  />
                  <ListCheckItem
                    title={t("import.optAutoCat")}
                    detail={t("import.optAutoCatDesc")}
                    checked={autoCat}
                    onCheckedChange={(c) => setAutoCat(c === true)}
                  />
                </ListCheckGroup>
                {/* 오타가 그대로 새 카테고리가 되던 자리(QA #59) — 실행 전에 이름을 보여 주고,
                    마음에 안 들면 바로 위 체크를 끄면 미분류로 들어간다. */}
                {autoCat && analysis.newCategoryCount > 0 && (
                  <CategoryList
                    t={t}
                    title={t("import.newCatTitle", {
                      count: fmt(analysis.newCategoryCount),
                    })}
                    names={analysis.newCategories ?? []}
                    total={analysis.newCategoryCount}
                    hint={t("import.newCatHint")}
                  />
                )}
              </>
            )}
          </DataSection>

          {mobile && mappingBar}
        </>
      )}

      {step === "done" && result && mobile && (
        <>
          {doneResult("large")}
          {/* 만들어진 카테고리 — 미리보기(매핑 단계)에서 본 것과 실제가 같은지 확인시킨다(ds List 줄, 지시서 50). */}
          {(result.createdCategories ?? []).length > 0 && (
            <DataSection
              mobile={mobile}
              title={createdTitle}
              heading="listHeader"
              list
            >
              {() => createdList}
            </DataSection>
          )}
          {/* 종전엔 "실패 2" 숫자뿐이라 CSV 를 고칠 수가 없었다(QA #61). */}
          {result.failures.length > 0 && (
            <DataSection
              mobile={mobile}
              title={failuresTitle}
              heading="listHeader"
              list
            >
              {() => failuresList}
            </DataSection>
          )}
          <ActionBar mobile={mobile}>
            <Button
              variant="neutralSolid"
              size="large"
              onClick={() => navigate("/desk/expense")}
            >
              {t("import.toLedger")}
            </Button>
          </ActionBar>
        </>
      )}

      {/* 데스크톱 · 태블릿(768 이상) 완료 — 결과(medium) + 만든 카테고리 + 실패를 한 카드 안에, [가계부로 가기] 는 카드
          바닥 오른쪽(1280 이상 medium 40 — 내보내기 버튼 줄과 같은 규칙). 사용자 결정 10-24 05-2 Q2 A. */}
      {step === "done" && result && !mobile && (
        <Card body="list">
          {doneResult("medium")}
          {(result.createdCategories ?? []).length > 0 && (
            <section aria-label={createdTitle} className="pt-x4">
              <ListHeader>{createdTitle}</ListHeader>
              {createdList}
            </section>
          )}
          {result.failures.length > 0 && (
            <section aria-label={failuresTitle} className="pt-x4">
              <ListHeader>{failuresTitle}</ListHeader>
              {failuresList}
            </section>
          )}
          <div
            data-slot="data-action-bar"
            className="flex justify-end px-global-gutter pt-x3 pb-x3"
          >
            <Button
              variant="neutralSolid"
              size={buttonSize}
              onClick={() => navigate("/desk/expense")}
            >
              {t("import.toLedger")}
            </Button>
          </div>
        </Card>
      )}

      <BusyOverlay busy={executing} label={t("import.importing")} />
    </div>
  );
}

type TFn = (key: string, options?: Record<string, unknown>) => string;

// ─── 단계 머리 · 카테고리 이름 ─────────────────────────────────

function StepHeader({ step: current, t }: { step: Step; t: TFn }) {
  const idx = STEP_ORDER.indexOf(current) + 1;
  const nameKey =
    current === "upload" ? "import.stepUpload" : "import.stepMapping";
  const descKey =
    current === "upload" ? "import.stepUploadDesc" : "import.stepMappingDesc";
  return (
    <header className="flex flex-col gap-x1">
      {/* 단계 원을 걷고 "2 / 3단계" + 단계 이름(Q6 6B) — 낭독은 글 그대로 읽는다 */}
      <p className="m-0 text-t3 text-fg-neutral-subtle">
        {t("import.stepMeta", { current: idx, total: STEP_ORDER.length })}
      </p>
      <h2 className="m-0 text-t5 font-bold text-fg-neutral">{t(nameKey)}</h2>
      <p className="m-0 text-t5 text-fg-neutral-muted">{t(descKey)}</p>
    </header>
  );
}

/** 카테고리 이름 줄 — ds List 줄(제목 하나씩). 서버가 상한까지만 줘서 나머지는 "외 N개" 로 센다. */
function CategoryList({
  t,
  title,
  names,
  total,
  hint,
}: {
  t: TFn;
  /** 주면 목록 제목(R5 mediumWeak) — 목록 구역 머리가 따로 있으면 주지 않는다 */
  title?: string;
  names: string[];
  total: number;
  hint?: string;
}) {
  return (
    <>
      {title && <ListHeader>{title}</ListHeader>}
      <List>
        {names.map((n) => (
          <ListItem key={n} title={n} />
        ))}
      </List>
      {total > names.length && (
        <p className="m-0 px-global-gutter pt-x3 text-t4 text-fg-neutral-subtle">
          {t("import.newCatMore", { count: fmt(total - names.length) })}
        </p>
      )}
      {hint && (
        <p className="m-0 px-global-gutter pt-x3 pb-x4 text-t4 text-fg-neutral-subtle">
          {hint}
        </p>
      )}
    </>
  );
}
