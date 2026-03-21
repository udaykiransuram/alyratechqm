import { HeroSkeleton, CardGridSkeleton, TwoColumnSkeleton } from "@/components/LoadingSkeletons";

export default function BenefitsLoading() {
  return (
    <main className="bg-slate-50/50 min-h-screen">
      <HeroSkeleton />
      <div className="mx-auto max-w-7xl px-6 lg:px-8 py-24">
        <CardGridSkeleton count={4} />
      </div>
      <div className="mx-auto max-w-7xl px-6 lg:px-8 pb-24">
        <TwoColumnSkeleton />
      </div>
      <div className="mx-auto max-w-7xl px-6 lg:px-8 pb-24 animate-pulse">
        <div className="rounded-3xl bg-slate-50 p-12 flex flex-col items-center gap-5">
          <div className="h-10 w-72 max-w-full rounded-xl bg-slate-100" />
          <div className="h-5 w-56 rounded-lg bg-slate-100/60" />
          <div className="h-12 w-44 rounded-full bg-emerald-100/40 mt-2" />
        </div>
      </div>
    </main>
  );
}
