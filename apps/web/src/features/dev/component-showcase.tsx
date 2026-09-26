"use client";

/**
 * Development-only visual verification surface. Its sample copy is intentionally local
 * (English and Arabic) and is excluded from production by the route that renders it.
 */

import { NextIntlClientProvider, useTranslations } from "next-intl";
import { useState } from "react";

import ar from "../../../messages/ar.json";
import {
  ConnectionIndicator,
  OfflineNotice,
  SyncIndicator,
} from "@/components/feedback/connectivity";
import { EmptyState, ErrorState, PermissionDeniedState } from "@/components/feedback/states";
import { Breadcrumbs } from "@/components/navigation/breadcrumbs";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox, RadioGroup, Switch } from "@/components/ui/choice-controls";
import { Card, CardContent, CardHeader, InfoPanel } from "@/components/ui/card";
import {
  Avatar,
  DefinitionList,
  DefinitionRow,
  Divider,
  ListItem,
  MetricCard,
  PageHeading,
  SectionHeading,
} from "@/components/ui/content";
import { DataTable } from "@/components/ui/data-table";
import { BottomSheet, ConfirmDialog, Dialog, Drawer } from "@/components/ui/dialog";
import { DropdownMenu } from "@/components/ui/dropdown-menu";
import { Field, FormError } from "@/components/ui/field";
import { FileUpload } from "@/components/ui/file-upload";
import { FilterControl } from "@/components/ui/filter-control";
import { IconButton } from "@/components/ui/icon-button";
import { Input, SearchInput, Textarea } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { Progress } from "@/components/ui/progress";
import { RecordStatus } from "@/components/ui/record-status";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { STATUS_KEYS, StatusBadge } from "@/components/ui/status-badge";
import { ToneBadge } from "@/components/ui/tone-badge";
import { useToast } from "@/components/ui/toast";
import { Tooltip } from "@/components/ui/tooltip";
import { SecurityStateCard } from "@/features/security/security-state-card";
import { Trash2 } from "lucide-react";

const COPY = {
  en: {
    title: "Component showcase",
    description: "Development-only reference for tokens, components and states.",
    long: "A deliberately long label that must wrap without clipping or overlapping neighbouring content",
    sample: "Lead-Acid Battery (Industrial)",
    open: "Open",
    field: "E-Waste Serial / Brand Name",
    placeholder: "e.g. Model Number",
    error: "Enter a serial number or brand name.",
    hint: "Printed on the device label.",
    search: "Search serial",
    materials: ["All Materials", "Batteries", "Circuit boards"],
    filter: "Material",
    check: "Safe Storage Verified",
    radio: "Recovery site",
    radios: ["Certified Recovery Site", "Collection point"],
    toggle: "Model Training Contribution",
    upload: "Add a photo",
    column: ["Record ID", "Batch", "Status"],
    caption: "Records",
    trail: ["Reviewer Workspace", "Active Tasks"],
    breadcrumb: "Breadcrumb",
  },
  ar: {
    title: "معرض المكوّنات",
    description: "مرجع للتطوير فقط للرموز والمكوّنات والحالات.",
    long: "تسمية طويلة عن قصد يجب أن تلتف دون قص أو تداخل مع المحتوى المجاور لها في الصفحة",
    sample: "بطارية حمضية رصاصية (صناعية)",
    open: "فتح",
    field: "الرقم التسلسلي للجهاز / الفئة",
    placeholder: "مثال: بطارية ليثيوم",
    error: "أدخل الرقم التسلسلي أو اسم العلامة.",
    hint: "مطبوع على ملصق الجهاز.",
    search: "بحث عن رقم تسلسلي",
    materials: ["كل المواد", "البطاريات", "اللوحات الإلكترونية"],
    filter: "المادة",
    check: "تم التحقق من التخزين الآمن",
    radio: "موقع الاسترجاع",
    radios: ["موقع استرجاع معتمد", "نقطة تجميع"],
    toggle: "المساهمة في تدريب النموذج",
    upload: "إضافة صورة",
    column: ["رمز السجل", "الدفعة", "الحالة"],
    caption: "السجلات",
    trail: ["مساحة عمل المراجع", "المهام النشطة"],
    breadcrumb: "مسار التنقل",
  },
} as const;

type Copy = (typeof COPY)[keyof typeof COPY];

const SWATCHES = [
  ["primary", "bg-primary text-primary-foreground"],
  ["primary-dark", "bg-primary-dark text-primary-foreground"],
  ["accent", "bg-accent text-primary-foreground"],
  ["secondary", "bg-secondary text-secondary-foreground"],
  ["warning", "bg-warning text-primary-foreground"],
  ["danger", "bg-danger text-primary-foreground"],
  ["info", "bg-info text-primary-foreground"],
  ["success", "bg-success text-primary-foreground"],
  ["background", "bg-background"],
  ["surface", "bg-surface"],
  ["foreground", "bg-foreground text-primary-foreground"],
  ["muted-foreground", "bg-muted-foreground text-primary-foreground"],
  ["border", "bg-border"],
] as const;

/** Tones ToneBadge carries for meanings outside the record lifecycle. */
const TONES = ["success", "warning", "danger", "info", "neutral"] as const;

const ROWS = [
  { id: "ST-0941", batch: "Lead-Acid", status: "awaiting_handoff" },
  { id: "ST-0832", batch: "CRT", status: "action_required" },
  { id: "ST-0192", batch: "Circuit boards", status: "synchronized" },
] as const;

/** Figma SharedSecurityStatesShell shows both cards side by side; the routes show one each. */
function SecurityStatePair() {
  const translate = useTranslations("security");
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <SecurityStateCard
        actionHref="/"
        actionLabel={translate("accessDeniedAction")}
        as="h3"
        description={translate("accessDeniedDescription")}
        notice={translate("accessDeniedNotice")}
        noticeTitle={translate("accessDeniedNoticeTitle")}
        title={translate("accessDeniedTitle")}
        tone="danger"
      />
      <SecurityStateCard
        actionHref="/sign-in"
        actionLabel={translate("sessionExpiredAction")}
        as="h3"
        description={translate("sessionExpiredDescription")}
        notice={translate("sessionExpiredNotice")}
        noticeTitle={translate("sessionExpiredNoticeTitle")}
        title={translate("sessionExpiredTitle")}
        tone="warning"
      />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <SectionHeading>{title}</SectionHeading>
      {children}
    </section>
  );
}

function ToastButton() {
  const { show } = useToast();
  return (
    <Button
      onClick={() => show({ title: "Saved", description: "Toast example", tone: "success" })}
      variant="secondary"
    >
      Toast
    </Button>
  );
}

function ComponentSet({ copy }: { copy: Copy }) {
  const [dialog, setDialog] = useState<"dialog" | "confirm" | "sheet" | "drawer" | null>(null);
  const [page, setPage] = useState(1);
  const close = () => setDialog(null);
  return (
    <div className="space-y-8">
      <PageHeading description={copy.description}>{copy.title}</PageHeading>

      <Section title="Colour tokens">
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {SWATCHES.map(([name, classes]) => (
            <li className={`rounded-sm border p-3 text-xs font-bold ${classes}`} key={name}>
              {name}
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Typography">
        <div className="space-y-1">
          <p className="text-primary-dark text-[2rem] font-extrabold">32 ExtraBold</p>
          <p className="text-primary-dark text-xl font-bold">20 Bold</p>
          <p className="text-base">16 Regular</p>
          <p className="text-muted-foreground text-sm">14 Muted</p>
          <p className="text-xs">12 Small</p>
          <p className="max-w-56 text-sm">{copy.long}</p>
        </div>
      </Section>

      <Section title="Buttons">
        <div className="flex flex-wrap gap-2">
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="tertiary">Tertiary</Button>
          <Button variant="destructive">Destructive</Button>
          <Button variant="destructiveOutline">Outline danger</Button>
          <Button loading>Loading</Button>
          <Button disabled>Disabled</Button>
          <IconButton icon={Trash2} label="Delete" variant="secondary" />
          <Tooltip content="Delete the record">
            <IconButton icon={Trash2} label="Delete with tooltip" variant="secondary" />
          </Tooltip>
        </div>
      </Section>

      <Section title="Forms">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field hint={copy.hint} label={copy.field}>
            {(control) => <Input placeholder={copy.placeholder} {...control} />}
          </Field>
          <Field error={copy.error} label={copy.field} required>
            {(control) => <Input {...control} />}
          </Field>
          <Field label={copy.field}>{(control) => <Textarea {...control} />}</Field>
          <Field label={copy.field}>
            {(control) => (
              <Select {...control}>
                {copy.materials.map((label) => (
                  <option key={label}>{label}</option>
                ))}
              </Select>
            )}
          </Field>
          <SearchInput label={copy.search} placeholder={copy.search} />
          <Field label={copy.field}>
            {(control) => <Input disabled placeholder={copy.placeholder} {...control} />}
          </Field>
          <div>
            <Checkbox defaultChecked label={copy.check} />
            <Checkbox label={copy.check} />
            <Switch defaultChecked label={copy.toggle} />
          </div>
          <RadioGroup
            defaultValue="a"
            legend={copy.radio}
            name="showcase-radio"
            options={[
              { value: "a", label: copy.radios[0] },
              { value: "b", label: copy.radios[1] },
            ]}
          />
          <FileUpload hint={copy.hint} label={copy.upload} />
        </div>
        <FormError title={copy.error}>{copy.hint}</FormError>
      </Section>

      <Section title="Security states">
        <SecurityStatePair />
      </Section>

      <Section title="Status badges">
        <ul className="flex flex-wrap gap-2">
          {STATUS_KEYS.map((key) => (
            <li key={key}>
              <StatusBadge status={key} />
            </li>
          ))}
        </ul>
        <ul className="flex flex-wrap gap-2">
          {TONES.map((tone) => (
            <li key={tone}>
              <ToneBadge tone={tone}>{tone}</ToneBadge>
            </li>
          ))}
        </ul>
        <RecordStatus
          gps="verified_gps"
          state="awaiting_handoff"
          synchronization="pending_synchronization"
        />
        <div className="flex flex-wrap gap-4">
          <SyncIndicator state="synchronizing" />
          <SyncIndicator state="action_required" />
          <ConnectionIndicator />
          <ConnectionIndicator forceOffline />
        </div>
      </Section>

      <Section title="Panels and alerts">
        <div className="grid gap-3 sm:grid-cols-3">
          <InfoPanel title="Safety Guidance" tone="danger">
            {copy.long}
          </InfoPanel>
          <InfoPanel title="Indicative Estimate" tone="warning">
            {copy.long}
          </InfoPanel>
          <InfoPanel title="Verified Outcome" tone="success">
            {copy.long}
          </InfoPanel>
        </div>
        <Alert title="Storage Nearly Full" tone="danger">
          89%
        </Alert>
        <Alert title="Stale Cached Data" tone="warning">
          3
        </Alert>
        <Alert title="Information" tone="info">
          {copy.hint}
        </Alert>
        <OfflineNotice forceVisible />
      </Section>

      <Section title="Content">
        <div className="grid gap-3 sm:grid-cols-3">
          <MetricCard label={copy.column[0]} value="14" />
          <MetricCard label={copy.column[1]} tone="success" value="184.2 kg" />
          <MetricCard label={copy.column[2]} tone="warning" value="84" />
        </div>
        <ul className="space-y-2">
          <ListItem
            status={<StatusBadge status="pending_synchronization" />}
            subtitle="ST-0941"
            title={copy.sample}
            value="4.2kg Pb"
          />
        </ul>
        <Card>
          <CardHeader>
            <h3 className="font-bold">{copy.sample}</h3>
          </CardHeader>
          <CardContent>
            <DefinitionList>
              <DefinitionRow term={copy.column[0]}>ST-0941</DefinitionRow>
              <DefinitionRow term={copy.column[1]} tone="success">
                98.4%
              </DefinitionRow>
            </DefinitionList>
          </CardContent>
        </Card>
        <div className="flex items-center gap-3">
          <Avatar />
          <Badge>{copy.trail[0]}</Badge>
          <Divider orientation="vertical" />
        </div>
        <Breadcrumbs
          items={[{ label: copy.trail[0], href: "/" }, { label: copy.trail[1] }]}
          label={copy.breadcrumb}
        />
      </Section>

      <Section title="Loading, empty and error">
        <div className="flex items-center gap-3">
          <Spinner />
          <Progress label={copy.column[2]} value={60} />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
        </div>
        <EmptyState />
        <ErrorState actionLabel="Retry" onAction={() => undefined} />
        <PermissionDeniedState />
      </Section>

      <Section title="Overlays and menus">
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={() => setDialog("dialog")} variant="secondary">
            {copy.open} dialog
          </Button>
          <Button onClick={() => setDialog("confirm")} variant="secondary">
            {copy.open} confirm
          </Button>
          <Button onClick={() => setDialog("sheet")} variant="secondary">
            {copy.open} sheet
          </Button>
          <Button onClick={() => setDialog("drawer")} variant="secondary">
            {copy.open} drawer
          </Button>
          <ToastButton />
          <DropdownMenu
            items={[
              { id: "one", label: copy.column[0] },
              { id: "two", label: copy.column[1] },
            ]}
            label="Menu"
            trigger={<span>Menu</span>}
          />
        </div>
        <Dialog onClose={close} open={dialog === "dialog"} title={copy.title}>
          {copy.long}
        </Dialog>
        <BottomSheet onClose={close} open={dialog === "sheet"} title={copy.title}>
          {copy.long}
        </BottomSheet>
        <Drawer onClose={close} open={dialog === "drawer"} title={copy.title}>
          {copy.long}
        </Drawer>
        <ConfirmDialog
          cancelLabel="Cancel"
          confirmLabel="Confirm"
          description={copy.long}
          destructive
          onClose={close}
          onConfirm={close}
          open={dialog === "confirm"}
          title={copy.title}
        />
      </Section>

      <Section title="Data display">
        <div className="flex flex-wrap gap-2">
          <FilterControl
            label={copy.filter}
            options={copy.materials.map((label) => ({ value: label, label }))}
          />
          <SearchInput className="min-w-48 flex-1" label={copy.search} placeholder={copy.search} />
        </div>
        <DataTable
          caption={copy.caption}
          columns={[
            { key: "id", header: copy.column[0], primary: true, cell: (row) => row.id },
            { key: "batch", header: copy.column[1], cell: (row) => row.batch },
            {
              key: "status",
              header: copy.column[2],
              cell: (row) => <StatusBadge status={row.status} />,
            },
          ]}
          getRowId={(row) => row.id}
          rows={ROWS}
        />
        <Pagination onPageChange={setPage} page={page} pageCount={3} />
      </Section>
    </div>
  );
}

export function ComponentShowcase() {
  return (
    <div className="content-container space-y-12 py-8">
      <ComponentSet copy={COPY.en} />
      <div
        className="space-y-2 rounded-md border border-dashed p-4"
        data-testid="rtl-sample"
        dir="rtl"
        lang="ar"
      >
        <NextIntlClientProvider locale="ar" messages={ar}>
          <ComponentSet copy={COPY.ar} />
        </NextIntlClientProvider>
      </div>
      <div
        className="max-w-80 space-y-4 rounded-md border border-dashed p-2"
        data-testid="narrow-sample"
      >
        <Field label={COPY.en.field}>
          {(control) => <Input placeholder={COPY.en.placeholder} {...control} />}
        </Field>
        <StatusBadge status="awaiting_handoff" />
        <p className="text-sm">{COPY.en.long}</p>
      </div>
    </div>
  );
}
