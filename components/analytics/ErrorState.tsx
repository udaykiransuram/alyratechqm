const ErrorState = ({ message }: { message: string }) => (
  <div className="analytics-page">
    <div className="container">
      <div className="app-page-shell max-w-3xl">
        <div className="analytics-card">
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
