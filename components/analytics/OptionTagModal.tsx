const OptionTagModal = ({
  isOpen,
  onClose,
  option,
  tag,
  isCorrect,
  students,
}: {
  isOpen: boolean;
  onClose: () => void;
  option: string;
  tag: string;
  isCorrect: boolean;
  students: { name: string; rollNumber: string }[];
}) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center border-b border-slate-200 p-4">
          <h3 className="text-lg font-semibold text-slate-800">
            {option}: {tag} <span className={isCorrect ? "text-green-700" : "text-red-700"}>({isCorrect ? "Correct" : "Incorrect"})</span>
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-slate-500 hover:bg-slate-200 focus:outline-none"
            aria-label="Close"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-4">
          <div className="font-semibold mb-2">Students who selected this option:</div>
          <ul className="list-disc list-inside text-slate-700 text-sm">
            {students.length > 0
              ? students.map((s, i) => (
                  <li key={i}>{s.name} ({s.rollNumber})</li>
                ))
              : <li className="text-slate-400 italic">None</li>}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default OptionTagModal;