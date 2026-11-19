import React, { useState } from 'react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { FeedbackModal } from './components/FeedbackModal';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { CampusProvider, useCampus } from './context/CampusContext';
import { AdminDashboardPage } from './pages/AdminDashboardPage';
import { AssistantPage } from './pages/AssistantPage';
import { AuthPage } from './pages/AuthPage';
import { CampusMapPage } from './pages/CampusMapPage';
import { DashboardPage } from './pages/DashboardPage';
import { FindLocationPage } from './pages/FindLocationPage';
import { LandingPage } from './pages/LandingPage';
import { NavigationPage } from './pages/NavigationPage';
import { RoomAvailabilityPage } from './pages/RoomAvailabilityPage';

function SmartCampusShell() {
  const { activePage } = useCampus();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  if (activePage === 'landing') {
    return <LandingPage />;
  }

  if (activePage === 'auth') {
    return <AuthPage />;
  }

  const renderPage = () => {
    switch (activePage) {
      case 'dashboard':
        return <DashboardPage />;
      case 'map':
        return <CampusMapPage />;
      case 'directory':
        return <FindLocationPage />;
      case 'navigation':
        return <NavigationPage />;
      case 'rooms':
        return <RoomAvailabilityPage />;
      case 'assistant':
        return <AssistantPage />;
      case 'admin':
        return <AdminDashboardPage />;
      default:
        return <DashboardPage />;
    }
  };

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-900">
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <Header
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
          onOpenFeedback={() => setFeedbackOpen(true)}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1440px] w-full mx-auto">
          {renderPage()}
        </main>

        <footer className="border-t border-slate-200 bg-white px-4 lg:px-8 py-3.5 text-xs text-slate-500 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <span>
            Smart Campus · Mohamed Sathak A.J. College of Engineering &amp; Technology
            (Siruseri, Chennai)
          </span>
          <span>
            Demonstration Campus Map &amp; Directory — Editable for verified institutional data
          </span>
        </footer>
      </div>

      <FeedbackModal open={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <CampusProvider>
        <SmartCampusShell />
      </CampusProvider>
    </ErrorBoundary>
  );
}
