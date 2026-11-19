import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  Bot,
  Building2,
  Compass,
  DoorOpen,
  Info,
  MapPin,
  Navigation,
  Route,
  Search,
} from 'lucide-react';
import { useCampus } from '../context/CampusContext';

export function DashboardPage() {
  const {
    campusInfo,
    buildings,
    locations,
    routes,
    roomStatuses,
    setActivePage,
    openBuildingOnMap,
    navigateToLocation,
  } = useCampus();

  const [quickQuery, setQuickQuery] = useState('');
  const [heroImgFailed, setHeroImgFailed] = useState(false);

  const availableRoomsCount = useMemo(
    () => roomStatuses.filter((r) => r.status === 'available').length,
    [roomStatuses]
  );

  const popularLocations = useMemo(
    () => locations.filter((l) => l.popular).slice(0, 6),
    [locations]
  );

  const quickResults = useMemo(() => {
    const q = quickQuery.trim().toLowerCase();
    if (!q) return [];
    return locations
      .filter((loc) => {
        const b = buildings.find((item) => item.id === loc.buildingId);
        return (
          loc.name.toLowerCase().includes(q) ||
          loc.roomNumber.toLowerCase().includes(q) ||
          (loc.department ?? '').toLowerCase().includes(q) ||
          (b?.name.toLowerCase().includes(q) ?? false) ||
          (b?.code.toLowerCase().includes(q) ?? false)
        );
      })
      .slice(0, 6);
  }, [quickQuery, locations, buildings]);

  const buildingNameById = useMemo(() => {
    const map = new Map<string, string>();
    buildings.forEach((b) => map.set(b.id, `${b.shortName} (${b.code})`));
    return map;
  }, [buildings]);

  return (
    <div className="space-y-8">
      {/* Demonstration Notice */}
      <div className="bg-blue-50/70 border border-blue-200 rounded-xl px-4 py-3 flex items-start gap-3">
        <Info className="w-4 h-4 text-blue-700 mt-0.5 shrink-0" />
        <div className="text-xs sm:text-sm text-slate-700 leading-relaxed">
          <span className="font-semibold text-blue-950">Demonstration Dataset:</span>{' '}
          {campusInfo.dataNotice}
        </div>
      </div>

      {/* Welcome Split Hero */}
      <section className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-12 items-stretch">
          <div className="lg:col-span-7 p-6 sm:p-8 flex flex-col justify-between gap-6">
            <div>
              <p className="text-xs font-medium text-blue-700 mb-2">
                {campusInfo.locationText}
              </p>
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight text-balance mb-3">
                {campusInfo.campusName}
              </h2>
              <p className="text-sm sm:text-base text-slate-600 leading-relaxed max-w-2xl">
                Navigate academic blocks, engineering laboratories, administrative offices, and
                student amenities across campus with interactive routing and live room
                availability.
              </p>
            </div>

            {/* Quick Location Search */}
            <div className="relative">
              <label htmlFor="dashboard-quick-search" className="sr-only">
                Quick search for classrooms, labs, departments, or facilities
              </label>
              <div className="relative flex items-center">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" />
                <input
                  id="dashboard-quick-search"
                  type="text"
                  value={quickQuery}
                  onChange={(e) => setQuickQuery(e.target.value)}
                  placeholder="Search rooms, labs, offices, or blocks (e.g., B-201, Library, Placement)..."
                  className="w-full pl-10 pr-4 py-3 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              {quickResults.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-2 z-20 bg-white border border-slate-200 rounded-xl shadow-lg divide-y divide-slate-100 overflow-hidden">
                  {quickResults.map((loc) => (
                    <div
                      key={loc.id}
                      className="px-4 py-3 flex items-center justify-between gap-3 hover:bg-slate-50 transition-colors"
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-slate-900 truncate">
                          {loc.name}
                        </div>
                        <div className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                          <span className="font-mono text-slate-700">{loc.roomNumber}</span>
                          <span aria-hidden="true">·</span>
                          <span>{buildingNameById.get(loc.buildingId) ?? loc.buildingId}</span>
                          <span aria-hidden="true">·</span>
                          <span>Floor {loc.floor}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => openBuildingOnMap(loc.buildingId)}
                          className="px-2.5 py-1.5 text-xs font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors whitespace-nowrap"
                        >
                          Map
                        </button>
                        <button
                          type="button"
                          onClick={() => navigateToLocation(loc)}
                          className="px-2.5 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap"
                        >
                          Route
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Primary Actions */}
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setActivePage('map')}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-900 text-white text-sm font-medium rounded-lg hover:bg-blue-800 transition-colors whitespace-nowrap"
              >
                <Compass className="w-4 h-4" />
                Open Campus Map
              </button>
              <button
                type="button"
                onClick={() => setActivePage('navigation')}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-white text-slate-800 border border-slate-200 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap"
              >
                <Navigation className="w-4 h-4 text-blue-700" />
                Plan Walking Route
              </button>
              <button
                type="button"
                onClick={() => setActivePage('assistant')}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-white text-slate-800 border border-slate-200 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap"
              >
                <Bot className="w-4 h-4 text-blue-700" />
                Ask AI Assistant
              </button>
            </div>
          </div>

          <div className="lg:col-span-5 relative min-h-[240px] bg-slate-100 border-t lg:border-t-0 lg:border-l border-slate-200">
            {!heroImgFailed ? (
              <img
                src="/src/assets/images/campus_hero_banner_1795009619080.jpg"
                alt="Illustrative modern engineering campus courtyard and academic buildings"
                referrerPolicy="no-referrer"
                onError={() => setHeroImgFailed(true)}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-gradient-to-br from-blue-950 to-blue-800 text-white">
                <Building2 className="w-10 h-10 mb-2 opacity-80" />
                <div className="font-display font-semibold text-base">
                  MSAJCE Smart Campus
                </div>
                <div className="text-xs text-blue-100 mt-1">
                  Interactive Navigation &amp; Facility Finder
                </div>
              </div>
            )}
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/80 via-slate-950/35 to-transparent p-4">
              <p className="text-xs text-white/95 font-medium">
                Illustrative Campus Preview · Siruseri Campus Navigation Hub
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 4-Column Campus KPI Strip */}
      <section aria-label="Campus statistics" className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 mb-2">
            <span>Mapped Buildings</span>
            <Building2 className="w-4 h-4 text-blue-800" />
          </div>
          <div className="font-display text-2xl font-bold text-slate-900 tabular-nums">
            {buildings.length}
          </div>
          <div className="text-xs text-slate-500 mt-1">Demo architectural blocks</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 mb-2">
            <span>Rooms &amp; Facilities</span>
            <MapPin className="w-4 h-4 text-blue-800" />
          </div>
          <div className="font-display text-2xl font-bold text-slate-900 tabular-nums">
            {locations.length}
          </div>
          <div className="text-xs text-slate-500 mt-1">Searchable campus spaces</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 mb-2">
            <span>Available Rooms Now</span>
            <DoorOpen className="w-4 h-4 text-emerald-700" />
          </div>
          <div className="font-display text-2xl font-bold text-slate-900 tabular-nums">
            {availableRoomsCount} / {roomStatuses.length}
          </div>
          <div className="text-xs text-slate-500 mt-1">Live tracked rooms</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 mb-2">
            <span>Walkway Segments</span>
            <Route className="w-4 h-4 text-blue-800" />
          </div>
          <div className="font-display text-2xl font-bold text-slate-900 tabular-nums">
            {routes.length}
          </div>
          <div className="text-xs text-slate-500 mt-1">Shortest-path network edges</div>
        </div>
      </section>

      {/* Popular Destinations + Quick AI Assistant Access */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Popular Destinations */}
        <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl shadow-xs">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
            <div>
              <h3 className="font-display text-base font-semibold text-slate-900">
                Popular Campus Destinations
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Frequently visited academic offices, labs, and student facilities (demo data)
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActivePage('directory')}
              className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:text-blue-900 whitespace-nowrap"
            >
              Browse All
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="divide-y divide-slate-100">
            {popularLocations.map((loc) => (
              <div
                key={loc.id}
                className="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/70 transition-colors"
              >
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-900 truncate">
                    {loc.name}
                  </div>
                  <div className="text-xs text-slate-500 flex flex-wrap items-center gap-1.5 mt-1">
                    <span className="font-mono text-slate-700">{loc.roomNumber}</span>
                    <span aria-hidden="true">·</span>
                    <span>{buildingNameById.get(loc.buildingId) ?? loc.buildingId}</span>
                    <span aria-hidden="true">·</span>
                    <span>Floor {loc.floor}</span>
                    <span aria-hidden="true">·</span>
                    <span>{loc.hours}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => openBuildingOnMap(loc.buildingId)}
                    className="px-3 py-1.5 text-xs font-medium text-slate-700 border border-slate-200 bg-white rounded-lg hover:bg-slate-100 transition-colors whitespace-nowrap"
                  >
                    View on Map
                  </button>
                  <button
                    type="button"
                    onClick={() => navigateToLocation(loc)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-900 rounded-lg hover:bg-blue-800 transition-colors whitespace-nowrap"
                  >
                    <Navigation className="w-3 h-3" />
                    Directions
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* AI Campus Assistant Panel */}
        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-xl shadow-xs p-6 space-y-5">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-900 text-white flex items-center justify-center shrink-0">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-display text-base font-semibold text-slate-900">
                AI Campus Assistant
              </h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Ask natural-language questions grounded strictly in our campus directory and route
                graph.
              </p>
            </div>
          </div>

          <div className="space-y-2 border-t border-slate-100 pt-4">
            <div className="text-xs font-medium text-slate-500 mb-2">
              Example campus questions:
            </div>
            {[
              'Where is the AI & Data Science Computing Lab?',
              'How do I walk from Main Gate to Central Library?',
              'Which classrooms or labs are currently available?',
            ].map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => setActivePage('assistant')}
                className="w-full text-left px-3.5 py-2.5 text-xs font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-lg hover:border-blue-400 hover:bg-blue-50/40 transition-colors flex items-center justify-between gap-2"
              >
                <span className="truncate">{prompt}</span>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setActivePage('assistant')}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Bot className="w-4 h-4" />
            Launch AI Assistant
          </button>
        </div>
      </section>
    </div>
  );
}
