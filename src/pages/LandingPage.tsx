import React, { useState } from 'react';
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Compass,
  DoorOpen,
  FileCheck2,
  Map as MapIcon,
  Navigation,
  ShieldCheck,
  Upload,
} from 'lucide-react';
import { useCampus } from '../context/CampusContext';

export function LandingPage() {
  const {
    buildings,
    locations,
    routes,
    mapLayouts,
    user,
    isAdmin,
    setActivePage,
    openAuthPage,
  } = useCampus();

  const [heroImgFailed, setHeroImgFailed] = useState(false);
  const [blueprintImgFailed, setBlueprintImgFailed] = useState(false);

  const verifiedLayoutCount = mapLayouts.filter((l) => l.status === 'verified').length;
  const pendingLayoutCount = mapLayouts.filter((l) => l.status === 'pending').length;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* Top Bar Contract: 3 zones separated by gap-8 */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-xs border-b border-slate-200">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Single text element wordmark */}
          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="font-display text-lg font-bold tracking-tight text-[#0F2557] whitespace-nowrap shrink-0 cursor-pointer"
          >
            Smart Campus
          </button>

          {/* Zone 2: 4 concise single-line nav links */}
          <nav
            aria-label="Landing navigation"
            className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600"
          >
            <a
              href="#capabilities"
              className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Capabilities
            </a>
            <button
              type="button"
              onClick={() => setActivePage('map')}
              className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Campus Map
            </button>
            <a
              href="#verification"
              className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Map Verification
            </a>
            <button
              type="button"
              onClick={() => openAuthPage(user ? 'signin' : 'signin')}
              className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {user ? 'Account' : 'Sign In'}
            </button>
          </nav>

          {/* Zone 3: 1 primary action */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setActivePage('dashboard')}
              className="px-4 py-2 text-xs sm:text-sm font-medium text-white bg-[#0F2557] rounded-lg hover:bg-blue-900 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Open Dashboard
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Section 1: Architectural Hero */}
        <section className="bg-white border-b border-slate-200">
          <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-20">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-stretch">
              <div className="lg:col-span-6 flex flex-col justify-center">
                <p className="text-xs sm:text-sm font-medium text-blue-700 mb-3">
                  Mohamed Sathak A.J. College of Engineering &amp; Technology · Siruseri, Chennai
                </p>

                <h1
                  className="font-display font-bold text-slate-950 tracking-tight leading-[1.1] max-w-2xl"
                  style={{
                    fontSize: 'clamp(2.25rem, 4vw, 3.5rem)',
                    textWrap: 'balance',
                  }}
                >
                  Navigate every block, lab, and floor across campus with clarity.
                </h1>

                <p className="mt-5 text-base text-slate-600 leading-relaxed max-w-xl">
                  Locate classrooms, departments, laboratories, and administrative offices on an
                  interactive floor-by-floor SVG map with shortest-path walking routes, live room
                  availability, and administrator-verified map layouts.
                </p>

                <div className="mt-8 flex flex-wrap items-center gap-4">
                  <button
                    type="button"
                    onClick={() => setActivePage('map')}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-[#0F2557] text-white text-sm font-medium rounded-lg hover:bg-blue-900 transition-colors whitespace-nowrap cursor-pointer"
                  >
                    Explore Campus Map
                    <ArrowRight className="w-4 h-4" />
                  </button>

                  {user ? (
                    <button
                      type="button"
                      onClick={() => setActivePage(isAdmin ? 'admin' : 'dashboard')}
                      className="inline-flex items-center gap-1.5 px-4 py-3 text-sm font-medium text-slate-700 hover:text-slate-950 hover:underline underline-offset-4 transition-colors whitespace-nowrap cursor-pointer"
                    >
                      {isAdmin ? 'Open Admin Console' : 'Continue to Dashboard'}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => openAuthPage('signup')}
                      className="inline-flex items-center gap-1.5 px-4 py-3 text-sm font-medium text-slate-700 hover:text-slate-950 hover:underline underline-offset-4 transition-colors whitespace-nowrap cursor-pointer"
                    >
                      Sign In or Create Account
                    </button>
                  )}
                </div>

                <p className="mt-6 text-xs text-slate-500 leading-relaxed max-w-lg">
                  Demonstration campus data notice: Initial building footprints, room codes, and
                  walking distances are editable demonstration records prepared for replacement
                  with verified MSAJCE institutional layouts.
                </p>
              </div>

              <div className="lg:col-span-6">
                <div className="relative h-full min-h-[300px] sm:min-h-[380px] rounded-xl overflow-hidden border border-slate-200 bg-[#0F2557]">
                  {!heroImgFailed ? (
                    <img
                      src="/src/assets/images/campus_hero_banner_1795009619080.jpg"
                      alt="Architectural view of Mohamed Sathak A.J. College of Engineering campus buildings and walkways"
                      referrerPolicy="no-referrer"
                      onError={() => setHeroImgFailed(true)}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center text-white bg-gradient-to-br from-[#0F2557] to-blue-900">
                      <Compass className="w-10 h-10 text-blue-200 mb-3" />
                      <span className="font-display text-lg font-semibold">
                        MSAJCE Smart Campus Masterplan
                      </span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/75 via-slate-950/15 to-transparent" />
                  <div className="absolute bottom-5 left-5 right-5 text-white">
                    <div className="text-xs text-blue-200 font-medium">
                      Interactive SVG Wayfinding · OMR Campus, Siruseri
                    </div>
                    <div className="font-display text-base sm:text-lg font-semibold mt-0.5">
                      Zoomable floorplans, step-free route paths, and AI guidance
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Full-width Operational Metrics Strip below the hero split */}
            <div className="mt-12 pt-8 border-t border-slate-200 grid grid-cols-2 lg:grid-cols-4 gap-6">
              <div>
                <div className="font-display text-2xl sm:text-3xl font-bold text-[#0F2557] tabular-nums">
                  {buildings.length}
                </div>
                <div className="text-xs sm:text-sm text-slate-600 mt-1">
                  Mapped Campus Blocks (Demo)
                </div>
              </div>
              <div>
                <div className="font-display text-2xl sm:text-3xl font-bold text-[#0F2557] tabular-nums">
                  {locations.length}
                </div>
                <div className="text-xs sm:text-sm text-slate-600 mt-1">
                  Indexed Rooms, Labs &amp; Offices
                </div>
              </div>
              <div>
                <div className="font-display text-2xl sm:text-3xl font-bold text-[#0F2557] tabular-nums">
                  {routes.length}
                </div>
                <div className="text-xs sm:text-sm text-slate-600 mt-1">
                  Walkable Footpath Segments
                </div>
              </div>
              <div>
                <div className="font-display text-2xl sm:text-3xl font-bold text-blue-700 tabular-nums">
                  {verifiedLayoutCount} / {mapLayouts.length}
                </div>
                <div className="text-xs sm:text-sm text-slate-600 mt-1">
                  Admin-Verified Map Layouts ({pendingLayoutCount} pending)
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Section 2: Core Capabilities (Asymmetric Bento Grid) */}
        <section id="capabilities" className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-20">
          <div className="max-w-2xl mb-10">
            <p className="text-xs font-semibold text-blue-700">Platform Capabilities</p>
            <h2
              className="font-display text-2xl sm:text-3xl font-bold text-slate-950 tracking-tight mt-1.5"
              style={{ textWrap: 'balance' }}
            >
              Built for daily navigation by students, faculty, and campus visitors.
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Marquee Card: Col-span-2 */}
            <div className="md:col-span-2 bg-white border border-slate-200 rounded-xl p-6 sm:p-8 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-4">
                  <span className="font-mono text-xs font-semibold text-blue-700">01</span>
                  <MapIcon className="w-5 h-5 text-blue-800" />
                </div>
                <h3 className="font-display text-xl font-bold text-slate-900 mt-4">
                  Interactive Floor-by-Floor Campus Map
                </h3>
                <p className="text-sm text-slate-600 mt-2.5 leading-relaxed max-w-xl">
                  Pan and zoom smoothly from 60% to 300% on desktop or touch screens, switch between
                  Ground, 1st, 2nd, and 3rd floor layouts for multi-story blocks, and click landmark
                  pins for building hours, accessibility details, and mapped rooms.
                </p>
              </div>
              <div className="mt-6 pt-5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                <span className="text-xs text-slate-500">
                  Pinch-to-zoom · Floor filter · Landmark pop-up cards
                </span>
                <button
                  type="button"
                  onClick={() => setActivePage('map')}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 hover:text-blue-900 cursor-pointer"
                >
                  Open Interactive Map
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Card 02 */}
            <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-4">
                  <span className="font-mono text-xs font-semibold text-blue-700">02</span>
                  <Navigation className="w-5 h-5 text-blue-800" />
                </div>
                <h3 className="font-display text-lg font-bold text-slate-900 mt-4">
                  Shortest-Path Walking Routes
                </h3>
                <p className="text-sm text-slate-600 mt-2.5 leading-relaxed">
                  Calculate walking distance and step-free routes between any campus gate, building,
                  or classroom with an animated dotted-dash pathfinding overlay.
                </p>
              </div>
              <div className="mt-6 pt-5 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setActivePage('navigation')}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 hover:text-blue-900 cursor-pointer"
                >
                  Plan a Route
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Card 03 */}
            <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-4">
                  <span className="font-mono text-xs font-semibold text-blue-700">03</span>
                  <DoorOpen className="w-5 h-5 text-blue-800" />
                </div>
                <h3 className="font-display text-lg font-bold text-slate-900 mt-4">
                  Live Room Availability
                </h3>
                <p className="text-sm text-slate-600 mt-2.5 leading-relaxed">
                  Check whether lecture halls, seminar rooms, and computing labs are available,
                  occupied, or unconfirmed, synchronized in real time through Cloud Firestore.
                </p>
              </div>
              <div className="mt-6 pt-5 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setActivePage('rooms')}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 hover:text-blue-900 cursor-pointer"
                >
                  Check Room Status
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Card 04 */}
            <div className="md:col-span-2 bg-white border border-slate-200 rounded-xl p-6 sm:p-8 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-4">
                  <span className="font-mono text-xs font-semibold text-blue-700">04</span>
                  <Building2 className="w-5 h-5 text-blue-800" />
                </div>
                <h3 className="font-display text-xl font-bold text-slate-900 mt-4">
                  Grounded AI Campus Assistant &amp; Facility Finder
                </h3>
                <p className="text-sm text-slate-600 mt-2.5 leading-relaxed max-w-xl">
                  Ask natural-language questions about departments, lab floors, opening hours, or
                  walking directions. Every response is strictly grounded in your campus directory
                  so unknown room numbers are never invented.
                </p>
              </div>
              <div className="mt-6 pt-5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                <span className="text-xs text-slate-500">
                  Server-side Gemini API · Directory-grounded answers
                </span>
                <button
                  type="button"
                  onClick={() => setActivePage('assistant')}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 hover:text-blue-900 cursor-pointer"
                >
                  Ask AI Assistant
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Section 3: Admin Map Layout Legitimacy Verification */}
        <section id="verification" className="bg-white border-y border-slate-200">
          <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-20">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-stretch">
              <div className="lg:col-span-5">
                <div className="h-full min-h-[280px] rounded-xl overflow-hidden border border-slate-200 bg-slate-100">
                  {!blueprintImgFailed ? (
                    <img
                      src="/src/assets/images/campus_architectural_blueprint_1795062988387.jpg"
                      alt="Architectural campus masterplan blueprint ready for administrator verification"
                      referrerPolicy="no-referrer"
                      onError={() => setBlueprintImgFailed(true)}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center text-slate-600">
                      <FileCheck2 className="w-10 h-10 text-blue-800 mb-3" />
                      <span className="font-display text-base font-semibold text-slate-900">
                        Campus Masterplan Verification
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="lg:col-span-7 flex flex-col justify-center">
                <p className="text-xs font-semibold text-blue-700">
                  Map Layout Verification Governance
                </p>
                <h2
                  className="font-display text-2xl sm:text-3xl font-bold text-slate-950 tracking-tight mt-1.5"
                  style={{ textWrap: 'balance' }}
                >
                  Every uploaded campus map layout is inspected before it goes live.
                </h2>
                <p className="text-sm text-slate-600 mt-3 leading-relaxed">
                  Unverified third-party floorplans and malformed SVG files are never published
                  automatically. Administrators review every submission inside a sandboxed preview
                  workbench with automated security and coordinate checks.
                </p>

                <div className="mt-7 space-y-5">
                  <div className="flex items-start gap-4">
                    <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-800 flex items-center justify-center shrink-0">
                      <Upload className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900">
                        01. Upload SVG or JSON Map Layout
                      </h3>
                      <p className="text-xs sm:text-sm text-slate-600 mt-0.5 leading-relaxed">
                        Signed-in contributors submit architectural SVG blueprints or structured
                        building coordinate files with drawing source references.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-800 flex items-center justify-center shrink-0">
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900">
                        02. Automated Security &amp; Geometry Audit
                      </h3>
                      <p className="text-xs sm:text-sm text-slate-600 mt-0.5 leading-relaxed">
                        Smart Campus scans for embedded scripts, event handlers, invalid viewBox
                        scales, out-of-bounds coordinates, and records a SHA-256 integrity hash.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-800 flex items-center justify-center shrink-0">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900">
                        03. Administrator Legitimacy Approval
                      </h3>
                      <p className="text-xs sm:text-sm text-slate-600 mt-0.5 leading-relaxed">
                        Verified administrators inspect the sandboxed rendering, mark the layout as
                        legit or reject it with audit notes, and activate approved layouts on the
                        campus map.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-8 flex flex-wrap items-center gap-4">
                  <button
                    type="button"
                    onClick={() => setActivePage('admin')}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#0F2557] text-white text-sm font-medium rounded-lg hover:bg-blue-900 transition-colors whitespace-nowrap cursor-pointer"
                  >
                    Open Verification Console
                    <ArrowRight className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => openAuthPage('signin')}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-slate-700 border border-slate-200 bg-white rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap cursor-pointer"
                  >
                    Admin Sign In
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Section 4: Focused Final Conversion */}
        <section className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="bg-[#0F2557] text-white rounded-xl p-8 sm:p-12 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
            <div className="max-w-xl">
              <h2
                className="font-display text-2xl sm:text-3xl font-bold tracking-tight"
                style={{ textWrap: 'balance' }}
              >
                Ready to explore the MSAJCE Smart Campus platform?
              </h2>
              <p className="text-sm text-blue-100/90 mt-2.5 leading-relaxed">
                Start navigating immediately as a guest, or sign in to submit campus map layouts,
                report corrections, and manage verified institutional data.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setActivePage('dashboard')}
                className="px-6 py-3 bg-white text-[#0F2557] text-sm font-semibold rounded-lg hover:bg-blue-50 transition-colors whitespace-nowrap cursor-pointer"
              >
                Launch Smart Campus
              </button>
              <button
                type="button"
                onClick={() => openAuthPage('signup')}
                className="px-5 py-3 bg-blue-900/70 text-white border border-blue-400/30 text-sm font-medium rounded-lg hover:bg-blue-800 transition-colors whitespace-nowrap cursor-pointer"
              >
                Create Account
              </button>
            </div>
          </div>
        </section>
      </main>

      {/* Quiet Footer */}
      <footer className="bg-white border-t border-slate-200">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs text-slate-500">
          <div>
            Smart Campus · Mohamed Sathak A.J. College of Engineering &amp; Technology (Siruseri,
            Chennai)
          </div>
          <div className="flex flex-wrap items-center gap-5">
            <button
              type="button"
              onClick={() => setActivePage('map')}
              className="hover:text-slate-900 transition-colors cursor-pointer"
            >
              Campus Map
            </button>
            <button
              type="button"
              onClick={() => setActivePage('directory')}
              className="hover:text-slate-900 transition-colors cursor-pointer"
            >
              Directory
            </button>
            <button
              type="button"
              onClick={() => openAuthPage('signin')}
              className="hover:text-slate-900 transition-colors cursor-pointer"
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => setActivePage('admin')}
              className="hover:text-slate-900 transition-colors cursor-pointer"
            >
              Admin Console
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
