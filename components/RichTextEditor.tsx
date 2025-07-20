'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import { memo, useState, useCallback, useEffect, useRef } from 'react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import Highlight from '@tiptap/extension-highlight';
import TextStyle from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Image from '@tiptap/extension-image';
import MathExtension from '@/extensions/MathExtension';

import { Toolbar } from './Toolbar';
import MathModal from './MathModal';
import { Spinner } from './ui/spinner';

// --- FIX: Correctly type the custom event listener ---
declare module '@tiptap/core' {
  interface EditorEvents {
    // Define 'editMath' as a function that receives the payload
    editMath: (payload: EditMathPayload) => void;
  }
}

interface RichTextEditorProps {
  initialContent?: string | null;
  onChange: (html: string) => void;
  editorKey?: string | number; // <-- ADD THIS PROP
}

interface EditMathPayload {
  pos: number;
  latex: string;
}

// --- Component Props and Payloads ---

// --- The Component ---
const RichTextEditor = ({ initialContent, onChange, editorKey }: RichTextEditorProps) => {
  const [isMathModalOpen, setIsMathModalOpen] = useState(false);
  // --- FIX: Add state to track the node being edited ---
  const [editingMath, setEditingMath] = useState<EditMathPayload | null>(null);

  // --- FIX: Create a stable ref for the onChange handler ---
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // --- CHANGE: Add key to force remount on reset ---
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Underline,
      Link.configure({ openOnClick: false, autolink: true }),
      Highlight,
      TextStyle,
      Color,
      TaskList,
      TaskItem.configure({ nested: true }),
      Image.configure({ allowBase64: true }),
      MathExtension,
    ],
    content: initialContent || '',
    editorProps: {
      attributes: {
        // --- FIX: Add the 'prose' classes back in ---
        // This will apply the typography plugin's styles.
        class: 'prose dark:prose-invert max-w-none min-h-[210px] w-full rounded-b-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
      },
    },
    onUpdate: ({ editor }) => {
      // Use the stable ref
      onChangeRef.current(editor.getHTML());
    },
    // FIX: Add these to prevent re-renders and SSR errors
    immediatelyRender: false,
  }, [editorKey]); // <-- ADD editorKey as dependency

  useEffect(() => {
    if (editor && initialContent && initialContent !== editor.getHTML()) {
      editor.commands.setContent(initialContent, false);
    }
  }, [initialContent, editor]);

  // --- FIX: Add the custom event listener to handle editing ---
  useEffect(() => {
    if (!editor) return;
    const handler = (payload: EditMathPayload) => {
      setEditingMath(payload); // Store position and latex of the clicked node
      setIsMathModalOpen(true); // Open the modal
    };
    editor.on('editMath', handler);
    return () => {
      editor.off('editMath', handler);
    };
  }, [editor]);

  const handleSetLink = useCallback(() => {
    if (!editor) return;
    const previousUrl = editor.getAttributes('link').href;
    const url = window.prompt('URL', previousUrl);

    if (url === null) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  }, [editor]);

  const handleAddImage = useCallback(() => {
    if (!editor) return;
    const url = window.prompt('Image URL');
    if (url) {
      editor.chain().focus().setImage({ src: url }).run();
    }
  }, [editor]);

  const handleOpenMathModal = useCallback(() => {
    // --- FIX: When opening for a NEW equation, clear any editing state ---
    setEditingMath(null);
    setIsMathModalOpen(true);
  }, []);

  const handleInsertMath = useCallback((latex: string, mode: 'inline' | 'block' = 'inline') => {
    if (!editor) return;
    const chain = editor.chain().focus();

    // --- FIX: Check if we are editing or inserting ---
    if (editingMath) {
      // We are in "edit mode", so update the node at its position
      chain.command(({ tr }) => {
        tr.setNodeMarkup(editingMath.pos, undefined, { latex, displayMode: mode === 'block' });
        return true;
      }).run();
    } else {
      // We are in "insert mode"
      chain.insertContent({ type: 'math', attrs: { latex, displayMode: mode === 'block' } }).run();
    }

    // --- FIX: Reset state and close modal ---
    setIsMathModalOpen(false);
    setEditingMath(null);
  }, [editor, editingMath]);

  const handleModalClose = useCallback(() => {
    setIsMathModalOpen(false);
    // --- FIX: Clear editing state on close ---
    setEditingMath(null);
    editor?.commands.focus();
  }, [editor]);

  if (!editor) {
    return (
      <div className="flex items-center justify-center min-h-[210px] p-4 border rounded-lg bg-muted">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="flex flex-col justify-stretch">
      {/* --- FIX: Pass all the required props to the Toolbar --- */}
      <Toolbar
        editor={editor}
        onSetLink={handleSetLink}
        onAddImage={handleAddImage}
        onOpenMathModal={handleOpenMathModal}
      />
      <EditorContent editor={editor} />
      <MathModal
        open={isMathModalOpen}
        onClose={handleModalClose}
        onInsert={handleInsertMath}
        // --- FIX: Pass the current latex to the modal when editing ---
        initialLatex={editingMath?.latex}
      />
    </div>
  );
};

export default memo(RichTextEditor);
