'use client';

import {
  useId,
  type ChangeEvent,
  type InputHTMLAttributes,
  type ReactNode,
} from 'react';

import { cn } from '@/lib/utils';

export type SearchableDatalistOption = {
  value: string;
  description?: string;
};

type SearchableDatalistInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'list' | 'onChange' | 'value'
> & {
  value: string;
  options: SearchableDatalistOption[];
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  helperText?: ReactNode;
  helperTextClassName?: string;
  listId?: string;
};

export function SearchableDatalistInput({
  autoComplete = 'off',
  className,
  helperText,
  helperTextClassName,
  id,
  listId,
  name,
  onChange,
  options,
  value,
  ...props
}: SearchableDatalistInputProps) {
  const generatedId = useId();
  const resolvedListId = listId ?? `${id ?? name ?? generatedId}-options`;
  const helperId = helperText ? `${id ?? name ?? generatedId}-help` : undefined;

  return (
    <>
      <input
        {...props}
        id={id}
        name={name}
        value={value}
        onChange={onChange}
        autoComplete={autoComplete}
        list={resolvedListId}
        aria-describedby={helperId}
        className={cn('public-flow-input', className)}
      />
      <datalist id={resolvedListId}>
        {options.map((option, index) => (
          <option
            key={`${option.value}-${option.description ?? ''}-${index}`}
            value={option.value}
          >
            {option.description ?? option.value}
          </option>
        ))}
      </datalist>
      {helperText ? (
        <p
          id={helperId}
          className={cn('public-flow-helper', helperTextClassName)}
        >
          {helperText}
        </p>
      ) : null}
    </>
  );
}
