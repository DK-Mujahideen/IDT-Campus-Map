import React from 'react';
import {
  Bot,
  ChevronLeft,
  ChevronRight,
  Compass,
  DoorOpen,
  Home,
  LayoutDashboard,
  LogIn,
  Map as MapIcon,
  Navigation,
  Search,
  ShieldCheck,
  X,
} from 'lucide-react';
import { useCampus } from '../context/CampusContext';
import type { NavPage } from '../types/campus';

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

const NAV_ITEMS: Array<{
  id: NavPage;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'landing', label: 'Home', icon: Home },
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'map', label: 'Campus Map', icon: MapIcon },
  { id: 'directory', label: 'Find a Location', icon: Search },
  { id: 'navigation', label: 'Navigation', icon: Navigation },
  { id: 'rooms', label: 'Room Availability', icon: DoorOpen },
  { id: 'assistant', label: 'AI Assistant', icon: Bot },
  { id: 'admin', label: 'Admin Console', icon: ShieldCheck },
  { id: 'auth', label: 'Sign In / Account', icon: LogIn },
];

export function Sidebar({
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onCloseMobile,
}: SidebarProps) {
  const { activePage, setActivePage } = useCampus();

  const handleNavClick = (page: NavPage) => {
    setActivePage(page);
    onCloseMobile();
  };

  return (
    <>
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/50 lg:hidden"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 flex flex-col bg-[#0F2557] text-white border-r border-blue-950 transition-all duration-200 shrink-0 ${
          collapsed ? 'lg:w-[76px]' : 'lg:w-64'
        } ${mobileOpen ? 'translate-x-0 w-64' : '-translate-x-full lg:translate-x-0'}`}
      >
        {/* Brand lockup */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-white/10 shrink-0">
          <button
            type="button"
            onClick={() => handleNavClick('dashboard')}
            className="flex items-center gap-3 text-left min-w-0"
          >
            <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
              <Compass className="w-5 h-5 text-white" />
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <div className="font-display font-bold text-base tracking-tight text-white truncate">
                  Smart Campus
                </div>
                <div className="text-[11px] text-blue-200/80 truncate">
                  MSAJCE · Siruseri
                </div>
              </div>
            )}
          </button>

          <button
            type="button"
            onClick={onCloseMobile}
            aria-label="Close navigation menu"
            className="lg:hidden p-1.5 rounded-lg text-blue-200 hover:text-white hover:bg-white/10"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto" aria-label="Primary">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activePage === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavClick(item.id)}
                title={collapsed ? item.label : undefined}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-blue-100/85 hover:text-white hover:bg-white/10'
                } ${collapsed ? 'lg:justify-center lg:px-2' : ''}`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </button>
            );
          })}
        </nav>

        {/* Collapse toggle (Desktop) */}
        <div className="hidden lg:flex items-center justify-between px-3 py-3 border-t border-white/10">
          {!collapsed && (
            <span className="text-xs text-blue-200/70 truncate px-1">
              Demo Campus Platform
            </span>
          )}
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="p-2 rounded-lg text-blue-200 hover:text-white hover:bg-white/10 transition-colors ml-auto"
          >
            {collapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <ChevronLeft className="w-4 h-4" />
            )}
          </button>
        </div>
      </aside>
    </>
  );
}
