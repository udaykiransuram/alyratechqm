type RouteLoadingPageProps = {
  title?: string;
  description?: string;
};

export default function RouteLoadingPage({
  title = "Loading page",
  description = "Opening the next workspace screen.",
}: RouteLoadingPageProps) {
  return (
    <div className="app-page-shell max-w-[88rem] px-4 py-5 sm:px-0">
      <div className="rounded-[1.75rem] border border-border/70 bg-background/95 shadow-sm">
        <div className="flex min-h-[46vh] flex-col items-center justify-center gap-4 px-6 py-12 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full border border-primary/20 bg-primary/5 text-primary">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
          </div>
          <div className="space-y-1.5">
            <h1 className="app-page-title text-xl sm:text-2xl">{title}</h1>
            <p className="app-page-subtitle mx-auto max-w-md">{description}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
