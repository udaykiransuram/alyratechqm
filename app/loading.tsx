import PageLoadingState from "@/components/ui/page-loading-state";

export default function AppLoading() {
  return (
    <PageLoadingState
      title="Loading page"
      description="Preparing the workspace and the latest school data."
    />
  );
}
