import { useId, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  BarChart3,
  Bell,
  CalendarClock,
  CircleAlert,
  CreditCard,
  FileBarChart,
  Mail,
  Moon,
  Target,
  Users,
  Vibrate,
  Volume2,
  Zap,
} from "lucide-react";
import {
  useCurrentUser,
  useUpdateUserPreferences,
  useUserPreferences,
  type EmailFrequency,
  type NotificationSound,
  type UserPreferences,
} from "@/features/user";
import {
  BottomSheet,
  BottomSheetBody,
  BottomSheetContent,
  BottomSheetFooter,
} from "@/shared/ds/bottom-sheet";
import { Button } from "@/shared/ds/button";
import { Card } from "@/shared/ds/card";
import { useInputButtonSurface } from "@/shared/ds/input-button";
import {
  List,
  ListButtonItem,
  ListHeader,
  ListItem,
  ListRadioGroup,
  ListRadioItem,
  ListSwitchItem,
} from "@/shared/ds/list";
import {
  Popover,
  PopoverBody,
  PopoverContent,
  PopoverFooter,
  PopoverTrigger,
} from "@/shared/ds/popover";
import { ResultSection } from "@/shared/ds/result-section";
import { Skeleton } from "@/shared/ds/skeleton";
import { useSnackbar } from "@/shared/ds/snackbar";
import {
  TimePicker,
  formatTimeValue,
  roundToStep,
  type TimeValue,
} from "@/shared/ds/time-picker";
import { ManagerHead } from "@/shared/ui/groo/manager-layout";
import { ThresholdSlider } from "./ThresholdSlider";

const ICON = { "aria-hidden": true } as const;

/** 알림 종류 일곱 — 앞 아이콘은 그림 TYPES 의 이름 그대로(I-15 49). */
const NOTIFY_ROWS: {
  field:
    | "notifyPayment"
    | "notifyBudget"
    | "notifyAutoRecord"
    | "notifyDutchPay"
    | "notifyCalendar"
    | "notifyWeeklyReport"
    | "notifyMonthlyReport";
  icon: ReactNode;
  titleKey: string;
  descKey: string;
}[] = [
  {
    field: "notifyPayment",
    icon: <CreditCard {...ICON} />,
    titleKey: "rows.payment.title",
    descKey: "rows.payment.desc",
  },
  {
    field: "notifyBudget",
    icon: <Target {...ICON} />,
    titleKey: "rows.budget.title",
    descKey: "rows.budget.desc",
  },
  {
    field: "notifyAutoRecord",
    icon: <Zap {...ICON} />,
    titleKey: "rows.autoRecord.title",
    descKey: "rows.autoRecord.desc",
  },
  {
    field: "notifyDutchPay",
    icon: <Users {...ICON} />,
    titleKey: "rows.dutchPay.title",
    descKey: "rows.dutchPay.desc",
  },
  {
    field: "notifyCalendar",
    icon: <CalendarClock {...ICON} />,
    titleKey: "rows.calendar.title",
    descKey: "rows.calendar.desc",
  },
  {
    field: "notifyWeeklyReport",
    icon: <BarChart3 {...ICON} />,
    titleKey: "rows.weeklyReport.title",
    descKey: "rows.weeklyReport.desc",
  },
  {
    field: "notifyMonthlyReport",
    icon: <FileBarChart {...ICON} />,
    titleKey: "rows.monthlyReport.title",
    descKey: "rows.monthlyReport.desc",
  },
];

const SOUND_OPTIONS: { value: NotificationSound; labelKey: string }[] = [
  { value: "CHIME", labelKey: "sound.options.CHIME" },
  { value: "DEFAULT", labelKey: "sound.options.DEFAULT" },
  { value: "NONE", labelKey: "sound.options.NONE" },
];

const EMAIL_FREQ_OPTIONS: { value: EmailFrequency; labelKey: string }[] = [
  { value: "DAILY", labelKey: "email.frequency.DAILY" },
  { value: "WEEKLY", labelKey: "email.frequency.WEEKLY" },
  { value: "MONTHLY", labelKey: "email.frequency.MONTHLY" },
];

/** 들인 줄(시작 · 종료 · 발송 주기) — 앞 아이콘 자리(22)만큼 비워 제목이 부모 제목 줄에 선다(왼쪽 58). */
const INDENT = <span aria-hidden className="inline-block w-[22px]" />;

const toTime = (hhmm: string): TimeValue | undefined =>
  /^\d{2}:\d{2}$/.test(hhmm)
    ? { hour: Number(hhmm.slice(0, 2)), minute: Number(hhmm.slice(3, 5)) }
    : undefined;

/** 스위치 줄 — 켬 · 끔은 누르는 순간 적용(요청 중에도 막지 않는다). 불러오는 동안은 스위치 자리만 Skeleton. */
function SwitchRow({
  loading,
  icon,
  title,
  detail,
  checked,
  disabled,
  onChange,
}: {
  loading: boolean;
  icon: ReactNode;
  title: string;
  detail?: ReactNode;
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
}) {
  if (loading)
    return (
      <ListItem
        prefix={icon}
        title={title}
        detail={detail}
        suffix={<Skeleton radius="full" className="h-6 w-[38px]" />}
      />
    );
  return (
    <ListSwitchItem
      markSize="24"
      prefix={icon}
      title={title}
      detail={detail}
      checked={checked}
      disabled={disabled}
      onCheckedChange={onChange}
    />
  );
}

/** 값 줄 — 누르면 고르는 면(1280 미만 시트 · 이상 팝오버)이 열린다. 값은 오른쪽 끝선 하나, 꺾쇠 없음. */
function PickRow({
  indent,
  icon,
  title,
  value,
  loading,
  disabled,
  done,
  children,
}: {
  indent?: boolean;
  icon?: ReactNode;
  title: string;
  value: string;
  loading: boolean;
  disabled?: boolean;
  /** 바닥 "완료" — 시각 고르기만(고르는 동안 값은 그대로, 완료에 들어간다). 목록 고르기는 누르면 바로 넣고 닫힌다 */
  done?: { label: string; onDone: () => void };
  /** 고르는 면 안 — close 로 닫는다 */
  children: (close: () => void) => ReactNode;
}) {
  const wide = useInputButtonSurface() === "popover";
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  const prefix = indent ? INDENT : icon;
  if (loading)
    return (
      <ListItem
        prefix={prefix}
        title={title}
        suffix={<Skeleton radius="4" text="t5" className="w-16" />}
      />
    );
  const doneButton = done ? (
    <Button
      onClick={() => {
        done.onDone();
        close();
      }}
    >
      {done.label}
    </Button>
  ) : null;
  const row = (
    <ListButtonItem
      prefix={prefix}
      title={title}
      suffix={<span className="text-fg-neutral-muted">{value}</span>}
      suffixText
      disabled={disabled}
      aria-haspopup="dialog"
      aria-expanded={open}
      onClick={wide ? undefined : () => setOpen(true)}
    />
  );
  return wide ? (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{row}</PopoverTrigger>
      <PopoverContent aria-label={title} align="end">
        <PopoverBody>{children(close)}</PopoverBody>
        {doneButton && <PopoverFooter>{doneButton}</PopoverFooter>}
      </PopoverContent>
    </Popover>
  ) : (
    <>
      {row}
      <BottomSheet open={open} onOpenChange={setOpen}>
        <BottomSheetContent title={title}>
          <BottomSheetBody>{children(close)}</BottomSheetBody>
          {doneButton && <BottomSheetFooter>{doneButton}</BottomSheetFooter>}
        </BottomSheetContent>
      </BottomSheet>
    </>
  );
}

/** 시각 줄 — 12시간 · 5분 단위 Time Picker, "완료" 에 들어간다. */
function TimeRow({
  title,
  value,
  loading,
  disabled,
  doneLabel,
  onPick,
}: {
  title: string;
  value: string;
  loading: boolean;
  disabled?: boolean;
  doneLabel: string;
  onPick: (hhmm: string) => void;
}) {
  const current = toTime(value);
  const [draft, setDraft] = useState<TimeValue | undefined>(current);
  return (
    <PickRow
      indent
      title={title}
      value={formatTimeValue(current)}
      loading={loading}
      disabled={disabled}
      done={{
        label: doneLabel,
        onDone: () => {
          const v = draft ?? roundToStep(current ?? { hour: 22, minute: 0 }, 5);
          const pad = (n: number) => String(n).padStart(2, "0");
          onPick(`${pad(v.hour)}:${pad(v.minute)}`);
        },
      }}
    >
      {() => (
        <div
          className="flex justify-center"
          onPointerDownCapture={() => setDraft((d) => d ?? current)}
        >
          <TimePicker
            aria-label={title}
            value={draft ?? current}
            onValueChange={setDraft}
            minuteStep={5}
            autoFocus
          />
        </div>
      )}
    </PickRow>
  );
}

/** 묶음 제목 — List Header boldSolid · h2(폰) / h3(카드 안). 위 16, 첫 묶음은 8. */
function Group({
  title,
  headingAs,
  first,
  children,
}: {
  title: string;
  headingAs: "h2" | "h3";
  first?: boolean;
  children: ReactNode;
}) {
  const hid = useId();
  return (
    <section>
      <ListHeader
        as={headingAs}
        id={hid}
        variant="boldSolid"
        className={first ? "pt-x2" : "pt-x4"}
      >
        {title}
      </ListHeader>
      {children && <List aria-labelledby={hid}>{children}</List>}
    </section>
  );
}

export function NotificationsManager({ mobile }: { mobile: boolean }) {
  const { t } = useTranslation("notification");
  const { t: tc } = useTranslation("common");
  const snackbar = useSnackbar();
  const preferencesQ = useUserPreferences();
  const updateMut = useUpdateUserPreferences();
  const { data: currentUser } = useCurrentUser();

  const pref = preferencesQ.data;
  const isLoading = preferencesQ.isLoading;

  const pushEnabled = pref?.pushEnabled ?? true;
  const warnThreshold = pref?.budgetAlertThreshold ?? 85;
  const quietHoursEnabled = pref?.quietHoursEnabled ?? false;
  const quietHoursStart = pref?.quietHoursStart ?? "22:00";
  const quietHoursEnd = pref?.quietHoursEnd ?? "07:00";
  const notificationSound: NotificationSound =
    pref?.notificationSound ?? "DEFAULT";
  const vibrationEnabled = pref?.vibrationEnabled ?? true;
  const emailEnabled = pref?.emailEnabled ?? false;
  const emailFrequency: EmailFrequency = pref?.emailFrequency ?? "WEEKLY";

  // 예산 경고 기준을 끄는 동안의 값 — 머리 값 · 슬라이더가 따라가고, 저장이 끝나면 서버 값으로 돌아온다
  const [drag, setDrag] = useState<number | null>(null);
  // 기준 저장이 실패하면 값은 서버 값으로 되돌아가고(onSettled) 슬라이더 아래 오류 글로 알린다(slider.yaml commit)
  const [thresholdFailed, setThresholdFailed] = useState(false);
  const thresholdErrorId = useId();
  const thresholdLabelId = useId();
  const shownThreshold = drag ?? warnThreshold;

  // 스위치 · 값 줄 저장 — 누르는 순간 적용. 실패하면 값은 서버 값 그대로(되돌림)이고 critical 스낵바 고정 글을 띄운다.
  // 요청은 silent(전역 서버 글 없음), [다시 시도] 는 두지 않는다 — 스위치를 다시 누르는 것이 재시도다(I-15 덧붙임 14-1 M1).
  const save = (patch: Partial<UserPreferences>) =>
    updateMut.mutate(patch, {
      onError: () =>
        snackbar.show({ message: t("settingsSaveFailed"), tone: "critical" }),
    });

  const headingAs = mobile ? "h2" : "h3";
  const head = !mobile && (
    <ManagerHead
      title={t("prefs.title")}
      description={t("prefs.description")}
    />
  );
  const wrap = (content: ReactNode) => (
    <div className="flex flex-col">
      {head}
      {mobile ? (
        <div className="pb-x6">{content}</div>
      ) : (
        <Card body="list">
          <div className="pb-x6">{content}</div>
        </Card>
      )}
    </div>
  );

  if (preferencesQ.isError && !pref) {
    return wrap(
      <ResultSection
        kind="failure"
        size={mobile ? "large" : "medium"}
        title={t("prefsLoadFailed.title")}
        description={t("loadFailed.desc")}
        primaryAction={{
          label: tc("retry"),
          loading: preferencesQ.isRefetching,
          onClick: () => void preferencesQ.refetch(),
        }}
      />,
    );
  }

  const off = !pushEnabled;
  return wrap(
    <>
      {/* 푸시 알림 — 맨 위 줄(묶음 제목 없음) */}
      <div className="pt-x2">
        <List aria-label={t("prefs.title")}>
          <SwitchRow
            loading={isLoading}
            icon={<Bell {...ICON} />}
            title={t("push.title")}
            detail={pushEnabled ? t("push.on") : t("push.off")}
            checked={pushEnabled}
            onChange={(v) => save({ pushEnabled: v })}
          />
        </List>
      </div>

      <Group title={t("types.title")} headingAs={headingAs}>
        {NOTIFY_ROWS.map((row) => (
          <SwitchRow
            key={row.field}
            loading={isLoading}
            icon={row.icon}
            title={t(row.titleKey)}
            detail={
              // 예산 알림 설명은 DB 기준값(budget_alert_threshold) 기반 — 아래 기준 줄과 같은 값
              row.field === "notifyBudget"
                ? t("rows.budget.desc", { threshold: warnThreshold })
                : t(row.descKey)
            }
            checked={pref?.[row.field] ?? true}
            disabled={off}
            onChange={(v) => save({ [row.field]: v })}
          />
        ))}
      </Group>

      {/* 예산 알림 기준 — 눈금 없이 양 끝 표식 */}
      <Group title={t("threshold.title")} headingAs={headingAs}>
        <li className="list-none px-global-gutter pb-x4 pt-x1">
          <div className="flex items-baseline justify-between gap-x2">
            <span id={thresholdLabelId} className="text-t4 text-fg-neutral">
              {t("threshold.label")}
            </span>
            <span className="font-bold text-t5 text-fg-neutral [font-variant-numeric:tabular-nums]">
              {shownThreshold}%
            </span>
          </div>
          <div className="py-x3">
            {isLoading ? (
              <Skeleton radius="full" className="h-1 w-full" />
            ) : (
              <ThresholdSlider
                value={shownThreshold}
                labelledBy={thresholdLabelId}
                onDrag={(v) => {
                  setThresholdFailed(false);
                  setDrag(v);
                }}
                describedBy={thresholdFailed ? thresholdErrorId : undefined}
                onCommit={(v) =>
                  updateMut.mutate(
                    { budgetAlertThreshold: v },
                    {
                      onSuccess: () => setThresholdFailed(false),
                      onError: () => setThresholdFailed(true),
                      onSettled: () => setDrag(null),
                    },
                  )
                }
              />
            )}
          </div>
          <div className="flex justify-between text-t3 text-fg-neutral-subtle">
            <span>{t("thresholdRange.min")}</span>
            <span>{t("thresholdRange.max")}</span>
          </div>
          <p className="m-0 mt-x2 text-t3 text-fg-neutral-subtle">
            {t("threshold.desc")}
          </p>
          {thresholdFailed && (
            <p
              id={thresholdErrorId}
              data-slot="field-error"
              className="m-0 mt-x2 flex text-t4 text-fg-critical"
            >
              <CircleAlert
                aria-hidden
                size={16}
                className="mr-x1_5 mt-0.5 shrink-0"
              />
              <span className="min-w-0">{t("saveError")}</span>
            </p>
          )}
        </li>
      </Group>

      <Group title={t("quiet.title")} headingAs={headingAs}>
        <SwitchRow
          loading={isLoading}
          icon={<Moon {...ICON} />}
          title={t("quiet.use.title")}
          detail={t("quiet.use.desc")}
          checked={quietHoursEnabled}
          onChange={(v) => save({ quietHoursEnabled: v })}
        />
        {(quietHoursEnabled || isLoading) && (
          <>
            <TimeRow
              title={t("quiet.start")}
              value={quietHoursStart}
              loading={isLoading}
              doneLabel={tc("done")}
              onPick={(v) => save({ quietHoursStart: v })}
            />
            <TimeRow
              title={t("quiet.end")}
              value={quietHoursEnd}
              loading={isLoading}
              doneLabel={tc("done")}
              onPick={(v) => save({ quietHoursEnd: v })}
            />
          </>
        )}
      </Group>

      <Group title={t("sound.title")} headingAs={headingAs}>
        <PickRow
          icon={<Volume2 {...ICON} />}
          title={t("sound.notif.title")}
          value={t(`sound.options.${notificationSound}`)}
          loading={isLoading}
        >
          {(close) => (
            <ListRadioGroup
              aria-label={t("sound.notif.title")}
              value={notificationSound}
              onValueChange={(v) => {
                save({ notificationSound: v as NotificationSound });
                close();
              }}
            >
              {SOUND_OPTIONS.map((o) => (
                <ListRadioItem
                  key={o.value}
                  value={o.value}
                  title={t(o.labelKey)}
                />
              ))}
            </ListRadioGroup>
          )}
        </PickRow>
        <SwitchRow
          loading={isLoading}
          icon={<Vibrate {...ICON} />}
          title={t("sound.vibration.title")}
          detail={t("sound.vibration.desc")}
          checked={vibrationEnabled}
          onChange={(v) => save({ vibrationEnabled: v })}
        />
      </Group>

      <Group title={t("email.title")} headingAs={headingAs}>
        <SwitchRow
          loading={isLoading}
          icon={<Mail {...ICON} />}
          title={t("email.receive.title")}
          detail={currentUser?.userEmail ?? t("email.empty")}
          checked={emailEnabled}
          onChange={(v) => save({ emailEnabled: v })}
        />
        {emailEnabled && (
          <PickRow
            indent
            title={t("email.frequency.label")}
            value={t(`email.frequency.${emailFrequency}`)}
            loading={isLoading}
          >
            {(close) => (
              <ListRadioGroup
                aria-label={t("email.frequency.label")}
                value={emailFrequency}
                onValueChange={(v) => {
                  save({ emailFrequency: v as EmailFrequency });
                  close();
                }}
              >
                {EMAIL_FREQ_OPTIONS.map((o) => (
                  <ListRadioItem
                    key={o.value}
                    value={o.value}
                    title={t(o.labelKey)}
                  />
                ))}
              </ListRadioGroup>
            )}
          </PickRow>
        )}
      </Group>
    </>,
  );
}
