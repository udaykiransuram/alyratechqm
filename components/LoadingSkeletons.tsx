/**
 * Reusable skeleton for pages that use InnerHero + content sections.
 * Each page loading.tsx composes this with page-specific content skeletons.
 */

function HeroSkeleton() {
  return (
    <div className="relative w-full bg-gradient-to-b from-teal-200/50 via-teal-100/30 to-slate-50 pt-28 pb-36 sm:pt-36 sm:pb-44 animate-pulse">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-3xl flex flex-col items-center gap-5">
          <div className="h-7 w-32 rounded-full bg-teal-300/30" />
          <div className="h-12 sm:h-16 w-full max-w-lg rounded-2xl bg-teal-300/25" />
          <div className="h-5 w-full max-w-md rounded-lg bg-teal-200/25 mt-1" />
          <div className="h-5 w-2/3 max-w-sm rounded-lg bg-teal-200/20" />
        </div>
      </div>
    </div>
  );
}

function CardGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 animate-pulse">
      {[...Array(count)].map((_, i) => (
        <div key={i} className="rounded-2xl border border-slate-100 bg-white p-8 flex flex-col gap-4">
          <div className="h-10 w-10 rounded-xl bg-slate-100" />
          <div className="h-5 w-32 rounded-lg bg-slate-100" />
          <div className="space-y-2">
            <div className="h-3.5 w-full rounded bg-slate-50" />
            <div className="h-3.5 w-5/6 rounded bg-slate-50" />
            <div className="h-3.5 w-4/6 rounded bg-slate-50" />
          </div>
        </div>
      ))}
    </div>
  );
}

function TwoColumnSkeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center animate-pulse">
      <div className="space-y-4">
        <div className="h-8 w-3/4 rounded-xl bg-slate-100" />
        <div className="space-y-2">
          <div className="h-4 w-full rounded bg-slate-50" />
          <div className="h-4 w-full rounded bg-slate-50" />
          <div className="h-4 w-5/6 rounded bg-slate-50" />
          <div className="h-4 w-4/6 rounded bg-slate-50" />
        </div>
      </div>
      <div className="aspect-[4/3] rounded-2xl bg-slate-100/60" />
    </div>
  );
}

function StatsSkeleton({ count = 3 }: { count?: number }) {
  const responsiveColumns = count === 4 ? "md:grid-cols-4" : count === 3 ? "md:grid-cols-3" : count === 2 ? "md:grid-cols-2" : "md:grid-cols-1";

  return (
    <div className={`grid grid-cols-1 ${responsiveColumns} gap-6 animate-pulse`}>
      {[...Array(count)].map((_, i) => (
        <div key={i} className="bg-white rounded-2xl border border-slate-100 p-8 text-center flex flex-col items-center gap-3">
          <div className="h-12 w-24 rounded-xl bg-slate-100" />
          <div className="h-4 w-28 rounded bg-slate-50" />
        </div>
      ))}
    </div>
  );
}

function FormSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="h-12 rounded-xl bg-slate-100" />
        <div className="h-12 rounded-xl bg-slate-100" />
      </div>
      <div className="h-12 rounded-xl bg-slate-100" />
      <div className="h-12 rounded-xl bg-slate-100" />
      <div className="h-32 rounded-xl bg-slate-100" />
      <div className="h-12 w-40 rounded-full bg-emerald-100/50" />
    </div>
  );
}

export { HeroSkeleton, CardGridSkeleton, TwoColumnSkeleton, StatsSkeleton, FormSkeleton };
