import React from 'react';
import { Layers } from 'lucide-react';

export type FloorSelection = number | 'all';

export interface FloorOption {
  value: FloorSelection;
  shortLabel: string;
  fullLabel: string;
  roomCount: number;
  inSelectedBuilding: boolean;
}

interface FloorLevelSelectorProps {
  options: FloorOption[];
  selectedFloor: FloorSelection;
  onSelectFloor: (floor: FloorSelection) => void;
  selectedBuildingName?: string;
}

export function formatFloorLabel(floor: number): string {
  if (floor === 0) return 'Ground Floor';
  if (floor === 1) return '1st Floor';
  if (floor === 2) return '2nd Floor';
  if (floor === 3) return '3rd Floor';
  return `${floor}th Floor`;
}

export function formatFloorShort(floor: number): string {
  if (floor === 0) return 'Ground';
  if (floor === 1) return '1st';
  if (floor === 2) return '2nd';
  if (floor === 3) return '3rd';
  return `${floor}th`;
}

export function FloorLevelSelector({
  options,
  selectedFloor,
  onSelectFloor,
  selectedBuildingName,
}: FloorLevelSelectorProps) {
  return (
    <div
      className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 border-b border-slate-200 bg-white"
      role="region"
      aria-label="Floor level selector"
    >
      <div className="flex items-center gap-2 text-xs text-slate-600">
        <Layers className="w-3.5 h-3.5 text-blue-800 shrink-0" />
        <span className="font-semibold text-slate-800 whitespace-nowrap">Floor Level</span>
        {selectedBuildingName && (
          <>
            <span aria-hidden="true" className="text-slate-300 hidden sm:inline">
              ·
            </span>
            <span className="hidden sm:inline text-slate-500 truncate max-w-[200px]">
              {selectedBuildingName}
            </span>
          </>
        )}
      </div>

      <div
        className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg overflow-x-auto max-w-full"
        role="group"
        aria-label="Select campus floor level"
      >
        {options.map((opt) => {
          const isActive = selectedFloor === opt.value;
          return (
            <button
              key={String(opt.value)}
              type="button"
              onClick={() => onSelectFloor(opt.value)}
              aria-pressed={isActive}
              title={
                opt.value === 'all'
                  ? 'Show all campus floors'
                  : `${opt.fullLabel} (${opt.roomCount} mapped spaces)`
              }
              className={`min-h-[36px] sm:min-h-[32px] px-2.5 sm:px-3 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 ${
                isActive
                  ? 'bg-blue-900 text-white shadow-xs'
                  : opt.inSelectedBuilding
                  ? 'text-slate-700 hover:text-slate-900 hover:bg-white/70'
                  : 'text-slate-400 hover:text-slate-700 hover:bg-white/50'
              }`}
            >
              <span>{opt.shortLabel}</span>
              {opt.value !== 'all' && (
                <span
                  className={`font-mono text-[10px] tabular-nums ${
                    isActive ? 'text-blue-200' : 'text-slate-400'
                  }`}
                >
                  {opt.roomCount}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
