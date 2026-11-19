import React, { useMemo, useState } from 'react';
import {
  Accessibility,
  ArrowLeftRight,
  Camera,
  Clock,
  Footprints,
  Map as MapIcon,
  Navigation,
  Route,
} from 'lucide-react';
import { ARCameraNavigationView } from '../components/ARCameraNavigationView';
import { InteractiveCampusMap } from '../components/InteractiveCampusMap';
import { useCampus } from '../context/CampusContext';
import { calculateShortestRoute } from '../utils/pathfinding';

export function NavigationPage() {
  const {
    buildings,
    locations,
    mapNodes,
    routes,
    roomStatuses,
    navStartNodeId,
    setNavStartNodeId,
    navEndNodeId,
    setNavEndNodeId,
    selectedBuildingId,
    setSelectedBuildingId,
  } = useCampus();

  const [accessibleOnly, setAccessibleOnly] = useState(false);
  const [viewMode, setViewMode] = useState<'map' | 'camera'>('map');

  // Build user-friendly selectable destinations (Gate + Building Entrances + Rooms mapped to building entrance)
  const waypointOptions = useMemo(() => {
    const basePoints: Array<{ value: string; label: string; group: string }> = [
      { value: 'node-gate', label: 'Main Campus Gate (OMR Entrance)', group: 'Campus Entrances' },
      ...buildings.map((b) => ({
        value: b.entranceNodeId,
        label: `[${b.code}] ${b.name}`,
        group: 'Buildings',
      })),
    ];
    return basePoints;
  }, [buildings]);

  const handleRoomQuickSelect = (locationId: string, target: 'start' | 'end') => {
    const loc = locations.find((l) => l.id === locationId);
    if (!loc) return;
    const bldg = buildings.find((b) => b.id === loc.buildingId);
    if (!bldg) return;
    if (target === 'start') {
      setNavStartNodeId(bldg.entranceNodeId);
    } else {
      setNavEndNodeId(bldg.entranceNodeId);
      setSelectedBuildingId(bldg.id);
    }
  };

  const calculatedRoute = useMemo(
    () =>
      calculateShortestRoute(
        navStartNodeId,
        navEndNodeId,
        mapNodes,
        routes,
        accessibleOnly
      ),
    [navStartNodeId, navEndNodeId, mapNodes, routes, accessibleOnly]
  );

  const handleSwap = () => {
    const prevStart = navStartNodeId;
    setNavStartNodeId(navEndNodeId);
    setNavEndNodeId(prevStart);
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
      {/* Left Route Planner Panel */}
      <div className="xl:col-span-4 space-y-5">
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-display text-base font-semibold text-slate-900 flex items-center gap-2">
              <Navigation className="w-4 h-4 text-blue-700" />
              Walking Route Planner
            </h2>
            <button
              type="button"
              onClick={handleSwap}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
              title="Swap starting point and destination"
            >
              <ArrowLeftRight className="w-3.5 h-3.5" />
              Swap
            </button>
          </div>

          <div className="space-y-3">
            <div>
              <label
                htmlFor="nav-start-select"
                className="block text-xs font-medium text-slate-700 mb-1.5"
              >
                Starting Point
              </label>
              <select
                id="nav-start-select"
                value={navStartNodeId}
                onChange={(e) => setNavStartNodeId(e.target.value)}
                className="w-full px-3 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                {waypointOptions.map((opt) => (
                  <option key={`start-${opt.value}`} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="nav-end-select"
                className="block text-xs font-medium text-slate-700 mb-1.5"
              >
                Destination Building
              </label>
              <select
                id="nav-end-select"
                value={navEndNodeId}
                onChange={(e) => setNavEndNodeId(e.target.value)}
                className="w-full px-3 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                {waypointOptions.map((opt) => (
                  <option key={`end-${opt.value}`} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="nav-room-jump"
                className="block text-xs font-medium text-slate-500 mb-1.5"
              >
                Or pick a specific destination room / lab
              </label>
              <select
                id="nav-room-jump"
                defaultValue=""
                onChange={(e) => {
                  if (e.target.value) {
                    handleRoomQuickSelect(e.target.value, 'end');
                  }
                }}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-slate-700"
              >
                <option value="">Jump to room or facility...</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.roomNumber} — {loc.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <label className="flex items-center gap-2.5 pt-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={accessibleOnly}
              onChange={(e) => setAccessibleOnly(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
            />
            <span className="text-xs font-medium text-slate-700 inline-flex items-center gap-1.5">
              <Accessibility className="w-3.5 h-3.5 text-blue-700" />
              Step-free / ramp-accessible paths only
            </span>
          </label>
        </div>

        {/* Route Result Metrics & Steps */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs">
          {calculatedRoute ? (
            <div className="space-y-5">
              <div className="grid grid-cols-3 gap-3 pb-4 border-b border-slate-200">
                <div>
                  <div className="text-[11px] font-medium text-slate-500 flex items-center gap-1">
                    <Route className="w-3 h-3" />
                    Distance
                  </div>
                  <div className="font-display text-lg font-bold text-slate-900 tabular-nums mt-0.5">
                    {calculatedRoute.totalDistanceMeters} m
                  </div>
                </div>
                <div>
                  <div className="text-[11px] font-medium text-slate-500 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Walk Time
                  </div>
                  <div className="font-display text-lg font-bold text-blue-700 tabular-nums mt-0.5">
                    {calculatedRoute.estimatedMinutes} min
                  </div>
                </div>
                <div>
                  <div className="text-[11px] font-medium text-slate-500 flex items-center gap-1">
                    <Footprints className="w-3 h-3" />
                    Segments
                  </div>
                  <div className="font-display text-lg font-bold text-slate-900 tabular-nums mt-0.5">
                    {calculatedRoute.segments.length}
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-3">
                  Turn-by-Turn Walking Directions (Demo)
                </h3>
                <ol className="space-y-2.5">
                  {calculatedRoute.steps.map((step, idx) => (
                    <li key={idx} className="flex items-start gap-2.5 text-xs text-slate-700">
                      <span className="w-5 h-5 rounded-full bg-blue-50 text-blue-800 font-mono text-[11px] font-semibold flex items-center justify-center shrink-0 mt-0.5">
                        {idx + 1}
                      </span>
                      <span className="leading-relaxed">{step}</span>
                    </li>
                  ))}
                </ol>
              </div>

              <div className="pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setViewMode((prev) => (prev === 'camera' ? 'map' : 'camera'))}
                  className={`w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                    viewMode === 'camera'
                      ? 'bg-slate-100 text-slate-900 border border-slate-200 hover:bg-slate-200'
                      : 'bg-[#0F2557] text-white hover:bg-blue-900'
                  }`}
                >
                  {viewMode === 'camera' ? (
                    <>
                      <MapIcon className="w-4 h-4" />
                      Switch to 2D Map View
                    </>
                  ) : (
                    <>
                      <Camera className="w-4 h-4" />
                      Launch Camera View (AR Markers)
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            <div className="py-6 text-center text-xs text-slate-500">
              No walkable route found matching your accessibility filter between the selected
              points. Try unchecking step-free only or selecting another building.
            </div>
          )}
        </div>
      </div>

      {/* Right Navigation Viewport: 2D Map View or Live AR Camera View */}
      <div className="xl:col-span-8 space-y-3">
        <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs font-semibold text-slate-900">
              {viewMode === 'camera'
                ? 'Live AR Camera View · 3D Directional Wayfinding Overlay'
                : 'Interactive Campus Map · Shortest Walking Path'}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              {viewMode === 'camera'
                ? 'Point your device camera along the walkway (or drag horizontally to rotate heading) to follow the 3D markers.'
                : 'Click any building on the map to update your destination or toggle Camera View for live guidance.'}
            </div>
          </div>

          <div
            className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg shrink-0 w-fit"
            role="group"
            aria-label="Navigation view mode"
          >
            <button
              type="button"
              onClick={() => setViewMode('map')}
              aria-pressed={viewMode === 'map'}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                viewMode === 'map'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <MapIcon className="w-3.5 h-3.5" />
              Map View
            </button>
            <button
              type="button"
              onClick={() => setViewMode('camera')}
              aria-pressed={viewMode === 'camera'}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                viewMode === 'camera'
                  ? 'bg-[#0F2557] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Camera className="w-3.5 h-3.5" />
              Camera View
            </button>
          </div>
        </div>

        {viewMode === 'camera' ? (
          <ARCameraNavigationView
            activeRoute={calculatedRoute}
            onExitCameraView={() => setViewMode('map')}
            heightClass="h-[580px]"
          />
        ) : (
          <InteractiveCampusMap
            buildings={buildings}
            nodes={mapNodes}
            routes={routes}
            locations={locations}
            roomStatuses={roomStatuses}
            selectedBuildingId={selectedBuildingId}
            onSelectBuilding={(id) => {
              setSelectedBuildingId(id);
              const bldg = buildings.find((b) => b.id === id);
              if (bldg) {
                setNavEndNodeId(bldg.entranceNodeId);
              }
            }}
            activeRoute={calculatedRoute}
            heightClass="h-[580px]"
          />
        )}
      </div>
    </div>
  );
}
