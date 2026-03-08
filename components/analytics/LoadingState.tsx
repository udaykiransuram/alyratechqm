import { Spinner } from '@/components/ui/spinner';

const LoadingState = () => (
  <div className="analytics-page">
    <div className="container">
      <div className="app-page-shell max-w-3xl">
        <div className="analytics-card">
          <div className="analytics-card-body">
            <div className="app-status-row justify-center py-10 text-base">
              <Spinner />
              <span>Loading analytics report…</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
);

export default LoadingState;
