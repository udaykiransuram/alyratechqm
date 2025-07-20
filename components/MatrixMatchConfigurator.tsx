import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { PlusCircle, X } from 'lucide-react';
import { Label } from '@/components/ui/label';
import React from 'react';

export interface MatrixMatchConfiguratorProps {
  rows: string[];
  setRows: React.Dispatch<React.SetStateAction<string[]>>;
  cols: string[];
  setCols: React.Dispatch<React.SetStateAction<string[]>>;
  answers: number[][];
  setAnswers: React.Dispatch<React.SetStateAction<number[][]>>;
}

const MatrixMatchConfigurator = ({
  rows,
  setRows,
  cols,
  setCols,
  answers,
  setAnswers,
}: MatrixMatchConfiguratorProps) => {
  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
        {/* Row Configuration */}
        <div className="space-y-2">
          <Label className="font-semibold mb-2 block">Rows</Label>
          {rows.map((row, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <Input
                value={row}
                onChange={e => {
                  const updated = [...rows];
                  updated[idx] = e.target.value;
                  setRows(updated);
                }}
                placeholder={`Row ${idx + 1}`}
                className="w-full"
              />
              <Button
                variant="ghost"
                size="icon"
                disabled={rows.length <= 1}
                onClick={() => {
                  setRows(rows.filter((_, i) => i !== idx));
                  setAnswers(answers.filter((_, i) => i !== idx));
                }}
                aria-label="Remove row"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button variant="outline" onClick={() => setRows([...rows, ''])} className="w-full mt-2">
            <PlusCircle className="mr-2 h-4 w-4" />
            Add Row
          </Button>
        </div>

        {/* Column Configuration */}
        <div className="space-y-2">
          <Label className="font-semibold mb-2 block">Columns</Label>
          {cols.map((col, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <Input
                value={col}
                onChange={e => {
                  const updated = [...cols];
                  updated[idx] = e.target.value;
                  setCols(updated);
                }}
                placeholder={`Column ${idx + 1}`}
                className="w-full"
              />
              <Button
                variant="ghost"
                size="icon"
                disabled={cols.length <= 1}
                onClick={() => {
                  setCols(cols.filter((_, i) => i !== idx));
                  setAnswers(answers.map(row => row.filter(ans => ans !== idx)));
                }}
                aria-label="Remove column"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button variant="outline" onClick={() => setCols([...cols, ''])} className="w-full mt-2">
            <PlusCircle className="mr-2 h-4 w-4" />
            Add Column
          </Button>
        </div>
      </div>

      {/* Matching Grid */}
      <div className="overflow-x-auto mt-6">
        <table className="w-full text-center border-collapse">
          <thead>
            <tr>
              <th className="border p-2 w-1/4 bg-muted"></th>
              {cols.map((col, colIdx) => (
                <th key={colIdx} className="border p-2 font-medium bg-muted">
                  {col || `Col ${colIdx + 1}`}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIdx) => (
              <tr key={rowIdx}>
                <td className="border p-2 font-medium bg-muted">
                  {row || `Row ${rowIdx + 1}`}
                </td>
                {cols.map((_, colIdx) => (
                  <td key={colIdx} className="border p-2">
                    <input
                      type="checkbox"
                      className="h-5 w-5 accent-primary"
                      checked={answers[rowIdx]?.includes(colIdx) ?? false}
                      onChange={e => {
                        const updated = [...answers];
                        if (!Array.isArray(updated[rowIdx])) updated[rowIdx] = [];
                        if (e.target.checked) {
                          updated[rowIdx].push(colIdx);
                        } else {
                          updated[rowIdx] = updated[rowIdx].filter(val => val !== colIdx);
                        }
                        setAnswers(updated);
                      }}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default MatrixMatchConfigurator;