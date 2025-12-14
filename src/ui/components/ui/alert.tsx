import React from 'react';

export const Alert = ({
  children,
  className = ''
}: {
  children: React.ReactNode;
  className?: string;
}) => (
  <div className={`rounded-lg border p-4 ${className}`}>
    {children}
  </div>
);

export const AlertDescription = ({
  children,
  className = ''
}: {
  children: React.ReactNode;
  className?: string;
}) => (
  <div className={`text-sm ${className}`}>
    {children}
  </div>
);
