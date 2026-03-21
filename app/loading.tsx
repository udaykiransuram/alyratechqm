export default function HomeLoading() {
  return (
    <div className="bg-white min-h-screen animate-pulse">
      {/* Hero Skeleton */}
      <div className="relative w-full bg-gradient-to-b from-teal-200/60 via-teal-100/40 to-white pt-28 pb-36 sm:pt-36 sm:pb-44">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-3xl flex flex-col items-center gap-6">
            {/* Pill */}
            <div className="h-7 w-40 rounded-full bg-teal-300/40" />
            {/* Title */}
            <div className="h-12 sm:h-16 w-full max-w-xl rounded-2xl bg-teal-300/30" />
            <div className="h-12 sm:h-16 w-3/4 max-w-md rounded-2xl bg-teal-300/25" />
            {/* Subtitle */}
            <div className="h-5 w-full max-w-lg rounded-lg bg-teal-200/30 mt-2" />
            <div className="h-5 w-2/3 max-w-sm rounded-lg bg-teal-200/25" />
            {/* CTA Buttons */}
            <div className="flex gap-4 mt-6">
              <div className="h-12 w-40 rounded-full bg-emerald-300/30" />
              <div className="h-12 w-36 rounded-full bg-slate-200/50" />
            </div>
          </div>
        </div>
      </div>

      {/* Stats Row Skeleton */}
      <div className="mx-auto max-w-7xl px-6 lg:px-8 -mt-16 relative z-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 flex flex-col items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-slate-100" />
              <div className="h-8 w-20 rounded-lg bg-slate-100" />
              <div className="h-4 w-24 rounded bg-slate-50" />
            </div>
          ))}
        </div>
      </div>

      {/* Feature Cards Skeleton */}
      <div className="mx-auto max-w-7xl px-6 lg:px-8 py-24">
        <div className="flex flex-col items-center gap-4 mb-16">
          <div className="h-10 w-72 rounded-xl bg-slate-100" />
          <div className="h-5 w-96 max-w-full rounded-lg bg-slate-50" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="rounded-2xl border border-slate-100 p-8 flex flex-col gap-4">
              <div className="h-12 w-12 rounded-xl bg-slate-100" />
              <div className="h-6 w-40 rounded-lg bg-slate-100" />
              <div className="space-y-2">
                <div className="h-4 w-full rounded bg-slate-50" />
                <div className="h-4 w-5/6 rounded bg-slate-50" />
                <div className="h-4 w-3/4 rounded bg-slate-50" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* CTA Section Skeleton */}
      <div className="mx-auto max-w-7xl px-6 lg:px-8 pb-24">
        <div className="rounded-3xl bg-slate-50 p-12 flex flex-col items-center gap-6">
          <div className="h-10 w-80 max-w-full rounded-xl bg-slate-100" />
          <div className="h-5 w-64 rounded-lg bg-slate-100/60" />
          <div className="h-12 w-44 rounded-full bg-emerald-100/50 mt-2" />
        </div>
      </div>
    </div>
  );
}
