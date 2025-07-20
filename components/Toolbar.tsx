'use client';

import type { Editor } from '@tiptap/core';
import {
  Bold, Italic, Underline, Strikethrough, List, ListOrdered,
  Heading1, Heading2, Link as LinkIcon, Quote, Minus, Image as ImageIcon,
  Undo, Redo, Sigma
} from 'lucide-react';
import { Toggle } from '@/components/ui/toggle';

type Props = {
  editor: Editor | null;
  onSetLink: () => void;
  onAddImage: () => void;
  onOpenMathModal: () => void;
};

export function Toolbar({ editor, onSetLink, onAddImage, onOpenMathModal }: Props) {
  if (!editor) {
    return null;
  }

  return (
    <div className="border border-input bg-transparent rounded-t-md p-1 flex items-center flex-wrap gap-1">
      <Toggle
        size="sm"
        aria-label="Bold"
        pressed={editor.isActive('bold')}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <Bold className="h-4 w-4" />
      </Toggle>
      <Toggle
        size="sm"
        aria-label="Italic"
        pressed={editor.isActive('italic')}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <Italic className="h-4 w-4" />
      </Toggle>
      <Toggle
        size="sm"
        aria-label="Underline"
        pressed={editor.isActive('underline')}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      >
        <Underline className="h-4 w-4" />
      </Toggle>
      <Toggle
        size="sm"
        aria-label="Strikethrough"
        pressed={editor.isActive('strike')}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      >
        <Strikethrough className="h-4 w-4" />
      </Toggle>
      <Toggle
        size="sm"
        aria-label="Heading 1"
        pressed={editor.isActive('heading', { level: 1 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
      >
        <Heading1 className="h-4 w-4" />
      </Toggle>
      <Toggle
        size="sm"
        aria-label="Heading 2"
        pressed={editor.isActive('heading', { level: 2 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      >
        <Heading2 className="h-4 w-4" />
      </Toggle>
      <Toggle
        size="sm"
        aria-label="Bullet List"
        pressed={editor.isActive('bulletList')}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <List className="h-4 w-4" />
      </Toggle>
      <Toggle
        size="sm"
        aria-label="Ordered List"
        pressed={editor.isActive('orderedList')}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <ListOrdered className="h-4 w-4" />
      </Toggle>
      <Toggle
        size="sm"
        aria-label="Blockquote"
        pressed={editor.isActive('blockquote')}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      >
        <Quote className="h-4 w-4" />
      </Toggle>
      <Toggle
        size="sm"
        aria-label="Link"
        pressed={editor.isActive('link')}
        onClick={onSetLink}
      >
        <LinkIcon className="h-4 w-4" />
      </Toggle>
      <Toggle
        size="sm"
        aria-label="Image"
        onClick={onAddImage}
      >
        <ImageIcon className="h-4 w-4" />
      </Toggle>
      <Toggle
        size="sm"
        aria-label="Math"
        pressed={editor.isActive('math')}
        onClick={onOpenMathModal}
      >
        <Sigma className="h-4 w-4" />
      </Toggle>
      <Toggle
        size="sm"
        aria-label="Horizontal Rule"
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
      >
        <Minus className="h-4 w-4" />
      </Toggle>
      <Toggle
        size="sm"
        aria-label="Undo"
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().undo()}
      >
        <Undo className="h-4 w-4" />
      </Toggle>
      <Toggle
        size="sm"
        aria-label="Redo"
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().redo()}
      >
        <Redo className="h-4 w-4" />
      </Toggle>
    </div>
  );
}