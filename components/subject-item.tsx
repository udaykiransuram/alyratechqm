'use client';

import AppPrefetchLink from '@/components/navigation/AppPrefetchLink';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { useReturnHrefBuilder } from '@/hooks/useReturnNavigation';
import { Archive, Edit } from 'lucide-react';

interface TagType {
  _id: string;
  name: string;
}

interface TagItem {
  _id: string;
  name: string;
  type: TagType;
}

export interface Subject {
  _id: string;
  name: string;
  code?: string;
  description?: string;
  tags: TagItem[];
}

export interface SubjectItemProps {
  subject: Subject;
  onDelete: (id: string) => void;
  isLoading: boolean;
}

export function SubjectItem({ subject, onDelete, isLoading }: SubjectItemProps) {
  const { buildReturnHref } = useReturnHrefBuilder('/workspace/subjects');
  return (
    <li className="h-full list-none">
      <Card className="app-surface flex h-full flex-col overflow-hidden transition-shadow duration-200 hover:shadow-md">
        <CardContent className="flex h-full flex-col p-0 pt-0">
          <div className="flex flex-1 flex-col gap-4 p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <h3 className="text-base font-semibold text-foreground">{subject.name}</h3>
                <p className="text-sm text-muted-foreground">
                  {subject.description?.trim() || 'No description added for this subject yet.'}
                </p>
              </div>
              {subject.code ? (
                <Badge variant="outline" className="shrink-0 font-medium">
                  {subject.code}
                </Badge>
              ) : null}
            </div>

            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Tags
              </p>
              {subject.tags?.length ? (
                <div className="flex flex-wrap gap-2">
                  {subject.tags.map((tag) => (
                    <Badge key={tag._id} variant="secondary" className="gap-1 px-2.5 py-1 text-xs">
                      <span>{tag.name}</span>
                      <span className="opacity-70">• {tag.type.name}</span>
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No tags linked.</p>
              )}
            </div>
          </div>

          <div className="border-t border-border/60 bg-muted/10 p-4">
            <div className="app-row-action-group justify-end">
              <AppPrefetchLink
                href={buildReturnHref(`/workspace/subjects/edit/${subject._id}`)}
              >
                <Button
                  disabled={isLoading}
                  size="sm"
                  variant="outline"
                  className="app-row-action-button app-row-action-button-accent"
                  aria-label={`Edit ${subject.name}`}
                  title={`Edit ${subject.name}`}
                >
                  <Edit className="h-4 w-4" />
                  Edit
                </Button>
              </AppPrefetchLink>
              <Button
                onClick={() => onDelete(subject._id)}
                disabled={isLoading}
                variant="outline"
                size="sm"
                className="app-row-action-button app-row-action-button-danger"
                aria-label={`Archive ${subject.name}`}
                title={`Archive ${subject.name}`}
              >
                {isLoading ? <Spinner /> : <Archive className="h-4 w-4" />}
                Archive
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </li>
  );
}

export function SubjectItemSkeleton() {
  return (
    <li className="h-full list-none">
      <Card className="app-surface h-full overflow-hidden animate-pulse">
        <CardContent className="flex h-full flex-col p-0 pt-0">
          <div className="flex-1 space-y-4 p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 space-y-2">
                <div className="h-5 w-2/3 rounded bg-muted" />
                <div className="h-4 w-full rounded bg-muted" />
                <div className="h-4 w-4/5 rounded bg-muted" />
              </div>
              <div className="h-6 w-16 rounded-full bg-muted" />
            </div>
            <div className="space-y-2">
              <div className="h-3 w-14 rounded bg-muted" />
              <div className="flex flex-wrap gap-2">
                <div className="h-6 w-20 rounded-full bg-muted" />
                <div className="h-6 w-24 rounded-full bg-muted" />
                <div className="h-6 w-16 rounded-full bg-muted" />
              </div>
            </div>
          </div>
          <div className="border-t border-border/60 bg-muted/10 p-4">
            <div className="flex justify-end gap-2">
              <div className="h-9 w-9 rounded-xl bg-muted" />
              <div className="h-9 w-9 rounded-xl bg-muted" />
            </div>
          </div>
        </CardContent>
      </Card>
    </li>
  );
}
