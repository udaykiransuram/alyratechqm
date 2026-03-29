import { connectDB } from "@/lib/db";
import CompanyAuditLog from "@/models/CompanyAuditLog";

type CompanyActivityQueryInput = {
  schoolKey?: string | null;
  action?: string | null;
  source?: string | null;
  limit?: number | null;
};

type CompanyActivityQuery = {
  schoolKey: string;
  action: string;
  source: string;
  limit: number;
};

type CompanyActivityFilters = {
  schoolKeys: string[];
  actions: string[];
  sources: string[];
};

export type CompanyActivityData = {
  logs: any[];
  filters: CompanyActivityFilters;
};

function toNormalizedList(values: unknown[]) {
  return (Array.isArray(values) ? values : [])
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .sort();
}

export function normalizeCompanyActivityQuery(
  input?: CompanyActivityQueryInput,
): CompanyActivityQuery {
  const schoolKey = String(input?.schoolKey || "all").trim().toLowerCase();
  const action = String(input?.action || "all").trim();
  const source = String(input?.source || "all").trim();
  const limitInput = Number(input?.limit || 100);
  const limit = Math.min(
    Math.max(Number.isFinite(limitInput) ? limitInput : 100, 1),
    200,
  );

  return {
    schoolKey,
    action,
    source,
    limit,
  };
}

export async function getCompanyActivityData(
  input?: CompanyActivityQueryInput,
): Promise<CompanyActivityData> {
  const normalized = normalizeCompanyActivityQuery(input);

  await connectDB();

  const query: Record<string, any> = {};
  if (normalized.schoolKey && normalized.schoolKey !== "all") {
    query.schoolKey = normalized.schoolKey;
  }
  if (normalized.action && normalized.action !== "all") {
    query.action = normalized.action;
  }
  if (normalized.source && normalized.source !== "all") {
    query.source = normalized.source;
  }

  const [logs, schoolKeys, actions, sources] = await Promise.all([
    CompanyAuditLog.find(query)
      .sort({ createdAt: -1 })
      .limit(normalized.limit)
      .lean(),
    CompanyAuditLog.distinct("schoolKey"),
    CompanyAuditLog.distinct("action"),
    CompanyAuditLog.distinct("source"),
  ]);

  return {
    logs: Array.isArray(logs) ? logs : [],
    filters: {
      schoolKeys: toNormalizedList(schoolKeys),
      actions: toNormalizedList(actions),
      sources: toNormalizedList(sources),
    },
  };
}
