"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import PageHero from "@/components/layout/PageHero";
import { Button } from "@/components/ui/button";
import type { SearchableCommandOption } from "@/components/ui/searchable-command-select";
import { fetchApiJson } from "@/lib/client/api";

type CompanyAuditLogItem = {
  _id: string;
  createdAt?: string;
  schoolKey?: string;
  entityType?: string;
  entityId?: string;
  entityLabel?: string;
  action?: string;
  summary?: string;
  actorName?: string;
  actorEmail?: string;
  actorRole?: string;
  source?: string;
  requestMethod?: string;
  requestPath?: string;
};

type CompanyActivityResponse = {
  logs?: CompanyAuditLogItem[];
  filters?: {
    schoolKeys?: string[];
    actions?: string[];
    sources?: string[];
  };
};

type ActivityClientProps = {
  initialLogs?: CompanyAuditLogItem[];
  initialSchoolKeys?: string[];
  initialActions?: string[];
  initialSources?: string[];
  initialError?: string | null;
};

const SearchableCommandSelect = dynamic(
  () =>
    import("@/components/ui/searchable-command-select").then(
      (mod) => mod.SearchableCommandSelect,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="h-11 w-full rounded-xl border border-input bg-background" />
    ),
  },
);

export default function ActivityClient({
  initialLogs = [],
  initialSchoolKeys = [],
  initialActions = [],
  initialSources = [],
  initialError = null,
}: ActivityClientProps) {
  const [logs, setLogs] = useState<CompanyAuditLogItem[]>(initialLogs);
  const [schoolKeys, setSchoolKeys] = useState<string[]>(initialSchoolKeys);
  const [actions, setActions] = useState<string[]>(initialActions);
  const [sources, setSources] = useState<string[]>(initialSources);
  const [schoolKeyFilter, setSchoolKeyFilter] = useState("all");
  const [actionFilter, setActionFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(initialError);
  const didHydrate = useRef(false);
  const hasActiveFilters =
    schoolKeyFilter !== "all" ||
    actionFilter !== "all" ||
    sourceFilter !== "all";
  const schoolKeyOptions = useMemo<SearchableCommandOption[]>(
    () => [
      {
        value: "all",
        label: "All schools",
        description: "Review activity across every school tenant.",
      },
      ...schoolKeys.map((schoolKey) => ({
        value: schoolKey,
        label: schoolKey,
      })),
    ],
    [schoolKeys],
  );
  const actionOptions = useMemo<SearchableCommandOption[]>(
    () => [
      {
        value: "all",
        label: "All actions",
        description: "Include every operational action in the company trail.",
      },
      ...actions.map((action) => ({
        value: action,
        label: action,
      })),
    ],
    [actions],
  );
  const sourceOptions = useMemo<SearchableCommandOption[]>(
    () => [
      {
        value: "all",
        label: "All sources",
        description: "Show both UI and API initiated activity together.",
      },
      ...sources.map((source) => ({
        value: source,
        label: source,
      })),
    ],
    [sources],
  );

  const loadLogs = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (schoolKeyFilter !== "all") params.set("schoolKey", schoolKeyFilter);
      if (actionFilter !== "all") params.set("action", actionFilter);
      if (sourceFilter !== "all") params.set("source", sourceFilter);
      params.set("limit", "100");

      const data = await fetchApiJson<CompanyActivityResponse>(
        `/api/admin/audit-logs?${params.toString()}`,
        {
          cache: "no-store",
          fallbackMessage: "Failed to load company activity.",
        },
      );

      setLogs(Array.isArray(data?.logs) ? data.logs : []);
      setSchoolKeys(
        Array.isArray(data?.filters?.schoolKeys) ? data.filters.schoolKeys : [],
      );
      setActions(
        Array.isArray(data?.filters?.actions) ? data.filters.actions : [],
      );
      setSources(
        Array.isArray(data?.filters?.sources) ? data.filters.sources : [],
      );
    } catch (loadError: any) {
      setError(loadError?.message || "Failed to load company activity.");
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [actionFilter, schoolKeyFilter, sourceFilter]);

  useEffect(() => {
    if (!didHydrate.current) {
      didHydrate.current = true;
      return;
    }

    void loadLogs();
  }, [loadLogs]);

  return (
    <div className="app-page-shell max-w-[88rem] px-4 py-6 sm:px-0">
      <PageHero
        eyebrow="Company Admin"
        title="Operations Activity"
        description="Review company-level maintenance runs and operational actions from one read-only audit trail."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/company/schools">
              <Button type="button" variant="outline" size="sm" className="app-button-compact">
                Manage Schools
              </Button>
            </Link>
            <Link href="/company/indexing">
              <Button type="button" variant="outline" size="sm" className="app-button-compact">
                Maintenance Console
              </Button>
            </Link>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="app-button-compact"
              onClick={() => void loadLogs()}
              disabled={loading}
            >
              {loading ? "Refreshing..." : "Refresh"}
            </Button>
          </div>
        }
        meta={
          <>
            <span className="app-meta-chip">Read-only</span>
            <span className="app-meta-chip">Company scope</span>
            <span className="app-meta-chip">
              {schoolKeyFilter === "all" ? "All schools" : schoolKeyFilter}
            </span>
          </>
        }
        stats={[
          {
            label: "Loaded entries",
            value: String(logs.length),
            meta: "Current company activity records after filters are applied.",
          },
          {
            label: "School filters",
            value: String(schoolKeys.length),
            meta: "Distinct school keys currently present in the activity trail.",
          },
          {
            label: "Action filters",
            value: String(actions.length),
            meta: "Distinct maintenance and operational actions captured so far.",
          },
          {
            label: "Sources",
            value: String(sources.length),
            meta: "Request origins such as api and ui surfaces.",
          },
        ]}
      />

      <div className="app-filter-panel">
        <div className="app-filter-panel-header">
          <div className="app-filter-panel-heading">
            <div className="app-filter-panel-copy">
              <h2 className="app-filter-panel-title">Activity Filters</h2>
              <p className="app-filter-panel-note">
                Narrow company-wide operations activity by school, action, and request source.
              </p>
            </div>
            <div className="app-filter-panel-chips">
              <span className="app-meta-chip">{logs.length} loaded</span>
              <span className="app-meta-chip">
                {schoolKeyFilter === "all" ? "All schools" : schoolKeyFilter}
              </span>
              <span className="app-meta-chip">
                {sourceFilter === "all" ? "All sources" : sourceFilter}
              </span>
            </div>
          </div>
        </div>
        <div className="app-filter-panel-body">
          <div className="app-filter-grid xl:grid-cols-[220px_240px_180px_minmax(0,1fr)] xl:items-end">
            <div className="app-field-group">
              <span className="app-field-label">School</span>
              <SearchableCommandSelect
                value={schoolKeyFilter}
                options={schoolKeyOptions}
                onValueChange={setSchoolKeyFilter}
                placeholder="All schools"
                searchPlaceholder="Search schools..."
                emptyText="No schools found."
                onClear={() => setSchoolKeyFilter("all")}
                showCloseAction
              />
            </div>
            <div className="app-field-group">
              <span className="app-field-label">Action</span>
              <SearchableCommandSelect
                value={actionFilter}
                options={actionOptions}
                onValueChange={setActionFilter}
                placeholder="All actions"
                searchPlaceholder="Search actions..."
                emptyText="No actions found."
                onClear={() => setActionFilter("all")}
                showCloseAction
              />
            </div>
            <div className="app-field-group">
              <span className="app-field-label">Source</span>
              <SearchableCommandSelect
                value={sourceFilter}
                options={sourceOptions}
                onValueChange={setSourceFilter}
                placeholder="All sources"
                searchPlaceholder="Search sources..."
                emptyText="No sources found."
                onClear={() => setSourceFilter("all")}
                showCloseAction
              />
            </div>
            <div className="app-filter-summary">
              <div className="app-filter-summary-copy">
                <p className="app-filter-summary-title">Current scope</p>
                <p className="app-filter-summary-note">
                  {logs.length} company activity entr{logs.length === 1 ? "y" : "ies"} loaded after the current filters.
                </p>
              </div>
              <div className="app-filter-summary-actions">
                {hasActiveFilters ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="app-button-filter"
                    onClick={() => {
                      setSchoolKeyFilter("all");
                      setActionFilter("all");
                      setSourceFilter("all");
                    }}
                  >
                    Clear Filters
                  </Button>
                ) : null}
              </div>
            </div>
          </div>

          {error ? <div className="app-feedback app-feedback-error">{error}</div> : null}

          <div className="app-table-wrap">
            <table className="min-w-full text-sm">
              <thead className="bg-muted/30">
                <tr>
                  <th className="analytics-th">Time</th>
                  <th className="analytics-th">Actor</th>
                  <th className="analytics-th">Action</th>
                  <th className="analytics-th">School</th>
                  <th className="analytics-th">Source</th>
                  <th className="analytics-th">Summary</th>
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 ? (
                  <tr>
                    <td className="analytics-td text-center text-muted-foreground" colSpan={6}>
                      {loading ? "Loading company activity..." : "No company activity found."}
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log._id} className="analytics-row">
                      <td className="analytics-td text-muted-foreground">
                        {log.createdAt ? new Date(log.createdAt).toLocaleString() : "-"}
                      </td>
                      <td className="analytics-td">
                        <div className="font-medium text-foreground">
                          {log.actorName || log.actorEmail || "System"}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {log.actorRole || "Unknown role"}
                        </div>
                      </td>
                      <td className="analytics-td">
                        <span className="analytics-toolbar-chip analytics-toolbar-chip-muted">
                          {log.action || "-"}
                        </span>
                      </td>
                      <td className="analytics-td">
                        <div className="font-medium text-foreground">
                          {log.schoolKey || "All schools"}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {log.entityLabel || log.entityType || "-"}
                        </div>
                      </td>
                      <td className="analytics-td">
                        <div className="font-medium text-foreground">
                          {log.source || "api"}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {[log.requestMethod, log.requestPath].filter(Boolean).join(" ") || "-"}
                        </div>
                      </td>
                      <td className="analytics-td text-muted-foreground">
                        {log.summary || "-"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
