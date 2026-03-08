'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from '@/components/ui/use-toast';

export default function SignIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [schoolKey, setSchoolKey] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    const result = await signIn('credentials', {
      redirect: true,
      email,
      password,
      schoolKey,
      callbackUrl: '/manage/admin/indexing',
    });
    setIsLoading(false);
    if (!result || !result.ok) {
      const errorMessage =
        result?.error || 'Login failed. Please check your credentials and try again.';
      toast({ title: 'Error', description: errorMessage, variant: 'destructive' });
    }
  };

  return (
    <div className="app-page-shell max-w-md px-4 py-6 sm:px-0">
      <div className="app-page-header text-center">
        <h1 className="app-page-title">Admin Sign In</h1>
        <p className="app-page-subtitle">
          Enter your school key and credentials to access the admin workspace.
        </p>
      </div>

      <Card className="app-surface">
        <CardContent className="app-surface-body">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="app-field-group">
              <label className="app-field-label" htmlFor="schoolKey">
                School Key
              </label>
              <Input
                id="schoolKey"
                type="text"
                placeholder="Enter school key"
                value={schoolKey}
                onChange={(e) => setSchoolKey(e.target.value)}
                required
              />
            </div>

            <div className="app-field-group">
              <label className="app-field-label" htmlFor="email">
                Email
              </label>
              <Input
                id="email"
                type="email"
                placeholder="Enter email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="app-field-group">
              <label className="app-field-label" htmlFor="password">
                Password
              </label>
              <Input
                id="password"
                type="password"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <Button type="submit" disabled={isLoading} className="w-full">
              {isLoading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
