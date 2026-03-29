"use client";

import { useEffect, useMemo, useState } from "react";

type FailInsightRow = {
  tag: string;
  failPct: number;
  category: string;
  action: string;
};

type FailInsightsCardProps = {
  title: string;
  lastLabel: string;
  rows: FailInsightRow[];
};

const PAGE_SIZE_OPTIONS = [10, 12, 25, 50];

export default function FailInsightsCard({
  title,
  lastLabel,
  rows,
}: FailInsightsCardProps) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    setPage(1);
  }, [rows.length, pageSize, showAll]);

  const pagination = useMemo(() => {
    const total = rows.length;
    const maxPage = Math.max(1, Math.ceil(total / pageSize));
    const safePage = Math.min(page, maxPage);
    const start = (safePage - 1) * pageSize;
    const end = Math.min(total, start + pageSize);
    const visibleRows = showAll ? rows : rows.slice(start, end);
    const rangeLabel = showAll
      ? `Showing all ${total}`
      : `Showing ${total === 0 ? 0 : start + 1}-${end} of ${total}`;

    return {
      total,
      maxPage,
      safePage,
      visibleRows,
      rangeLabel,
    };
  }, [page, pageSize, rows, showAll]);

  if (rows.length === 0) {
    return null;
  }

  return (
    <div className="analytics-card">
      <div className="analytics-card-header analytics-card-header-highlight">
        <div className="analytics-toolbar-row">
          <div className="analytics-toolbar-copy">
            <h2 className="analytics-card-title">{title}</h2>
            <p className="analytics-card-description">
              Overall-first insight rows ordered by the strongest reteach signal.
            </p>
          </div>
          <div className="analytics-toolbar-meta">
            <span className="analytics-toolbar-chip analytics-toolbar-chip-muted">
              Based on {lastLabel}
            </span>
          </div>
        </div>
      </div>
      <div className="analytics-table-shell">
        <div className="analytics-table-wrap rounded-none border-x-0 border-b-0">
        <table className="min-w-full text-sm">
          <thead className="bg-muted/30">
            <tr>
              <th className="analytics-th">{lastLabel}</th>
              <th className="analytics-th-center">Fail (%)</th>
              <th className="analytics-th">Category</th>
              <th className="analytics-th">Action</th>
            </tr>
          </thead>
          <tbody>
            {pagination.visibleRows.map((row) => (
              <tr key={row.tag} className="analytics-row">
                <td className="analytics-td analytics-table-group-cell">{row.tag}</td>
                <td className="analytics-td-center analytics-table-measure-cell font-medium text-rose-600">
                  {row.failPct}
                </td>
                <td className="analytics-td">{row.category}</td>
                <td className="analytics-td">{row.action}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        <div className="analytics-table-footer">
          <div className="analytics-table-footer-actions">
              <label className="analytics-checkbox-card">
                <input
                  type="checkbox"
                  className="analytics-inline-check"
                  checked={showAll}
                  onChange={() => {
                    setShowAll((value) => !value);
                    setPage(1);
                  }}
                />
                <span>Show all rows</span>
              </label>
              {!showAll && pagination.total > 0 ? (
                <label className="analytics-checkbox-card">
                  <span className="text-muted-foreground">Rows per page</span>
                  <select
                    className="analytics-select-compact"
                    value={pageSize}
                    onChange={(event) => {
                      setPageSize(Number(event.target.value));
                      setPage(1);
                    }}
                  >
                    {PAGE_SIZE_OPTIONS.map((count) => (
                      <option key={count} value={count}>
                        {count}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
          </div>
          <div className="analytics-table-footer-meta">
              <span className="analytics-toolbar-chip analytics-toolbar-chip-muted">
                {pagination.rangeLabel}
              </span>
              {!showAll && pagination.total > pageSize ? (
                <>
                  <span className="analytics-toolbar-chip analytics-toolbar-chip-muted">
                    Page {pagination.safePage} of {pagination.maxPage}
                  </span>
                  <button
                    type="button"
                    className="analytics-pagination-button"
                    onClick={() => setPage((value) => Math.max(1, value - 1))}
                    disabled={pagination.safePage <= 1}
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    className="analytics-pagination-button"
                    onClick={() =>
                      setPage((value) => Math.min(pagination.maxPage, value + 1))
                    }
                    disabled={pagination.safePage >= pagination.maxPage}
                  >
                    Next
                  </button>
                </>
              ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
