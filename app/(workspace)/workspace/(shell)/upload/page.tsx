'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, FileText, TableProperties } from 'lucide-react';

import PageHero from '@/components/layout/PageHero';
import PageShell from '@/components/layout/PageShell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import FilePickerField from '@/components/ui/file-picker-field';
import { Spinner } from '@/components/ui/spinner';
import { useToast } from '@/components/ui/use-toast';
import { useBackNavigation } from '@/hooks/useReturnNavigation';

const ACCEPTED_IMPORT_FORMATS = [
  '.docx',
  '.xlsx',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
].join(',');

export default function UploadPage() {
  const router = useRouter();
  const { navigateBack } = useBackNavigation('/workspace/questions');
  const { toast } = useToast();
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  async function handleCreateDraft() {
    if (!importFile) {
      toast({
        title: 'No file selected',
        description: 'Choose a teacher-master DOCX or diagnostic XLSX file before starting the import.',
        variant: 'destructive',
      });
      return;
    }

    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', importFile, importFile.name || 'question-import.xlsx');

      const response = await fetch('/api/question-imports', {
        method: 'POST',
        credentials: 'same-origin',
        body: formData,
      });
      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.success || !data?.draft?._id) {
        throw new Error(data?.message || 'Failed to create the import draft.');
      }

      toast({
        title: 'Draft created',
        description: 'The import file was parsed successfully. Review and approve the questions before publish.',
      });

      router.push(`/workspace/upload/${data.draft._id}`);
    } catch (error) {
      toast({
        title: 'Import failed',
        description:
          error instanceof Error
            ? error.message
            : 'Failed to create the import draft.',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <PageShell width="wide" padding="standard">
      <div className="space-y-4 sm:space-y-5">
        <PageHero
          variant="editor"
          density="compact"
          eyebrow="Import Tools"
          title="Import Diagnostic Questions"
          description="Upload the teacher-master DOCX or the canonical diagnostic XLSX, review the parsed paper and questions, and publish only the items you approve."
          actions={
            <div className="app-import-inline-actions">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={navigateBack}
                className="app-import-action-button"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
              <Button type="button" variant="outline" size="sm" className="app-import-action-button" asChild>
                <Link href="/workspace/upload/getjson">
                  <TableProperties className="h-4 w-4" />
                  Spreadsheet import
                </Link>
              </Button>
            </div>
          }
          meta={
            <>
              <span className="app-meta-chip">DOCX or XLSX</span>
              <span className="app-meta-chip">Mandatory review</span>
              <span className="app-meta-chip">Question approval before publish</span>
            </>
          }
          stats={[
            {
              label: 'Selected file',
              value: importFile?.name || 'No file selected',
              meta: 'Upload the official teacher-master DOCX or the canonical diagnostic workbook.',
            },
            {
              label: 'Workflow',
              value: 'Upload -> Review -> Publish',
              meta: 'Questions and the draft paper are only created after approval.',
            },
            {
              label: 'Template',
              value: 'DOCX + XLSX',
              meta: 'Download the latest template before authoring a new paper.',
            },
          ]}
        />

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
          <Card className="app-surface overflow-hidden shadow-none">
            <CardHeader className="app-section-header">
              <CardTitle>Start an import draft</CardTitle>
              <CardDescription>
                Parse the uploaded DOCX or XLSX into a review draft. Nothing is published until the review is complete.
              </CardDescription>
            </CardHeader>
            <CardContent className="app-section-body space-y-5">
              <div className="app-import-inline-actions">
                <Button type="button" variant="outline" size="sm" className="app-import-action-button" asChild>
                  <a href="/api/question-import/template?format=docx">
                    <FileText className="h-4 w-4" />
                    DOCX template
                  </a>
                </Button>
                <Button type="button" variant="outline" size="sm" className="app-import-action-button" asChild>
                  <a href="/api/question-import/template?format=xlsx">
                    <TableProperties className="h-4 w-4" />
                    XLSX template
                  </a>
                </Button>
                <Button type="button" variant="outline" size="sm" className="app-import-action-button" asChild>
                  <Link href="/workspace/upload/getjson">
                    <TableProperties className="h-4 w-4" />
                    Open spreadsheet flow
                  </Link>
                </Button>
              </div>

              <div className="app-field-group">
                <FilePickerField
                  id="teacherMasterDocx"
                  label="Teacher master DOCX or diagnostic XLSX"
                  accept={ACCEPTED_IMPORT_FORMATS}
                  onChange={(event) => setImportFile(event.target.files?.[0] || null)}
                  selectedFileName={importFile?.name || null}
                  placeholder="Choose a DOCX or XLSX file"
                />
              </div>

              <div className="app-import-note-card">
                Supported in this version: DOCX files created from the official template, canonical diagnostic XLSX workbooks, embedded images inside DOCX stem/option/explanation blocks, and Word or Mathpix-style math that can be normalized into the editor.
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  size="sm"
                  className="app-import-action-button-primary"
                  onClick={() => void handleCreateDraft()}
                  disabled={isUploading || !importFile}
                >
                  {isUploading ? <Spinner className="h-4 w-4" /> : null}
                  Create draft
                </Button>
                <p className="text-sm text-muted-foreground">
                  After upload, you will land on the review screen to confirm the paper and each parsed question.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="app-surface overflow-hidden shadow-none">
            <CardHeader className="app-section-header">
              <CardTitle>What happens next</CardTitle>
            </CardHeader>
            <CardContent className="app-section-body space-y-3 text-sm text-muted-foreground">
              <div className="app-import-note-card">
                1. The import file is parsed into a review draft with paper metadata, sections, question blocks, and any supported images or math fragments.
              </div>
              <div className="app-import-note-card">
                2. You review the parsed questions in a create-style editor, fix issues, and approve or exclude each item.
              </div>
              <div className="app-import-note-card">
                3. Publish creates the approved question-bank items first, then one draft question paper with the reviewed sections and mapped academic sections.
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </PageShell>
  );
}
