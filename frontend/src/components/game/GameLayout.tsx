'use client';

import type { ReactNode } from 'react';

interface GameLayoutProps {
  topNav: ReactNode;
  table: ReactNode;
  sidebar: ReactNode;
}

export default function GameLayout({ topNav, table, sidebar }: GameLayoutProps) {
  return (
    <div className="flex h-screen flex-col bg-gray-950">
      {topNav}
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-auto p-4">
          {table}
        </div>
        <div className="w-80 flex-shrink-0 overflow-auto border-l border-gray-700 bg-gray-900 p-4">
          {sidebar}
        </div>
      </div>
    </div>
  );
}
