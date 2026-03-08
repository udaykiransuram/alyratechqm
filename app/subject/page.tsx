import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Subject',
};

export default function SubjectPage() {
  return (
    <div className="app-page-shell max-w-3xl px-4 py-6 sm:px-0">
      <div className="app-page-header">
        <h1 className="app-page-title">Subject</h1>
        <p className="app-page-subtitle">
          This page is ready for subject-specific content and setup controls.
        </p>
      </div>

      <div className="app-surface app-surface-body">
        <p className="text-sm text-muted-foreground">
          Add your subject dashboard, metadata, or management tools here.
        </p>
      </div>
    </div>
  );
}
