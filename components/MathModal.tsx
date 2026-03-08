'use client';

declare global {
  interface Window {
    __mathlive_registered__?: boolean;
  }
}

import { type CSSProperties, useEffect, useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import katex from 'katex';

type Props = {
  open: boolean;
  onClose: () => void;
  onInsert: (latex: string, mode?: 'inline' | 'block') => void;
  initialLatex?: string;
};

const RECENT_KEY = 'recent_math_expressions';

const mathFieldStyle: CSSProperties = {
  width: '100%',
  minHeight: '72px',
  fontSize: '1.1rem',
  background: 'transparent',
  outline: 'none',
};

export default function MathModal({ open, onClose, onInsert, initialLatex }: Props) {
  const mathRef = useRef<any>(null);
  const [mode, setMode] = useState<'inline' | 'block'>('inline');
  const [latex, setLatex] = useState('');
  const [previewHtml, setPreviewHtml] = useState('');
  const [error, setError] = useState('');
  const [recent, setRecent] = useState<string[]>([]);

  useEffect(() => {
    const loadMathLive = async () => {
      if (typeof window !== 'undefined' && !window.__mathlive_registered__) {
        const { MathfieldElement } = await import('mathlive');
        MathfieldElement.soundsDirectory = '/sounds/';

        if (!customElements.get('math-field')) {
          customElements.define('math-field', MathfieldElement);
        }
        window.__mathlive_registered__ = true;
      }
    };

    loadMathLive();
  }, []);

  useEffect(() => {
    if (!open) return;

    const initialValue = initialLatex || '';
    setLatex(initialValue);
    setError('');
    setPreviewHtml('');
    loadRecent();

    if (mathRef.current) {
      mathRef.current.setValue(initialValue);
      setTimeout(() => {
        handleInput();
        mathRef.current?.focus();
      }, 100);
    }
  }, [open, initialLatex]);

  useEffect(() => {
    const field = mathRef.current;
    if (!field) return;

    const stopKey = (event: KeyboardEvent) => event.stopPropagation();
    field.addEventListener('keydown', stopKey);
    field.addEventListener('keyup', stopKey);

    return () => {
      field.removeEventListener('keydown', stopKey);
      field.removeEventListener('keyup', stopKey);
    };
  }, [mathRef.current]);

  useEffect(() => {
    if (open && mathRef.current) {
      handleInput();
    }
  }, [mode, open]);

  const loadRecent = () => {
    const data = localStorage.getItem(RECENT_KEY);
    if (!data) {
      setRecent([]);
      return;
    }

    try {
      setRecent(JSON.parse(data));
    } catch {
      setRecent([]);
    }
  };

  const saveToRecent = (expression: string) => {
    const updated = [expression, ...recent.filter((item) => item !== expression)].slice(0, 5);
    setRecent(updated);
    localStorage.setItem(RECENT_KEY, JSON.stringify(updated));
  };

  const handleInput = () => {
    const current = mathRef.current?.value || '';
    setLatex(current);

    if (!current) {
      setPreviewHtml('');
      setError('');
      return;
    }

    try {
      const html = katex.renderToString(current, {
        displayMode: mode === 'block',
        throwOnError: true,
      });
      setPreviewHtml(html);
      setError('');
    } catch (err: any) {
      setPreviewHtml('');
      setError(err.message);
    }
  };

  const handleInsert = () => {
    if (!latex || error) return;
    saveToRecent(latex);
    onInsert(latex, mode);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent
        className="sm:max-w-2xl"
        aria-describedby="math-dialog-description"
        onPointerDownOutside={(event) => {
          const target = event.target as HTMLElement;
          if (target.closest('.ML__keyboard')) {
            event.preventDefault();
          }
        }}
      >
        <DialogHeader className="text-left">
          <DialogTitle>Insert Math</DialogTitle>
          <DialogDescription id="math-dialog-description">
            Enter or edit a LaTeX expression, preview it instantly, and insert it in inline or block mode.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="app-section space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Math Mode</p>
                <p className="text-sm text-muted-foreground">Choose how the expression should render in the editor.</p>
              </div>
              <ToggleGroup
                type="single"
                value={mode}
                onValueChange={(value) => {
                  if (value === 'inline' || value === 'block') {
                    setMode(value);
                  }
                }}
              >
                <ToggleGroupItem value="inline">Inline</ToggleGroupItem>
                <ToggleGroupItem value="block">Block</ToggleGroupItem>
              </ToggleGroup>
            </div>

            <div className="space-y-2">
              <label className="app-field-label">Expression</label>
              <div className="rounded-xl border border-border/60 bg-background px-3 py-3 shadow-sm">
                <math-field ref={mathRef} onInput={handleInput} style={mathFieldStyle} />
              </div>
            </div>
          </div>

          <div className="app-section space-y-3">
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">Preview</p>
              <p className="text-sm text-muted-foreground">Verify the rendered output before inserting it.</p>
            </div>
            <div
              className="min-h-[72px] rounded-xl border border-border/60 bg-background px-4 py-3 text-foreground"
              dangerouslySetInnerHTML={{
                __html: previewHtml || '<span class="text-sm text-muted-foreground">Start typing to preview the expression.</span>',
              }}
            />
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>

          {recent.length > 0 ? (
            <div className="app-section space-y-3">
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">Recent</p>
                <p className="text-sm text-muted-foreground">Reuse one of your recently inserted expressions.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {recent.map((item) => (
                  <Button
                    key={item}
                    variant="outline"
                    size="sm"
                    className="max-w-full font-mono text-xs"
                    onClick={() => {
                      if (mathRef.current) {
                        mathRef.current.setValue(item);
                        setLatex(item);
                        handleInput();
                      }
                    }}
                  >
                    {item}
                  </Button>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <DialogFooter className="gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!latex || !!error} onClick={handleInsert}>
            Insert
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
