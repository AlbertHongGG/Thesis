'use client';

import React from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';
import styles from './Card.module.css';

export const Card = ({ children, className = '', ...props }: HTMLMotionProps<'div'>) => {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className={`${styles.card} ${className}`}
      {...props}
    >
      {children}
    </motion.div>
  );
};

export const CardHeader = ({ children, className = '' }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={`${styles.header} ${className}`}>
    {children}
  </div>
);

export const CardTitle = ({ children, className = '' }: React.HTMLAttributes<HTMLHeadingElement>) => (
  <h3 className={`${styles.title} ${className}`}>{children}</h3>
);

export const CardDescription = ({ children, className = '' }: React.HTMLAttributes<HTMLParagraphElement>) => (
  <p className={`${styles.description} ${className}`}>{children}</p>
);

export const CardContent = ({ children, className = '' }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={`${styles.content} ${className}`}>{children}</div>
);

export const CardFooter = ({ children, className = '' }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={`${styles.footer} ${className}`}>{children}</div>
);
