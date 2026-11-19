import React, { useEffect, useMemo, useState } from 'react';
import {
  Accessibility,
  AlertTriangle,
  Building2,
  Clock,
  Image as ImageIcon,
  Layers,
  MapPin,
  Navigation,
  Route,
  Search,
  ShieldCheck,
  Sparkles,
  Upload,
  X,
} from 'lucide-react';
import { ExtractedLayoutCanvas } from '../components/ExtractedLayoutCanvas';
import {
  formatFloorLabel,
  type FloorSelection,
} from '../components/FloorLevelSelector';
import {
  InteractiveCampusMap,
  type CampusLandmark,
} from '../components/InteractiveCampusMap';
import {
  MapLayoutUploadModal,
  type UploadedLayoutPreviewPayload,
} from '../components/MapLayoutUploadModal';
import { useCampus } from '../context/CampusContext';
import type { BuildingCategory } from '../types/campus';
import { buildSandboxedSvgPreviewDoc } from '../utils/mapLayoutValidator';
import { calculateShortestRoute } from '../utils/pathfinding';

const CATEGORY_TABS: Array<{ id: BuildingCategory | 'all'; label: string }> = [
  { id: 'all', label: 'All Blocks' },
  { id: 'academic', label: 'Academic' },
  { id: 'labs', label: 'Labs & Workshops' },
  { id: 'admin', label: 'Administration' },
  { id: 'facilities', label: 'Facilities' },
];

export function CampusMapPage() {
  const {
    buildings,
    locations,
    mapNodes,
    routes,
    roomStatuses,
    navStartNodeId,
    setNavStartNodeId,
    selectedBuildingId,
    setSelectedBuildingId,
    navigateToBuilding,
    activeVerifiedLayout,
  } = useCampus();

  const [categoryFilter, setCategoryFilter] = useState<BuildingCategory | 'all'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFloor, setSelectedFloor] = useState<FloorSelection>('all');
  const [popupLandmarkId, setPopupLandmarkId] = useState<string | null>(null);
  const [routeTargetBuildingId, setRouteTargetBuildingId] = useState<string | null>(null);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [mapViewMode, setMapViewMode] = useState<'interactive' | 'uploaded' | 'verified'>(
    'interactive'
  );
  const [uploadedLayoutPreview, setUploadedLayoutPreview] =
    useState<UploadedLayoutPreviewPayload | null>(null);
  const [showSourceImage, setShowSourceImage] = useState(false);
  const [uploadNotice, setUploadNotice] = useState<string | null>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPopupLandmarkId(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const filteredBuildings = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return buildings.filter((b) => {
      const matchesCat = categoryFilter === 'all' || b.category === categoryFilter;
      if (!matchesCat) return false;
      if (!q) return true;
      const matchesBldg =
        b.name.toLowerCase().includes(q) ||
        b.code.toLowerCase().includes(q) ||
        b.shortName.toLowerCase().includes(q);
      const matchesLoc = locations.some(
        (l) =>
          l.buildingId === b.id &&
          (l.name.toLowerCase().includes(q) || l.roomNumber.toLowerCase().includes(q))
      );
      return matchesBldg || matchesLoc;
    });
  }, [buildings, locations, categoryFilter, searchTerm]);

  const selectedBuilding = useMemo(
    () => buildings.find((b) => b.id === selectedBuildingId) ?? buildings[0] ?? null,
    [buildings, selectedBuildingId]
  );

  const buildingLocations = useMemo(() => {
    if (!selectedBuilding) return [];
    return locations.filter((l) => l.buildingId === selectedBuilding.id);
  }, [locations, selectedBuilding]);

  const visibleBuildingLocations = useMemo(() => {
    if (selectedFloor === 'all') return buildingLocations;
    return buildingLocations.filter((l) => l.floor === selectedFloor);
  }, [buildingLocations, selectedFloor]);

  const statusByLocationId = useMemo(() => {
    const map = new Map<string, string>();
    roomStatuses.forEach((rs) => map.set(rs.locationId, rs.status));
    return map;
  }, [roomStatuses]);

  const campusLandmarks = useMemo<CampusLandmark[]>(() => {
    const buildingPins: CampusLandmark[] = filteredBuildings.map((b) => {
      const shortTag =
        b.code === 'ADM'
          ? 'AD'
          : b.code === 'BLK-A'
          ? 'A'
          : b.code === 'BLK-B'
          ? 'B'
          : b.code === 'LAB-1'
          ? 'L1'
          : b.code === 'WS-1'
          ? 'WS'
          : b.code === 'LIB'
          ? 'LB'
          : b.code === 'AUD'
          ? 'AU'
          : b.code === 'CAFE'
          ? 'CF'
          : b.code.slice(0, 2).toUpperCase();

      return {
        id: `lm-${b.id}`,
        label: b.shortName,
        shortTag,
        category: b.category,
        x: b.x + b.width / 2,
        y: b.y - 2,
        buildingId: b.id,
        description: b.description,
        hours: b.hours,
      };
    });

    const gatePin: CampusLandmark = {
      id: 'lm-main-gate',
      label: 'Main Campus Gate',
      shortTag: 'GT',
      category: 'entrance',
      x: 500,
      y: 598,
      description:
        'Primary OMR / Siruseri campus entry point with security check-in and visitor orientation path toward the Administration Block.',
      hours: 'Open 24 Hours (Demo)',
    };

    return [...buildingPins, gatePin];
  }, [filteredBuildings]);

  const activePopupLandmark = useMemo(
    () => campusLandmarks.find((lm) => lm.id === popupLandmarkId) ?? null,
    [campusLandmarks, popupLandmarkId]
  );

  const activePopupBuilding = useMemo(
    () =>
      activePopupLandmark?.buildingId
        ? buildings.find((b) => b.id === activePopupLandmark.buildingId) ?? null
        : null,
    [activePopupLandmark, buildings]
  );

  const activePopupRoomCount = useMemo(() => {
    if (!activePopupBuilding) return 0;
    return locations.filter((l) => l.buildingId === activePopupBuilding.id).length;
  }, [activePopupBuilding, locations]);

  const routeTargetBuilding = useMemo(
    () =>
      routeTargetBuildingId
        ? buildings.find((b) => b.id === routeTargetBuildingId) ?? null
        : null,
    [buildings, routeTargetBuildingId]
  );

  const previewRoute = useMemo(() => {
    if (!routeTargetBuilding) return null;
    if (navStartNodeId === routeTargetBuilding.entranceNodeId) return null;
    return calculateShortestRoute(
      navStartNodeId,
      routeTargetBuilding.entranceNodeId,
      mapNodes,
      routes,
      false
    );
  }, [navStartNodeId, routeTargetBuilding, mapNodes, routes]);

  const startLocationOptions = useMemo(
    () => [
      { value: 'node-gate', label: 'Main Campus Gate (Current)' },
      ...buildings.map((b) => ({
        value: b.entranceNodeId,
        label: `[${b.code}] ${b.shortName}`,
      })),
    ],
    [buildings]
  );

  const handleToggleRoutePreview = (buildingId: string) => {
    setRouteTargetBuildingId((prev) => (prev === buildingId ? null : buildingId));
  };

  const handleSelectLandmark = (lm: CampusLandmark) => {
    setPopupLandmarkId(lm.id);
    if (lm.buildingId) {
      setSelectedBuildingId(lm.buildingId);
    }
  };

  const handleSelectBuildingFootprint = (id: string) => {
    setSelectedBuildingId(id);
    setPopupLandmarkId(`lm-${id}`);
  };

  return (
    <div className="space-y-6">
      {/* Filter & Search Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg">
          {CATEGORY_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setCategoryFilter(tab.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                categoryFilter === tab.id
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full md:w-auto">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Filter buildings or room codes..."
              className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <button
            type="button"
            onClick={() => setUploadModalOpen(true)}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-medium text-[#0F2557] bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            Upload Map / Image (AI)
          </button>
        </div>
      </div>

      {uploadNotice && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl px-4 py-3 text-xs font-medium flex items-center justify-between gap-2">
          <span>{uploadNotice}</span>
          <button
            type="button"
            onClick={() => setUploadNotice(null)}
            aria-label="Dismiss notice"
            className="text-emerald-700 hover:text-emerald-950 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {(activeVerifiedLayout || uploadedLayoutPreview) && (
        <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 text-xs min-w-0">
            {mapViewMode === 'uploaded' && uploadedLayoutPreview ? (
              <>
                <Sparkles className="w-4 h-4 text-blue-700 shrink-0" />
                <div className="min-w-0">
                  <span className="font-semibold text-slate-900">
                    Uploaded AI Map Layout: {uploadedLayoutPreview.title}
                  </span>
                  <span className="text-slate-500 ml-1.5">
                    ·{' '}
                    {uploadedLayoutPreview.status === 'pending'
                      ? 'Pending Admin Verification'
                      : 'Local AI Preview'}
                  </span>
                </div>
              </>
            ) : activeVerifiedLayout ? (
              <>
                <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0" />
                <div className="min-w-0">
                  <span className="font-semibold text-slate-900">
                    Admin-Verified Map Layout: {activeVerifiedLayout.title}
                  </span>
                  <span className="text-slate-500 ml-1.5">
                    · Verified by {activeVerifiedLayout.reviewedBy || 'Administrator'}
                  </span>
                </div>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-blue-700 shrink-0" />
                <div className="min-w-0">
                  <span className="font-semibold text-slate-900">
                    AI Map Layout Ready: {uploadedLayoutPreview?.title}
                  </span>
                  <span className="text-slate-500 ml-1.5">
                    · Switch tabs to inspect the extracted layout
                  </span>
                </div>
              </>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg w-fit">
              <button
                type="button"
                onClick={() => setMapViewMode('interactive')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                  mapViewMode === 'interactive'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Interactive Map
              </button>
              {uploadedLayoutPreview && (
                <button
                  type="button"
                  onClick={() => setMapViewMode('uploaded')}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                    mapViewMode === 'uploaded'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Uploaded AI Layout
                </button>
              )}
              {activeVerifiedLayout && (
                <button
                  type="button"
                  onClick={() => setMapViewMode('verified')}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                    mapViewMode === 'verified'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Verified Blueprint
                </button>
              )}
            </div>

            {uploadedLayoutPreview && (
              <button
                type="button"
                onClick={() => {
                  setUploadedLayoutPreview(null);
                  setShowSourceImage(false);
                  if (mapViewMode === 'uploaded') {
                    setMapViewMode('interactive');
                  }
                }}
                aria-label="Clear uploaded layout preview"
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Active Route Preview Strip (when a route overlay is active on Campus Map) */}
      {routeTargetBuilding && (
        <div className="bg-blue-950 text-white rounded-xl px-4 py-3 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs">
            <span className="inline-flex items-center gap-1.5 font-semibold text-blue-200">
              <Route className="w-4 h-4 text-blue-300 shrink-0" />
              Active Pathfinding Overlay
            </span>
            <span aria-hidden="true" className="text-blue-700 hidden sm:inline">
              ·
            </span>
            <label className="inline-flex items-center gap-1.5 text-blue-100">
              <span className="text-blue-300">From:</span>
              <select
                value={navStartNodeId}
                onChange={(e) => setNavStartNodeId(e.target.value)}
                aria-label="Current starting location"
                className="bg-blue-900/90 border border-blue-700 text-white text-xs rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                {startLocationOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
            <span className="text-blue-300">→</span>
            <span className="font-semibold text-white">
              {routeTargetBuilding.code} · {routeTargetBuilding.shortName}
            </span>
            {previewRoute ? (
              <span className="text-blue-200 font-mono tabular-nums">
                ({previewRoute.totalDistanceMeters} m · {previewRoute.estimatedMinutes} min walk)
              </span>
            ) : (
              <span className="text-amber-300">
                Select a different starting location to view the path
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => navigateToBuilding(routeTargetBuilding.id, navStartNodeId)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-lg transition-colors whitespace-nowrap"
            >
              <Navigation className="w-3.5 h-3.5" />
              Full Directions
            </button>
            <button
              type="button"
              onClick={() => setRouteTargetBuildingId(null)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-blue-900 hover:bg-blue-800 border border-blue-700 text-blue-100 text-xs font-medium rounded-lg transition-colors whitespace-nowrap"
            >
              <X className="w-3.5 h-3.5" />
              Clear Route
            </button>
          </div>
        </div>
      )}

      {/* Map + Inspection Split */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        <div className="xl:col-span-8 space-y-4">
          {mapViewMode === 'uploaded' && uploadedLayoutPreview ? (
            <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="font-semibold text-slate-900 flex items-center gap-1.5 min-w-0">
                  <Sparkles className="w-4 h-4 text-blue-700 shrink-0" />
                  <span className="truncate">{uploadedLayoutPreview.title}</span>
                </div>
                <div className="flex items-center gap-2.5 shrink-0">
                  {uploadedLayoutPreview.sourceImageDataUrl && (
                    <button
                      type="button"
                      onClick={() => setShowSourceImage((prev) => !prev)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-blue-800 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 cursor-pointer"
                    >
                      <ImageIcon className="w-3 h-3" />
                      {showSourceImage ? 'Hide Source Image' : 'Compare Source Image'}
                    </button>
                  )}
                  <span className="text-slate-500 font-mono">
                    {uploadedLayoutPreview.status === 'pending'
                      ? 'Queued for Admin Review'
                      : 'AI Preview'}
                  </span>
                </div>
              </div>

              {uploadedLayoutPreview.aiAssessment && (
                <div
                  className={`px-4 py-2.5 border-b border-slate-200 text-xs flex items-start gap-2 ${
                    uploadedLayoutPreview.isCampusOrFloorMap === false
                      ? 'bg-red-50/70 text-red-900'
                      : 'bg-blue-50/40 text-slate-700'
                  }`}
                >
                  {uploadedLayoutPreview.isCampusOrFloorMap === false ? (
                    <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  ) : (
                    <Sparkles className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
                  )}
                  <div className="leading-relaxed">
                    <span className="font-semibold text-slate-900">AI Analysis: </span>
                    {uploadedLayoutPreview.aiAssessment}
                  </div>
                </div>
              )}

              <div className="p-4 bg-[#F4F7FB] space-y-4">
                {showSourceImage && uploadedLayoutPreview.sourceImageDataUrl && (
                  <div className="rounded-lg border border-slate-200 bg-white p-2">
                    <div className="text-[11px] font-medium text-slate-500 px-1 pb-1.5">
                      Uploaded Original Map Image
                    </div>
                    <img
                      src={uploadedLayoutPreview.sourceImageDataUrl}
                      alt={uploadedLayoutPreview.title}
                      className="w-full max-h-[260px] object-contain rounded bg-slate-100"
                    />
                  </div>
                )}

                {uploadedLayoutPreview.format === 'svg' ? (
                  <iframe
                    title={`Uploaded map layout: ${uploadedLayoutPreview.title}`}
                    sandbox=""
                    srcDoc={buildSandboxedSvgPreviewDoc(uploadedLayoutPreview.layoutContent)}
                    className="w-full h-[460px] sm:h-[520px] rounded-lg border border-slate-200 bg-white"
                  />
                ) : (
                  <ExtractedLayoutCanvas
                    layoutContent={uploadedLayoutPreview.layoutContent}
                    fileName={uploadedLayoutPreview.fileName}
                    title={uploadedLayoutPreview.title}
                    heightClass="h-[460px] sm:h-[520px]"
                  />
                )}
              </div>
            </div>
          ) : mapViewMode === 'verified' && activeVerifiedLayout ? (
            <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-700" />
                  {activeVerifiedLayout.title}
                </div>
                <span className="text-slate-500 font-mono">
                  {activeVerifiedLayout.fileName} · Verified
                </span>
              </div>
              <div className="p-4 bg-[#F4F7FB]">
                {activeVerifiedLayout.format === 'svg' ? (
                  <iframe
                    title={`Verified campus map layout: ${activeVerifiedLayout.title}`}
                    sandbox=""
                    srcDoc={buildSandboxedSvgPreviewDoc(activeVerifiedLayout.layoutContent)}
                    className="w-full h-[460px] sm:h-[520px] rounded-lg border border-slate-200 bg-white"
                  />
                ) : (
                  <ExtractedLayoutCanvas
                    layoutContent={activeVerifiedLayout.layoutContent}
                    fileName={activeVerifiedLayout.fileName}
                    title={activeVerifiedLayout.title}
                    heightClass="h-[460px] sm:h-[520px]"
                  />
                )}
              </div>
            </div>
          ) : (
          <InteractiveCampusMap
            buildings={buildings}
            nodes={mapNodes}
            routes={routes}
            locations={locations}
            roomStatuses={roomStatuses}
            landmarks={campusLandmarks}
            selectedLandmarkId={popupLandmarkId}
            onSelectLandmark={handleSelectLandmark}
            selectedBuildingId={selectedBuilding?.id ?? null}
            onSelectBuilding={handleSelectBuildingFootprint}
            selectedFloor={selectedFloor}
            onSelectFloor={setSelectedFloor}
            activeRoute={previewRoute}
            activeCategoryFilter={categoryFilter}
            popupOverlay={
              activePopupLandmark ? (
                <div
                  role="dialog"
                  aria-label={`Landmark details for ${activePopupLandmark.label}`}
                  className="absolute top-3 left-3 z-20 w-[calc(100%-4.5rem)] max-w-sm bg-white/98 backdrop-blur-xs border border-slate-200 rounded-xl shadow-lg p-4 text-left"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
                        <span className="font-mono font-semibold text-blue-700">
                          {activePopupBuilding ? activePopupBuilding.code : 'GATE'}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="capitalize">
                          {activePopupBuilding
                            ? activePopupBuilding.category
                            : 'Campus Entrance'}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>Demo Data</span>
                      </div>
                      <h3 className="font-display text-sm sm:text-base font-bold text-slate-900 mt-0.5 leading-snug">
                        {activePopupBuilding
                          ? activePopupBuilding.name
                          : activePopupLandmark.label}
                      </h3>
                    </div>

                    <button
                      type="button"
                      onClick={() => setPopupLandmarkId(null)}
                      aria-label="Close landmark pop-up"
                      className="p-1.5 -mr-1 -mt-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors shrink-0"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <p className="text-xs text-slate-600 mt-2 leading-relaxed line-clamp-3">
                    {activePopupBuilding
                      ? activePopupBuilding.description
                      : activePopupLandmark.description}
                  </p>

                  <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-slate-600">
                    {activePopupBuilding && (
                      <span className="inline-flex items-center gap-1 tabular-nums">
                        <Layers className="w-3.5 h-3.5 text-slate-400" />
                        {activePopupBuilding.floors} Floors · {activePopupRoomCount} spaces
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      {activePopupBuilding
                        ? activePopupBuilding.hours
                        : activePopupLandmark.hours}
                    </span>
                    {activePopupBuilding && (
                      <span className="inline-flex items-center gap-1">
                        <Accessibility className="w-3.5 h-3.5 text-slate-400" />
                        {activePopupBuilding.accessible
                          ? 'Step-free access'
                          : 'Stair access'}
                      </span>
                    )}
                  </div>

                  {activePopupBuilding && (
                    <div className="mt-3.5 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleToggleRoutePreview(activePopupBuilding.id)}
                        className={`flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                          routeTargetBuildingId === activePopupBuilding.id
                            ? 'bg-blue-600 text-white hover:bg-blue-700'
                            : 'bg-blue-900 text-white hover:bg-blue-800'
                        }`}
                      >
                        <Route className="w-3.5 h-3.5" />
                        {routeTargetBuildingId === activePopupBuilding.id
                          ? 'Hide Path'
                          : 'Show Path'}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          navigateToBuilding(activePopupBuilding.id, navStartNodeId)
                        }
                        className="px-3 py-2 bg-slate-50 text-slate-700 border border-slate-200 text-xs font-medium rounded-lg hover:bg-slate-100 transition-colors whitespace-nowrap inline-flex items-center gap-1"
                      >
                        <Navigation className="w-3.5 h-3.5" />
                        Directions
                      </button>
                    </div>
                  )}
                </div>
              ) : null
            }
          />
          )}

          {/* Quick Building Chips */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
            <div className="text-xs font-medium text-slate-500 mb-3">
              Select a Demonstration Building ({filteredBuildings.length})
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {filteredBuildings.map((b) => {
                const active = selectedBuilding?.id === b.id;
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => setSelectedBuildingId(b.id)}
                    className={`px-3 py-2 rounded-lg border text-left transition-colors ${
                      active
                        ? 'border-blue-600 bg-blue-50/70 text-blue-950'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="font-mono text-[11px] font-semibold text-blue-700">
                      {b.code}
                    </div>
                    <div className="text-xs font-semibold truncate mt-0.5">{b.shortName}</div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Building Inspection Panel */}
        <div className="xl:col-span-4 bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
          {selectedBuilding ? (
            <>
              <div className="p-6 border-b border-slate-200 bg-slate-50/60">
                <div className="flex items-center justify-between gap-2 text-xs text-slate-500 mb-1.5">
                  <span className="font-mono font-semibold text-blue-700">
                    {selectedBuilding.code}
                  </span>
                  <span>
                    {selectedBuilding.isDemo ? 'Demo Building Record' : 'Verified Building'}
                  </span>
                </div>
                <h2 className="font-display text-lg font-bold text-slate-900 leading-snug">
                  {selectedBuilding.name}
                </h2>
                <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                  {selectedBuilding.description}
                </p>

                <div className="mt-4 pt-4 border-t border-slate-200 grid grid-cols-2 gap-3 text-xs text-slate-600">
                  <div className="flex items-center gap-2">
                    <Layers className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="tabular-nums">{selectedBuilding.floors} Floors</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">{selectedBuilding.hours}</span>
                  </div>
                  <div className="flex items-center gap-2 col-span-2">
                    <Accessibility className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>
                      {selectedBuilding.accessible
                        ? 'Ramp & step-free entrance available'
                        : 'Stairway access only at main entrance'}
                    </span>
                  </div>
                </div>

                <div className="mt-5 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleToggleRoutePreview(selectedBuilding.id)}
                    className={`flex-1 inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                      routeTargetBuildingId === selectedBuilding.id
                        ? 'bg-blue-600 text-white hover:bg-blue-700'
                        : 'bg-blue-900 text-white hover:bg-blue-800'
                    }`}
                  >
                    <Route className="w-3.5 h-3.5" />
                    {routeTargetBuildingId === selectedBuilding.id
                      ? 'Hide Route on Map'
                      : 'Show Route on Map'}
                  </button>
                  <button
                    type="button"
                    onClick={() => navigateToBuilding(selectedBuilding.id, navStartNodeId)}
                    className="px-3.5 py-2.5 bg-white text-slate-700 border border-slate-200 text-xs font-medium rounded-lg hover:bg-slate-100 transition-colors whitespace-nowrap inline-flex items-center gap-1.5"
                  >
                    <Navigation className="w-3.5 h-3.5" />
                    Directions
                  </button>
                </div>
              </div>

              <div className="p-6">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    {selectedFloor === 'all'
                      ? `Mapped Spaces (${visibleBuildingLocations.length})`
                      : `${formatFloorLabel(selectedFloor)} (${visibleBuildingLocations.length})`}
                  </h3>
                  {selectedFloor !== 'all' && (
                    <button
                      type="button"
                      onClick={() => setSelectedFloor('all')}
                      className="text-xs font-medium text-blue-700 hover:underline whitespace-nowrap"
                    >
                      Show all floors
                    </button>
                  )}
                </div>

                {visibleBuildingLocations.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-500">
                    <Building2 className="w-6 h-6 mx-auto mb-2 text-slate-300" />
                    {selectedFloor !== 'all' && buildingLocations.length > 0 ? (
                      <div className="space-y-2">
                        <p>
                          No rooms mapped on {formatFloorLabel(selectedFloor)} in{' '}
                          {selectedBuilding.shortName}.
                        </p>
                        <button
                          type="button"
                          onClick={() => setSelectedFloor('all')}
                          className="text-blue-700 font-medium hover:underline"
                        >
                          View all {buildingLocations.length} spaces in this building
                        </button>
                      </div>
                    ) : (
                      'No rooms or facilities registered in this building yet.'
                    )}
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {visibleBuildingLocations.map((loc) => {
                      const status = statusByLocationId.get(loc.id);
                      return (
                        <div key={loc.id} className="py-3 first:pt-0 last:pb-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="text-sm font-medium text-slate-900 truncate">
                                {loc.name}
                              </div>
                              <div className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                                <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                                <span className="font-mono text-slate-700">{loc.roomNumber}</span>
                                <span aria-hidden="true">·</span>
                                <span>Floor {loc.floor}</span>
                                <span aria-hidden="true">·</span>
                                <span className="capitalize">{loc.category}</span>
                              </div>
                            </div>
                            {status && (
                              <span
                                className={`text-xs font-medium whitespace-nowrap ${
                                  status === 'available'
                                    ? 'text-emerald-700'
                                    : status === 'occupied'
                                    ? 'text-red-700'
                                    : 'text-amber-700'
                                }`}
                              >
                                {status === 'available'
                                  ? 'Available'
                                  : status === 'occupied'
                                  ? 'Occupied'
                                  : 'Unknown'}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          ) : null}
        </div>
      </div>
      <MapLayoutUploadModal
        open={uploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
        onPreviewExtracted={(preview) => {
          setUploadedLayoutPreview(preview);
          setShowSourceImage(false);
          setMapViewMode('uploaded');
          if (preview.status === 'preview') {
            setUploadNotice(
              `AI extracted "${preview.title}" and displayed the interactive map layout below.`
            );
          }
        }}
        onSubmitted={(title) =>
          setUploadNotice(
            `Uploaded "${title}" — now displayed on the Campus Map and queued for administrator verification.`
          )
        }
      />
    </div>
  );
}
