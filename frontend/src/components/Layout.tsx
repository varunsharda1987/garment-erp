import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Header from './Header';
import Sidebar from './Sidebar';
import CommandPalette from './CommandPalette';
import { recordPage } from '@/lib/session-trail';

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const { pathname } = useLocation();

  // Session trail: which pages the user visited (read by the AI assistant and issue reports)
  useEffect(() => {
    recordPage(pathname);
  }, [pathname]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <Header sidebarOpen={sidebarOpen} toggleSidebar={() => setSidebarOpen(!sidebarOpen)} />

      {/* Global Command Palette (Ctrl+K) */}
      <CommandPalette />

      <div className="flex pt-16">
        {/* Sidebar */}
        <Sidebar isOpen={sidebarOpen} />

        {/* Main Content */}
        <main className={`flex-1 transition-all duration-300 ${sidebarOpen ? 'ml-64' : 'ml-0'}`}>
          <div className="p-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
