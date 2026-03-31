import { HeroSkeleton, CardGridSkeleton } from "@/components/LoadingSkeletons";

export default function ProductLoading() {
  return (
    <main className="bg-slate-50/50 min-h-screen">
      <HeroSkeleton />
      <div className="mx-auto max-w-7xl px-6 lg:px-8 py-24">
        <div className="flex flex-col items-center gap-4 mb-16 animate-pulse">
          <div className="h-10 w-64 rounded-xl bg-slate-100" />
          <div className="h-5 w-96 max-w-full rounded-lg bg-slate-50" />
        </div>
        <CardGridSkeleton count={4} />
      </div>
      {/* Pricing Skeleton */}
      <div className="mx-auto max-w-7xl px-6 lg:px-8 py-24 animate-pulse">
        <div className="flex flex-col items-center gap-4 mb-12">
          <div className="h-10 w-48 rounded-xl bg-slate-100" />
          <div className="h-5 w-72 rounded-lg bg-slate-50" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="rounded-3xl border border-slate-100 bg-white p-8 flex flex-col gap-5">
              <div className="h-6 w-24 rounded-lg bg-slate-100" />
              <div className="h-10 w-32 rounded-xl bg-slate-100" />
              <div className="space-y-3">
                {[...Array(4)].map((_, j) => (
                  <div key={j} className="h-4 w-full rounded bg-slate-50" />
                ))}
              </div>
              <div className="h-12 w-full rounded-full bg-emerald-100/40 mt-4" />
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
