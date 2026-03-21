import { HeroSkeleton, TwoColumnSkeleton, StatsSkeleton } from "@/components/LoadingSkeletons";

export default function AboutLoading() {
  return (
    <main className="bg-slate-50/50 min-h-screen">
      <HeroSkeleton />
      <div className="mx-auto max-w-7xl px-6 lg:px-8 py-20">
        <TwoColumnSkeleton />
        <div className="mt-24">
          <StatsSkeleton count={3} />
        </div>
        <div className="mt-24 animate-pulse">
          <div className="flex flex-col items-center gap-4 mb-12">
            <div className="h-10 w-56 rounded-xl bg-slate-100" />
            <div className="h-5 w-80 max-w-full rounded-lg bg-slate-50" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="rounded-2xl border border-slate-100 bg-white p-8 flex flex-col items-center gap-4">
                <div className="h-16 w-16 rounded-full bg-slate-100" />
                <div className="h-5 w-32 rounded-lg bg-slate-100" />
                <div className="h-4 w-40 rounded bg-slate-50" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
