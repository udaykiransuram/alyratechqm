"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import PageHero from "@/components/layout/PageHero";
import { Button } from "@/components/ui/button";
import { fetchApiJson, resolveClientSchoolKey } from "@/lib/client/api";

type AuditLogItem = {
  _id: string;
  createdAt?: string;
  entityType?: string;
  entityId?: string;
  entityLabel?: string;
  action?: string;
  summary?: string;
  actorName?: string;
  actorEmail?: string;
  actorRole?: string;
};

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [entityTypes, setEntityTypes] = useState<string[]>([]);
  const [actions, setActions] = useState<string[]>([]);
  const [entityTypeFilter, setEntityTypeFilter] = useState<string>("all");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const schoolKey = useMemo(() => resolveClientSchoolKey(), []);
  const hasActiveFilters = entityTypeFilter !== "all" || actionFilter !== "all";

  const loadLogs = useCallback(async () => {
    if (!schoolKey) {
      setError("Select a school workspace to load audit logs.");
      setLogs([]);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (entityTypeFilter !== "all") params.set("entityType", entityTypeFilter);
      if (actionFilter !== "all") params.set("action", actionFilter);
      params.set("limit", "100");

      const data = await fetchApiJson<any>(`/api/audit-logs?${params.toString()}`, {
        cache: "no-store",
        schoolKey,
        fallbackMessage: "Failed to load audit logs.",
      });

      setLogs(Array.isArray(data?.logs) ? data.logs : []);
      setEntityTypes(Array.isArray(data?.filters?.entityTypes) ? data.filters.entityTypes : []);
      setActions(Array.isArray(data?.filters?.actions) ? data.filters.actions : []);
    } catch (loadError: any) {
      setError(loadError?.message || "Failed to load audit logs.");
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [actionFilter, entityTypeFilter, schoolKey]);

  useEffect(() => {
    void loadLogs();
  }, [loadLogs]);

  return (
    <div className="app-page-shell max-w-[88rem] px-4 py-6 sm:px-0">
      <PageHero
        eyebrow="Operations"
        title="Audit Logs"
        description="Review archived items and upload batch activity for the selected school from one consistent operations view."
        actions={
          <Button type="button" variant="outline" onClick={() => void loadLogs()} disabled={loading}>
            {loading ? "Refreshing…" : "Refresh"}
          </Button>
        }
        meta={
          <>
            <span className="app-meta-chip">{schoolKey ? "School selected" : "School required"}</span>
            <span className="app-meta-chip">{entityTypeFilter === "all" ? "All entities" : entityTypeFilter}</span>
          </>
        }
        stats={[
          {
            label: "Loaded entries",
            value: String(logs.length),
            meta: "Current log count after the selected filters are applied.",
          },
          {
            label: "Entity filters",
            value: String(entityTypes.length),
            meta: "Distinct entity types available for filtering in this school workspace.",
          },
          {
            label: "Action filters",
            value: String(actions.length),
            meta: "Distinct audit actions available in the current response.",
          },
        ]}
      />

      {!schoolKey ? (
        <div className="app-feedback app-feedback-info">
          Select a school workspace to load audit logs.
        </div>
      ) : null}

      <div className="app-filter-panel">
        <div className="app-filter-panel-header">
          <div className="app-filter-panel-heading">
            <div className="app-filter-panel-copy">
              <h2 className="app-filter-panel-title">Audit Filters</h2>
              <p className="app-filter-panel-note">
                Narrow the school audit trail by entity type and action without leaving the operations view.
              </p>
            </div>
            <div className="app-filter-panel-chips">
              <span className="app-meta-chip">{logs.length} loaded</span>
              <span className="app-meta-chip">
                {entityTypeFilter === "all" ? "All entities" : entityTypeFilter}
              </span>
              <span className="app-meta-chip">
                {actionFilter === "all" ? "All actions" : actionFilter}
              </span>
            </div>
          </div>
        </div>
        <div className="app-filter-panel-body">
          <div className="app-filter-grid md:grid-cols-[220px_220px_minmax(0,1fr)] md:items-end">
            <label className="app-field-group">
              <span className="app-field-label">Entity</span>
              <select
                className="app-form-input"
                value={entityTypeFilter}
                onChange={(event) => setEntityTypeFilter(event.target.value)}
              >
                <option value="all">All entities</option>
                {entityTypes.map((entityType) => (
                  <option key={entityType} value={entityType}>
                    {entityType}
                  </option>
                ))}
              </select>
            </label>
            <label className="app-field-group">
              <span className="app-field-label">Action</span>
              <select
                className="app-form-input"
                value={actionFilter}
                onChange={(event) => setActionFilter(event.target.value)}
              >
                <option value="all">All actions</option>
                {actions.map((action) => (
                  <option key={action} value={action}>
                    {action}
                  </option>
                ))}
              </select>
            </label>
            <div className="app-filter-summary">
              <div className="app-filter-summary-copy">
                <p className="app-filter-summary-title">Current scope</p>
                <p className="app-filter-summary-note">
                  {logs.length} log entr{logs.length === 1 ? "y" : "ies"} loaded for the current school workspace.
                </p>
              </div>
              <div className="app-filter-summary-actions">
                {hasActiveFilters ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setEntityTypeFilter("all");
                      setActionFilter("all");
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
                  <th className="analytics-th">Entity</th>
                  <th className="analytics-th">Summary</th>
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 ? (
                  <tr>
                    <td className="analytics-td text-center text-muted-foreground" colSpan={5}>
                      {loading ? "Loading audit logs…" : "No audit activity found."}
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
                          {log.entityLabel || log.entityType || "-"}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {log.entityId || log.entityType || "-"}
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
