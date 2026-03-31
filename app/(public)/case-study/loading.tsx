import { HeroSkeleton, TwoColumnSkeleton } from "@/components/LoadingSkeletons";

export default function CaseStudyLoading() {
  return (
    <main className="bg-slate-50/50 min-h-screen">
      <HeroSkeleton />
      <div className="mx-auto max-w-7xl px-6 lg:px-8 py-20">
        <TwoColumnSkeleton />
        <div className="mt-20 animate-pulse">
          <div className="flex flex-col items-center gap-4 mb-12">
            <div className="h-10 w-64 rounded-xl bg-slate-100" />
            <div className="h-5 w-80 max-w-full rounded-lg bg-slate-50" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="rounded-2xl border border-slate-100 bg-white p-8 flex flex-col gap-4">
                <div className="h-6 w-40 rounded-lg bg-slate-100" />
                <div className="space-y-2">
                  <div className="h-4 w-full rounded bg-slate-50" />
                  <div className="h-4 w-5/6 rounded bg-slate-50" />
                  <div className="h-4 w-3/4 rounded bg-slate-50" />
                </div>
                <div className="flex gap-3 mt-2">
                  <div className="h-8 w-20 rounded-full bg-emerald-50" />
                  <div className="h-8 w-20 rounded-full bg-blue-50" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
