/// <reference types="@tiptap/core" />
import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import MathNodeView from '@/components/MathNodeView';

export default Node.create({
  name: 'math',
  group: 'inline',
  inline: true,
  atom: true,

  addAttributes() {
    return {
      // --- FIX: Tell Tiptap to render this attribute as 'data-latex' in HTML ---
      latex: {
        default: '',
        // This maps the 'latex' node attribute to the 'data-latex' HTML attribute
        renderHTML: attributes => ({
          'data-latex': attributes.latex,
        }),
      },
      // --- FIX: Do the same for displayMode for consistency ---
      displayMode: {
        default: false,
        renderHTML: attributes => ({
          'data-display-mode': attributes.displayMode,
        }),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-type="math"]',
        // This maps the 'data-latex' HTML attribute back to the 'latex' node attribute
        getAttrs: element => ({
          latex: (element as HTMLElement).getAttribute('data-latex'),
          displayMode: (element as HTMLElement).getAttribute('data-display-mode') === 'true',
        }),
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    // Now Tiptap correctly handles the attribute mapping, so we just merge them.
    return ['span', mergeAttributes({ 'data-type': 'math' }, HTMLAttributes)];
  },

  addNodeView() {
    return ReactNodeViewRenderer(MathNodeView);
  },
});
