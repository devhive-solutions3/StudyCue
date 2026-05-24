'use client';

import * as React from 'react';

type PasswordFieldProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  inputClassName: string;
  wrapperClassName?: string;
};

export default function PasswordField({
  inputClassName,
  wrapperClassName,
  ...props
}: PasswordFieldProps) {
  const [visible, setVisible] = React.useState(false);

  return (
    <div className={wrapperClassName ?? 'relative'}>
      <input
        {...props}
        type={visible ? 'text' : 'password'}
        className={inputClassName}
      />
      <button
        type="button"
        onClick={() => setVisible((current) => !current)}
        className="absolute inset-y-0 right-3 inline-flex items-center text-xs font-medium text-text-muted transition hover:text-text-primary"
        aria-label={visible ? 'Hide password' : 'Show password'}
        aria-pressed={visible}
      >
        {visible ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M3 3L21 21M10.58 10.58A2 2 0 0 0 13.42 13.42M9.88 5.09A9.77 9.77 0 0 1 12 4.8C17.4 4.8 21.27 9.11 22.5 12C21.95 13.29 21 14.74 19.66 16.02M14.12 18.91A9.77 9.77 0 0 1 12 19.2C6.6 19.2 2.73 14.89 1.5 12C2.17 10.43 3.39 8.61 5.15 7.15"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M1.5 12C2.73 9.11 6.6 4.8 12 4.8C17.4 4.8 21.27 9.11 22.5 12C21.27 14.89 17.4 19.2 12 19.2C6.6 19.2 2.73 14.89 1.5 12Z"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="12" cy="12" r="3.2" stroke="currentColor" strokeWidth="1.8" />
          </svg>
        )}
      </button>
    </div>
  );
}
