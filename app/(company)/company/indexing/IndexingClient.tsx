'use client';

import { useState } from 'react';
import Link from 'next/link';
import type {
  StudentRollDuplicateAuditReport,
  StudentRollDuplicateGroup,
} from '@/lib/admin/student-roll-cleanup';
import { AlertTriangle, ArrowLeft, Search, ShieldCheck, Wrench } from 'lucide-react';

import PageHero from '@/components/layout/PageHero';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useBackNavigation } from '@/hooks/useReturnNavigation';
import { toast } from '@/components/ui/use-toast';

type SchoolOption = {
  key: string;
  displayName: string;
};

type CleanupMessage = {
  tone: 'success' | 'error' | 'info';
  text: string;
};

type IndexingClientProps = {
  initialSchoolOptions: SchoolOption[];
};

async function readJsonResponse<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.success) {
    throw new Error(data?.message || 'Request failed.');
  }
  return data as T;
}

function getResolutionGroupKey(schoolKey: string, normalizedRollNumber: string) {
  return `${schoolKey}::${normalizedRollNumber}`;
}

function getPendingUpdatesForGroup(
  groupValues: Record<string, string> | undefined,
  group: StudentRollDuplicateGroup,
) {
  const valueMap = groupValues || {};

  return group.students
    .map((student) => {
      const nextRollNumber = String(valueMap[student.userId] || '').trim();
      if (!nextRollNumber || nextRollNumber === student.rollNumber) {
        return null;
      }

      return {
        userId: student.userId,
        newRollNumber: nextRollNumber,
      };
    })
    .filter(Boolean) as Array<{ userId: string; newRollNumber: string }>;
}

function getCleanupMessageClassName(message: CleanupMessage) {
  if (message.tone === 'success') return 'app-feedback app-feedback-success';
  if (message.tone === 'error') return 'app-feedback app-feedback-error';
  return 'app-feedback app-feedback-info';
}

export default function IndexingClient({
  initialSchoolOptions,
}: IndexingClientProps) {
  const { navigateBack } = useBackNavigation('/company/schools');
  const [indexSchoolKey, setIndexSchoolKey] = useState('');
  const [indexResults, setIndexResults] = useState<Record<string, any> | null>(null);
  const [indexLoading, setIndexLoading] = useState(false);

  const [cleanupSchoolKey, setCleanupSchoolKey] = useState('');
  const [cleanupReport, setCleanupReport] = useState<StudentRollDuplicateAuditReport | null>(null);
  const [cleanupAuditScopeSchoolKey, setCleanupAuditScopeSchoolKey] = useState<string | null>(null);
  const [cleanupLoading, setCleanupLoading] = useState(false);
  const [cleanupActionLoading, setCleanupActionLoading] = useState(false);
  const [cleanupActionType, setCleanupActionType] = useState<
    'safe-fix' | 'apply-suggested-fix' | 'resolve-group' | null
  >(null);
  const [manualResolutionValues, setManualResolutionValues] = useState<
    Record<string, Record<string, string>>
  >({});
  const [cleanupMessage, setCleanupMessage] = useState<CleanupMessage | null>(null);

  const schoolOptions = Array.isArray(initialSchoolOptions)
    ? initialSchoolOptions
    : [];
  const hasSchoolOptions = schoolOptions.length > 0;

  const cleanupSummary = cleanupReport?.summary;

  const handleIndexAll = async () => {
    setIndexLoading(true);
    try {
      const data = await readJsonResponse<any>(
        await fetch('/api/admin/reindex-ui', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ all: true }),
        }),
      );
      setIndexResults(data.results);
      toast({
        title: 'Success',
        description: 'Indexing completed for all tenants.',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error?.message || 'Failed to index all tenants.',
        variant: 'destructive',
      });
    } finally {
      setIndexLoading(false);
    }
  };

  const handleIndexOne = async () => {
    if (!indexSchoolKey.trim()) {
      toast({
        title: 'Error',
        description: 'Please select a school.',
        variant: 'destructive',
      });
      return;
    }

    setIndexLoading(true);
    try {
      const data = await readJsonResponse<any>(
        await fetch('/api/admin/reindex-ui', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ schoolKey: indexSchoolKey.trim() }),
        }),
      );
      setIndexResults(data.results);
      toast({
        title: 'Success',
        description: `Indexing completed for ${indexSchoolKey.trim()}.`,
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error?.message || 'Failed to index the selected tenant.',
        variant: 'destructive',
      });
    } finally {
      setIndexLoading(false);
    }
  };

  const runCleanupAudit = async (targetSchoolKey?: string) => {
    setCleanupLoading(true);
    setCleanupMessage(null);
    setManualResolutionValues({});
    setCleanupAuditScopeSchoolKey(targetSchoolKey?.trim() || null);

    try {
      const queryString = targetSchoolKey
        ? `?schoolKey=${encodeURIComponent(targetSchoolKey.trim())}`
        : '';
      const data = await readJsonResponse<StudentRollDuplicateAuditReport>(
        await fetch(`/api/admin/student-roll-cleanup${queryString}`, {
          cache: 'no-store',
        }),
      );

      setCleanupReport(data);

      if (targetSchoolKey && data.summary.schoolsScanned === 0) {
        setCleanupMessage({
          tone: 'info',
          text: `No school was found for key "${targetSchoolKey.trim()}".`,
        });
        return;
      }

      if (data.summary.duplicateGroupCount === 0) {
        setCleanupMessage({
          tone: 'success',
          text: targetSchoolKey
            ? `No duplicate student roll numbers were found in ${targetSchoolKey.trim()}.`
            : 'No duplicate student roll numbers were found across the company schools.',
        });
        return;
      }

      setCleanupMessage({
        tone: 'info',
        text: `Found ${data.summary.duplicateGroupCount} duplicate roll-number group(s) across ${data.summary.schoolsWithDuplicates} school(s).`,
      });
    } catch (error: any) {
      setCleanupReport(null);
      setCleanupMessage({
        tone: 'error',
        text:
          error?.message || 'Failed to audit duplicate student roll numbers.',
      });
      setCleanupAuditScopeSchoolKey(null);
    } finally {
      setCleanupLoading(false);
    }
  };

  const handleAutoFixSafeDuplicates = async () => {
    const scope = cleanupAuditScopeSchoolKey?.trim();
    setCleanupActionLoading(true);
    setCleanupActionType('safe-fix');
    setCleanupMessage(null);

    try {
      const data = await readJsonResponse<any>(
        await fetch('/api/admin/student-roll-cleanup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'safe-fix',
            schoolKey: scope || undefined,
          }),
        }),
      );

      setCleanupMessage({
        tone: 'success',
        text:
          data.summary.updatedCount > 0
            ? `Updated ${data.summary.updatedCount} student record(s) across ${data.summary.schoolsProcessed} school(s). Default passwords were restored from student phone numbers for ${data.summary.passwordResetCount} account(s).`
            : 'No safe duplicate records were available to auto-fix.',
      });

      await runCleanupAudit(scope || undefined);
    } catch (error: any) {
      setCleanupMessage({
        tone: 'error',
        text:
          error?.message ||
          'Failed to auto-fix duplicate student roll numbers.',
      });
    } finally {
      setCleanupActionLoading(false);
      setCleanupActionType(null);
    }
  };

  const handleApplySuggestedValuesToAll = async () => {
    if (!cleanupSummary || cleanupSummary.duplicateGroupCount === 0) {
      return;
    }

    const scope = cleanupAuditScopeSchoolKey?.trim();
    const scopeLabel = scope ? `school "${scope}"` : 'all audited schools';
    const confirmationMessage = cleanupSummary.riskyGroupCount > 0
      ? `Apply suggested roll-number fixes to all ${cleanupSummary.duplicateGroupCount} duplicate group(s) in ${scopeLabel}? This will also rename records in ${cleanupSummary.riskyGroupCount} manual-review group(s) that already have linked responses or report jobs.`
      : `Apply suggested roll-number fixes to all ${cleanupSummary.duplicateGroupCount} duplicate group(s) in ${scopeLabel}?`;

    if (typeof window !== 'undefined' && !window.confirm(confirmationMessage)) {
      return;
    }

    setCleanupActionLoading(true);
    setCleanupActionType('apply-suggested-fix');
    setCleanupMessage(null);

    try {
      const data = await readJsonResponse<any>(
        await fetch('/api/admin/student-roll-cleanup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'apply-suggested-fix',
            schoolKey: scope || undefined,
          }),
        }),
      );

      setCleanupMessage({
        tone: 'success',
        text:
          data.summary.updatedCount > 0
            ? `Applied suggested values across ${data.summary.groupCount} duplicate group(s) and updated ${data.summary.updatedCount} student record(s). Default passwords were restored from student phone numbers for ${data.summary.passwordResetCount} account(s).`
            : 'No duplicate records were available for suggested-value auto-fix.',
      });

      await runCleanupAudit(scope || undefined);
    } catch (error: any) {
      setCleanupMessage({
        tone: 'error',
        text:
          error?.message ||
          'Failed to apply suggested duplicate student roll-number fixes.',
      });
    } finally {
      setCleanupActionLoading(false);
      setCleanupActionType(null);
    }
  };

  const handleUseSuggestedValues = (
    schoolKey: string,
    group: StudentRollDuplicateGroup,
  ) => {
    const groupKey = getResolutionGroupKey(schoolKey, group.normalizedRollNumber);

    setManualResolutionValues((current) => ({
      ...current,
      [groupKey]: group.students.reduce<Record<string, string>>((accumulator, student) => {
        if (!student.isRecommendedKeeper && student.suggestedRollNumber) {
          accumulator[student.userId] = student.suggestedRollNumber;
        }
        return accumulator;
      }, {}),
    }));
  };

  const handleManualValueChange = (
    schoolKey: string,
    normalizedRollNumber: string,
    userId: string,
    nextValue: string,
  ) => {
    const groupKey = getResolutionGroupKey(schoolKey, normalizedRollNumber);

    setManualResolutionValues((current) => ({
      ...current,
      [groupKey]: {
        ...(current[groupKey] || {}),
        [userId]: nextValue,
      },
    }));
  };

  const handleResolveGroup = async (
    schoolKey: string,
    group: StudentRollDuplicateGroup,
  ) => {
    const groupKey = getResolutionGroupKey(schoolKey, group.normalizedRollNumber);
    const updates = getPendingUpdatesForGroup(
      manualResolutionValues[groupKey],
      group,
    );

    if (updates.length === 0) {
      setCleanupMessage({
        tone: 'error',
        text: 'Enter at least one unique roll-number update before resolving the group.',
      });
      return;
    }

    setCleanupActionLoading(true);
    setCleanupActionType('resolve-group');
    setCleanupMessage(null);

    try {
      const data = await readJsonResponse<any>(
        await fetch('/api/admin/student-roll-cleanup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'resolve-group',
            schoolKey,
            normalizedRollNumber: group.normalizedRollNumber,
            updates,
          }),
        }),
      );

      setManualResolutionValues((current) => {
        const next = { ...current };
        delete next[groupKey];
        return next;
      });

      setCleanupMessage({
        tone: 'success',
        text: `Resolved duplicate roll number "${group.normalizedRollNumber}" in ${schoolKey}. Updated ${data.result.updatedCount} student record(s).`,
      });

      await runCleanupAudit(cleanupAuditScopeSchoolKey?.trim() || undefined);
    } catch (error: any) {
      setCleanupMessage({
        tone: 'error',
        text:
          error?.message ||
          `Failed to resolve duplicate roll number "${group.normalizedRollNumber}".`,
      });
    } finally {
      setCleanupActionLoading(false);
      setCleanupActionType(null);
    }
  };

  return (
    <div className="app-page-shell max-w-[88rem] px-4 py-5 sm:px-0">
      <PageHero
        eyebrow="Company Admin"
        title="Maintenance Console"
        description="Run tenant index maintenance and resolve legacy student roll-number conflicts from one company-level console."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/company/health">
              <Button type="button" variant="outline" size="sm" className="app-button-compact">
                System Health
              </Button>
            </Link>
            <Button type="button" variant="outline" size="sm" className="app-button-compact" onClick={navigateBack}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
          </div>
        }
        meta={
          <>
            <span className="app-meta-chip">Company admin only</span>
            <span className="app-meta-chip">Indexing + student cleanup</span>
          </>
        }
        stats={[
          {
            label: 'Schools audited',
            value: cleanupSummary ? String(cleanupSummary.schoolsScanned) : '—',
            meta: 'Latest duplicate-roll audit scope.',
          },
          {
            label: 'Duplicate groups',
            value: cleanupSummary ? String(cleanupSummary.duplicateGroupCount) : '—',
            meta: 'Active roll-number collisions currently detected.',
          },
          {
            label: 'Safe auto-fix',
            value: cleanupSummary ? String(cleanupSummary.autoFixCandidateCount) : '—',
            meta: 'Records that can be corrected without linked student data.',
          },
          {
            label: 'Manual review',
            value: cleanupSummary ? String(cleanupSummary.riskyGroupCount) : '—',
            meta: 'Groups with linked responses or report jobs that need review.',
          },
        ]}
      />

      <Card className="app-surface overflow-hidden">
        <CardHeader className="app-section-header">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Search className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <CardTitle>Index Maintenance</CardTitle>
              <CardDescription>
                Rebuild MongoDB indexes for one tenant or for the full multi-tenant workspace.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="app-section-body space-y-4">
          <div className="app-toolbar space-y-3">
            <p className="app-toolbar-note">
              Use full-company indexing for global maintenance, or target one school for focused checks.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" className="app-button-compact" onClick={handleIndexAll} disabled={indexLoading}>
                {indexLoading ? 'Indexing...' : 'Index All Tenants'}
              </Button>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
            <div className="space-y-2">
              <Label>Select School</Label>
              {!hasSchoolOptions ? (
                <Input
                  placeholder="Enter school key"
                  value={indexSchoolKey}
                  onChange={(event) => setIndexSchoolKey(event.target.value)}
                  className="app-control-compact"
                />
              ) : (
                <Select onValueChange={setIndexSchoolKey} value={indexSchoolKey}>
                  <SelectTrigger className="app-control-compact">
                    <SelectValue placeholder="Select school" />
                  </SelectTrigger>
                  <SelectContent>
                    {schoolOptions.map((school) => (
                      <SelectItem key={school.key} value={school.key}>
                        {school.displayName || school.key}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="flex items-end">
              <Button
                size="sm"
                className="app-button-compact"
                onClick={handleIndexOne}
                disabled={indexLoading || !indexSchoolKey.trim()}
              >
                {indexLoading ? 'Indexing...' : 'Index Selected Tenant'}
              </Button>
            </div>
          </div>

          {indexResults ? (
            <div className="app-section">
              <div className="space-y-1">
                <h2 className="text-sm font-semibold text-foreground">
                  Latest Index Result
                </h2>
                <p className="text-xs text-muted-foreground">
                  Raw response from the most recent indexing action.
                </p>
              </div>
              <pre className="max-h-[22rem] overflow-auto rounded-xl border border-border/60 bg-background p-4 text-sm text-foreground">
                {JSON.stringify(indexResults, null, 2)}
              </pre>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="app-surface overflow-hidden">
        <CardHeader className="app-section-header">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Wrench className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <CardTitle>Student Roll Number Cleanup</CardTitle>
              <CardDescription>
                Audit older student data, run safe auto-fixes, and apply suggested duplicate roll-number updates in bulk.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="app-section-body space-y-5">
          <div className="app-toolbar space-y-3">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
              <div className="app-toolbar-copy">
                <p className="app-toolbar-title">Cleanup Scope</p>
                <p className="app-toolbar-note">
                  Audit all schools or a single school first, then apply safe fixes or suggested values.
                </p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {!hasSchoolOptions ? (
                  <Input
                    placeholder="Enter school key"
                    value={cleanupSchoolKey}
                    onChange={(event) => setCleanupSchoolKey(event.target.value)}
                    className="app-control-compact min-w-[14rem]"
                  />
                ) : (
                  <Select onValueChange={setCleanupSchoolKey} value={cleanupSchoolKey}>
                    <SelectTrigger className="app-control-compact min-w-[14rem]">
                      <SelectValue placeholder="Select school" />
                    </SelectTrigger>
                    <SelectContent>
                      {schoolOptions.map((school) => (
                        <SelectItem key={school.key} value={school.key}>
                          {school.displayName || school.key}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <Button
                  variant="outline"
                  className="app-button-compact"
                  onClick={() => void runCleanupAudit()}
                  disabled={cleanupLoading || cleanupActionLoading}
                >
                  {cleanupLoading ? 'Auditing...' : 'Audit All Schools'}
                </Button>
                <Button
                  variant="outline"
                  className="app-button-compact"
                  onClick={() => void runCleanupAudit(cleanupSchoolKey)}
                  disabled={
                    cleanupLoading ||
                    cleanupActionLoading ||
                    !cleanupSchoolKey.trim()
                  }
                >
                  {cleanupLoading ? 'Auditing...' : 'Audit Selected School'}
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 border-t border-border/60 pt-3">
              <Button
                size="sm"
                className="app-button-compact"
                onClick={handleAutoFixSafeDuplicates}
                disabled={
                  cleanupLoading ||
                  cleanupActionLoading ||
                  !cleanupSummary ||
                  cleanupSummary.autoFixCandidateCount === 0
                }
              >
                {cleanupActionLoading && cleanupActionType === 'safe-fix'
                  ? 'Applying safe fixes...'
                  : 'Auto-fix Safe Duplicates'}
              </Button>
              <Button
                variant="outline"
                className="app-button-compact"
                onClick={handleApplySuggestedValuesToAll}
                disabled={
                  cleanupLoading ||
                  cleanupActionLoading ||
                  !cleanupSummary ||
                  cleanupSummary.duplicateGroupCount === 0
                }
              >
                {cleanupActionLoading && cleanupActionType === 'apply-suggested-fix'
                  ? 'Applying suggestions...'
                  : 'Auto-fix All Suggested Values'}
              </Button>
            </div>
          </div>

          {cleanupMessage ? (
            <div className={getCleanupMessageClassName(cleanupMessage)}>
              {cleanupMessage.text}
            </div>
          ) : null}

          {cleanupReport ? (
            cleanupReport.summary.duplicateGroupCount === 0 ? (
              <div className="app-empty-state">
                No duplicate student roll numbers are active in the audited scope.
              </div>
            ) : (
              <>
                <div className="app-metric-grid">
                  <div className="app-metric-card">
                    <p className="app-metric-label">Schools With Duplicates</p>
                    <p className="app-metric-value">
                      {cleanupReport.summary.schoolsWithDuplicates}
                    </p>
                    <p className="app-metric-meta">
                      Schools currently affected by duplicate student usernames.
                    </p>
                  </div>
                  <div className="app-metric-card">
                    <p className="app-metric-label">Affected Students</p>
                    <p className="app-metric-value">
                      {cleanupReport.summary.affectedStudentCount}
                    </p>
                    <p className="app-metric-meta">
                      Student records participating in duplicate roll-number groups.
                    </p>
                  </div>
                  <div className="app-metric-card">
                    <p className="app-metric-label">Safe Auto-Fix Candidates</p>
                    <p className="app-metric-value">
                      {cleanupReport.summary.autoFixCandidateCount}
                    </p>
                    <p className="app-metric-meta">
                      Duplicate records with no linked responses or report jobs.
                    </p>
                  </div>
                  <div className="app-metric-card">
                    <p className="app-metric-label">Risky Groups</p>
                    <p className="app-metric-value">
                      {cleanupReport.summary.riskyGroupCount}
                    </p>
                    <p className="app-metric-meta">
                      Groups that still need manual review after safe fixes.
                    </p>
                  </div>
                </div>

                <Accordion type="multiple" className="space-y-3">
                  {cleanupReport.schools.map((school) => (
                    <AccordionItem
                      key={school.schoolKey}
                      value={school.schoolKey}
                      className="app-surface overflow-hidden"
                    >
                      <AccordionTrigger className="px-4 py-4 text-left hover:no-underline">
                        <div className="flex w-full flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-semibold text-foreground">
                                {school.schoolDisplayName || school.schoolKey}
                              </span>
                              <Badge variant="outline">{school.schoolKey}</Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {school.duplicateGroupCount} duplicate group(s),{' '}
                              {school.affectedStudentCount} affected student record(s).
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="secondary">
                              {school.autoFixCandidateCount} safe fixes
                            </Badge>
                            {school.riskyGroupCount > 0 ? (
                              <Badge variant="destructive">
                                {school.riskyGroupCount} manual review
                              </Badge>
                            ) : (
                              <Badge variant="secondary">No risky groups</Badge>
                            )}
                          </div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="px-4 pb-4">
                        <div className="space-y-4">
                          {school.duplicateGroups.map((group) => {
                            const groupKey = getResolutionGroupKey(
                              school.schoolKey,
                              group.normalizedRollNumber,
                            );
                            const pendingUpdates = getPendingUpdatesForGroup(
                              manualResolutionValues[groupKey],
                              group,
                            );

                            return (
                              <div key={groupKey} className="app-section space-y-4">
                                <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                                  <div className="space-y-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <h3 className="text-sm font-semibold text-foreground">
                                        Roll Number:{' '}
                                        <span className="font-mono">
                                          {group.normalizedRollNumber}
                                        </span>
                                      </h3>
                                      <Badge variant="outline">
                                        {group.duplicateCount} records
                                      </Badge>
                                      {group.risky ? (
                                        <Badge variant="destructive">
                                          Manual review required
                                        </Badge>
                                      ) : (
                                        <Badge variant="secondary">
                                          Safe auto-fix eligible
                                        </Badge>
                                      )}
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                      Keep the recommended record unchanged and assign unique roll numbers to the others. Suggested values are generated to avoid collisions in the same school.
                                    </p>
                                  </div>
                                  <div className="flex flex-wrap items-center gap-2">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="app-button-compact"
                                      onClick={() =>
                                        handleUseSuggestedValues(
                                          school.schoolKey,
                                          group,
                                        )
                                      }
                                      disabled={cleanupActionLoading}
                                    >
                                      Use Suggested Values
                                    </Button>
                                    <Button
                                      size="sm"
                                      className="app-button-compact"
                                      onClick={() =>
                                        void handleResolveGroup(
                                          school.schoolKey,
                                          group,
                                        )
                                      }
                                      disabled={
                                        cleanupActionLoading ||
                                        pendingUpdates.length === 0
                                      }
                                    >
                                      {cleanupActionLoading && cleanupActionType === 'resolve-group'
                                        ? 'Resolving...'
                                        : 'Apply Manual Resolution'}
                                    </Button>
                                  </div>
                                </div>

                                {group.risky ? (
                                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                                    <div className="flex items-start gap-2">
                                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                                      <span>
                                        One or more duplicate records already have linked responses or report jobs. Review the suggested values and decide which students should keep or change usernames.
                                      </span>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                                    <div className="flex items-start gap-2">
                                      <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
                                      <span>
                                        All non-primary duplicates in this group are safe to auto-fix because they have no linked responses or report jobs.
                                      </span>
                                    </div>
                                  </div>
                                )}

                                <div className="app-table-wrap">
                                  <Table className="text-[13px]">
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead>Student</TableHead>
                                        <TableHead>Current Roll No.</TableHead>
                                        <TableHead>Suggested</TableHead>
                                        <TableHead>Class / Section</TableHead>
                                        <TableHead>Linked Records</TableHead>
                                        <TableHead className="min-w-[240px]">
                                          Resolution
                                        </TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {group.students.map((student) => (
                                        <TableRow key={student.userId}>
                                          <TableCell>
                                            <div className="space-y-1">
                                              <div className="flex flex-wrap items-center gap-2">
                                                <span className="font-medium text-foreground">
                                                  {student.name}
                                                </span>
                                                {student.isRecommendedKeeper ? (
                                                  <Badge variant="secondary">
                                                    Keep
                                                  </Badge>
                                                ) : null}
                                              </div>
                                              <p className="text-xs text-muted-foreground">
                                                {student.email || 'No email'}
                                              </p>
                                            </div>
                                          </TableCell>
                                          <TableCell>
                                            <span className="font-mono text-sm">
                                              {student.rollNumber || '—'}
                                            </span>
                                          </TableCell>
                                          <TableCell>
                                            {student.suggestedRollNumber ? (
                                              <span className="font-mono text-sm text-foreground">
                                                {student.suggestedRollNumber}
                                              </span>
                                            ) : (
                                              <span className="text-sm text-muted-foreground">
                                                Keep current
                                              </span>
                                            )}
                                          </TableCell>
                                          <TableCell>
                                            <div className="space-y-1 text-sm">
                                              <div>{student.className || 'Unassigned'}</div>
                                              <div className="text-xs text-muted-foreground">
                                                {student.academicSectionName || 'No section'}
                                              </div>
                                            </div>
                                          </TableCell>
                                          <TableCell>
                                            <div className="space-y-1 text-sm">
                                              <div>
                                                Responses: {student.responseCount}
                                              </div>
                                              <div className="text-xs text-muted-foreground">
                                                Report jobs: {student.reportJobCount}
                                              </div>
                                            </div>
                                          </TableCell>
                                          <TableCell>
                                            <div className="space-y-2">
                                              <Input
                                                value={
                                                  manualResolutionValues[groupKey]?.[
                                                    student.userId
                                                  ] || ''
                                                }
                                                onChange={(event) =>
                                                  handleManualValueChange(
                                                    school.schoolKey,
                                                    group.normalizedRollNumber,
                                                    student.userId,
                                                    event.target.value,
                                                  )
                                                }
                                                placeholder={
                                                  student.suggestedRollNumber ||
                                                  'Keep current roll number'
                                                }
                                                className="h-8"
                                                disabled={cleanupActionLoading}
                                              />
                                              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                                {student.canAutoFix ? (
                                                  <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-emerald-700">
                                                    Safe auto-fix candidate
                                                  </span>
                                                ) : null}
                                                {student.hasLinkedData ? (
                                                  <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-amber-700">
                                                    Linked data present
                                                  </span>
                                                ) : null}
                                              </div>
                                            </div>
                                          </TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </>
            )
          ) : (
            <div className="app-empty-state">
              Run an audit to inspect duplicate student roll numbers and prepare fixes.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
