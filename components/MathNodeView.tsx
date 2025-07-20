import React, { useEffect, useRef } from 'react';
import { NodeViewWrapper } from '@tiptap/react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

const MathNodeView = (props: any) => {
  const { node, editor } = props;
  const { latex, displayMode } = node.attrs;

  const html = katex.renderToString(latex || '', {
    throwOnError: false,
    displayMode: displayMode,
  });

  const handleClick = () => {
    editor.emit('editMath', {
      pos: props.getPos(),
      latex: latex,
    });
  };

  return (
    <NodeViewWrapper
      as="span"
      className="math-node"
      onClick={handleClick}
      style={{ cursor: 'pointer' }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};

export default MathNodeView;
