import { Metadata } from 'next';
import PageHero from '@/components/layout/PageHero';

export const metadata: Metadata = {
  title: 'Subject',
  robots: {
    index: false,
    follow: false,
  },
};

export default function SubjectPage() {
  return (
    <div className="app-page-shell max-w-3xl px-4 py-6 sm:px-0">
      <PageHero
        eyebrow="Curriculum"
        title="Subject"
        description="This page is ready for subject-specific content and setup controls."
      />

      <div className="app-surface app-surface-body">
        <p className="text-sm text-muted-foreground">
          Add your subject dashboard, metadata, or management tools here.
        </p>
      </div>
    </div>
  );
}
