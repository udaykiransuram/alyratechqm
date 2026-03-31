export default function RegisterLoading() {
  return (
    <main className="bg-slate-50/50 min-h-screen">
      <div className="relative w-full bg-gradient-to-b from-teal-200/50 via-teal-100/30 to-slate-50 pt-28 pb-20 sm:pt-36 sm:pb-28 animate-pulse">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-xl flex flex-col items-center gap-5">
            <div className="h-10 w-64 rounded-xl bg-teal-300/25" />
            <div className="h-5 w-80 max-w-full rounded-lg bg-teal-200/20" />
          </div>
        </div>
      </div>
      <div className="mx-auto max-w-2xl px-6 lg:px-8 py-16 animate-pulse">
        <div className="rounded-3xl border border-slate-100 bg-white p-10 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="h-12 rounded-xl bg-slate-100" />
            <div className="h-12 rounded-xl bg-slate-100" />
          </div>
          <div className="h-12 rounded-xl bg-slate-100" />
          <div className="h-12 rounded-xl bg-slate-100" />
          <div className="h-12 rounded-xl bg-slate-100" />
          <div className="h-14 w-full rounded-2xl bg-emerald-100/40" />
        </div>
      </div>
    </main>
  );
}
