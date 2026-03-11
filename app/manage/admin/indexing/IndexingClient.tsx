'use client';

import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useBackNavigation } from '@/hooks/useReturnNavigation';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from '@/components/ui/use-toast';
import useSWR from 'swr';

async function fetcher(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch');
  return res.json();
}

export default function IndexingClient() {
  const { navigateBack } = useBackNavigation('/manage/users');
  const [schoolKey, setSchoolKey] = useState('');
  const [results, setResults] = useState<Record<string, any> | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const { data: schools, error: schoolsError } = useSWR('/api/schools', fetcher);

  const handleIndexAll = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/admin/reindex-ui', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ all: true }),
      });
      if (!res.ok) throw new Error('Failed to index');
      const data = await res.json();
      setResults(data.results);
      toast({ title: 'Success', description: 'Indexing completed for all tenants.' });
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to index all tenants.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleIndexOne = async () => {
    if (!schoolKey) {
      return toast({
        title: 'Error',
        description: 'Please select a school.',
        variant: 'destructive',
      });
    }
    setIsLoading(true);
    try {
      const res = await fetch('/api/admin/reindex-ui', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schoolKey }),
      });
      if (!res.ok) throw new Error('Failed to index');
      const data = await res.json();
      setResults(data.results);
      toast({ title: 'Success', description: `Indexing completed for ${schoolKey}.` });
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to index selected tenant.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="app-page-shell max-w-4xl px-4 py-6 sm:px-0">
      <div className="app-page-header-row">
        <div>
          <h1 className="app-page-title">Database Indexing</h1>
          <p className="app-page-subtitle">
            Rebuild indexes for one tenant or for the full multi-tenant workspace.
          </p>
        </div>
        <Button type="button" variant="outline" onClick={navigateBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
      </div>

      <Card className="app-surface">
        <CardContent className="app-surface-body">
          <div className="flex flex-wrap gap-3">
            <Button onClick={handleIndexAll} disabled={isLoading}>
              {isLoading ? 'Indexing...' : 'Index All Tenants'}
            </Button>
          </div>

          <div className="flex flex-col gap-3 md:flex-row">
            {schoolsError ? (
              <Input
                placeholder="Enter School Key"
                value={schoolKey}
                onChange={(e) => setSchoolKey(e.target.value)}
              />
            ) : (
              <Select onValueChange={setSchoolKey} value={schoolKey}>
                <SelectTrigger className="md:max-w-sm">
                  <SelectValue placeholder="Select School" />
                </SelectTrigger>
                <SelectContent>
                  {schools?.schools?.map((school: any) => (
                    <SelectItem key={school.key} value={school.key}>
                      {school.displayName || school.key}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button onClick={handleIndexOne} disabled={isLoading || !schoolKey}>
              {isLoading ? 'Indexing...' : 'Index Selected Tenant'}
            </Button>
          </div>

          {results ? (
            <div className="app-section">
              <h2 className="text-lg font-semibold tracking-tight text-foreground">
                Latest Result
              </h2>
              <pre className="overflow-auto rounded-xl bg-background p-4 text-sm text-foreground">
                {JSON.stringify(results, null, 2)}
              </pre>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
