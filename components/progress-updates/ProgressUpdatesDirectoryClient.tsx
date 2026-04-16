"use client";

import { useMemo, useState } from "react";
import { Edit, Eye } from "lucide-react";

import type { ProgressUpdateStudentRow } from "@/lib/server/progress-updates";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/components/ui/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import AppPrefetchLink from "@/components/navigation/AppPrefetchLink";
import { formatDiaryDateLabel } from "@/lib/diary/shared";

type ProgressUpdatesDirectoryClientProps = {
  rows: ProgressUpdateStudentRow[];
  date: string;
  totalStudents: number;
};

type EditableContact = {
  studentId: string;
  studentName: string;
  parentName: string;
  whatsappOptIn: boolean;
  relationship: string;
  preferredLanguage: string;
};

const STATUS_VARIANTS: Record<string, "success" | "warning" | "neutral" | "danger"> = {
  sent: "success",
  pending: "warning",
  skipped: "neutral",
  failed: "danger",
};

function formatProgressSummary(progress: ProgressUpdateStudentRow["progress"]) {
  if (!progress) {
    return "No update generated yet.";
  }

  const parts: string[] = [];
  if (progress.assessmentQuestionCount > 0) {
    const pct =
      typeof progress.assessmentAccuracyPct === "number"
        ? `${Math.round(progress.assessmentAccuracyPct)}%`
        : "-";
    parts.push(`Assessment ${pct}`);
  }
  if (progress.homeworkAssigned > 0) {
    parts.push(
      `Homework ${progress.homeworkCompleted}/${progress.homeworkAssigned}`,
    );
  }
  if (progress.liveSessionsAssigned > 0) {
    const attentionLabel =
      typeof progress.liveAttentionPct === "number"
        ? `${Math.round(progress.liveAttentionPct)}% attention`
        : "Attention —";
    parts.push(
      `Live class ${progress.liveSessionsAttended}/${progress.liveSessionsAssigned} • ${attentionLabel}`,
    );
  }
  if (progress.nextFocusText) {
    parts.push(`Next focus: ${progress.nextFocusText}`);
  }
  return parts.join(" • ") || "No update generated yet.";
}

export default function ProgressUpdatesDirectoryClient({
  rows,
  date,
  totalStudents,
}: ProgressUpdatesDirectoryClientProps) {
  const { toast } = useToast();
  const [contacts, setContacts] = useState(rows);
  const studentMobileById = useMemo(() => {
    const map = new Map<string, string>();
    contacts.forEach((row) => {
      if (row.student.mobileNumber) {
        map.set(row.student._id, row.student.mobileNumber);
      }
    });
    return map;
  }, [contacts]);
  const [activeContact, setActiveContact] = useState<EditableContact | null>(null);
  const [savingContact, setSavingContact] = useState(false);

  const summaryStats = useMemo(() => {
    const withContact = contacts.filter((row) => row.student.mobileNumber).length;
    const sentCount = contacts.filter(
      (row) => row.progress?.digestStatus === "sent",
    ).length;
    return { withContact, sentCount };
  }, [contacts]);

  const openContactEditor = (row: ProgressUpdateStudentRow) => {
    setActiveContact({
      studentId: row.student._id,
      studentName: row.student.name,
      parentName: row.contact?.parentName || "",
      whatsappOptIn: row.contact?.whatsappOptIn ?? true,
      relationship: row.contact?.relationship || "parent",
      preferredLanguage: row.contact?.preferredLanguage || "en",
    });
  };

  const closeContactEditor = () => {
    if (savingContact) return;
    setActiveContact(null);
  };

  const updateActiveContact = (updates: Partial<EditableContact>) => {
    setActiveContact((current) => (current ? { ...current, ...updates } : current));
  };

  const saveContact = async () => {
    if (!activeContact) return;
    setSavingContact(true);
    try {
      const response = await fetch("/api/parent-contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: activeContact.studentId,
          parentName: activeContact.parentName,
          whatsappOptIn: activeContact.whatsappOptIn,
          relationship: activeContact.relationship,
          preferredLanguage: activeContact.preferredLanguage,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data?.message || "Failed to update parent contact.");
      }

      setContacts((current) =>
        current.map((row) =>
          row.student._id === activeContact.studentId
            ? {
                ...row,
                contact: {
                  parentName: activeContact.parentName,
                  whatsappOptIn: activeContact.whatsappOptIn,
                  relationship: activeContact.relationship,
                  preferredLanguage: activeContact.preferredLanguage,
                  updatedAt: new Date().toISOString(),
                },
              }
            : row,
        ),
      );

      toast({
        title: "Contact saved",
        description: "Parent contact details updated successfully.",
      });
      setActiveContact(null);
    } catch (error: any) {
      toast({
        title: "Update failed",
        description: error?.message || "Could not save parent contact.",
        variant: "destructive",
      });
    } finally {
      setSavingContact(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="app-card">
        <CardHeader className="app-card-header">
          <div>
            <CardTitle className="app-card-title">Daily update overview</CardTitle>
            <p className="app-card-description">
              {formatDiaryDateLabel(date) || date} • {summaryStats.sentCount} sent
              • {summaryStats.withContact}/{totalStudents} contacts available
            </p>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {contacts.map((row) => (
              <article
                key={row.student._id}
                className="app-card app-card-soft border border-border/60 p-4 md:hidden"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">{row.student.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {row.student.class?.name || "Class"}{" "}
                      {row.student.section?.name ? `• ${row.student.section?.name}` : ""}
                    </p>
                  </div>
                  <Badge variant={STATUS_VARIANTS[row.progress?.digestStatus || "pending"] || "neutral"}>
                    {row.progress?.digestStatus || "pending"}
                  </Badge>
                </div>
                <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                  <p>{formatProgressSummary(row.progress)}</p>
                  <p>
                    Contact:{" "}
                    {row.student.mobileNumber
                      ? row.student.mobileNumber
                      : "Missing student mobile"}
                  </p>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="app-row-action-button"
                    onClick={() => openContactEditor(row)}
                  >
                    <Edit className="h-4 w-4" />
                    Edit contact
                  </Button>
                  <Button
                    asChild
                    variant="outline"
                    size="sm"
                    className="app-row-action-button"
                  >
                    <AppPrefetchLink href={`/workspace/progress-updates/${row.student._id}`}>
                      <Eye className="h-4 w-4" />
                      View history
                    </AppPrefetchLink>
                  </Button>
                </div>
              </article>
            ))}
          </div>

          <div className="hidden md:block app-table-wrap app-table-dense">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Parent contact</TableHead>
                  <TableHead>Daily update</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contacts.map((row) => (
                  <TableRow key={row.student._id}>
                    <TableCell>
                      <div className="app-table-cell-stack">
                        <div className="app-table-cell-title">{row.student.name}</div>
                        <div className="app-table-cell-note">
                          {row.student.class?.name || "Class"}{" "}
                          {row.student.section?.name
                            ? `• ${row.student.section?.name}`
                            : ""}
                          {row.student.rollNumber
                            ? ` • Roll ${row.student.rollNumber}`
                            : ""}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="app-table-cell-stack">
                        <div className="app-table-cell-title">
                          {row.contact?.parentName || "Not set"}
                        </div>
                        <div className="app-table-cell-note">
                          {row.student.mobileNumber
                            ? row.student.mobileNumber
                            : "Add student mobile"}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="app-table-cell-stack">
                        <div className="app-table-cell-title">
                          {formatProgressSummary(row.progress)}
                        </div>
                        <div className="app-table-cell-note">
                          {row.progress?.topicsCovered?.length
                            ? `Topics: ${row.progress.topicsCovered.join(", ")}`
                            : "Topics from sub-skill tags"}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANTS[row.progress?.digestStatus || "pending"] || "neutral"}>
                        {row.progress?.digestStatus || "pending"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="app-row-action-group justify-end">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="app-row-action-button"
                          onClick={() => openContactEditor(row)}
                        >
                          <Edit className="h-4 w-4" />
                          Edit contact
                        </Button>
                        <Button
                          asChild
                          variant="outline"
                          size="sm"
                          className="app-row-action-button"
                        >
                          <AppPrefetchLink href={`/workspace/progress-updates/${row.student._id}`}>
                            <Eye className="h-4 w-4" />
                            View history
                          </AppPrefetchLink>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={Boolean(activeContact)} onOpenChange={closeContactEditor}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Parent contact</DialogTitle>
            <DialogDescription>
              Update the WhatsApp contact details for{" "}
              <strong>{activeContact?.studentName}</strong>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="app-field-group">
              <label className="app-field-label">Parent or guardian name</label>
              <Input
                value={activeContact?.parentName || ""}
                onChange={(event) =>
                  updateActiveContact({ parentName: event.target.value })
                }
                placeholder="Parent name"
              />
            </div>
            <div className="app-field-group">
              <label className="app-field-label">WhatsApp number</label>
              <Input
                value={
                  (activeContact?.studentId
                    ? studentMobileById.get(activeContact.studentId)
                    : "") || ""
                }
                disabled
                placeholder="Use student mobile number"
              />
              <p className="text-xs text-muted-foreground">
                WhatsApp uses the student mobile number saved on the student record.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="app-field-group">
                <label className="app-field-label">Relationship</label>
                <Input
                  value={activeContact?.relationship || ""}
                  onChange={(event) =>
                    updateActiveContact({ relationship: event.target.value })
                  }
                  placeholder="parent / guardian"
                />
              </div>
              <div className="app-field-group">
                <label className="app-field-label">Language</label>
                <Input
                  value={activeContact?.preferredLanguage || ""}
                  onChange={(event) =>
                    updateActiveContact({ preferredLanguage: event.target.value })
                  }
                  placeholder="en"
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <Checkbox
                checked={Boolean(activeContact?.whatsappOptIn)}
                onCheckedChange={(checked) =>
                  updateActiveContact({ whatsappOptIn: Boolean(checked) })
                }
              />
              WhatsApp opt-in confirmed
            </label>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={closeContactEditor} disabled={savingContact}>
              Cancel
            </Button>
            <Button onClick={saveContact} disabled={savingContact}>
              {savingContact ? "Saving..." : "Save contact"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
