"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import PageHero from "@/components/layout/PageHero";
import PageShell from "@/components/layout/PageShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  SearchableCommandSelect,
  type SearchableCommandOption,
} from "@/components/ui/searchable-command-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  const entityTypeOptions = useMemo<SearchableCommandOption[]>(
    () => [
      {
        value: "all",
        label: "All entities",
        description: "Show the full audit trail across every entity type.",
      },
      ...entityTypes.map((entityType) => ({
        value: entityType,
        label: entityType,
      })),
    ],
    [entityTypes],
  );
  const actionOptions = useMemo<SearchableCommandOption[]>(
    () => [
      {
        value: "all",
        label: "All actions",
        description: "Include every action captured in the current log stream.",
      },
      ...actions.map((action) => ({
        value: action,
        label: action,
      })),
    ],
    [actions],
  );

  const loadLogs = useCallback(async () => {
    if (!schoolKey) {
      setError("Select a school to load audit logs.");
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
    <PageShell width="wide" padding="relaxed">
      <PageHero
        variant="operations"
        eyebrow="School Activity"
        title="Audit Logs"
        description="Review archived items and upload batch activity for the selected school from one consistent activity view."
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
            meta: "Distinct entity types available for filtering in this school.",
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
          Select a school to load audit logs.
        </div>
      ) : null}

      <div className="app-filter-panel">
        <div className="app-filter-panel-header">
          <div className="app-filter-panel-heading">
            <div className="app-filter-panel-copy">
              <h2 className="app-filter-panel-title">Audit Filters</h2>
              <p className="app-filter-panel-note">
                Narrow the school audit trail by entity type and action without leaving this page.
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
            <div className="app-field-group">
              <span className="app-field-label">Entity</span>
              <SearchableCommandSelect
                value={entityTypeFilter}
                options={entityTypeOptions}
                onValueChange={setEntityTypeFilter}
                placeholder="All entities"
                searchPlaceholder="Search entities..."
                emptyText="No entity filters found."
                onClear={() => setEntityTypeFilter("all")}
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
                emptyText="No audit actions found."
                onClear={() => setActionFilter("all")}
                showCloseAction
              />
            </div>
            <div className="app-filter-summary">
              <div className="app-filter-summary-copy">
                <p className="app-filter-summary-title">Current scope</p>
                <p className="app-filter-summary-note">
                  {logs.length} log entr{logs.length === 1 ? "y" : "ies"} loaded for the current school.
                </p>
              </div>
              <div className="app-filter-summary-actions">
                {hasActiveFilters ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="app-button-filter"
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>Summary</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.length === 0 ? (
                  <TableRow>
                    <TableCell
                      className="py-10 text-center text-muted-foreground"
                      colSpan={5}
                    >
                      {loading ? "Loading audit logs…" : "No audit activity found."}
                    </TableCell>
                  </TableRow>
                ) : (
                  logs.map((log) => (
                    <TableRow key={log._id}>
                      <TableCell className="text-muted-foreground">
                        {log.createdAt ? new Date(log.createdAt).toLocaleString() : "-"}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-foreground">
                          {log.actorName || log.actorEmail || "System"}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {log.actorRole || "Unknown role"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="neutral">
                          {log.action || "-"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-foreground">
                          {log.entityLabel || log.entityType || "-"}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {log.entityId || log.entityType || "-"}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {log.summary || "-"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
