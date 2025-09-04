const ErrorState = ({ message }: { message: string }) => (
  <div className="flex items-center justify-center min-h-screen bg-slate-50">
    <div className="p-8 text-center bg-white shadow-xl rounded-lg border border-red-200 max-w-md">
      <h2 className="text-xl font-bold text-red-700">An Error Occurred</h2>
      <p className="mt-2 text-red-600">{message}</p>
    </div>
  </div>
);

export default ErrorState;