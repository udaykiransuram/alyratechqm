'use client';

declare global {
  interface Window {
    __mathlive_registered__?: boolean;
  }
}

import { useEffect, useRef, useState } from 'react';
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
  initialLatex?: string; // Prop to pre-fill the math field for editing
};

const RECENT_KEY = 'recent_math_expressions';

export default function MathModal({ open, onClose, onInsert, initialLatex }: Props) {
  const mathRef = useRef<any>(null);
  const [mode, setMode] = useState<'inline' | 'block'>('inline');
  const [latex, setLatex] = useState('');
  const [previewHtml, setPreviewHtml] = useState('');
  const [error, setError] = useState('');
  const [recent, setRecent] = useState<string[]>([]);

  // Dynamically register <math-field> and configure sounds directory
  useEffect(() => {
    const loadMathLive = async () => {
      if (typeof window !== 'undefined' && !window.__mathlive_registered__) {
        const { MathfieldElement } = await import('mathlive');

        // Set soundsDirectory on the MathfieldElement class itself
        MathfieldElement.soundsDirectory = '/sounds/'; // Point to your public/sounds folder
        // Optionally, you can explicitly disable sounds if desired:
        // MathfieldElement.keypressSound = 'none';
        // MathfieldElement.plonkSound = 'none';

        if (!customElements.get('math-field')) {
          customElements.define('math-field', MathfieldElement);
        }
        window.__mathlive_registered__ = true;
        console.log('MathfieldElement defined and soundsDirectory set.');
      }
    };
    loadMathLive();
  }, []);

  // Reset state when modal opens and focus math field
  useEffect(() => {
    if (open) {
      // Set initial LaTeX if provided, otherwise clear
      const initialValue = initialLatex || '';
      setLatex(initialValue);
      setError('');
      setPreviewHtml('');
      loadRecent();

      // Set value on math-field and trigger input handler
      if (mathRef.current) {
        mathRef.current.setValue(initialValue);
        // Manually trigger handleInput to update preview if initialValue is set
        // A small timeout ensures MathLive has initialized the value before focusing
        setTimeout(() => {
          handleInput(); // Call handleInput to generate preview
          mathRef.current?.focus(); // Focus after setting value
        }, 100);
      }
    }
  }, [open, initialLatex]); // Depend on initialLatex to re-initialize when editing different math

  // Prevent modal from closing on virtual keyboard input
  // The global 'pointerdown' listener was removed as onPointerDownOutside is more suitable
  useEffect(() => {
    const el = mathRef.current;
    if (!el) return;

    const stopKey = (e: KeyboardEvent) => e.stopPropagation();

    el.addEventListener('keydown', stopKey);
    el.addEventListener('keyup', stopKey);

    return () => {
      el.removeEventListener('keydown', stopKey);
      el.removeEventListener('keyup', stopKey);
    };
  }, [mathRef.current]);

  const loadRecent = () => {
    const data = localStorage.getItem(RECENT_KEY);
    if (data) {
      setRecent(JSON.parse(data));
    }
  };

  const saveToRecent = (expression: string) => {
    const updated = [expression, ...recent.filter((e) => e !== expression)].slice(0, 5);
    setRecent(updated);
    localStorage.setItem(RECENT_KEY, JSON.stringify(updated));
  };

  const handleInput = () => {
    const current = mathRef.current?.value || '';
    setLatex(current);
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
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent
        aria-describedby="math-dialog-description"
        // This prop prevents the dialog from closing when clicking on the MathLive virtual keyboard
        onPointerDownOutside={(e) => {
          const target = e.target as HTMLElement;
          // Check if the clicked element (or any of its parents) is part of the MathLive virtual keyboard
          if (target.closest('.ML__keyboard')) {
            e.preventDefault(); // Prevent the default behavior (closing the dialog)
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>Insert Math</DialogTitle>
        </DialogHeader>

        {/* ADD DialogDescription here, as a direct child of DialogContent */}
        <DialogDescription id="math-dialog-description" className="sr-only">
          Enter a LaTeX math expression to insert or edit in the editor.
        </DialogDescription>

        {/* Mode toggle */}
        <div className="flex items-center justify-between gap-2">
          <label className="text-sm font-medium">Math Mode:</label>
          <ToggleGroup
            type="single"
            value={mode}
            onValueChange={(val) => setMode(val as 'inline' | 'block')}
          >
            <ToggleGroupItem value="inline">Inline</ToggleGroupItem>
            <ToggleGroupItem value="block">Block</ToggleGroupItem>
          </ToggleGroup>
        </div>

        {/* Math input */}
        <math-field
          ref={mathRef}
          onInput={handleInput}
          style={{
            width: '100%',
            minHeight: '64px',
            fontSize: '1.2rem',
            border: '1px solid #ccc',
            borderRadius: '8px',
            padding: '8px',
          }}
        />

        {/* Live preview */}
        <div className="mt-2">
          <label className="text-sm font-medium">Preview:</label>
          <div
            className="p-2 border rounded min-h-[40px] mt-1 bg-gray-50"
            dangerouslySetInnerHTML={{ __html: previewHtml }}
          />
          {error && <p className="text-sm text-red-600 mt-1">{error}</p>}
        </div>

        {/* Recent */}
        {recent.length > 0 && (
          <div className="mt-3">
            <label className="text-sm font-medium">Recent:</label>
            <div className="flex flex-wrap gap-2 mt-1">
              {recent.map((item) => (
                <Button
                  key={item}
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (mathRef.current) {
                      mathRef.current.setValue(item);
                      setLatex(item);
                      handleInput(); // Trigger input handler for preview
                    }
                  }}
                >
                  {item}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <DialogFooter className="mt-4">
          <Button variant="secondary" onClick={onClose}>
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
