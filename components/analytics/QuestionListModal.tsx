const QuestionListModal = ({
  isOpen,
  onClose,
  title,
  questionIds,
  groupStats,
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  questionIds: any[];
  groupStats?: {
    correctCount: number;
    incorrectCount: number;
    unattemptedCount: number;
    correctStudents: { name: string; rollNumber: string; count?: number }[];
    incorrectStudents: { name: string; rollNumber: string; count?: number }[];
    unattemptedStudents: { name: string; rollNumber: string; count?: number }[];
  };
}) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full" onClick={e => e.stopPropagation()}>
        {/* ...modal content as in your code... */}
      </div>
    </div>
  );
};

export default QuestionListModal;