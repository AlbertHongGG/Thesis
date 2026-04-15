'use client';

import React from 'react';
import styles from './Input.module.css';

type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, ...props }, ref) => {
  return (
    <div className={styles.inputWrapper}>
      <input ref={ref} className={`${styles.input} ${className || ''}`} {...props} />
    </div>
  );
});

Input.displayName = 'Input';
