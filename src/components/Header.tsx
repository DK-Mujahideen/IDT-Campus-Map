import React from 'react';
import { LogIn, LogOut, Menu, MessageSquarePlus } from 'lucide-react';
import { useCampus } from '../context/CampusContext';
import type { NavPage } from '../types/campus';

interface HeaderProps {
  onOpenMobileMenu: () => void;
  onOpenFeedback: () => void;
}

const PAGE_TITLES: Record<NavPage, string> = {
  landing: 'Home',
  auth: 'Sign In',
  dashboard: 'Dashboard',
  map: 'Campus Map',
  directory: 'Find a Location',
  navigation: 'Route Navigation',
  rooms: 'Room Availability',
  assistant: 'AI Campus Assistant',
  admin: 'Admin Console',
};

export function Header({ onOpenMobileMenu, onOpenFeedback }: HeaderProps) {
  const { activePage, setActivePage, openAuthPage, user, isAdmin, signOutUser } = useCampus();

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-4 lg:px-8 flex items-center justify-between gap-6 shrink-0">
      {/* Zone 1: Mobile trigger + Breadcrumb */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          aria-label="Open navigation menu"
          className="lg:hidden p-2 -ml-2 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 text-sm min-w-0">
          <button
            type="button"
            onClick={() => setActivePage('landing')}
            className="hidden sm:inline text-slate-500 hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap cursor-pointer"
          >
            MSAJCE Smart Campus
          </button>
          <span className="hidden sm:inline text-slate-300" aria-hidden="true">
            /
          </span>
          <h1 className="font-display font-semibold text-slate-900 truncate">
            {PAGE_TITLES[activePage]}
          </h1>
        </div>
      </div>

      {/* Zone 2 & 3: Account context + Single primary action */}
      <div className="flex items-center gap-3 shrink-0">
        {user ? (
          <button
            type="button"
            onClick={() => openAuthPage('signin')}
            className="hidden md:flex items-center gap-2 text-xs text-slate-600 hover:text-slate-900 pr-1 cursor-pointer"
          >
            <span className="font-medium text-slate-800 truncate max-w-[160px]">
              {user.displayName || user.email}
            </span>
            {isAdmin && (
              <>
                <span aria-hidden="true">·</span>
                <span className="text-blue-700 font-semibold">Admin</span>
              </>
            )}
          </button>
        ) : null}

        <button
          type="button"
          onClick={onOpenFeedback}
          className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 border border-slate-200 bg-white rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <MessageSquarePlus className="w-3.5 h-3.5 text-slate-500" />
          Feedback
        </button>

        {user ? (
          <button
            type="button"
            onClick={() => void signOutUser()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 border border-slate-200 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign Out
          </button>
        ) : (
          <button
            type="button"
            onClick={() => openAuthPage('signin')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-blue-900 rounded-lg hover:bg-blue-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <LogIn className="w-3.5 h-3.5" />
            Sign In
          </button>
        )}
      </div>
    </header>
  );
}
