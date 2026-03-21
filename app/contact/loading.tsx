import { HeroSkeleton, FormSkeleton } from "@/components/LoadingSkeletons";

export default function ContactLoading() {
  return (
    <main className="bg-slate-50/50 min-h-screen">
      <HeroSkeleton />
      <div className="mx-auto max-w-7xl px-6 lg:px-8 py-24">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
          {/* Form */}
          <div className="order-2 lg:order-1">
            <div className="animate-pulse mb-8">
              <div className="h-8 w-48 rounded-xl bg-slate-100 mb-3" />
              <div className="h-4 w-72 max-w-full rounded bg-slate-50" />
            </div>
            <FormSkeleton />
          </div>
          {/* Contact Info */}
          <div className="order-1 lg:order-2 animate-pulse">
            <div className="aspect-square max-w-xs rounded-2xl bg-slate-100/40 mb-8 mx-auto lg:mx-0" />
            <div className="space-y-6">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex items-start gap-4">
                  <div className="h-10 w-10 rounded-lg bg-slate-100 shrink-0" />
                  <div className="space-y-2 flex-1">
                    <div className="h-5 w-24 rounded bg-slate-100" />
                    <div className="h-4 w-48 rounded bg-slate-50" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
