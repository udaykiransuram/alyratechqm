'use client';

import AppPrefetchLink from '@/components/navigation/AppPrefetchLink';
import { Button } from '@/components/ui/button';
import { FilePenLine, Printer } from 'lucide-react';
import { useReturnHrefBuilder } from '@/hooks/useReturnNavigation';

export function PrintEditToolbar({ paperId }: { paperId: string }) {
  const { buildReturnHref } = useReturnHrefBuilder('/workspace/question-papers');

  return (
    <div className="flex items-center gap-2 print:hidden">
      <Button variant="outline" asChild className="app-button-inline">
        <AppPrefetchLink
          href={buildReturnHref(`/workspace/question-papers/edit/${paperId}`)}
          relatedApiPrefetches={[
            `/api/question-papers/${paperId}`,
            '/api/classes',
            '/api/sections',
            '/api/subjects',
            '/api/tags/with-subjects',
          ]}
        >
          <FilePenLine className="h-4 w-4" /> Edit
        </AppPrefetchLink>
      </Button>
      <Button variant="outline" className="app-button-inline" onClick={() => window.print()}>
        <Printer className="h-4 w-4" /> Print
      </Button>
    </div>
  );
}
