"use client";

import {
  EwasteCategorySchema,
  SupportedLanguageSchema,
  getLanguageDirection,
  type EwasteCategory,
  type SupportedLanguage,
} from "@scraptrace/contracts";
import { Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/choice-controls";
import {
  DefinitionList,
  DefinitionRow,
  PageHeading,
  SectionHeading,
} from "@/components/ui/content";
import { Field, FormError } from "@/components/ui/field";
import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Tabs } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { AsyncPanel, useSafeErrorMessage } from "@/features/shared/async-panel";
import { ConfirmAction } from "@/features/shared/confirm-action";
import { useContractLabels } from "@/features/shared/contract-labels";
import { useValueFormats } from "@/features/shared/formats";
import {
  useApproveSafetyCard,
  useChangeSafetyCardStatus,
  useCreateSafetyDraft,
  useSafetyCards,
  useUpdateSafetyDraft,
} from "@/hooks/use-administration";
import { Link, useRouter } from "@/i18n/navigation";
import {
  SAFETY_QUESTION_KEYS,
  isExpiredSafetyCard,
  type SafetyCard,
} from "@/services/domain/safety-content";
import { addDays, toCalendarDate, todayCalendarDate } from "@/services/domain/time";

interface SourceRow {
  readonly id: string;
  label: string;
  reference: string;
}

const newSource = (): SourceRow => ({
  id: `source-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  label: "",
  reference: "",
});

const emptyAnswers = {
  what_is_it: "",
  possible_dangers: "",
  prohibited_actions: "",
  safe_actions_now: "",
  suitable_destination: "",
};

/**
 * Safety-card form.
 *
 * All five questions are required. A draft can be edited freely; approval records a named approver
 * with an approval and a review date; publishing makes the card current and archives the version it
 * replaces. Preview shows exactly what a collector would read, in the card's own language and
 * direction, so Arabic is checked right to left before it is published.
 *
 * The form's state is initialised from the card it is given, and the container remounts it when a
 * different card arrives, so no effect has to copy loaded data into state.
 */
function SafetyCardForm({ existing }: { existing: SafetyCard | null }) {
  const translate = useTranslations("screens.safetyEditor");
  const translateQuestions = useTranslations("safetyQuestions");
  const labels = useContractLabels();
  const formats = useValueFormats();
  const { show } = useToast();
  const safeMessage = useSafeErrorMessage();
  const router = useRouter();

  const createDraft = useCreateSafetyDraft();
  const updateDraft = useUpdateSafetyDraft();
  const approve = useApproveSafetyCard();
  const changeStatus = useChangeSafetyCardStatus();

  const readOnly = existing !== null && existing.status !== "draft";

  const [category, setCategory] = useState<EwasteCategory>(existing?.category ?? "refrigerators");
  const [language, setLanguage] = useState<SupportedLanguage>(existing?.language ?? "en");
  const [translatedFrom, setTranslatedFrom] = useState<SupportedLanguage | "">(
    existing?.translated_from ?? "",
  );
  const [aiAssisted, setAiAssisted] = useState(existing?.ai_assisted ?? false);
  const [answers, setAnswers] = useState<Record<string, string>>(
    existing ? { ...existing.answers } : emptyAnswers,
  );
  const [sources, setSources] = useState<readonly SourceRow[]>(() =>
    existing
      ? existing.sources.map((source, index) => ({
          id: `source-${index}`,
          label: source.label,
          reference: source.reference,
        }))
      : [newSource()],
  );
  const [approver, setApprover] = useState(existing?.approved_by ?? "");
  const [approvalDate, setApprovalDate] = useState(
    () => existing?.approval_date ?? todayCalendarDate(),
  );
  const [reviewDate, setReviewDate] = useState(
    () => existing?.review_date ?? toCalendarDate(addDays(Date.now(), 365)),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | undefined>();

  const validate = (): boolean => {
    const next: Record<string, string> = {};
    for (const key of SAFETY_QUESTION_KEYS) {
      if ((answers[key] ?? "").trim().length === 0) {
        next[key] = translate("answerRequired");
      }
    }
    const filledSources = sources.filter(
      (source) => source.label.trim().length > 0 || source.reference.trim().length > 0,
    );
    if (filledSources.length === 0) next["sources"] = translate("sourceRequired");
    if (
      filledSources.some(
        (source) => source.label.trim().length === 0 || source.reference.trim().length === 0,
      )
    ) {
      next["sources"] = translate("sourceIncomplete");
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const draftInput = () => ({
    category,
    language,
    answers: {
      what_is_it: (answers["what_is_it"] ?? "").trim(),
      possible_dangers: (answers["possible_dangers"] ?? "").trim(),
      prohibited_actions: (answers["prohibited_actions"] ?? "").trim(),
      safe_actions_now: (answers["safe_actions_now"] ?? "").trim(),
      suitable_destination: (answers["suitable_destination"] ?? "").trim(),
    },
    sources: sources
      .filter((source) => source.label.trim().length > 0)
      .map((source) => ({ label: source.label.trim(), reference: source.reference.trim() })),
    ...(translatedFrom ? { translatedFrom } : {}),
    aiAssisted,
  });

  const onSaveDraft = () => {
    setFormError(undefined);
    if (!validate()) {
      setFormError(translate("fixErrors"));
      return;
    }
    if (existing) {
      updateDraft.mutate(
        { cardId: existing.card_id, input: draftInput() },
        {
          onSuccess: () => show({ title: translate("draftSaved"), tone: "success" }),
          onError: (error) => setFormError(safeMessage(error)),
        },
      );
    } else {
      createDraft.mutate(draftInput(), {
        onSuccess: (card) => {
          show({ title: translate("draftCreated"), tone: "success" });
          router.push(`/administration/safety/cards/${card.card_id}`);
        },
        onError: (error) => setFormError(safeMessage(error)),
      });
    }
  };

  const onApprove = () => {
    if (!existing) return;
    setFormError(undefined);
    if (approver.trim().length < 2) {
      setErrors((current) => ({ ...current, approver: translate("approverRequired") }));
      setFormError(translate("fixErrors"));
      return;
    }
    if (reviewDate <= approvalDate) {
      setErrors((current) => ({ ...current, reviewDate: translate("reviewDateInvalid") }));
      setFormError(translate("fixErrors"));
      return;
    }
    approve.mutate(
      {
        cardId: existing.card_id,
        approvedBy: approver.trim(),
        approvalDate,
        reviewDate,
      },
      {
        onSuccess: () => show({ title: translate("approved"), tone: "success" }),
        onError: (error) => setFormError(safeMessage(error)),
      },
    );
  };

  const onChangeStatus = (status: "published" | "archived" | "draft") => {
    if (!existing) return;
    changeStatus.mutate(
      { cardId: existing.card_id, status },
      {
        onSuccess: () => show({ title: translate(`statusChanged.${status}`), tone: "success" }),
        onError: (error) => setFormError(safeMessage(error)),
      },
    );
  };

  const direction = getLanguageDirection(language);
  const busy =
    createDraft.isPending || updateDraft.isPending || approve.isPending || changeStatus.isPending;

  const editor = (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <SectionHeading as="h2">{translate("identityHeading")}</SectionHeading>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field label={translate("categoryLabel")} required>
            {(control) => (
              <Select
                disabled={existing !== null}
                onChange={(event) => setCategory(event.target.value as EwasteCategory)}
                value={category}
                {...control}
              >
                {EwasteCategorySchema.options.map((value) => (
                  <option key={value} value={value}>
                    {labels.category(value)}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field hint={translate("languageHint")} label={translate("languageLabel")} required>
            {(control) => (
              <Select
                disabled={existing !== null}
                onChange={(event) => setLanguage(event.target.value as SupportedLanguage)}
                value={language}
                {...control}
              >
                {SupportedLanguageSchema.options.map((value) => (
                  <option key={value} value={value}>
                    {labels.language(value)} ({value.toUpperCase()})
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field hint={translate("translatedFromHint")} label={translate("translatedFromLabel")}>
            {(control) => (
              <Select
                disabled={readOnly}
                onChange={(event) =>
                  setTranslatedFrom(event.target.value as SupportedLanguage | "")
                }
                value={translatedFrom}
                {...control}
              >
                <option value="">{translate("originalContent")}</option>
                {SupportedLanguageSchema.options
                  .filter((value) => value !== language)
                  .map((value) => (
                    <option key={value} value={value}>
                      {labels.language(value)}
                    </option>
                  ))}
              </Select>
            )}
          </Field>
          <Checkbox
            checked={aiAssisted}
            description={translate("aiAssistedHint")}
            disabled={readOnly}
            label={translate("aiAssistedLabel")}
            onChange={(event) => setAiAssisted(event.target.checked)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <SectionHeading as="h2">{translate("questionsHeading")}</SectionHeading>
          <p className="text-muted-foreground text-xs leading-5">{translate("questionsIntro")}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {SAFETY_QUESTION_KEYS.map((key, index) => (
            <Field
              error={errors[key]}
              hint={translate(`questionHint.${key}`)}
              key={key}
              label={`${index + 1}. ${translateQuestions(key)}`}
              required
            >
              {(control) => (
                <textarea
                  className="border-border bg-surface focus-visible:outline-focus min-h-24 w-full rounded-sm border p-3 text-sm focus-visible:outline-[length:var(--focus-ring-width)]"
                  dir={direction}
                  disabled={readOnly}
                  lang={language}
                  maxLength={2000}
                  onChange={(event) =>
                    setAnswers((current) => ({ ...current, [key]: event.target.value }))
                  }
                  value={answers[key] ?? ""}
                  {...control}
                />
              )}
            </Field>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <SectionHeading as="h2">{translate("sourcesHeading")}</SectionHeading>
          <p className="text-muted-foreground text-xs leading-5">{translate("sourcesIntro")}</p>
        </CardHeader>
        <CardContent className="space-y-3">
          <ul className="space-y-3">
            {sources.map((source, index) => (
              <li
                className="bg-surface-subtle grid gap-2 rounded-md border p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end"
                key={source.id}
              >
                <Field label={translate("sourceLabel", { index: index + 1 })}>
                  {(control) => (
                    <Input
                      disabled={readOnly}
                      maxLength={240}
                      onChange={(event) =>
                        setSources((current) =>
                          current.map((row) =>
                            row.id === source.id ? { ...row, label: event.target.value } : row,
                          ),
                        )
                      }
                      value={source.label}
                      {...control}
                    />
                  )}
                </Field>
                <Field label={translate("sourceReference", { index: index + 1 })}>
                  {(control) => (
                    <Input
                      disabled={readOnly}
                      maxLength={500}
                      onChange={(event) =>
                        setSources((current) =>
                          current.map((row) =>
                            row.id === source.id ? { ...row, reference: event.target.value } : row,
                          ),
                        )
                      }
                      value={source.reference}
                      {...control}
                    />
                  )}
                </Field>
                <IconButton
                  disabled={readOnly || sources.length === 1}
                  icon={Trash2}
                  label={translate("removeSource", { index: index + 1 })}
                  onClick={() =>
                    setSources((current) => current.filter((row) => row.id !== source.id))
                  }
                  variant="destructiveOutline"
                />
              </li>
            ))}
          </ul>
          {errors["sources"] ? <FormError title={errors["sources"]} /> : null}
          <Button
            disabled={readOnly}
            onClick={() => setSources((current) => [...current, newSource()])}
            variant="secondary"
          >
            <Plus aria-hidden="true" className="size-4" />
            {translate("addSource")}
          </Button>
        </CardContent>
      </Card>

      {formError ? <FormError title={formError} /> : null}

      {readOnly ? (
        <Alert title={translate("readOnlyTitle")} tone="info">
          {translate("readOnlyNotice")}
        </Alert>
      ) : (
        <Button block loading={busy} onClick={onSaveDraft} size="large">
          {translate(existing ? "saveDraft" : "createDraft")}
        </Button>
      )}
    </div>
  );

  const preview = (
    <div className="space-y-3">
      <Alert title={translate("previewTitle")} tone="info">
        {translate("previewNotice")}
      </Alert>
      <ol className="space-y-3" dir={direction} lang={language}>
        {SAFETY_QUESTION_KEYS.map((key) => (
          <li className="bg-surface rounded-md border p-3" key={key}>
            <p className="text-primary-dark text-sm font-bold">{translateQuestions(key)}</p>
            <p className="text-foreground mt-1 text-sm leading-6">
              {(answers[key] ?? "").trim().length > 0
                ? answers[key]
                : translate("previewEmptyAnswer")}
            </p>
          </li>
        ))}
      </ol>
    </div>
  );

  const workflow = (card: SafetyCard) => (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <SectionHeading as="h2">{translate("statusHeading")}</SectionHeading>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge>{labels.cardStatus(card.status)}</Badge>
            <Badge>{translate("versionBadge", { version: card.version })}</Badge>
            {isExpiredSafetyCard(card) ? (
              <Badge className="bg-danger-subtle text-danger">{translate("expiredBadge")}</Badge>
            ) : null}
          </div>
          <DefinitionList>
            <DefinitionRow term={translate("approvedBy")}>
              {card.approved_by ?? translate("notApproved")}
            </DefinitionRow>
            <DefinitionRow term={translate("approvalDate")}>
              {card.approval_date ?? "—"}
            </DefinitionRow>
            <DefinitionRow term={translate("reviewDate")}>{card.review_date ?? "—"}</DefinitionRow>
            <DefinitionRow term={translate("lastUpdated")}>
              {formats.dateTime(card.updated_at)}
            </DefinitionRow>
            <DefinitionRow term={translate("servedToCollectors")}>
              {translate(card.status === "published" && !isExpiredSafetyCard(card) ? "yes" : "no")}
            </DefinitionRow>
          </DefinitionList>
        </CardContent>
      </Card>

      {card.status === "draft" ? (
        <Card>
          <CardHeader>
            <SectionHeading as="h2">{translate("approveHeading")}</SectionHeading>
            <p className="text-muted-foreground text-xs leading-5">{translate("approveIntro")}</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field error={errors["approver"]} label={translate("approverLabel")} required>
              {(control) => (
                <Input
                  maxLength={160}
                  onChange={(event) => setApprover(event.target.value)}
                  value={approver}
                  {...control}
                />
              )}
            </Field>
            <Field label={translate("approvalDateLabel")} required>
              {(control) => (
                <Input
                  onChange={(event) => setApprovalDate(event.target.value)}
                  type="date"
                  value={approvalDate}
                  {...control}
                />
              )}
            </Field>
            <Field
              error={errors["reviewDate"]}
              hint={translate("reviewDateHint")}
              label={translate("reviewDateLabel")}
              required
            >
              {(control) => (
                <Input
                  onChange={(event) => setReviewDate(event.target.value)}
                  type="date"
                  value={reviewDate}
                  {...control}
                />
              )}
            </Field>
            <ConfirmAction
              block
              confirmLabel={translate("approveAction")}
              description={translate("approveConfirmDescription")}
              disabled={busy}
              label={translate("approveAction")}
              loading={approve.isPending}
              onConfirm={onApprove}
              title={translate("approveConfirmTitle")}
            />
          </CardContent>
        </Card>
      ) : null}

      {card.status === "approved" ? (
        <Card>
          <CardHeader>
            <SectionHeading as="h2">{translate("publishHeading")}</SectionHeading>
            <p className="text-muted-foreground text-xs leading-5">{translate("publishIntro")}</p>
          </CardHeader>
          <CardContent className="space-y-2">
            <ConfirmAction
              block
              confirmLabel={translate("publishAction")}
              description={translate("publishConfirmDescription")}
              disabled={busy}
              label={translate("publishAction")}
              loading={changeStatus.isPending}
              onConfirm={() => onChangeStatus("published")}
              title={translate("publishConfirmTitle")}
            />
            <Button
              block
              disabled={busy}
              onClick={() => onChangeStatus("draft")}
              variant="secondary"
            >
              {translate("returnToDraft")}
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {card.status === "published" ? (
        <Card>
          <CardHeader>
            <SectionHeading as="h2">{translate("archiveHeading")}</SectionHeading>
            <p className="text-muted-foreground text-xs leading-5">{translate("archiveIntro")}</p>
          </CardHeader>
          <CardContent>
            <ConfirmAction
              block
              confirmLabel={translate("archiveAction")}
              description={translate("archiveConfirmDescription")}
              destructive
              disabled={busy}
              label={translate("archiveAction")}
              loading={changeStatus.isPending}
              onConfirm={() => onChangeStatus("archived")}
              title={translate("archiveConfirmTitle")}
              variant="destructive"
            />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );

  return (
    <div className="max-w-3xl space-y-4">
      <PageHeading
        eyebrow={existing ? labels.category(existing.category) : translate("newCardEyebrow")}
      >
        {translate(existing ? "editTitle" : "newTitle")}
      </PageHeading>

      <Tabs
        items={
          existing
            ? [
                { id: "editor", label: translate("tabEditor"), content: editor },
                { id: "preview", label: translate("tabPreview"), content: preview },
                { id: "workflow", label: translate("tabWorkflow"), content: workflow(existing) },
              ]
            : [
                { id: "editor", label: translate("tabEditor"), content: editor },
                { id: "preview", label: translate("tabPreview"), content: preview },
              ]
        }
        label={translate("tabsLabel")}
      />

      <Link className={buttonVariants({ variant: "secondary" })} href="/administration/safety">
        {translate("backToList")}
      </Link>
    </div>
  );
}

/**
 * Loads the card, then mounts the form for it. The form is keyed by the card's identity and its
 * last update, so arriving or changed content replaces the form rather than being copied into its
 * state by an effect.
 */
export function SafetyCardEditor({ cardId }: { cardId?: string }) {
  const cardsQuery = useSafetyCards();

  if (!cardId) return <SafetyCardForm existing={null} key="new" />;

  return (
    <AsyncPanel
      isEmpty={(cards) => !cards.some((card) => card.card_id === cardId)}
      query={cardsQuery}
      skeletonRows={4}
    >
      {(cards) => {
        const card = cards.find((candidate) => candidate.card_id === cardId);
        if (!card) return null;
        return <SafetyCardForm existing={card} key={`${card.card_id}:${card.updated_at}`} />;
      }}
    </AsyncPanel>
  );
}
