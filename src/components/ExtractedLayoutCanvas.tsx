import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Layers,
  MapPin,
  RotateCcw,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import {
  analyzeMapLayout,
  type ParsedJsonBuilding,
} from '../utils/mapLayoutValidator';

interface ExtractedLayoutCanvasProps {
  layoutContent: string;
  fileName: string;
  title?: string;
  heightClass?: string;
  compact?: boolean;
}

const CATEGORY_PALETTE: Record<
  string,
  { fill: string; stroke: string; header: string; label: string }
> = {
  academic: {
    fill: '#EFF6FF',
    stroke: '#2563EB',
    header: '#1D4ED8',
    label: 'Academic',
  },
  labs: {
    fill: '#F0F9FF',
    stroke: '#0284C7',
    header: '#0369A1',
    label: 'Labs',
  },
  admin: {
    fill: '#EEF2FF',
    stroke: '#1E3A8A',
    header: '#0F2557',
    label: 'Admin',
  },
  facilities: {
    fill: '#F8FAFC',
    stroke: '#475569',
    header: '#334155',
    label: 'Facilities',
  },
  sports: {
    fill: '#ECFDF5',
    stroke: '#059669',
    header: '#047857',
    label: 'Sports',
  },
};

function getPalette(category?: string) {
  return CATEGORY_PALETTE[category ?? 'academic'] ?? CATEGORY_PALETTE.academic;
}

function splitNameLines(name: string, maxCharsPerLine: number): string[] {
  const words = name.trim().split(/\s+/);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    if (!current) {
      current = word;
    } else if ((current + ' ' + word).length <= maxCharsPerLine) {
      current = `${current} ${word}`;
    } else {
      lines.push(current);
      current = word;
      if (lines.length === 1) break;
    }
  }
  if (current && lines.length < 2) {
    lines.push(current);
  }
  return lines.map((line) =>
    line.length > maxCharsPerLine + 2 ? `${line.slice(0, maxCharsPerLine)}…` : line
  );
}

export function ExtractedLayoutCanvas({
  layoutContent,
  fileName,
  title,
  heightClass = 'h-[420px]',
  compact = false,
}: ExtractedLayoutCanvasProps) {
  const [zoom, setZoom] = useState(1);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const report = useMemo(
    () => analyzeMapLayout(layoutContent, 'json', fileName),
    [layoutContent, fileName]
  );

  const buildings = report.parsedJsonBuildings;
  const walkways = report.parsedJsonWalkways;
  const landmarks = report.parsedJsonLandmarks;

  const selectedBuilding: ParsedJsonBuilding | null =
    selectedIndex !== null && buildings[selectedIndex] ? buildings[selectedIndex] : null;

  const handleZoomIn = () => setZoom((z) => Math.min(2.4, Number((z + 0.2).toFixed(2))));
  const handleZoomOut = () => setZoom((z) => Math.max(0.6, Number((z - 0.2).toFixed(2))));
  const handleReset = () => setZoom(1);

  if (buildings.length === 0) {
    return (
      <div
        className={`w-full ${heightClass} rounded-lg border border-slate-200 bg-white flex flex-col items-center justify-center p-6 text-center space-y-2.5`}
      >
        <AlertTriangle className="w-7 h-7 text-amber-600" />
        <div className="text-xs font-semibold text-slate-900">
          {report.aiAnalysis && !report.aiAnalysis.isCampusOrFloorMap
            ? 'No Campus or Floor Layout Detected in Image'
            : 'No Plottable Building Footprints Found'}
        </div>
        <p className="text-xs text-slate-500 max-w-md leading-relaxed">
          {report.aiAnalysis?.legitimacyAssessment ||
            'The structured layout JSON did not contain valid building coordinate rectangles within the 1000 × 660 canvas bounds.'}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
      {/* Canvas Area */}
      <div className={`relative w-full ${heightClass} bg-[#F4F7FB] overflow-auto`}>
        {/* Zoom Controls */}
        <div className="sticky top-2.5 left-0 right-0 z-10 pointer-events-none flex justify-end px-2.5 h-0">
          <div className="pointer-events-auto inline-flex items-center gap-0.5 bg-white/95 backdrop-blur-xs border border-slate-200 rounded-lg shadow-xs p-1 h-8">
            <button
              type="button"
              onClick={handleZoomOut}
              disabled={zoom <= 0.6}
              aria-label="Zoom out layout"
              className="p-1 rounded text-slate-600 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="px-1.5 text-[11px] font-mono font-semibold text-slate-700 tabular-nums min-w-[42px] text-center">
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              onClick={handleZoomIn}
              disabled={zoom >= 2.4}
              aria-label="Zoom in layout"
              className="p-1 rounded text-slate-600 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handleReset}
              aria-label="Reset zoom"
              className="p-1 rounded text-slate-500 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* SVG Architectural Sheet */}
        <div
          className="w-full h-full flex items-center justify-center p-2"
          style={{
            minWidth: zoom > 1 ? `${Math.round(zoom * 100)}%` : '100%',
            minHeight: zoom > 1 ? `${Math.round(zoom * 100)}%` : '100%',
          }}
        >
          <svg
            viewBox="0 0 1000 660"
            className="w-full h-full max-w-full max-h-full select-none"
            role="img"
            aria-label={title ? `Extracted map layout for ${title}` : 'Extracted campus map layout'}
          >
            <defs>
              <pattern
                id="extracted-grid-pattern"
                width="40"
                height="40"
                patternUnits="userSpaceOnUse"
              >
                <path
                  d="M 40 0 L 0 0 0 40"
                  fill="none"
                  stroke="#E2E8F0"
                  strokeWidth="0.8"
                />
              </pattern>
            </defs>

            {/* Outer sheet background */}
            <rect x="0" y="0" width="1000" height="660" fill="#F4F7FB" />
            <rect
              x="20"
              y="20"
              width="960"
              height="620"
              rx="10"
              fill="#FFFFFF"
              stroke="#CBD5E1"
              strokeWidth="1.5"
            />
            <rect
              x="20"
              y="20"
              width="960"
              height="620"
              rx="10"
              fill="url(#extracted-grid-pattern)"
              opacity="0.55"
            />

            {/* Architectural Header Stamp */}
            {!compact && (
              <g>
                <text
                  x="38"
                  y="44"
                  fill="#0F2557"
                  fontSize="11"
                  fontWeight="700"
                  fontFamily="Plus Jakarta Sans, sans-serif"
                  letterSpacing="0.06em"
                >
                  {(title || fileName).toUpperCase().slice(0, 68)}
                </text>
                <text
                  x="962"
                  y="44"
                  textAnchor="end"
                  fill="#64748B"
                  fontSize="10"
                  fontWeight="600"
                  fontFamily="JetBrains Mono, monospace"
                >
                  N ↑ · VECTOR LAYOUT (1000×660)
                </text>
              </g>
            )}

            {/* Walkways / Roads / Corridors */}
            {walkways.map((w, idx) => {
              const midX = (w.fromX + w.toX) / 2;
              const midY = (w.fromY + w.toY) / 2;
              return (
                <g key={`walkway-${idx}`}>
                  <line
                    x1={w.fromX}
                    y1={w.fromY}
                    x2={w.toX}
                    y2={w.toY}
                    stroke="#CBD5E1"
                    strokeWidth="11"
                    strokeLinecap="round"
                  />
                  <line
                    x1={w.fromX}
                    y1={w.fromY}
                    x2={w.toX}
                    y2={w.toY}
                    stroke="#FFFFFF"
                    strokeWidth="2"
                    strokeDasharray="6 6"
                    strokeLinecap="round"
                  />
                  {w.label && (
                    <text
                      x={midX}
                      y={midY - 8}
                      textAnchor="middle"
                      fill="#475569"
                      fontSize="9"
                      fontWeight="600"
                      fontFamily="Inter, sans-serif"
                    >
                      {w.label.slice(0, 26)}
                    </text>
                  )}
                </g>
              );
            })}

            {/* Building Footprints */}
            {buildings.map((b, idx) => {
              const palette = getPalette(b.category);
              const isSelected = selectedIndex === idx;
              const headerHeight = Math.min(22, Math.max(16, b.height * 0.28));
              const maxChars = Math.max(10, Math.floor((b.width - 14) / 6.2));
              const nameLines = splitNameLines(b.name, maxChars);
              const bodyCenterY = b.y + headerHeight + (b.height - headerHeight) / 2;

              return (
                <g
                  key={`${b.code}-${idx}`}
                  onClick={() => setSelectedIndex(isSelected ? null : idx)}
                  className="cursor-pointer"
                  role="button"
                  tabIndex={0}
                  aria-label={`${b.code}: ${b.name}`}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedIndex(isSelected ? null : idx);
                    }
                  }}
                >
                  {/* Selection halo */}
                  {isSelected && (
                    <rect
                      x={b.x - 4}
                      y={b.y - 4}
                      width={b.width + 8}
                      height={b.height + 8}
                      rx="10"
                      fill="none"
                      stroke="#2563EB"
                      strokeWidth="2.5"
                      strokeDasharray="5 3"
                    />
                  )}

                  {/* Building base rectangle */}
                  <rect
                    x={b.x}
                    y={b.y}
                    width={b.width}
                    height={b.height}
                    rx="7"
                    fill={palette.fill}
                    stroke={isSelected ? '#0F2557' : palette.stroke}
                    strokeWidth={isSelected ? 2.5 : 1.75}
                  />

                  {/* Top code bar */}
                  <path
                    d={`M ${b.x + 7} ${b.y} H ${b.x + b.width - 7} Q ${b.x + b.width} ${b.y} ${b.x + b.width} ${b.y + 7} V ${b.y + headerHeight} H ${b.x} V ${b.y + 7} Q ${b.x} ${b.y} ${b.x + 7} ${b.y} Z`}
                    fill={palette.header}
                  />

                  <text
                    x={b.x + 8}
                    y={b.y + headerHeight / 2 + 3.5}
                    fill="#FFFFFF"
                    fontSize="10"
                    fontWeight="700"
                    fontFamily="JetBrains Mono, monospace"
                  >
                    {b.code.slice(0, 12)}
                  </text>

                  {b.width >= 95 && (
                    <text
                      x={b.x + b.width - 8}
                      y={b.y + headerHeight / 2 + 3.5}
                      textAnchor="end"
                      fill="#DBEAFE"
                      fontSize="9"
                      fontWeight="600"
                      fontFamily="JetBrains Mono, monospace"
                    >
                      {b.floors ?? 1}F
                    </text>
                  )}

                  {/* Building Name */}
                  {nameLines.length === 1 ? (
                    <text
                      x={b.x + b.width / 2}
                      y={bodyCenterY + 3.5}
                      textAnchor="middle"
                      fill="#0F172A"
                      fontSize="10.5"
                      fontWeight="600"
                      fontFamily="Plus Jakarta Sans, sans-serif"
                    >
                      {nameLines[0]}
                    </text>
                  ) : (
                    <>
                      <text
                        x={b.x + b.width / 2}
                        y={bodyCenterY - 2.5}
                        textAnchor="middle"
                        fill="#0F172A"
                        fontSize="10"
                        fontWeight="600"
                        fontFamily="Plus Jakarta Sans, sans-serif"
                      >
                        {nameLines[0]}
                      </text>
                      <text
                        x={b.x + b.width / 2}
                        y={bodyCenterY + 10.5}
                        textAnchor="middle"
                        fill="#334155"
                        fontSize="9.5"
                        fontWeight="500"
                        fontFamily="Plus Jakarta Sans, sans-serif"
                      >
                        {nameLines[1]}
                      </text>
                    </>
                  )}
                </g>
              );
            })}

            {/* Landmarks */}
            {landmarks.map((lm, idx) => (
              <g key={`landmark-${idx}`}>
                <circle
                  cx={lm.x}
                  cy={lm.y}
                  r="6"
                  fill="#0F2557"
                  stroke="#FFFFFF"
                  strokeWidth="2"
                />
                <rect
                  x={lm.x - Math.min(82, Math.max(40, lm.label.length * 3.4))}
                  y={lm.y + 9}
                  width={Math.min(164, Math.max(80, lm.label.length * 6.8))}
                  height="16"
                  rx="4"
                  fill="#0F2557"
                  opacity="0.92"
                />
                <text
                  x={lm.x}
                  y={lm.y + 20}
                  textAnchor="middle"
                  fill="#FFFFFF"
                  fontSize="9"
                  fontWeight="600"
                  fontFamily="Inter, sans-serif"
                >
                  {lm.label.slice(0, 24)}
                </text>
              </g>
            ))}
          </svg>
        </div>

        {/* Selected Building Inspector Pop-up */}
        {selectedBuilding && (
          <div className="absolute bottom-3 left-3 z-20 max-w-xs bg-white/98 backdrop-blur-xs border border-slate-200 rounded-lg shadow-md p-3 text-left">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-[11px] font-mono font-semibold text-blue-700">
                  {selectedBuilding.code} ·{' '}
                  <span className="capitalize font-sans text-slate-500">
                    {selectedBuilding.category ?? 'academic'}
                  </span>
                </div>
                <div className="text-xs font-bold text-slate-900 mt-0.5 leading-snug">
                  {selectedBuilding.name}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedIndex(null)}
                aria-label="Close block details"
                className="p-0.5 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="mt-2 pt-2 border-t border-slate-100 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-600 tabular-nums">
              <span className="inline-flex items-center gap-1">
                <Layers className="w-3 h-3 text-slate-400" />
                {selectedBuilding.floors ?? 1} Floor{(selectedBuilding.floors ?? 1) === 1 ? '' : 's'}
              </span>
              <span className="inline-flex items-center gap-1 font-mono text-[10px]">
                <MapPin className="w-3 h-3 text-slate-400" />
                ({selectedBuilding.x}, {selectedBuilding.y}) · {selectedBuilding.width}×
                {selectedBuilding.height}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Footer Legend & Metrics */}
      <div className="px-3.5 py-2 border-t border-slate-200 bg-white flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-600">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {Object.entries(CATEGORY_PALETTE).map(([key, style]) => (
            <span key={key} className="inline-flex items-center gap-1.5">
              <span
                className="w-2.5 h-2.5 rounded-[2px] border"
                style={{ backgroundColor: style.fill, borderColor: style.stroke }}
              />
              <span>{style.label}</span>
            </span>
          ))}
        </div>
        <div className="font-mono text-[11px] text-slate-500 tabular-nums">
          {buildings.length} block{buildings.length === 1 ? '' : 's'}
          {walkways.length > 0 ? ` · ${walkways.length} walkways` : ''}
          {landmarks.length > 0 ? ` · ${landmarks.length} landmarks` : ''}
          {' · '}Click a block to inspect
        </div>
      </div>
    </div>
  );
}
