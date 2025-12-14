import React from 'react';

export const Badge = ({
  children,
  variant = 'default',
  className = ''
}: {
  children: React.ReactNode;
  variant?: 'default' | 'secondary';
  className?: string;
}) => {
  const variants = {
    default: 'bg-cyan text-black',
    secondary: 'bg-muted-foreground text-black'
  };

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${variants[variant]} ${className}`}>
      {children}
    </span>
  );
};
