'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/components/ui/use-toast';

export default function SignIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [schoolKey, setSchoolKey] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    console.log('Attempting signIn with:', { email, schoolKey }); // Debug log
    const result = await signIn('credentials', {
      redirect: true,
      email,
      password,
      schoolKey,
      callbackUrl: '/manage/admin/indexing',
    });
    console.log('signIn result:', result); // Debug log
    setIsLoading(false);
    if (!result || !result.ok) {
      const errorMessage = result?.error || 'Login failed. Please check your credentials and try again.';
      console.log('Login error:', errorMessage); // Debug log
      toast({ title: 'Error', description: errorMessage, variant: 'destructive' });
      return;
    }
  };

  return (
    <Card className="max-w-md mx-auto mt-8">
      <CardHeader>
        <CardTitle>Admin Sign In</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            type="text"
            placeholder="School Key"
            value={schoolKey}
            onChange={(e) => setSchoolKey(e.target.value)}
            required
          />
          <Input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <Button type="submit" disabled={isLoading}>
            {isLoading ? 'Signing in...' : 'Sign In'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}