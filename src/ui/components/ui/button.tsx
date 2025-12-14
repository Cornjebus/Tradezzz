import React from 'react';

export const Button = ({
  children,
  onClick,
  variant = 'default',
  className = '',
  disabled = false
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'default' | 'secondary' | 'success' | 'danger';
  className?: string;
  disabled?: boolean;
}) => {
  const variants = {
    default: 'bg-cyan text-black hover:bg-cyan/80',
    secondary: 'bg-muted hover:bg-muted/80',
    success: 'bg-green-600 text-white hover:bg-green-700',
    danger: 'bg-red-600 text-white hover:bg-red-700'
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`px-4 py-2 rounded-lg font-semibold transition-colors ${variants[variant]} ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
    >
      {children}
    </button>
  );
};
