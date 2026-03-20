import * as React from 'react';
import { cn } from '@/lib/utils'; // Make sure this path is correct

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          'flex min-h-[96px] w-full rounded-xl border border-input bg-background/95 px-3.5 py-2.5 text-sm leading-6 text-foreground shadow-sm ring-offset-background transition-[border-color,box-shadow,background-color] duration-200 placeholder:text-muted-foreground/90 hover:border-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Textarea.displayName = 'Textarea';

export { Textarea };
