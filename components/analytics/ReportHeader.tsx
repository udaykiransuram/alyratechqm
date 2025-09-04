const ReportHeader = ({ student, rollNumber, paper }: { student: string; rollNumber: string; paper: string }) => (
  <div className="bg-white rounded-lg shadow-md border border-slate-200/80">
    <div className="p-6 border-b border-slate-200">
      <h1 className="text-2xl sm:text-3xl font-bold text-slate-800">Student Analytics Report</h1>
      <p className="text-slate-500 mt-1">Detailed performance breakdown by tags.</p>
    </div>
    <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
      {[
        { label: 'Student', value: student, icon: <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" /> },
        { label: 'Roll Number', value: rollNumber, icon: <><path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" /><path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" /></> },
        { label: 'Paper', value: paper, icon: <path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.968 7.968 0 005.5 16c1.255 0 2.443-.29 3.5-.804V4.804zM14.5 4c-1.255 0-2.443.29-3.5.804v10A7.968 7.968 0 0014.5 16c1.255 0 2.443-.29 3.5-.804V4.804A7.968 7.968 0 0014.5 4z" /> }
      ].map(item => (
        <div key={item.label} className="flex items-center gap-4">
          <div className="flex-shrink-0 bg-blue-100 text-blue-600 rounded-full p-2.5">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">{item.icon}</svg>
          </div>
          <div>
            <span className="font-semibold text-slate-700 block">{item.label}</span>
            <span className="text-slate-900">{item.value || '-'}</span>
          </div>
        </div>
      ))}
    </div>
  </div>
);

export default ReportHeader;