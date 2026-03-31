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

const ACCEPTED_DOCX_FORMATS = '.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export default function UploadPage() {
  const router = useRouter();
  const { navigateBack } = useBackNavigation('/workspace/questions');
  const { toast } = useToast();
  const [docxFile, setDocxFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  async function handleCreateDraft() {
    if (!docxFile) {
      toast({
        title: 'No DOCX selected',
        description: 'Choose a teacher-master DOCX file before starting the import.',
        variant: 'destructive',
      });
      return;
    }

    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', docxFile, docxFile.name || 'teacher-master.docx');

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
        description: 'The DOCX was parsed successfully. Review and approve the questions before publish.',
      });

      router.push(`/workspace/upload/${data.draft._id}`);
    } catch (error) {
      toast({
        title: 'Import failed',
        description:
          error instanceof Error
            ? error.message
            : 'Failed to create the DOCX import draft.',
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
          title="Import Teacher Master DOCX"
          description="Upload the official teacher-master DOCX, review the parsed paper and questions, approve what should be published, and keep spreadsheet import available as a separate path."
          actions={
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={navigateBack} className="app-button-back">
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
              <Button type="button" variant="outline" asChild>
                <Link href="/workspace/upload/getjson">
                  <TableProperties className="h-4 w-4" />
                  Spreadsheet import
                </Link>
              </Button>
            </div>
          }
          meta={
            <>
              <span className="app-meta-chip">DOCX only</span>
              <span className="app-meta-chip">Mandatory review</span>
              <span className="app-meta-chip">Question approval before publish</span>
            </>
          }
          stats={[
            {
              label: 'Selected file',
              value: docxFile?.name || 'No file selected',
              meta: 'Upload the official teacher-master DOCX template or a file edited from it.',
            },
            {
              label: 'Workflow',
              value: 'Upload -> Review -> Publish',
              meta: 'Questions and the draft paper are only created after approval.',
            },
            {
              label: 'Template',
              value: 'Versioned DOCX',
              meta: 'Download the latest template before authoring a new paper.',
            },
          ]}
        />

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
          <Card className="app-surface overflow-hidden shadow-none">
            <CardHeader className="app-section-header">
              <CardTitle>Start a DOCX import draft</CardTitle>
              <CardDescription>
                This flow parses the uploaded DOCX into a review draft. Nothing is published until you approve the questions.
              </CardDescription>
            </CardHeader>
            <CardContent className="app-section-body space-y-5">
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" asChild>
                  <a href="/api/question-import/template?format=docx">
                    <FileText className="h-4 w-4" />
                    Download DOCX template
                  </a>
                </Button>
                <Button type="button" variant="outline" asChild>
                  <Link href="/workspace/upload/getjson">
                    <TableProperties className="h-4 w-4" />
                    Open spreadsheet flow
                  </Link>
                </Button>
              </div>

              <div className="app-field-group">
                <FilePickerField
                  id="teacherMasterDocx"
                  label="Teacher master DOCX"
                  accept={ACCEPTED_DOCX_FORMATS}
                  onChange={(event) => setDocxFile(event.target.files?.[0] || null)}
                  selectedFileName={docxFile?.name || null}
                  placeholder="Choose a DOCX file"
                />
              </div>

              <div className="rounded-[var(--app-radius-md)] border border-border/70 bg-[hsl(var(--app-surface-1)/0.92)] px-4 py-3 text-sm text-muted-foreground">
                Supported in this version: DOCX files created from the official template, embedded images inside stem/options/explanation blocks, and Word or Mathpix-style math that can be normalized into the app editor.
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  onClick={() => void handleCreateDraft()}
                  disabled={isUploading || !docxFile}
                >
                  {isUploading ? <Spinner className="h-4 w-4" /> : null}
                  Create review draft
                </Button>
                <p className="text-sm text-muted-foreground">
                  After upload, you will land on the approval screen to review the paper and each parsed question.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="app-surface overflow-hidden shadow-none">
            <CardHeader className="app-section-header">
              <CardTitle>What happens next</CardTitle>
            </CardHeader>
            <CardContent className="app-section-body space-y-3 text-sm text-muted-foreground">
              <div className="rounded-[var(--app-radius-md)] border border-border/70 bg-[hsl(var(--app-surface-1)/0.92)] px-4 py-3">
                1. The DOCX is parsed into a review draft with paper metadata, sections, images, math fragments, and question blocks.
              </div>
              <div className="rounded-[var(--app-radius-md)] border border-border/70 bg-[hsl(var(--app-surface-1)/0.92)] px-4 py-3">
                2. You review the parsed questions in a create-style editor, fix issues, and approve or exclude each item.
              </div>
              <div className="rounded-[var(--app-radius-md)] border border-border/70 bg-[hsl(var(--app-surface-1)/0.92)] px-4 py-3">
                3. Publish creates the approved question-bank items first, then one draft question paper with the reviewed sections and mapped academic sections.
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </PageShell>
  );
}
