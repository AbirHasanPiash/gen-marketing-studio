import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Menu as MenuIcon, Sun, Moon, LogOut, Plus, ChevronDown, Store, UserCog } from 'lucide-react';
import { Menu, MenuItem, Avatar, Button } from '../ui';
import { BrandSwitcher } from './BrandSwitcher';
import { NotificationBell } from './NotificationBell';
import { ProfileModal } from './ProfileModal';
import { useUI } from '../../store/ui';
import { useAuth } from '../../store/auth';

export function Topbar() {
  const { theme, toggleTheme, setSidebar } = useUI();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [profileOpen, setProfileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 h-16 shrink-0 border-b border-border bg-bg/80 backdrop-blur-xl">
      <div className="flex h-full items-center gap-3 px-4 sm:px-6">
        <button
          onClick={() => setSidebar(true)}
          className="grid h-10 w-10 place-items-center rounded-xl text-muted hover:bg-elevated lg:hidden"
          aria-label="Open navigation"
        >
          <MenuIcon className="h-5 w-5" />
        </button>

        <BrandSwitcher />

        <div className="ml-auto flex items-center gap-1.5">
          <Button size="sm" className="hidden sm:inline-flex" onClick={() => navigate('/posts/new')}>
            <Plus className="h-4 w-4" /> New Post
          </Button>

          <NotificationBell />

          <button
            onClick={toggleTheme}
            className="grid h-10 w-10 place-items-center rounded-xl text-muted hover:bg-elevated hover:text-fg transition"
            aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            title="Toggle theme"
          >
            {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>

          <Menu
            width="w-56"
            label="Account menu"
            trigger={() => (
              <span className="flex items-center gap-2 rounded-xl p-1 pr-2 transition hover:bg-elevated">
                <Avatar name={user?.name} src={user?.avatarUrl} size="sm" />
                <span className="hidden md:block text-left leading-tight">
                  <span className="block text-sm font-medium text-fg truncate max-w-[120px]">{user?.name}</span>
                  <span className="block text-[11px] text-muted capitalize">{user?.role?.toLowerCase()}</span>
                </span>
                <ChevronDown className="h-4 w-4 text-muted hidden md:block" />
              </span>
            )}
          >
            <div className="px-2.5 py-2">
              <p className="text-sm font-medium text-fg truncate">{user?.name}</p>
              <p className="text-xs text-muted truncate">{user?.email}</p>
            </div>
            <div className="my-1 border-t border-border" />
            <MenuItem icon={UserCog} onClick={() => setProfileOpen(true)}>
              Profile & password
            </MenuItem>
            <Link to="/brands">
              <MenuItem icon={Store}>Brands & settings</MenuItem>
            </Link>
            <MenuItem icon={LogOut} danger onClick={logout}>
              Sign out
            </MenuItem>
          </Menu>
        </div>
      </div>

      <ProfileModal open={profileOpen} onClose={() => setProfileOpen(false)} />
    </header>
  );
}

export default Topbar;
