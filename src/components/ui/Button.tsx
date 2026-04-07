'use client';

import React from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import styles from './Button.module.css';

interface ButtonProps extends Omit<HTMLMotionProps<'button'>, 'ref'> {
  variant?: 'primary' | 'secondary' | 'ghost';
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ 
  children, 
  variant = 'primary', 
  isLoading, 
  className = '', 
  disabled, 
  ...props 
}, ref) => {
  return (
    <motion.button 
      ref={ref as any}
      whileTap={!disabled && !isLoading ? { scale: 0.96 } : {}}
      className={`${styles.button} ${styles[variant]} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading && <Loader2 className={styles.loader} size={16} />}
      {children}
    </motion.button>
  );
});

Button.displayName = 'Button';
