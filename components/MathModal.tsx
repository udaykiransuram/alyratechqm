'use client';

declare global {
  interface Window {
    __mathlive_registered__?: boolean;
  }
}

import { type CSSProperties, useCallback, useEffect, useRef, useState } from 'react';
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
  const [isMathLiveReady, setIsMathLiveReady] = useState(false);
  const [mathLiveLoadError, setMathLiveLoadError] = useState('');

  const updatePreview = useCallback((nextLatex: string) => {
    setLatex(nextLatex);

    if (!nextLatex) {
      setPreviewHtml('');
      setError('');
      return;
    }

    try {
      const html = katex.renderToString(nextLatex, {
        displayMode: mode === 'block',
        throwOnError: true,
      });
      setPreviewHtml(html);
      setError('');
    } catch (err: any) {
      setPreviewHtml('');
      setError(err?.message || 'Invalid LaTeX expression.');
    }
  }, [mode]);

  const loadMathLive = useCallback(async () => {
    if (typeof window === 'undefined') return false;

    if (window.__mathlive_registered__) {
      setIsMathLiveReady(true);
      setMathLiveLoadError('');
      return true;
    }

    try {
      const { MathfieldElement } = await import('mathlive');
      MathfieldElement.soundsDirectory = '/sounds/';

      if (!customElements.get('math-field')) {
        customElements.define('math-field', MathfieldElement);
      }

      window.__mathlive_registered__ = true;
      setIsMathLiveReady(true);
      setMathLiveLoadError('');
      return true;
    } catch (err) {
      console.error('[MathModal] Failed to load mathlive.', err);
      setIsMathLiveReady(false);
      setMathLiveLoadError(
        'The visual math keyboard could not be loaded. You can still type LaTeX manually.',
      );
      return false;
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    void loadMathLive();
  }, [loadMathLive, open]);

  useEffect(() => {
    if (!open) return;

    const initialValue = initialLatex || '';
    setError('');
    setPreviewHtml('');
    loadRecent();

    if (isMathLiveReady && mathRef.current?.setValue) {
      mathRef.current.setValue(initialValue);
      setTimeout(() => {
        updatePreview(mathRef.current?.value || initialValue);
        mathRef.current?.focus?.();
      }, 100);
      return;
    }

    updatePreview(initialValue);
  }, [initialLatex, isMathLiveReady, open, updatePreview]);

  useEffect(() => {
    if (!isMathLiveReady) return;

    const field = mathRef.current;
    if (!field?.addEventListener) return;

    const stopKey = (event: KeyboardEvent) => event.stopPropagation();
    field.addEventListener('keydown', stopKey);
    field.addEventListener('keyup', stopKey);

    return () => {
      field.removeEventListener('keydown', stopKey);
      field.removeEventListener('keyup', stopKey);
    };
  }, [isMathLiveReady]);

  useEffect(() => {
    if (!open) return;

    if (isMathLiveReady && mathRef.current) {
      updatePreview(mathRef.current?.value || latex);
      return;
    }

    updatePreview(latex);
  }, [isMathLiveReady, latex, mode, open, updatePreview]);

  const loadRecent = () => {
    try {
      const data = localStorage.getItem(RECENT_KEY);
      if (!data) {
        setRecent([]);
        return;
      }
      setRecent(JSON.parse(data));
    } catch {
      setRecent([]);
    }
  };

  const saveToRecent = (expression: string) => {
    const updated = [expression, ...recent.filter((item) => item !== expression)].slice(0, 5);
    setRecent(updated);
    try {
      localStorage.setItem(RECENT_KEY, JSON.stringify(updated));
    } catch {
    }
  };

  const handleFieldInput = useCallback(() => {
    updatePreview(mathRef.current?.value || '');
  }, [updatePreview]);

  const handleTextareaChange = useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      updatePreview(event.target.value);
    },
    [updatePreview],
  );

  const handleInsert = () => {
    if (!latex || error) return;
    saveToRecent(latex);
    onInsert(latex, mode);
    onClose();
  };

  const handleRecentClick = (expression: string) => {
    if (isMathLiveReady && mathRef.current?.setValue) {
      mathRef.current.setValue(expression);
      updatePreview(expression);
      return;
    }

    updatePreview(expression);
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent
        className="z-[80] flex h-[100dvh] w-screen max-w-none flex-col overflow-hidden p-0 sm:h-auto sm:max-h-[min(88vh,760px)] sm:w-[min(92vw,960px)] sm:max-w-[960px]"
        aria-describedby="math-dialog-description"
        onPointerDownOutside={(event) => {
          const target = event.target as HTMLElement;
          if (target.closest('.ML__keyboard')) {
            event.preventDefault();
          }
        }}
      >
        <DialogHeader className="border-b border-border/60 bg-muted/20 px-4 py-3.5 pr-12 text-left sm:px-5 sm:pr-14">
          <DialogTitle className="text-lg sm:text-xl">Insert Math</DialogTitle>
          <DialogDescription id="math-dialog-description">
            Enter or edit a LaTeX expression, preview it instantly, and insert it in inline or block mode.
          </DialogDescription>
        </DialogHeader>

        <div className="grid min-h-0 flex-1 gap-3 overflow-y-auto bg-muted/20 p-3 sm:p-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
          <div className="app-surface overflow-hidden shadow-none">
            <div className="app-section-header py-3.5">
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
            </div>
            <div className="app-section-body space-y-2.5">
              <label className="app-field-label">Expression</label>
              <div className="rounded-xl border border-border/60 bg-background px-3 py-3 shadow-sm">
                {isMathLiveReady ? (
                  <math-field ref={mathRef} onInput={handleFieldInput} style={mathFieldStyle} />
                ) : (
                  <textarea
                    rows={4}
                    className="app-form-textarea min-h-[96px] border-0 bg-transparent px-0 py-0 shadow-none focus-visible:ring-0"
                    value={latex}
                    onChange={handleTextareaChange}
                    placeholder="e.g. \frac{a}{b}"
                  />
                )}
              </div>
              {mathLiveLoadError ? (
                <p className="text-sm text-muted-foreground">{mathLiveLoadError}</p>
              ) : null}
            </div>
          </div>

          <div className="space-y-3">
            <div className="app-surface overflow-hidden shadow-none">
              <div className="app-section-header py-3.5">
                <p className="text-sm font-medium text-foreground">Preview</p>
                <p className="text-sm text-muted-foreground">Verify the rendered output before inserting it.</p>
              </div>
              <div className="app-section-body space-y-2.5">
                <div
                  className="min-h-[104px] rounded-xl border border-border/60 bg-background px-4 py-3 text-foreground"
                  dangerouslySetInnerHTML={{
                    __html: previewHtml || '<span class="text-sm text-muted-foreground">Start typing to preview the expression.</span>',
                  }}
                />
                {error ? <p className="text-sm text-destructive">{error}</p> : null}
              </div>
            </div>

            {recent.length > 0 ? (
              <div className="app-surface overflow-hidden shadow-none">
                <div className="app-section-header py-3.5">
                  <p className="text-sm font-medium text-foreground">Recent</p>
                  <p className="text-sm text-muted-foreground">Reuse one of your recently inserted expressions.</p>
                </div>
                <div className="app-section-body">
                  <div className="flex flex-wrap gap-2">
                    {recent.map((item) => (
                      <Button
                        key={item}
                        variant="outline"
                        size="sm"
                        className="app-button-compact max-w-full truncate font-mono text-xs"
                        onClick={() => handleRecentClick(item)}
                      >
                        {item}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <DialogFooter className="border-t border-border/60 bg-muted/10 px-4 py-3 sm:px-5">
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
