import PageLoadingState from "@/components/ui/page-loading-state";

type RouteLoadingPageProps = {
  title?: string;
  description?: string;
};

export default function RouteLoadingPage({
  title = "Loading page",
  description = "Opening the next workspace screen.",
}: RouteLoadingPageProps) {
  return (
    <PageLoadingState
      title={title}
      description={description}
      width="wide"
      padding="standard"
      className="app-route-loading-shell"
      contentClassName="app-route-loading-content"
      actions={
        <div className="app-route-loading-badge" role="status" aria-live="polite">
          <span className="app-route-loading-badge-spinner" />
          <span>Opening workspace screen</span>
        </div>
      }
    />
  );
}
