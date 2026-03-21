import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-28 text-center">
      <p className="text-sm uppercase tracking-wide text-neutral-500">404</p>
      <h1 className="mt-2 text-4xl font-extrabold tracking-tight">Page not found</h1>
      <p className="mt-3 text-neutral-600 dark:text-neutral-300">The page you’re looking for doesn’t exist or has been moved.</p>
      <div className="mt-8">
        <Link href="/" className="rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-3 text-white shadow hover:opacity-95">Go back home</Link>
      </div>
    </main>
  );
}
