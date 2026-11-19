import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Compass,
  Crosshair,
  Maximize2,
  Minus,
  Plus,
  RotateCcw,
} from 'lucide-react';
import type {
  Building,
  BuildingCategory,
  CalculatedRoute,
  LocationItem,
  MapNode,
  RoomStatusItem,
  RouteSegment,
} from '../types/campus';
import {
  FloorLevelSelector,
  formatFloorLabel,
  formatFloorShort,
  type FloorOption,
  type FloorSelection,
} from './FloorLevelSelector';

export interface CampusLandmark {
  id: string;
  label: string;
  shortTag: string;
  category: BuildingCategory | 'entrance';
  x: number;
  y: number;
  buildingId?: string;
  description: string;
  hours?: string;
}

interface InteractiveCampusMapProps {
  buildings: Building[];
  nodes: MapNode[];
  routes: RouteSegment[];
  locations?: LocationItem[];
  roomStatuses?: RoomStatusItem[];
  landmarks?: CampusLandmark[];
  selectedLandmarkId?: string | null;
  onSelectLandmark?: (landmark: CampusLandmark) => void;
  popupOverlay?: React.ReactNode;
  selectedBuildingId: string | null;
  onSelectBuilding?: (buildingId: string) => void;
  selectedFloor?: FloorSelection;
  onSelectFloor?: (floor: FloorSelection) => void;
  activeRoute?: CalculatedRoute | null;
  activeCategoryFilter?: BuildingCategory | 'all';
  heightClass?: string;
}

const CATEGORY_COLORS: Record<
  BuildingCategory,
  { fill: string; stroke: string; headerFill: string; label: string }
> = {
  academic: {
    fill: '#EFF6FF',
    stroke: '#1D4ED8',
    headerFill: '#1E3A8A',
    label: 'Academic',
  },
  labs: {
    fill: '#F0F9FF',
    stroke: '#0369A1',
    headerFill: '#0C4A6E',
    label: 'Labs & Workshops',
  },
  admin: {
    fill: '#EEF2FF',
    stroke: '#3730A3',
    headerFill: '#1E1B4B',
    label: 'Administration',
  },
  facilities: {
    fill: '#F8FAFC',
    stroke: '#334155',
    headerFill: '#0F172A',
    label: 'Campus Facilities',
  },
  sports: {
    fill: '#ECFDF5',
    stroke: '#047857',
    headerFill: '#064E3B',
    label: 'Sports & Grounds',
  },
};

const MIN_ZOOM = 0.6;
const MAX_ZOOM = 3.0;
const BASE_WIDTH = 1000;
const BASE_HEIGHT = 660;

function clampZoom(z: number): number {
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Number(z.toFixed(2))));
}

function clampPan(pan: { x: number; y: number }, zoom: number): { x: number; y: number } {
  // Allow panning all the way to map edges even at high zoom levels
  const maxX = Math.max(180, (BASE_WIDTH * (zoom - 0.5)) / (2 * zoom) + 120);
  const maxY = Math.max(140, (BASE_HEIGHT * (zoom - 0.5)) / (2 * zoom) + 100);
  return {
    x: Math.max(-maxX, Math.min(maxX, pan.x)),
    y: Math.max(-maxY, Math.min(maxY, pan.y)),
  };
}

export function InteractiveCampusMap({
  buildings,
  nodes,
  routes,
  locations = [],
  roomStatuses = [],
  landmarks = [],
  selectedLandmarkId = null,
  onSelectLandmark,
  popupOverlay,
  selectedBuildingId,
  onSelectBuilding,
  selectedFloor: controlledFloor,
  onSelectFloor,
  activeRoute,
  activeCategoryFilter = 'all',
  heightClass = 'h-[440px] sm:h-[540px]',
}: InteractiveCampusMapProps) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [hoveredLandmarkId, setHoveredLandmarkId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [internalFloor, setInternalFloor] = useState<FloorSelection>('all');
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mq.matches);
    const handler = (event: MediaQueryListEvent) => setPrefersReducedMotion(event.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const activeFloor = controlledFloor !== undefined ? controlledFloor : internalFloor;
  const handleFloorChange = useCallback(
    (nextFloor: FloorSelection) => {
      if (onSelectFloor) {
        onSelectFloor(nextFloor);
      } else {
        setInternalFloor(nextFloor);
      }
    },
    [onSelectFloor]
  );

  const buildingHasFloor = useCallback(
    (b: Building, floor: FloorSelection): boolean => {
      if (floor === 'all' || floor === 0) return true;
      if (floor < b.floors) return true;
      return locations.some((l) => l.buildingId === b.id && l.floor === floor);
    },
    [locations]
  );

  const floorOptions = useMemo<FloorOption[]>(() => {
    const highestBuildingFloor = buildings.reduce(
      (max, b) => Math.max(max, Math.max(0, b.floors - 1)),
      0
    );
    const highestLocationFloor = locations.reduce(
      (max, l) => Math.max(max, l.floor),
      0
    );
    const maxFloor = Math.min(10, Math.max(3, highestBuildingFloor, highestLocationFloor));
    const selectedBuilding = buildings.find((b) => b.id === selectedBuildingId) ?? null;

    const opts: FloorOption[] = [
      {
        value: 'all',
        shortLabel: 'All Floors',
        fullLabel: 'All Campus Floors',
        roomCount: locations.length,
        inSelectedBuilding: true,
      },
    ];

    for (let f = 0; f <= maxFloor; f++) {
      opts.push({
        value: f,
        shortLabel: formatFloorShort(f),
        fullLabel: formatFloorLabel(f),
        roomCount: locations.filter((l) => l.floor === f).length,
        inSelectedBuilding: selectedBuilding ? buildingHasFloor(selectedBuilding, f) : true,
      });
    }

    return opts;
  }, [buildings, locations, selectedBuildingId, buildingHasFloor]);

  const statusByLocationId = useMemo(() => {
    const map = new Map<string, string>();
    roomStatuses.forEach((rs) => map.set(rs.locationId, rs.status));
    return map;
  }, [roomStatuses]);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const activePointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchStateRef = useRef<{
    initialDistance: number;
    initialZoom: number;
    initialPan: { x: number; y: number };
    midpointSvg: { x: number; y: number };
  } | null>(null);
  const dragStartRef = useRef<{
    x: number;
    y: number;
    panX: number;
    panY: number;
    moved: boolean;
  } | null>(null);
  const zoomRef = useRef(zoom);
  const panRef = useRef(pan);
  zoomRef.current = zoom;
  panRef.current = pan;

  const nodeMap = useMemo(() => {
    const map = new Map<string, MapNode>();
    nodes.forEach((n) => map.set(n.id, n));
    return map;
  }, [nodes]);

  const activeRoutePathD = useMemo(() => {
    if (!activeRoute || activeRoute.nodes.length < 2) return '';
    return activeRoute.nodes
      .map((node, index) => `${index === 0 ? 'M' : 'L'} ${node.x} ${node.y}`)
      .join(' ');
  }, [activeRoute]);

  const routeBeaconDurationSec = useMemo(() => {
    if (!activeRoute) return 3.6;
    return Number(
      Math.max(2.4, Math.min(6.5, activeRoute.totalDistanceMeters / 55)).toFixed(1)
    );
  }, [activeRoute]);

  const applyZoomAtClientPoint = useCallback(
    (nextZoomRaw: number, clientX?: number, clientY?: number) => {
      const prevZoom = zoomRef.current;
      const nextZoom = clampZoom(nextZoomRaw);
      if (nextZoom === prevZoom) return;

      const svgEl = svgRef.current;
      if (svgEl && typeof clientX === 'number' && typeof clientY === 'number') {
        const rect = svgEl.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          // Normalized cursor position from center [-0.5, 0.5]
          const nx = (clientX - rect.left) / rect.width - 0.5;
          const ny = (clientY - rect.top) / rect.height - 0.5;
          const prevPan = panRef.current;
          // Shift pan so the world coordinate under the cursor remains stationary
          const deltaX = nx * BASE_WIDTH * (1 / nextZoom - 1 / prevZoom);
          const deltaY = ny * BASE_HEIGHT * (1 / nextZoom - 1 / prevZoom);
          setPan(clampPan({ x: prevPan.x + deltaX, y: prevPan.y + deltaY }, nextZoom));
          setZoom(nextZoom);
          return;
        }
      }

      setZoom(nextZoom);
      setPan((prev) => clampPan(prev, nextZoom));
    },
    []
  );

  const handleZoomIn = useCallback(() => {
    applyZoomAtClientPoint(zoomRef.current + 0.25);
  }, [applyZoomAtClientPoint]);

  const handleZoomOut = useCallback(() => {
    applyZoomAtClientPoint(zoomRef.current - 0.25);
  }, [applyZoomAtClientPoint]);

  const handleResetView = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  const handleCenterSelected = useCallback(() => {
    const selected = buildings.find((b) => b.id === selectedBuildingId);
    if (!selected) return;
    const targetZoom = Math.max(zoomRef.current, 1.5);
    const centerX = selected.x + selected.width / 2;
    const centerY = selected.y + selected.height / 2;
    setZoom(targetZoom);
    setPan(
      clampPan(
        {
          x: BASE_WIDTH / 2 - centerX,
          y: BASE_HEIGHT / 2 - centerY,
        },
        targetZoom
      )
    );
  }, [buildings, selectedBuildingId]);

  // Desktop mouse wheel / trackpad pinch zoom (non-passive to prevent page scroll)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const factor = e.ctrlKey ? -e.deltaY * 0.01 : -e.deltaY * 0.0018;
      const delta = Math.abs(factor) < 0.05 ? (e.deltaY < 0 ? 0.15 : -0.15) : factor;
      applyZoomAtClientPoint(zoomRef.current + delta, e.clientX, e.clientY);
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [applyZoomAtClientPoint]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === '+' || e.key === '=') {
      e.preventDefault();
      handleZoomIn();
    } else if (e.key === '-' || e.key === '_') {
      e.preventDefault();
      handleZoomOut();
    } else if (e.key === '0') {
      e.preventDefault();
      handleResetView();
    }
  };

  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (activePointersRef.current.size === 2) {
      const pts = Array.from(activePointersRef.current.values());
      const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
      const midX = (pts[0].x + pts[1].x) / 2;
      const midY = (pts[0].y + pts[1].y) / 2;
      pinchStateRef.current = {
        initialDistance: Math.max(10, dist),
        initialZoom: zoomRef.current,
        initialPan: panRef.current,
        midpointSvg: { x: midX, y: midY },
      };
      dragStartRef.current = null;
      setIsDragging(true);
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // Ignore synthetic events without pointer capture support
      }
      return;
    }

    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      panX: panRef.current.x,
      panY: panRef.current.y,
      moved: false,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (activePointersRef.current.has(e.pointerId)) {
      activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }

    // Two-finger mobile pinch-to-zoom
    if (activePointersRef.current.size === 2 && pinchStateRef.current) {
      const pts = Array.from(activePointersRef.current.values());
      const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
      const scaleRatio = dist / pinchStateRef.current.initialDistance;
      const targetZoom = clampZoom(pinchStateRef.current.initialZoom * scaleRatio);
      const midX = (pts[0].x + pts[1].x) / 2;
      const midY = (pts[0].y + pts[1].y) / 2;

      const svgEl = svgRef.current;
      const rect = svgEl?.getBoundingClientRect();
      const scaleFactor = rect && rect.width > 0 ? BASE_WIDTH / rect.width : 1;
      const panDx = ((midX - pinchStateRef.current.midpointSvg.x) * scaleFactor) / targetZoom;
      const panDy = ((midY - pinchStateRef.current.midpointSvg.y) * scaleFactor) / targetZoom;

      setZoom(targetZoom);
      setPan(
        clampPan(
          {
            x: pinchStateRef.current.initialPan.x + panDx,
            y: pinchStateRef.current.initialPan.y + panDy,
          },
          targetZoom
        )
      );
      return;
    }

    if (!isDragging || !dragStartRef.current) return;
    const rawDx = e.clientX - dragStartRef.current.x;
    const rawDy = e.clientY - dragStartRef.current.y;
    if (!dragStartRef.current.moved && Math.hypot(rawDx, rawDy) > 6) {
      dragStartRef.current.moved = true;
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // Ignore synthetic events without pointer capture support
      }
    }

    if (!dragStartRef.current.moved) return;

    const svgEl = svgRef.current;
    const rect = svgEl?.getBoundingClientRect();
    const scaleFactor = rect && rect.width > 0 ? BASE_WIDTH / rect.width : 1;
    const dx = (rawDx * scaleFactor) / zoomRef.current;
    const dy = (rawDy * scaleFactor) / zoomRef.current;

    setPan(
      clampPan(
        {
          x: dragStartRef.current.panX + dx,
          y: dragStartRef.current.panY + dy,
        },
        zoomRef.current
      )
    );
  };

  const handlePointerUpOrCancel = (e: React.PointerEvent<SVGSVGElement>) => {
    activePointersRef.current.delete(e.pointerId);
    if (activePointersRef.current.size < 2) {
      pinchStateRef.current = null;
    }
    if (activePointersRef.current.size === 0) {
      setIsDragging(false);
      // Keep moved flag briefly for click handler check, then clear
      setTimeout(() => {
        dragStartRef.current = null;
      }, 0);
    }
  };

  const handleCanvasDoubleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if ((e.target as HTMLElement).closest('[data-building-marker="true"]')) {
      return;
    }
    applyZoomAtClientPoint(zoomRef.current + 0.4, e.clientX, e.clientY);
  };

  const viewBoxW = BASE_WIDTH / zoom;
  const viewBoxH = BASE_HEIGHT / zoom;
  const viewBoxX = (BASE_WIDTH - viewBoxW) / 2 - pan.x;
  const viewBoxY = (BASE_HEIGHT - viewBoxH) / 2 - pan.y;

  return (
    <div
      tabIndex={0}
      onKeyDown={handleKeyDown}
      aria-label="Interactive campus map viewport. Use plus and minus keys or mouse wheel to zoom, and drag to pan."
      className="relative bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
    >
      {/* Top Overlay Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-slate-200 bg-slate-50/80">
        <div className="flex items-center gap-3 text-xs text-slate-600">
          <span className="font-semibold text-slate-900">
            Interactive Campus Map (Demonstration Layout)
          </span>
          <span aria-hidden="true" className="hidden sm:inline text-slate-300">
            |
          </span>
          <span className="hidden md:inline">
            Scroll, pinch, or use controls to zoom · Click any building to inspect
          </span>
        </div>

        <div className="flex items-center gap-1.5 ml-auto">
          <span className="font-mono text-xs font-medium text-slate-700 tabular-nums px-2 min-w-[48px] text-center">
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            onClick={handleZoomOut}
            disabled={zoom <= MIN_ZOOM}
            aria-label="Zoom out map"
            title="Zoom out (-)"
            className="min-w-[40px] min-h-[40px] sm:min-w-[36px] sm:min-h-[36px] inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 transition-colors disabled:opacity-40 disabled:pointer-events-none"
          >
            <Minus className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleZoomIn}
            disabled={zoom >= MAX_ZOOM}
            aria-label="Zoom in map"
            title="Zoom in (+)"
            className="min-w-[40px] min-h-[40px] sm:min-w-[36px] sm:min-h-[36px] inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 transition-colors disabled:opacity-40 disabled:pointer-events-none"
          >
            <Plus className="w-4 h-4" />
          </button>
          {selectedBuildingId && (
            <button
              type="button"
              onClick={handleCenterSelected}
              aria-label="Center and zoom on selected building"
              title="Focus selected building"
              className="hidden sm:inline-flex items-center gap-1.5 px-2.5 min-h-[36px] rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-100 transition-colors whitespace-nowrap"
            >
              <Crosshair className="w-3.5 h-3.5 text-blue-700" />
              Focus
            </button>
          )}
          <button
            type="button"
            onClick={handleResetView}
            aria-label="Reset map view"
            title="Reset zoom and pan (0)"
            className="inline-flex items-center gap-1.5 px-3 min-h-[40px] sm:min-h-[36px] rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-100 transition-colors whitespace-nowrap"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset
          </button>
        </div>
      </div>

      {/* Floor Level Selector */}
      <FloorLevelSelector
        options={floorOptions}
        selectedFloor={activeFloor}
        onSelectFloor={handleFloorChange}
        selectedBuildingName={
          buildings.find((b) => b.id === selectedBuildingId)?.shortName
        }
      />

      {/* SVG Canvas */}
      <div
        ref={containerRef}
        className={`relative w-full ${heightClass} bg-[#F4F7FB] touch-none`}
      >
        <svg
          ref={svgRef}
          viewBox={`${viewBoxX} ${viewBoxY} ${viewBoxW} ${viewBoxH}`}
          className={`w-full h-full touch-none ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUpOrCancel}
          onPointerCancel={handlePointerUpOrCancel}
          onDoubleClick={handleCanvasDoubleClick}
          role="img"
          aria-label="Demonstration interactive SVG campus map for MSAJCE Siruseri"
        >
          <defs>
            <pattern id="campus-grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path
                d="M 40 0 L 0 0 0 40"
                fill="none"
                stroke="#E2E8F0"
                strokeWidth="0.7"
              />
            </pattern>
            <filter id="bldg-shadow" x="-10%" y="-10%" width="120%" height="125%">
              <feDropShadow dx="0" dy="3" stdDeviation="4" floodColor="#0F172A" floodOpacity="0.08" />
            </filter>
          </defs>

          {/* Subtle blueprint grid */}
          <rect x="-200" y="-200" width="1400" height="1060" fill="url(#campus-grid)" />

          {/* Campus outer perimeter boundary */}
          <rect
            x="45"
            y="36"
            width="910"
            height="560"
            rx="16"
            fill="#FFFFFF"
            fillOpacity="0.65"
            stroke="#CBD5E1"
            strokeWidth="2"
          />

          {/* OMR Access Road along the South */}
          <rect x="45" y="608" width="910" height="36" rx="4" fill="#E2E8F0" />
          <line
            x1="55"
            y1="626"
            x2="945"
            y2="626"
            stroke="#FFFFFF"
            strokeWidth="2"
            strokeDasharray="14 10"
          />
          <text
            x="160"
            y="630"
            fill="#475569"
            fontSize="11"
            fontWeight="600"
            fontFamily="DM Sans, sans-serif"
          >
            OMR / Siruseri IT Park Approach Road (Demo)
          </text>

          {/* Visitor Parking Bay (South-West) */}
          <rect
            x="70"
            y="522"
            width="150"
            height="56"
            rx="6"
            fill="#F1F5F9"
            stroke="#CBD5E1"
            strokeWidth="1.2"
            strokeDasharray="4 3"
          />
          <text
            x="145"
            y="554"
            textAnchor="middle"
            fill="#64748B"
            fontSize="11"
            fontWeight="500"
          >
            Visitor Parking Zone
          </text>

          {/* Sports & Recreation Lawn (South-East) */}
          <rect
            x="775"
            y="512"
            width="155"
            height="66"
            rx="8"
            fill="#ECFDF5"
            stroke="#A7F3D0"
            strokeWidth="1.4"
          />
          <text
            x="852"
            y="549"
            textAnchor="middle"
            fill="#065F46"
            fontSize="11"
            fontWeight="600"
          >
            Sports Lawn (Demo)
          </text>

          {/* Central Quadrangle Landscaped Lawn */}
          <rect
            x="388"
            y="366"
            width="224"
            height="56"
            rx="10"
            fill="#ECFDF5"
            stroke="#BBF7D0"
            strokeWidth="1.2"
          />
          <text
            x="500"
            y="398"
            textAnchor="middle"
            fill="#047857"
            fontSize="11"
            fontWeight="600"
          >
            Central Quadrangle Lawn
          </text>

          {/* Trees / landscape accents around quadrangle */}
          {[
            [358, 376],
            [358, 412],
            [642, 376],
            [642, 412],
            [358, 200],
            [642, 200],
            [430, 584],
            [570, 584],
          ].map(([cx, cy], idx) => (
            <g key={`tree-${idx}`}>
              <circle cx={cx} cy={cy} r="9" fill="#D1FAE5" stroke="#6EE7B7" strokeWidth="1" />
              <circle cx={cx} cy={cy} r="4" fill="#34D399" />
            </g>
          ))}

          {/* Base Campus Footpaths (Route Segments) */}
          {routes.map((seg) => {
            const from = nodeMap.get(seg.fromNodeId);
            const to = nodeMap.get(seg.toNodeId);
            if (!from || !to) return null;
            return (
              <g key={seg.id}>
                <line
                  x1={from.x}
                  y1={from.y}
                  x2={to.x}
                  y2={to.y}
                  stroke="#CBD5E1"
                  strokeWidth="8"
                  strokeLinecap="round"
                />
                <line
                  x1={from.x}
                  y1={from.y}
                  x2={to.x}
                  y2={to.y}
                  stroke="#FFFFFF"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeDasharray={seg.accessible ? undefined : '5 5'}
                />
              </g>
            );
          })}

          {/* Walkway junction dots */}
          {nodes
            .filter((n) => !n.buildingId)
            .map((node) => (
              <circle
                key={node.id}
                cx={node.x}
                cy={node.y}
                r={node.id === 'node-gate' ? 6 : 3.5}
                fill={node.id === 'node-gate' ? '#0F2557' : '#94A3B8'}
                stroke="#FFFFFF"
                strokeWidth="1.5"
              />
            ))}

          {/* Main Gate Marker */}
          <g>
            <rect x="444" y="600" width="112" height="22" rx="4" fill="#0F2557" />
            <text
              x="500"
              y="615"
              textAnchor="middle"
              fill="#FFFFFF"
              fontSize="10.5"
              fontWeight="600"
            >
              MAIN GATE
            </text>
          </g>

          {/* Buildings */}
          {buildings.map((b) => {
            const palette = CATEGORY_COLORS[b.category] ?? CATEGORY_COLORS.academic;
            const isSelected = selectedBuildingId === b.id;
            const isHovered = hoveredId === b.id;
            const hasFloor = buildingHasFloor(b, activeFloor);
            const isDimmed =
              (activeCategoryFilter !== 'all' && b.category !== activeCategoryFilter) ||
              !hasFloor;

            const floorRooms =
              activeFloor === 'all'
                ? []
                : locations.filter(
                    (l) => l.buildingId === b.id && l.floor === activeFloor
                  );

            // Interior floorplan geometry inside building footprint
            const innerX = b.x + 8;
            const innerY = b.y + 32;
            const innerW = b.width - 16;
            const innerH = b.height - 40;
            const visibleRooms = floorRooms.slice(0, 3);
            const extraRoomsCount = Math.max(0, floorRooms.length - 3);

            return (
              <g
                key={b.id}
                data-building-marker="true"
                className="cursor-pointer transition-opacity duration-150"
                style={{ opacity: isDimmed ? 0.28 : 1 }}
                onClick={() => {
                  if (dragStartRef.current?.moved) return;
                  onSelectBuilding?.(b.id);
                }}
                onMouseEnter={() => setHoveredId(b.id)}
                onMouseLeave={() => setHoveredId(null)}
              >
                {/* Selection outer halo */}
                {isSelected && (
                  <rect
                    x={b.x - 5}
                    y={b.y - 5}
                    width={b.width + 10}
                    height={b.height + 10}
                    rx="12"
                    fill="none"
                    stroke="#2563EB"
                    strokeWidth="2.5"
                  />
                )}

                {/* Building footprint */}
                <rect
                  x={b.x}
                  y={b.y}
                  width={b.width}
                  height={b.height}
                  rx="8"
                  fill={activeFloor !== 'all' && hasFloor ? '#FFFFFF' : palette.fill}
                  stroke={isSelected || isHovered ? '#2563EB' : palette.stroke}
                  strokeWidth={isSelected ? 2.2 : 1.5}
                  strokeDasharray={!hasFloor ? '5 4' : undefined}
                  filter="url(#bldg-shadow)"
                />

                {/* Building top header band */}
                <rect
                  x={b.x}
                  y={b.y}
                  width={b.width}
                  height="26"
                  rx="8"
                  fill={palette.headerFill}
                />
                <rect
                  x={b.x}
                  y={b.y + 18}
                  width={b.width}
                  height="8"
                  fill={palette.headerFill}
                />

                {/* Building Code & Floors / Active Level */}
                <text
                  x={b.x + 10}
                  y={b.y + 17}
                  fill="#FFFFFF"
                  fontSize="11"
                  fontWeight="700"
                  fontFamily="JetBrains Mono, monospace"
                >
                  {b.code}
                </text>
                <text
                  x={b.x + b.width - 10}
                  y={b.y + 17}
                  textAnchor="end"
                  fill="#CBD5E1"
                  fontSize="10"
                  fontWeight="500"
                  fontFamily="DM Sans, sans-serif"
                >
                  {activeFloor === 'all'
                    ? `${b.floors}F`
                    : hasFloor
                    ? `${formatFloorShort(activeFloor)} · ${floorRooms.length} rm`
                    : `${b.floors}F only`}
                </text>

                {activeFloor === 'all' ? (
                  <>
                    {/* Exterior Overview View */}
                    <text
                      x={b.x + b.width / 2}
                      y={b.y + 50}
                      textAnchor="middle"
                      fill="#0F172A"
                      fontSize="12.5"
                      fontWeight="700"
                      fontFamily="Plus Jakarta Sans, sans-serif"
                    >
                      {b.shortName}
                    </text>

                    <text
                      x={b.x + b.width / 2}
                      y={b.y + 68}
                      textAnchor="middle"
                      fill="#475569"
                      fontSize="10"
                      fontWeight="500"
                    >
                      {palette.label}
                    </text>
                  </>
                ) : !hasFloor ? (
                  <>
                    {/* Building does not reach this floor */}
                    <text
                      x={b.x + b.width / 2}
                      y={b.y + 50}
                      textAnchor="middle"
                      fill="#475569"
                      fontSize="11.5"
                      fontWeight="600"
                      fontFamily="Plus Jakarta Sans, sans-serif"
                    >
                      {b.shortName}
                    </text>
                    <text
                      x={b.x + b.width / 2}
                      y={b.y + 67}
                      textAnchor="middle"
                      fill="#64748B"
                      fontSize="9.5"
                      fontWeight="500"
                    >
                      No {formatFloorShort(activeFloor)} Floor
                    </text>
                  </>
                ) : floorRooms.length > 0 ? (
                  <g>
                    {/* Interior Architectural Floorplan Partitions */}
                    <rect
                      x={innerX}
                      y={innerY}
                      width={innerW}
                      height={innerH}
                      rx="4"
                      fill="#F8FAFC"
                      stroke="#CBD5E1"
                      strokeWidth="0.9"
                    />
                    {/* Corridor Spine */}
                    <line
                      x1={innerX + 4}
                      y1={innerY + innerH - 11}
                      x2={innerX + innerW - 4}
                      y2={innerY + innerH - 11}
                      stroke="#E2E8F0"
                      strokeWidth="1"
                      strokeDasharray="3 2"
                    />
                    <text
                      x={b.x + b.width / 2}
                      y={innerY + innerH - 2}
                      textAnchor="middle"
                      fill="#64748B"
                      fontSize="8"
                      fontWeight="600"
                    >
                      {b.shortName}
                      {extraRoomsCount > 0 ? ` (+${extraRoomsCount} more)` : ''}
                    </text>

                    {/* Individual Room Cells */}
                    {visibleRooms.map((rm, idx) => {
                      const count = visibleRooms.length;
                      const gap = 4;
                      const cellW = (innerW - gap * (count + 1)) / count;
                      const cellX = innerX + gap + idx * (cellW + gap);
                      const cellY = innerY + 4;
                      const cellH = Math.max(18, innerH - 18);
                      const rmStatus = statusByLocationId.get(rm.id);
                      const cellFill =
                        rmStatus === 'available'
                          ? '#ECFDF5'
                          : rmStatus === 'occupied'
                          ? '#FEF2F2'
                          : rmStatus === 'unknown'
                          ? '#FFFBEB'
                          : '#EFF6FF';
                      const cellStroke =
                        rmStatus === 'available'
                          ? '#10B981'
                          : rmStatus === 'occupied'
                          ? '#EF4444'
                          : rmStatus === 'unknown'
                          ? '#F59E0B'
                          : '#93C5FD';

                      return (
                        <g key={rm.id}>
                          <rect
                            x={cellX}
                            y={cellY}
                            width={cellW}
                            height={cellH}
                            rx="3"
                            fill={cellFill}
                            stroke={cellStroke}
                            strokeWidth="1"
                          />
                          <text
                            x={cellX + cellW / 2}
                            y={cellY + cellH / 2 + 3}
                            textAnchor="middle"
                            fill="#0F172A"
                            fontSize={count >= 3 ? '8.5' : '9.5'}
                            fontWeight="700"
                            fontFamily="JetBrains Mono, monospace"
                          >
                            {rm.roomNumber}
                          </text>
                        </g>
                      );
                    })}
                  </g>
                ) : (
                  <g>
                    {/* Structural floor exists without specific mapped rooms */}
                    <rect
                      x={innerX}
                      y={innerY}
                      width={innerW}
                      height={innerH}
                      rx="4"
                      fill="#F8FAFC"
                      stroke="#CBD5E1"
                      strokeWidth="0.9"
                      strokeDasharray="3 3"
                    />
                    <text
                      x={b.x + b.width / 2}
                      y={innerY + innerH / 2 - 2}
                      textAnchor="middle"
                      fill="#0F172A"
                      fontSize="11"
                      fontWeight="600"
                      fontFamily="Plus Jakarta Sans, sans-serif"
                    >
                      {b.shortName}
                    </text>
                    <text
                      x={b.x + b.width / 2}
                      y={innerY + innerH / 2 + 12}
                      textAnchor="middle"
                      fill="#64748B"
                      fontSize="9"
                      fontWeight="500"
                    >
                      {formatFloorShort(activeFloor)} Floorplate
                    </text>
                  </g>
                )}
              </g>
            );
          })}

          {/* Active Calculated Route Pathfinding Overlay */}
          {activeRoutePathD && activeRoute && (
            <g data-active-route-overlay="true" aria-label="Active navigation route overlay">
              {/* Outer soft royal-blue halo */}
              <path
                d={activeRoutePathD}
                fill="none"
                stroke="#93C5FD"
                strokeWidth="12"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity="0.45"
              />
              {/* Subtle solid contrast base track */}
              <path
                d={activeRoutePathD}
                fill="none"
                stroke="#1E3A8A"
                strokeWidth="5"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity="0.2"
              />
              {/* Animated dotted dash pathfinding pattern (period 12px = 1.5 + 10.5, matches -24px loop) */}
              <path
                d={activeRoutePathD}
                fill="none"
                stroke="#2563EB"
                strokeWidth="4.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray="1.5 10.5"
                className="animate-route-dash"
              />

              {/* Intermediate waypoint junction nodes */}
              {activeRoute.nodes.slice(1, -1).map((waypoint) => (
                <circle
                  key={`route-wp-${waypoint.id}`}
                  cx={waypoint.x}
                  cy={waypoint.y}
                  r="4.2"
                  fill="#FFFFFF"
                  stroke="#2563EB"
                  strokeWidth="2"
                />
              ))}

              {/* Animated directional guide beacon traveling from Start to Destination */}
              {!prefersReducedMotion && (
                <g pointerEvents="none">
                  <circle
                    r="6"
                    fill="#2563EB"
                    stroke="#FFFFFF"
                    strokeWidth="2"
                  />
                  <path d="M -2.2 -2.4 L 3.2 0 L -2.2 2.4 Z" fill="#FFFFFF" />
                  <animateMotion
                    key={activeRoutePathD}
                    dur={`${routeBeaconDurationSec}s`}
                    repeatCount="indefinite"
                    path={activeRoutePathD}
                    rotate="auto"
                  />
                </g>
              )}

              {/* Current Location / Start Pin */}
              {activeRoute.nodes[0] && (
                <g>
                  <circle
                    cx={activeRoute.nodes[0].x}
                    cy={activeRoute.nodes[0].y}
                    r="13.5"
                    fill="none"
                    stroke="#2563EB"
                    strokeWidth="2"
                    className="animate-route-origin-ring"
                  />
                  <circle
                    cx={activeRoute.nodes[0].x}
                    cy={activeRoute.nodes[0].y}
                    r="8.5"
                    fill="#0F2557"
                    stroke="#FFFFFF"
                    strokeWidth="2.5"
                  />
                  <circle
                    cx={activeRoute.nodes[0].x}
                    cy={activeRoute.nodes[0].y}
                    r="2.8"
                    fill="#93C5FD"
                  />
                  <rect
                    x={activeRoute.nodes[0].x - 34}
                    y={activeRoute.nodes[0].y - 33}
                    width="68"
                    height="17"
                    rx="4"
                    fill="#0F2557"
                  />
                  <text
                    x={activeRoute.nodes[0].x}
                    y={activeRoute.nodes[0].y - 21}
                    textAnchor="middle"
                    fill="#FFFFFF"
                    fontSize="9"
                    fontWeight="700"
                    fontFamily="DM Sans, sans-serif"
                  >
                    YOU · START
                  </text>
                </g>
              )}

              {/* Destination Pin */}
              {activeRoute.nodes[activeRoute.nodes.length - 1] && (
                <g>
                  <circle
                    cx={activeRoute.nodes[activeRoute.nodes.length - 1].x}
                    cy={activeRoute.nodes[activeRoute.nodes.length - 1].y}
                    r="10"
                    fill="#2563EB"
                    stroke="#FFFFFF"
                    strokeWidth="2.5"
                  />
                  <circle
                    cx={activeRoute.nodes[activeRoute.nodes.length - 1].x}
                    cy={activeRoute.nodes[activeRoute.nodes.length - 1].y}
                    r="3.2"
                    fill="#FFFFFF"
                  />
                  <rect
                    x={activeRoute.nodes[activeRoute.nodes.length - 1].x - 38}
                    y={activeRoute.nodes[activeRoute.nodes.length - 1].y - 33}
                    width="76"
                    height="17"
                    rx="4"
                    fill="#2563EB"
                  />
                  <text
                    x={activeRoute.nodes[activeRoute.nodes.length - 1].x}
                    y={activeRoute.nodes[activeRoute.nodes.length - 1].y - 21}
                    textAnchor="middle"
                    fill="#FFFFFF"
                    fontSize="9"
                    fontWeight="700"
                    fontFamily="DM Sans, sans-serif"
                  >
                    DESTINATION
                  </text>
                </g>
              )}
            </g>
          )}

          {/* Clickable SVG Landmark Pin Markers */}
          {landmarks.map((lm) => {
            const isSelectedLm = selectedLandmarkId === lm.id;
            const isHoveredLm = hoveredLandmarkId === lm.id;
            const pinFill = isSelectedLm
              ? '#2563EB'
              : lm.category === 'entrance'
              ? '#0F2557'
              : lm.category === 'labs'
              ? '#0369A1'
              : lm.category === 'admin'
              ? '#312E81'
              : lm.category === 'facilities'
              ? '#1E293B'
              : '#1D4ED8';

            return (
              <g
                key={lm.id}
                data-landmark-marker="true"
                transform={`translate(${lm.x}, ${lm.y})`}
                className="cursor-pointer"
                role="button"
                tabIndex={0}
                aria-label={`Landmark marker: ${lm.label}`}
                onClick={(e) => {
                  e.stopPropagation();
                  if (dragStartRef.current?.moved) return;
                  onSelectLandmark?.(lm);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    e.stopPropagation();
                    onSelectLandmark?.(lm);
                  }
                }}
                onMouseEnter={() => setHoveredLandmarkId(lm.id)}
                onMouseLeave={() => setHoveredLandmarkId(null)}
              >
                {/* Ground anchor shadow dot */}
                <ellipse cx="0" cy="1" rx="6" ry="2.2" fill="#0F172A" opacity="0.2" />

                {/* Selection outer ring */}
                {isSelectedLm && (
                  <circle
                    cx="0"
                    cy="-19"
                    r="15"
                    fill="none"
                    stroke="#2563EB"
                    strokeWidth="2"
                    opacity="0.7"
                  />
                )}

                {/* SVG Teardrop Map Pin */}
                <g transform={isSelectedLm || isHoveredLm ? 'scale(1.12)' : 'scale(1)'}>
                  <path
                    d="M 0 0 C -7 -9 -11 -14 -11 -20 A 11 11 0 1 1 11 -20 C 11 -14 7 -9 0 0 Z"
                    fill={pinFill}
                    stroke="#FFFFFF"
                    strokeWidth="2"
                  />
                  <circle cx="0" cy="-20" r="5.5" fill="#FFFFFF" />
                  <text
                    x="0"
                    y="-17.5"
                    textAnchor="middle"
                    fill={pinFill}
                    fontSize="7"
                    fontWeight="800"
                    fontFamily="JetBrains Mono, monospace"
                  >
                    {lm.shortTag}
                  </text>
                </g>

                {/* Hover / Selected Label Callout */}
                {(isHoveredLm || isSelectedLm) && (
                  <g transform="translate(0, -37)">
                    <rect
                      x={-Math.max(46, lm.label.length * 3.1 + 12)}
                      y="-16"
                      width={Math.max(92, lm.label.length * 6.2 + 24)}
                      height="18"
                      rx="5"
                      fill="#0F172A"
                    />
                    <text
                      x="0"
                      y="-4"
                      textAnchor="middle"
                      fill="#FFFFFF"
                      fontSize="9.5"
                      fontWeight="600"
                      fontFamily="DM Sans, sans-serif"
                    >
                      {lm.label}
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </svg>

        {/* Optional Pop-up Info Card Overlay */}
        {popupOverlay}

        {/* Floating Touch-Friendly Zoom Dock (Bottom-Right on Mobile & Desktop) */}
        <div className="absolute top-3 right-3 flex flex-col gap-1.5 bg-white/95 border border-slate-200 rounded-xl p-1.5 shadow-sm">
          <button
            type="button"
            onClick={handleZoomIn}
            disabled={zoom >= MAX_ZOOM}
            aria-label="Zoom in"
            className="w-11 h-11 sm:w-9 sm:h-9 inline-flex items-center justify-center rounded-lg text-slate-700 hover:bg-slate-100 active:bg-slate-200 transition-colors disabled:opacity-40 disabled:pointer-events-none"
          >
            <Plus className="w-4 h-4" />
          </button>
          <div className="h-px bg-slate-200 mx-1" />
          <button
            type="button"
            onClick={handleZoomOut}
            disabled={zoom <= MIN_ZOOM}
            aria-label="Zoom out"
            className="w-11 h-11 sm:w-9 sm:h-9 inline-flex items-center justify-center rounded-lg text-slate-700 hover:bg-slate-100 active:bg-slate-200 transition-colors disabled:opacity-40 disabled:pointer-events-none"
          >
            <Minus className="w-4 h-4" />
          </button>
          <div className="h-px bg-slate-200 mx-1" />
          <button
            type="button"
            onClick={handleResetView}
            aria-label="Reset zoom"
            className="w-11 h-11 sm:w-9 sm:h-9 inline-flex items-center justify-center rounded-lg text-slate-700 hover:bg-slate-100 active:bg-slate-200 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>

        {/* Compass & Scale floating footer inside map */}
        <div className="pointer-events-none absolute bottom-3 left-3 right-3 flex items-center justify-between gap-2">
          <div className="pointer-events-auto inline-flex items-center gap-2 bg-white/95 border border-slate-200 rounded-lg px-3 py-1.5 shadow-xs text-xs text-slate-600">
            <Compass className="w-3.5 h-3.5 text-blue-800" />
            <span className="font-medium text-slate-800">N ↑</span>
            <span aria-hidden="true" className="text-slate-300">
              ·
            </span>
            <span className="font-mono tabular-nums">
              {Math.round(zoom * 100)}%
            </span>
          </div>

          <div className="hidden sm:flex items-center gap-4 bg-white/95 border border-slate-200 rounded-lg px-3 py-1.5 shadow-xs text-xs text-slate-600">
            {activeRoutePathD && activeRoute && (
              <span className="inline-flex items-center gap-1.5 font-medium text-blue-700 pr-2 border-r border-slate-200 tabular-nums">
                <svg width="20" height="8" viewBox="0 0 20 8" aria-hidden="true">
                  <line
                    x1="2"
                    y1="4"
                    x2="18"
                    y2="4"
                    stroke="#2563EB"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeDasharray="1 5"
                  />
                </svg>
                {activeRoute.totalDistanceMeters} m · {activeRoute.estimatedMinutes} min
              </span>
            )}
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-[#1E3A8A]" />
              Academic
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-[#0C4A6E]" />
              Labs
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-[#1E1B4B]" />
              Admin
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-[#0F172A]" />
              Facilities
            </span>
          </div>
        </div>
      </div>

      {/* Bottom notice */}
      <div className="px-4 py-2.5 border-t border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
        <span className="flex items-center gap-1.5">
          <Maximize2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          Drag to pan · Scroll, pinch, or double-click to zoom (60%–300%). Editable demonstration data.
        </span>
        <div className="flex items-center gap-2 sm:hidden">
          {selectedBuildingId && (
            <button
              type="button"
              onClick={handleCenterSelected}
              className="inline-flex items-center gap-1 font-medium text-blue-700"
            >
              <Crosshair className="w-3.5 h-3.5" />
              Focus Selected
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
