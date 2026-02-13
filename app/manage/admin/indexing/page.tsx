'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/use-toast';
import useSWR from 'swr';

async function fetcher(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch');
  return res.json();
}

export default function IndexingPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [schoolKey, setSchoolKey] = useState('');
  const [results, setResults] = useState<Record<string, any> | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const { data: schools, error: schoolsError } = useSWR('/api/schools', fetcher);

  if (status === 'loading') return <Skeleton className="h-32 w-full" />;
  if (!session || session.user.role !== 'admin') {
    router.push('/');
    return null;
  }

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
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to index all tenants.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleIndexOne = async () => {
    if (!schoolKey) return toast({ title: 'Error', description: 'Please select a school.', variant: 'destructive' });
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
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to index selected tenant.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Database Indexing</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button onClick={handleIndexAll} disabled={isLoading}>
          {isLoading ? 'Indexing...' : 'Index All Tenants'}
        </Button>
        <div className="flex space-x-2">
          {schoolsError ? (
            <Input
              placeholder="Enter School Key"
              value={schoolKey}
              onChange={(e) => setSchoolKey(e.target.value)}
            />
          ) : (
            <Select onValueChange={setSchoolKey}>
              <SelectTrigger>
                <SelectValue placeholder="Select School" />
              </SelectTrigger>
              <SelectContent>
                {schools?.map((school: any) => (
                  <SelectItem key={school.key} value={school.key}>
                    {school.name || school.key}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button onClick={handleIndexOne} disabled={isLoading || !schoolKey}>
            {isLoading ? 'Indexing...' : 'Index Selected Tenant'}
          </Button>
        </div>
        {results && (
          <pre className="bg-gray-100 p-4 rounded overflow-auto">
            {JSON.stringify(results, null, 2)}
          </pre>
        )}
      </CardContent>
    </Card>
  );
}