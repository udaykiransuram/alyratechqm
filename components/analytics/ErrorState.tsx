import type { ReactNode } from 'react';

type ErrorStateProps = {
  message: string;
  actions?: ReactNode;
};

const ErrorState = ({ message, actions }: ErrorStateProps) => (
  <div className="analytics-page">
    <div className="container">
      <div className="app-page-shell max-w-3xl">
        <div className="analytics-card overflow-hidden">
          {actions ? (
            <div className="analytics-card-header">
              <div className="flex flex-wrap items-center justify-end gap-2">{actions}</div>
            </div>
          ) : null}
          <div className="analytics-card-body">
            <div className="app-feedback app-feedback-error space-y-2 text-center">
              <h2 className="text-lg font-semibold">Unable to load analytics</h2>
              <p>{message}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
);

export default ErrorState;
