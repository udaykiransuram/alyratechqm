"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import AppPrefetchLink from "@/components/navigation/AppPrefetchLink";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import FeedbackNotice from "@/components/ui/feedback-notice";
import { Input } from "@/components/ui/input";
import ListPaginationLinks from "@/components/ui/list-pagination-links";
import {
  fetchApiJson,
  getClientRequestErrorMessage,
} from "@/lib/client/api";
import type {
  WorkspacePublicTestsConfig,
  WorkspacePublicTestsPageData,
} from "@/lib/server/workspace-public-tests";

type PublicTestsPageClientProps = {
  basePath: string;
  initialData: WorkspacePublicTestsPageData;
};

type WorkspacePublicTestsConfigResponse = {
  success?: boolean;
  message?: string;
  config?: WorkspacePublicTestsConfig;
};

function buildPageHref(params: {
  basePath: string;
  leadPage: number;
  resultPage: number;
  leadClassBand: string;
  resultClassBand: string;
}) {
  const searchParams = new URLSearchParams();

  if (params.leadPage > 1) {
    searchParams.set("leadPage", String(params.leadPage));
  }

  if (params.resultPage > 1) {
    searchParams.set("resultPage", String(params.resultPage));
  }

  if (params.leadClassBand !== "all") {
    searchParams.set("leadClassBand", params.leadClassBand);
  }

  if (params.resultClassBand !== "all") {
    searchParams.set("resultClassBand", params.resultClassBand);
  }

  const query = searchParams.toString();
  return query ? `${params.basePath}?${query}` : params.basePath;
}

function getMappingStatusTone(status: "ready" | "missing" | "invalid") {
  if (status === "ready") {
    return "bg-emerald-500/12 text-emerald-700";
  }

  if (status === "invalid") {
    return "bg-rose-500/12 text-rose-700";
  }

  return "bg-amber-500/12 text-amber-700";
}

export default function PublicTestsPageClient({
  basePath,
  initialData,
}: PublicTestsPageClientProps) {
  const router = useRouter();
  const [config, setConfig] = useState(initialData.config);
  const [title, setTitle] = useState(initialData.config.title);
  const [supportContact, setSupportContact] = useState(
    initialData.config.supportContact,
  );
  const [isActive, setIsActive] = useState(initialData.config.isActive);
  const [mappingValues, setMappingValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      initialData.config.classBandCards.map((card) => [
        card.classBand,
        card.diagnosticQuestionPaperId || "",
      ]),
    ),
  );
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isSaving, startSaveTransition] = useTransition();
  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const [diagnosticDetails, setDiagnosticDetails] = useState<
    Record<string, any> | null
  >(null);

  useEffect(() => {
    setConfig(initialData.config);
    setTitle(initialData.config.title);
    setSupportContact(initialData.config.supportContact);
    setIsActive(initialData.config.isActive);
    setMappingValues(
      Object.fromEntries(
        initialData.config.classBandCards.map((card) => [
          card.classBand,
          card.diagnosticQuestionPaperId || "",
        ]),
      ),
    );
  }, [initialData]);

  const leadPreviousHref =
    initialData.leads.page > 1
      ? buildPageHref({
          basePath,
          leadPage: initialData.leads.page - 1,
          resultPage: initialData.results.page,
          leadClassBand: initialData.filters.leadClassBand,
          resultClassBand: initialData.filters.resultClassBand,
        })
      : null;
  const leadNextHref =
    initialData.leads.page < initialData.leads.pages
      ? buildPageHref({
          basePath,
          leadPage: initialData.leads.page + 1,
          resultPage: initialData.results.page,
          leadClassBand: initialData.filters.leadClassBand,
          resultClassBand: initialData.filters.resultClassBand,
        })
      : null;
  const resultPreviousHref =
    initialData.results.page > 1
      ? buildPageHref({
          basePath,
          leadPage: initialData.leads.page,
          resultPage: initialData.results.page - 1,
          leadClassBand: initialData.filters.leadClassBand,
          resultClassBand: initialData.filters.resultClassBand,
        })
      : null;
  const resultNextHref =
    initialData.results.page < initialData.results.pages
      ? buildPageHref({
          basePath,
          leadPage: initialData.leads.page,
          resultPage: initialData.results.page + 1,
          leadClassBand: initialData.filters.leadClassBand,
          resultClassBand: initialData.filters.resultClassBand,
        })
      : null;

  const dirty = useMemo(() => {
    const mappingsChanged = config.classBandCards.some(
      (card) =>
        String(mappingValues[card.classBand] || "") !==
        String(card.diagnosticQuestionPaperId || ""),
    );

    return (
      mappingsChanged ||
      title !== config.title ||
      supportContact !== config.supportContact ||
      isActive !== config.isActive
    );
  }, [config, isActive, mappingValues, supportContact, title]);

  const handleSave = () => {
    setErrorMessage("");
    setSuccessMessage("");

    startSaveTransition(() => {
      void (async () => {
        try {
          const response = await fetchApiJson<WorkspacePublicTestsConfigResponse>(
            "/api/workspace/public-tests",
            {
              method: "PUT",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                title,
                supportContact,
                isActive,
                classMappings: config.classBandCards.map((card) => ({
                  classBand: card.classBand,
                  diagnosticQuestionPaperId:
                    String(mappingValues[card.classBand] || "").trim() || null,
                })),
              }),
              fallbackMessage:
                "We couldn't save summer public-test settings.",
            },
          );

          if (!response?.config) {
            throw new Error(
              response?.message ||
                "We couldn't save summer public-test settings.",
            );
          }

          setConfig(response.config);
          setTitle(response.config.title);
          setSupportContact(response.config.supportContact);
          setIsActive(response.config.isActive);
          setMappingValues(
            Object.fromEntries(
              response.config.classBandCards.map((card) => [
                card.classBand,
                card.diagnosticQuestionPaperId || "",
              ]),
            ),
          );
          setSuccessMessage("Summer public-test settings were saved.");
        } catch (error) {
          setErrorMessage(
            getClientRequestErrorMessage(
              error,
              "We couldn't save summer public-test settings.",
            ),
          );
        }
      })();
    });
  };

  const handleDiagnose = async (card: WorkspacePublicTestsConfig["classBandCards"][number]) => {
    if (!card.diagnosticQuestionPaperId) {
      setErrorMessage("Select a diagnostic paper first.");
      return;
    }
    setErrorMessage("");
    setSuccessMessage("");
    setIsDiagnosing(true);
    setDiagnosticDetails(null);

    try {
      const response = await fetchApiJson<any>(
        `/api/workspace/public-tests/diagnose?paperId=${encodeURIComponent(
          card.diagnosticQuestionPaperId,
        )}&classBand=${encodeURIComponent(card.classBand)}`,
        {
          fallbackMessage: "We couldn't diagnose this diagnostic paper.",
        },
      );

      if (!response?.diagnostic) {
        throw new Error(response?.message || "We couldn't diagnose this paper.");
      }

      setDiagnosticDetails(response);
      setSuccessMessage("Diagnostic details loaded.");
    } catch (error) {
      setErrorMessage(
        getClientRequestErrorMessage(
          error,
          "We couldn't diagnose this diagnostic paper.",
        ),
      );
    } finally {
      setIsDiagnosing(false);
    }
  };

  const handleFilterChange = (
    key: "leadClassBand" | "resultClassBand",
    value: string,
  ) => {
    const nextHref = buildPageHref({
      basePath,
      leadPage: key === "leadClassBand" ? 1 : initialData.leads.page,
      resultPage: key === "resultClassBand" ? 1 : initialData.results.page,
      leadClassBand:
        key === "leadClassBand" ? value : initialData.filters.leadClassBand,
      resultClassBand:
        key === "resultClassBand" ? value : initialData.filters.resultClassBand,
    });

    router.push(nextHref, { scroll: false });
  };

  return (
    <div className="space-y-6">
      {errorMessage ? (
        <FeedbackNotice variant="error">{errorMessage}</FeedbackNotice>
      ) : null}
      {successMessage ? (
        <FeedbackNotice variant="success">{successMessage}</FeedbackNotice>
      ) : null}

      <Card className="app-surface overflow-hidden">
        <CardHeader className="app-section-header">
          <CardTitle>Landing & Registration Settings</CardTitle>
        </CardHeader>
        <CardContent className="app-section-body space-y-4">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
            <div className="space-y-4">
              <div className="app-field-group">
                <label className="app-field-label" htmlFor="public-test-title">
                  Public title
                </label>
                <Input
                  id="public-test-title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Summer campaign title"
                />
              </div>

              <div className="app-field-group">
                <label
                  className="app-field-label"
                  htmlFor="public-test-support-contact"
                >
                  Support contact
                </label>
                <Input
                  id="public-test-support-contact"
                  value={supportContact}
                  onChange={(event) => setSupportContact(event.target.value)}
                  placeholder="WhatsApp, phone, or support email"
                />
              </div>
            </div>

            <div className="space-y-4 rounded-[1.25rem] border border-border/70 bg-background/70 p-4">
              <div className="space-y-2">
                <p className="text-sm font-semibold text-foreground">
                  Funnel status
                </p>
                <p className="text-sm leading-6 text-muted-foreground">
                  Switch this off to close new summer registrations without
                  changing the question and paper authoring setup.
                </p>
              </div>
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(event) => setIsActive(event.target.checked)}
                  className="mt-1 h-4 w-4"
                />
                <span className="text-sm leading-6 text-muted-foreground">
                  Public summer landing and registration are active.
                </span>
              </label>
              <div className="flex flex-wrap gap-2">
                <span className="app-meta-chip">
                  {isActive ? "Registration open" : "Registration closed"}
                </span>
                <AppPrefetchLink
                  href="/workspace/questions/create?returnTo=/workspace/public-tests"
                  className="app-meta-chip"
                >
                  Create question
                </AppPrefetchLink>
                <AppPrefetchLink
                  href="/workspace/question-papers?class=&returnTo=/workspace/public-tests"
                  className="app-meta-chip"
                >
                  Browse papers
                </AppPrefetchLink>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              className="app-button-compact"
              onClick={() => router.refresh()}
              disabled={isSaving}
            >
              Refresh
            </Button>
            <Button
              type="button"
              className="app-button-page"
              onClick={handleSave}
              disabled={isSaving || !dirty}
            >
              {isSaving ? "Saving..." : "Save Public-Test Settings"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="app-surface overflow-hidden">
        <CardHeader className="app-section-header">
          <CardTitle>Class-Band Diagnostic Mapping</CardTitle>
        </CardHeader>
        <CardContent className="app-section-body">
          <div className="grid gap-4 xl:grid-cols-2">
            {config.classBandCards.map((card) => (
              <div
                key={card.classBand}
                className="rounded-[1.35rem] border border-border/70 bg-background/80 p-4 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-lg font-semibold text-foreground">
                      {card.classBand}
                    </p>
                    <p className="text-sm leading-6 text-muted-foreground">
                      Use one online, instant-result paper for the public
                      diagnostic path.
                    </p>
                  </div>
                  <span
                    className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getMappingStatusTone(card.mappingStatus)}`}
                  >
                    {card.mappingStatus === "ready"
                      ? "Mapped"
                      : card.mappingStatus === "invalid"
                        ? "Needs attention"
                        : "Not mapped"}
                  </span>
                </div>

                <div className="mt-4 space-y-4">
                  <div className="rounded-[1rem] border border-border/60 bg-muted/10 p-3">
                    <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">
                      Current paper
                    </p>
                    <p className="mt-2 text-sm font-medium text-foreground">
                      {card.mappedPaper
                        ? card.mappedPaper.title
                        : card.mappingStatus === "invalid"
                          ? card.mappedPaperIssue ||
                            "The saved paper is no longer valid for public diagnostic use."
                          : "No paper mapped yet."}
                    </p>
                    {card.mappedPaper ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {card.mappedPaper.totalMarks} marks • {card.mappedPaper.duration} min
                      </p>
                    ) : null}
                    {card.mappingStatus === "invalid" && card.mappedPaperIssue ? (
                      <p className="mt-2 text-xs text-rose-600">
                        {card.mappedPaperIssue}
                      </p>
                    ) : null}
                  </div>

                  <div className="app-field-group">
                    <label
                      className="app-field-label"
                      htmlFor={`diagnostic-paper-${card.classBand}`}
                    >
                      Diagnostic paper
                    </label>
                    <select
                      id={`diagnostic-paper-${card.classBand}`}
                      className="public-flow-input"
                      value={mappingValues[card.classBand] || ""}
                      onChange={(event) =>
                        setMappingValues((current) => ({
                          ...current,
                          [card.classBand]: event.target.value,
                        }))
                      }
                    >
                      <option value="">No paper mapped</option>
                      {card.candidatePapers.map((paper) => (
                        <option key={paper._id} value={paper._id}>
                          {paper.title} • {paper.totalMarks} marks • {paper.duration} min
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-muted-foreground">
                      Only online papers without section scoping or manual
                      review appear here.
                    </p>
                    {card.candidatePapers.length === 0 ? (
                      <div className="mt-3 rounded-xl border border-amber-200/70 bg-amber-50/60 p-3 text-xs text-amber-900">
                        <p className="font-semibold">No eligible papers found.</p>
                        <p className="mt-1 text-amber-900/80">
                          To appear here, a paper must:
                        </p>
                        <ul className="mt-2 list-disc space-y-1 pl-4 text-amber-900/80">
                          <li>Be online enabled.</li>
                          <li>Have no assigned sections (open to full class).</li>
                          <li>Not require manual review.</li>
                          <li>Use only online-supported question types.</li>
                        </ul>
                      </div>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button asChild variant="outline" size="sm" className="app-button-compact">
                      <AppPrefetchLink href={`/workspace/question-papers?returnTo=/workspace/public-tests`}>
                        Browse Papers
                      </AppPrefetchLink>
                    </Button>
                    <Button asChild variant="outline" size="sm" className="app-button-compact">
                      <AppPrefetchLink href={`/workspace/question-papers/create?returnTo=/workspace/public-tests`}>
                        Create Paper
                      </AppPrefetchLink>
                    </Button>
                    <Button asChild variant="outline" size="sm" className="app-button-compact">
                      <AppPrefetchLink href={`/workspace/questions/create?returnTo=/workspace/public-tests`}>
                        Create Question
                      </AppPrefetchLink>
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="app-button-compact"
                      onClick={() => handleDiagnose(card)}
                      disabled={isDiagnosing}
                    >
                      {isDiagnosing ? "Diagnosing..." : "Validate Paper"}
                    </Button>
                  </div>

                  {diagnosticDetails &&
                  diagnosticDetails?.paperId === card.diagnosticQuestionPaperId &&
                  diagnosticDetails?.classBand === card.classBand ? (
                    <div className="mt-4 rounded-xl border border-border/70 bg-muted/10 p-4 text-xs text-muted-foreground">
                      <p className="text-sm font-semibold text-foreground">
                        Validation details
                      </p>
                      <p className="mt-2">
                        Status: {diagnosticDetails.diagnostic.ok ? "Ready" : "Needs attention"}
                      </p>
                      {diagnosticDetails.diagnostic.issues?.length ? (
                        <ul className="mt-2 list-disc space-y-1 pl-4">
                          {diagnosticDetails.diagnostic.issues.map((issue: string) => (
                            <li key={issue}>{issue}</li>
                          ))}
                        </ul>
                      ) : null}
                      {diagnosticDetails.diagnostic.missingQuestionIds?.length ? (
                        <div className="mt-3">
                          <p className="font-semibold text-foreground">
                            Missing question references
                          </p>
                          <p className="mt-1 break-all">
                            {diagnosticDetails.diagnostic.missingQuestionIds.join(", ")}
                          </p>
                        </div>
                      ) : null}
                      {diagnosticDetails.diagnostic.missingTypeQuestionIds?.length ? (
                        <div className="mt-3">
                          <p className="font-semibold text-foreground">
                            Missing question types
                          </p>
                          <p className="mt-1 break-all">
                            {diagnosticDetails.diagnostic.missingTypeQuestionIds.join(", ")}
                          </p>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="app-surface overflow-hidden">
          <CardHeader className="app-section-header">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle>Registrations & Leads</CardTitle>
              <select
                className="public-flow-input min-w-[10rem]"
                value={initialData.filters.leadClassBand}
                onChange={(event) =>
                  handleFilterChange("leadClassBand", event.target.value)
                }
              >
                {initialData.classBandOptions.map((classBand) => (
                  <option key={classBand} value={classBand}>
                    {classBand === "all" ? "All class bands" : classBand}
                  </option>
                ))}
              </select>
            </div>
          </CardHeader>
          <CardContent className="app-section-body space-y-4">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-left text-muted-foreground">
                  <tr className="border-b border-border/60">
                    <th className="px-3 py-2 font-medium">Student</th>
                    <th className="px-3 py-2 font-medium">Class</th>
                    <th className="px-3 py-2 font-medium">Entry</th>
                    <th className="px-3 py-2 font-medium">Diagnostic</th>
                    <th className="px-3 py-2 font-medium">Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {initialData.leads.items.map((lead) => (
                    <tr key={lead._id} className="border-b border-border/40">
                      <td className="px-3 py-3 align-top">
                        <p className="font-medium text-foreground">
                          {lead.studentName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {lead.guardianName || "Guardian not added"}
                        </p>
                        <p className="text-xs text-muted-foreground">{lead.phone}</p>
                      </td>
                      <td className="px-3 py-3 align-top">{lead.classBand}</td>
                      <td className="px-3 py-3 align-top">
                        {lead.entrySource === "diagnostic"
                          ? "Diagnostic"
                          : "Direct registration"}
                      </td>
                      <td className="px-3 py-3 align-top">{lead.diagnosticStatus}</td>
                      <td className="px-3 py-3 align-top">
                        {lead.joinedAt
                          ? new Date(lead.joinedAt).toLocaleDateString()
                          : "—"}
                      </td>
                    </tr>
                  ))}
                  {initialData.leads.items.length === 0 ? (
                    <tr>
                      <td
                        className="px-3 py-6 text-center text-sm text-muted-foreground"
                        colSpan={5}
                      >
                        No summer registrations match this filter yet.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>

            <ListPaginationLinks
              page={initialData.leads.page}
              totalPages={initialData.leads.pages}
              totalItems={initialData.leads.total}
              pageSize={initialData.leads.limit}
              itemLabel="registrations"
              previousHref={leadPreviousHref}
              nextHref={leadNextHref}
              hideWhenSinglePage={false}
            />
          </CardContent>
        </Card>

        <Card className="app-surface overflow-hidden">
          <CardHeader className="app-section-header">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle>Diagnostic Results</CardTitle>
              <select
                className="public-flow-input min-w-[10rem]"
                value={initialData.filters.resultClassBand}
                onChange={(event) =>
                  handleFilterChange("resultClassBand", event.target.value)
                }
              >
                {initialData.classBandOptions.map((classBand) => (
                  <option key={classBand} value={classBand}>
                    {classBand === "all" ? "All class bands" : classBand}
                  </option>
                ))}
              </select>
            </div>
          </CardHeader>
          <CardContent className="app-section-body space-y-4">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-left text-muted-foreground">
                  <tr className="border-b border-border/60">
                    <th className="px-3 py-2 font-medium">Student</th>
                    <th className="px-3 py-2 font-medium">Paper</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Score</th>
                    <th className="px-3 py-2 font-medium">Report</th>
                  </tr>
                </thead>
                <tbody>
                  {initialData.results.items.map((result) => (
                    <tr key={result._id} className="border-b border-border/40">
                      <td className="px-3 py-3 align-top">
                        <p className="font-medium text-foreground">
                          {result.studentName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {result.classBand}
                        </p>
                      </td>
                      <td className="px-3 py-3 align-top">
                        <p className="font-medium text-foreground">
                          {result.paperTitle}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {result.completedAt
                            ? new Date(result.completedAt).toLocaleDateString()
                            : result.startedAt
                              ? new Date(result.startedAt).toLocaleDateString()
                              : "—"}
                        </p>
                      </td>
                      <td className="px-3 py-3 align-top">{result.diagnosticStatus}</td>
                      <td className="px-3 py-3 align-top">
                        {result.score !== null
                          ? `${result.score}${result.percent !== null ? ` • ${result.percent}%` : ""}`
                          : "—"}
                      </td>
                      <td className="px-3 py-3 align-top">
                        {result.workspaceReportHref ? (
                          <AppPrefetchLink
                            href={result.workspaceReportHref}
                            className="public-flow-text-link"
                          >
                            Open Report
                          </AppPrefetchLink>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  ))}
                  {initialData.results.items.length === 0 ? (
                    <tr>
                      <td
                        className="px-3 py-6 text-center text-sm text-muted-foreground"
                        colSpan={5}
                      >
                        No diagnostic result rows match this filter yet.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>

            <ListPaginationLinks
              page={initialData.results.page}
              totalPages={initialData.results.pages}
              totalItems={initialData.results.total}
              pageSize={initialData.results.limit}
              itemLabel="results"
              previousHref={resultPreviousHref}
              nextHref={resultNextHref}
              hideWhenSinglePage={false}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
