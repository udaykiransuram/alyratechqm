import { HeroSkeleton } from "@/components/LoadingSkeletons";

export default function TalentTestLoading() {
  return (
    <main className="bg-slate-50/50 min-h-screen">
      <HeroSkeleton />
      <div className="mx-auto max-w-7xl px-6 lg:px-8 py-24 animate-pulse">
        <div className="max-w-2xl mx-auto">
          <div className="rounded-3xl border border-slate-100 bg-white p-10 flex flex-col items-center gap-6">
            <div className="h-8 w-56 rounded-xl bg-slate-100" />
            <div className="h-5 w-72 max-w-full rounded-lg bg-slate-50" />
            <div className="w-full space-y-4 mt-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="h-5 w-5 rounded bg-emerald-100/50 shrink-0" />
                  <div className="h-4 w-full rounded bg-slate-50" />
                </div>
              ))}
            </div>
            <div className="h-14 w-full rounded-2xl bg-emerald-100/40 mt-4" />
          </div>
        </div>
      </div>
    </main>
  );
}
