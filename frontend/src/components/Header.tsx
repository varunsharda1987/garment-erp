import { useNavigate } from 'react-router-dom';
import { Menu, X, User, LogOut, Settings, Search } from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import Breadcrumb from './Breadcrumb';
import { useUIPreferences } from '@/stores/ui-preferences.store';

interface HeaderProps {
  sidebarOpen: boolean;
  toggleSidebar: () => void;
}

export default function Header({ sidebarOpen, toggleSidebar }: HeaderProps) {
  const navigate = useNavigate();
  const { user, clearAuth } = useAuthStore();
  const { setCommandPaletteOpen } = useUIPreferences();

  const handleLogout = () => {
    clearAuth();
    navigate('/login');
  };

  return (
    <header className="fixed top-0 left-0 right-0 h-16 bg-card border-b shadow-sm z-50">
      <div className="h-full px-4 flex items-center justify-between">
        {/* Left Section: Logo + Sidebar Toggle + Breadcrumb */}
        <div className="flex items-center gap-4 flex-1">
          {/* Sidebar Toggle */}
          <Button variant="ghost" size="sm" onClick={toggleSidebar} className="lg:inline-flex">
            {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>

          {/* Logo */}
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/dashboard')}>
            <div className="text-2xl">🏭</div>
            <div>
              <h1 className="text-lg font-display font-medium text-foreground leading-tight">Kashaya Fabs ERP</h1>
            </div>
          </div>

          {/* Breadcrumb */}
          <div className="hidden md:block ml-4">
            <Breadcrumb />
          </div>
        </div>

        {/* Right Section: Search + User Menu */}
        <div className="flex items-center gap-3">
          {/* Search Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCommandPaletteOpen(true)}
            className="hidden md:flex items-center gap-2 text-muted-foreground h-8 px-3"
          >
            <Search className="h-3.5 w-3.5" />
            <span className="text-xs">Search...</span>
            <kbd className="ml-1 text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded font-mono">
              Ctrl+K
            </kbd>
          </Button>

          {/* User Info */}
          <div className="hidden sm:block text-right">
            <div className="text-sm font-medium text-foreground">{user?.name}</div>
            <div className="text-xs text-muted-foreground">{user?.role}</div>
          </div>

          {/* User Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="relative h-9 w-9 rounded-full">
                <User className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">{user?.name}</p>
                  <p className="text-xs leading-none text-muted-foreground">{user?.email}</p>
                  <p className="text-xs leading-none text-muted-foreground mt-1">Role: {user?.role}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate('/profile')}>
                <User className="mr-2 h-4 w-4" />
                <span>Profile</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate('/settings')}>
                <Settings className="mr-2 h-4 w-4" />
                <span>Settings</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-destructive">
                <LogOut className="mr-2 h-4 w-4" />
                <span>Logout</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
