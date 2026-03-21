'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { FilePenLine, Printer } from 'lucide-react';
import { useReturnHrefBuilder } from '@/hooks/useReturnNavigation';

export function PrintEditToolbar({ paperId }: { paperId: string }) {
  const { buildReturnHref } = useReturnHrefBuilder('/workspace/question-papers');

  return (
    <div className="flex items-center gap-2 print:hidden">
      <Button variant="outline" asChild>
        <Link href={buildReturnHref(`/workspace/question-papers/edit/${paperId}`)}>
          <FilePenLine className="mr-2 h-4 w-4" /> Edit
        </Link>
      </Button>
      <Button variant="outline" onClick={() => window.print()}>
        <Printer className="mr-2 h-4 w-4" /> Print
      </Button>
    </div>
  );
}