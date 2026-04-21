import * as React from 'react';
import { Toaster as Sonner } from 'sonner';

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      position="top-right"
      toastOptions={{
        classNames: {
          toast:
            'group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg',
          description: 'group-[.toast]:text-muted-foreground',
          actionButton: 'group-[.toast]:bg-primary group-[.toast]:text-primary-foreground',
          cancelButton: 'group-[.toast]:bg-muted group-[.toast]:text-muted-foreground',
          error:
            'group-[.toaster]:bg-destructive group-[.toaster]:text-destructive-foreground group-[.toaster]:border-destructive [&>div]:text-destructive-foreground [&_[data-title]]:text-destructive-foreground [&_[data-description]]:text-destructive-foreground/90',
          success:
            'group-[.toaster]:bg-success group-[.toaster]:text-white group-[.toaster]:border-success [&>div]:text-white',
          warning:
            'group-[.toaster]:bg-warning group-[.toaster]:text-white group-[.toaster]:border-warning [&>div]:text-white',
          info: 'group-[.toaster]:bg-info group-[.toaster]:text-white group-[.toaster]:border-info [&>div]:text-white',
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
