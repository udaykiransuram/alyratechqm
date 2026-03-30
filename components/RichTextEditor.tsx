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
import { useToast } from './ui/use-toast';

const MAX_IMAGE_UPLOAD_SIZE_BYTES = 5 * 1024 * 1024;
const MAX_IMAGE_UPLOAD_SIZE_LABEL = '5 MB';
const SUPPORTED_IMAGE_FORMATS_LABEL = 'PNG, JPG/JPEG, WEBP, GIF, AVIF, and SVG';
const ALLOWED_IMAGE_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'image/avif',
  'image/svg+xml',
]);

// --- FIX: Correctly type the custom event listener ---
declare module '@tiptap/core' {
  interface EditorEvents {
    // Define 'editMath' as a function that receives the payload
    editMath: (payload: any) => void;
  }
}

interface RichTextEditorProps {
  initialContent?: string | null;
  onChange: (html: string) => void;
  editorKey?: string | number;
  compact?: boolean;
}

interface EditMathPayload {
  pos: number;
  latex: string;
}

function normalizeImageFiles(fileList: FileList | File[] | null | undefined) {
  return Array.from(fileList || []).filter((file) =>
    String(file.type || '').toLowerCase().startsWith('image/'),
  );
}

function validateImageFile(file: File) {
  const mimeType = String(file.type || '').toLowerCase();

  if (!ALLOWED_IMAGE_MIME_TYPES.has(mimeType)) {
    throw new Error(
      `Unsupported image format. Upload ${SUPPORTED_IMAGE_FORMATS_LABEL} files only.`,
    );
  }

  if (file.size <= 0) {
    throw new Error(
      `The selected image is empty. Upload a ${SUPPORTED_IMAGE_FORMATS_LABEL} file up to ${MAX_IMAGE_UPLOAD_SIZE_LABEL}.`,
    );
  }

  if (file.size > MAX_IMAGE_UPLOAD_SIZE_BYTES) {
    throw new Error(
      `Image too large. Upload ${SUPPORTED_IMAGE_FORMATS_LABEL} files up to ${MAX_IMAGE_UPLOAD_SIZE_LABEL}.`,
    );
  }
}

function getClipboardImageFiles(dataTransfer: DataTransfer | null | undefined) {
  if (!dataTransfer) return [];

  const filesFromItems = Array.from(dataTransfer.items || [])
    .filter((item) => item.kind === 'file' && String(item.type || '').toLowerCase().startsWith('image/'))
    .map((item) => item.getAsFile())
    .filter((file): file is File => Boolean(file));

  if (filesFromItems.length > 0) {
    return filesFromItems;
  }

  return normalizeImageFiles(dataTransfer.files);
}

function getDroppedImageFiles(dataTransfer: DataTransfer | null | undefined) {
  if (!dataTransfer) return [];

  const filesFromItems = Array.from(dataTransfer.items || [])
    .filter((item) => item.kind === 'file' && String(item.type || '').toLowerCase().startsWith('image/'))
    .map((item) => item.getAsFile())
    .filter((file): file is File => Boolean(file));

  if (filesFromItems.length > 0) {
    return filesFromItems;
  }

  return normalizeImageFiles(dataTransfer.files);
}

function getImageAltText(fileName: string) {
  return String(fileName || '')
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/[-_]+/g, ' ')
    .trim();
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return 'Something went wrong while uploading the image.';
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      if (!result) {
        reject(new Error('The selected image could not be read.'));
        return;
      }

      resolve(result);
    };

    reader.onerror = () => {
      reject(new Error('The selected image could not be read.'));
    };

    reader.readAsDataURL(file);
  });
}

// --- Component Props and Payloads ---

// --- The Component ---
const RichTextEditor = ({ initialContent, onChange, editorKey, compact = false }: RichTextEditorProps) => {
  const [isMathModalOpen, setIsMathModalOpen] = useState(false);
  // --- FIX: Add state to track the node being edited ---
  const [editingMath, setEditingMath] = useState<EditMathPayload | null>(null);
  const [uploadingImageCount, setUploadingImageCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // --- FIX: Create a stable ref for the onChange handler ---
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // --- CHANGE: Add key to force remount on reset ---
  const editorMinHeightClass = compact ? 'min-h-[160px]' : 'min-h-[210px]';
  const editorRef = useRef<ReturnType<typeof useEditor>>(null);

  const uploadImageFile = useCallback(async (file: File) => {
    validateImageFile(file);

    const formData = new FormData();
    formData.append('file', file, file.name || 'question-image');

    const response = await fetch('/api/questions/images', {
      method: 'POST',
      credentials: 'same-origin',
      body: formData,
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok || !payload?.success || !payload?.url) {
      throw new Error(payload?.message || 'Failed to upload the image.');
    }

    return String(payload.url);
  }, []);

  const resolveImageSource = useCallback(async (file: File) => {
    validateImageFile(file);

    try {
      return {
        src: await uploadImageFile(file),
        storage: 'uploaded' as const,
      };
    } catch (uploadError) {
      try {
        return {
          src: await readFileAsDataUrl(file),
          storage: 'inline' as const,
          uploadError,
        };
      } catch {
        throw uploadError;
      }
    }
  }, [uploadImageFile]);

  const uploadImagesToEditor = useCallback(async (files: File[]) => {
    if (!files.length) return;

    const currentEditor = editorRef.current;
    if (!currentEditor) return;

    setUploadingImageCount((count) => count + files.length);

    const failures: string[] = [];
    let inlineFallbackCount = 0;

    try {
      for (const file of files) {
        try {
          const resolvedImage = await resolveImageSource(file);
          if (resolvedImage.storage === 'inline') {
            inlineFallbackCount += 1;
          }

          currentEditor
            .chain()
            .focus()
            .setImage({
              src: resolvedImage.src,
              alt: getImageAltText(file.name),
            })
            .run();
        } catch (error) {
          failures.push(getErrorMessage(error));
        }
      }
    } finally {
      setUploadingImageCount((count) => Math.max(0, count - files.length));
    }

    if (inlineFallbackCount > 0) {
      toast({
        title: inlineFallbackCount === 1 ? 'Image embedded inline' : 'Images embedded inline',
        description:
          inlineFallbackCount === 1
            ? 'The image was inserted directly because the upload service was unavailable.'
            : `${inlineFallbackCount} images were inserted directly because the upload service was unavailable.`,
      });
    }

    if (failures.length > 0) {
      toast({
        title: 'Image upload failed',
        description:
          failures.length === 1
            ? failures[0]
            : `${failures.length} image uploads failed. ${failures[0]}`,
        variant: 'destructive',
      });
    }
  }, [resolveImageSource, toast]);

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
      Image.configure({
        allowBase64: true,
        HTMLAttributes: {
          loading: 'lazy',
          decoding: 'async',
        },
      }),
      MathExtension,
    ],
    content: initialContent || '',
    editorProps: {
      attributes: {
        // --- FIX: Add the 'prose' classes back in ---
        // This will apply the typography plugin's styles.
        class: `prose dark:prose-invert max-w-none ${editorMinHeightClass} w-full rounded-b-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50`,
      },
      handlePaste: (_view, event) => {
        const imageFiles = getClipboardImageFiles(event.clipboardData);
        if (!imageFiles.length) {
          return false;
        }

        event.preventDefault();
        void uploadImagesToEditor(imageFiles);
        return true;
      },
      handleDrop: (_view, event) => {
        const imageFiles = getDroppedImageFiles(event.dataTransfer);
        if (!imageFiles.length) {
          return false;
        }

        event.preventDefault();
        void uploadImagesToEditor(imageFiles);
        return true;
      },
    },
    onUpdate: ({ editor }) => {
      // Use the stable ref
      onChangeRef.current(editor.getHTML());
    },
    // FIX: Add these to prevent re-renders and SSR errors
    immediatelyRender: false,
  }, [editorKey, editorMinHeightClass, uploadImagesToEditor]); // <-- ADD editorKey as dependency

  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

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
    // @ts-ignore
    editor.on('editMath', handler as any);
    return () => {
      // @ts-ignore
      editor.off('editMath', handler as any);
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
    const url = window.prompt('Paste an image URL.');
    if (url === null) return;

    if (url.trim()) {
      editor.chain().focus().setImage({ src: url.trim(), alt: '' }).run();
    }
  }, [editor]);

  const handleUploadImage = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

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

  const handleFileInputChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = normalizeImageFiles(event.target.files);
    event.target.value = '';

    if (!files.length) {
      return;
    }

    void uploadImagesToEditor(files);
  }, [uploadImagesToEditor]);

  if (!editor) {
    return (
      <div className={`flex items-center justify-center rounded-lg border bg-muted p-4 ${compact ? 'min-h-[160px]' : 'min-h-[210px]'}`}>
        <Spinner />
      </div>
    );
  }

  return (
    <div className="flex flex-col justify-stretch">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif,image/avif,image/svg+xml"
        className="sr-only"
        onChange={handleFileInputChange}
      />
      {/* --- FIX: Pass all the required props to the Toolbar --- */}
      <Toolbar
        editor={editor}
        onSetLink={handleSetLink}
        onAddImage={handleAddImage}
        onUploadImage={handleUploadImage}
        onOpenMathModal={handleOpenMathModal}
      />
      {!compact || uploadingImageCount > 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">
          {uploadingImageCount > 0
            ? `Uploading ${uploadingImageCount} image${uploadingImageCount === 1 ? '' : 's'}...`
            : 'Paste or drag screenshots directly, use the upload button for your device, or insert an image URL.'}
        </p>
      ) : null}
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
