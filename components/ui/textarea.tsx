import * as React from 'react';
import { cn } from '@/lib/utils'; // Make sure this path is correct

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          'flex min-h-[112px] w-full rounded-[var(--app-radius-md)] border border-input bg-background/98 px-3.5 py-2.5 text-sm leading-6 text-foreground shadow-[0_10px_24px_-24px_hsl(var(--app-shadow-deep)/0.18)] ring-offset-background transition-[border-color,box-shadow,background-color] duration-200 placeholder:text-muted-foreground/90 hover:border-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:shadow-[0_0_0_4px_hsl(var(--ring)/0.14),0_14px_30px_-24px_hsl(var(--app-shadow-deep)/0.26)] disabled:cursor-not-allowed disabled:opacity-50',
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
