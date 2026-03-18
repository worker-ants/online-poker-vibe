'use client';

import type { ReactNode } from 'react';
import { SocketProvider } from '@/src/providers/SocketProvider';
import { IdentityProvider } from '@/src/providers/IdentityProvider';
import { ToastProvider } from '@/src/providers/ToastProvider';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SocketProvider>
      <IdentityProvider>
        <ToastProvider>{children}</ToastProvider>
      </IdentityProvider>
    </SocketProvider>
  );
}
