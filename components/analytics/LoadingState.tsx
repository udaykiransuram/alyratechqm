import type { ReactNode } from 'react';

import PageLoadingState from '@/components/ui/page-loading-state';

type LoadingStateProps = {
  actions?: ReactNode;
};

const LoadingState = ({ actions }: LoadingStateProps) => (
  <div className="analytics-page">
    <div className="container">
      <div className="app-page-shell max-w-5xl">
        <PageLoadingState
          title="Loading analytics report"
          description="Crunching question, section, and benchmark metrics for this paper."
          actions={actions}
          dense
          className="px-0 py-0"
          contentClassName="max-w-none"
        />
      </div>
    </div>
  </div>
);

export default LoadingState;
