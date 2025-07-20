// global.d.ts

declare namespace JSX {
  interface IntrinsicElements {
    'math-field': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
  }
}

// Tiptap type augmentations
// declare module '@tiptap/core' {
//   interface Commands<ReturnType> {
//     math: {
//       setMath: (options: { latex: string; displayMode?: boolean }) => ReturnType;
//     };
//   }

//   interface EditorEvents {
//     editMath: (payload: { pos: number; latex: string }) => void;
//   }
// }
