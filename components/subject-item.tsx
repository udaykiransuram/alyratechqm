// components/subject-item.tsx
'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { Spinner } from '@/components/ui/spinner';

// Define the correct, nested structure for a tag's type
interface TagType {
  _id: string;
  name: string;
}

// Define the structure for a populated tag item
interface TagItem {
  _id: string;
  name: string;
  type: TagType; // Type is an object, not a string
}

// Define the structure for a Subject, expecting populated tags
export interface Subject {
  _id:string;
  name: string;
  code?: string;
  description?: string;
  tags: TagItem[];
}

// Define the props that the SubjectItem component actually uses.
// Removed props related to inline editing (allAvailableTags, onCreateNewTag, onUpdate).
export interface SubjectItemProps {
  subject: Subject;
  onDelete: (id: string) => void;
  isLoading: boolean;
}

export function SubjectItem({
  subject,
  onDelete,
  isLoading,
}: SubjectItemProps) {
  // The component logic is already simplified for display-only purposes.
  return (
    <li className="list-none">
      <Card className="flex items-center justify-between p-4 shadow-sm hover:shadow-md transition-shadow duration-200 ease-in-out border border-border/50 animate-card-fade-in">
        <CardContent className="flex-1 p-0 grid gap-2">
          <h3 className="text-lg font-semibold text-foreground">{subject.name}</h3>
          {subject.code && (
            <p className="text-sm text-muted-foreground">Code: {subject.code}</p>
          )}
          {subject.description && (
            <p className="text-sm text-muted-foreground">{subject.description}</p>
          )}
          {subject.tags && subject.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {subject.tags.map((tag) => (
                <Badge key={tag._id} variant="secondary" className="capitalize">
                  {tag.name} ({tag.type.name})
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
        <div className="flex gap-2 ml-4">
          <Link href={`/subjects/edit/${subject._id}`} passHref>
            <Button disabled={isLoading} size="sm" variant="outline">
              Edit
            </Button>
          </Link>
          <Button onClick={() => onDelete(subject._id)} disabled={isLoading} variant="destructive" size="sm">
            {isLoading ? <Spinner /> : 'Delete'}
          </Button>
        </div>
      </Card>
    </li>
  );
}

export function SubjectItemSkeleton() {
    return (
      <Card className="flex items-center justify-between p-4 shadow-sm border border-border/50 animate-pulse">
        <CardContent className="flex-1 p-0 grid gap-2">
          <div className="h-6 bg-muted rounded w-3/4"></div>
          <div className="h-4 bg-muted rounded w-1/2"></div>
          <div className="h-4 bg-muted rounded w-full"></div>
          <div className="flex flex-wrap gap-1 mt-2">
            <div className="h-5 bg-muted rounded-full w-16"></div>
            <div className="h-5 bg-muted rounded-full w-20"></div>
          </div>
        </CardContent>
        <div className="flex gap-2 ml-4">
          <div className="h-9 w-16 bg-muted rounded"></div>
          <div className="h-9 w-20 bg-muted rounded"></div>
        </div>
      </Card>
    );
  }