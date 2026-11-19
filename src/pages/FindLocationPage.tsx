import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  HelpCircle,
  MapPin,
  Navigation,
  Search,
  XCircle,
} from 'lucide-react';
import { useCampus } from '../context/CampusContext';
import type { LocationCategory, RoomAvailabilityState } from '../types/campus';

const LOCATION_CATEGORIES: Array<{ id: LocationCategory | 'all'; label: string }> = [
  { id: 'all', label: 'All Types' },
  { id: 'classroom', label: 'Classrooms' },
  { id: 'laboratory', label: 'Laboratories' },
  { id: 'department', label: 'Departments' },
  { id: 'office', label: 'Offices' },
  { id: 'facility', label: 'Facilities' },
];

export function FindLocationPage() {
  const {
    buildings,
    locations,
    roomStatuses,
    openBuildingOnMap,
    navigateToLocation,
  } = useCampus();

  const [queryText, setQueryText] = useState('');
  const [category, setCategory] = useState<LocationCategory | 'all'>('all');
  const [buildingFilter, setBuildingFilter] = useState<string>('all');

  const buildingMap = useMemo(() => {
    const map = new Map<string, { name: string; shortName: string; code: string }>();
    buildings.forEach((b) =>
      map.set(b.id, { name: b.name, shortName: b.shortName, code: b.code })
    );
    return map;
  }, [buildings]);

  const statusMap = useMemo(() => {
    const map = new Map<string, RoomAvailabilityState>();
    roomStatuses.forEach((rs) => map.set(rs.locationId, rs.status));
    return map;
  }, [roomStatuses]);

  const filteredLocations = useMemo(() => {
    const q = queryText.trim().toLowerCase();
    return locations.filter((loc) => {
      if (category !== 'all' && loc.category !== category) return false;
      if (buildingFilter !== 'all' && loc.buildingId !== buildingFilter) return false;
      if (!q) return true;
      const b = buildingMap.get(loc.buildingId);
      return (
        loc.name.toLowerCase().includes(q) ||
        loc.roomNumber.toLowerCase().includes(q) ||
        (loc.department ?? '').toLowerCase().includes(q) ||
        (loc.description ?? '').toLowerCase().includes(q) ||
        (b?.name.toLowerCase().includes(q) ?? false) ||
        (b?.code.toLowerCase().includes(q) ?? false)
      );
    });
  }, [locations, category, buildingFilter, queryText, buildingMap]);

  const renderStatus = (status?: RoomAvailabilityState) => {
    if (!status) {
      return <span className="text-xs text-slate-400">Not tracked</span>;
    }
    if (status === 'available') {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700">
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
          Available
        </span>
      );
    }
    if (status === 'occupied') {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-red-700">
          <XCircle className="w-3.5 h-3.5 shrink-0" />
          Occupied
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700">
        <HelpCircle className="w-3.5 h-3.5 shrink-0" />
        Unknown
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Search and Filter Controls */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          <div className="md:col-span-7 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={queryText}
              onChange={(e) => setQueryText(e.target.value)}
              placeholder="Search by room number (B-201), department (CSE), or facility name..."
              className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div className="md:col-span-5">
            <select
              value={buildingFilter}
              onChange={(e) => setBuildingFilter(e.target.value)}
              aria-label="Filter by building"
              className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              <option value="all">All Campus Buildings ({buildings.length})</option>
              {buildings.map((b) => (
                <option key={b.id} value={b.id}>
                  [{b.code}] {b.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg">
            {LOCATION_CATEGORIES.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setCategory(tab.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  category === tab.id
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="text-xs text-slate-500 tabular-nums">
            Showing <span className="font-semibold text-slate-900">{filteredLocations.length}</span>{' '}
            of {locations.length} demo directory entries
          </div>
        </div>
      </div>

      {/* Results Table / Directory */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        {filteredLocations.length === 0 ? (
          <div className="p-12 text-center">
            <MapPin className="w-8 h-8 text-slate-300 mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-slate-900">No matching locations found</h3>
            <p className="text-xs text-slate-500 mt-1 mb-4">
              Try clearing your search filter or switching to another building.
            </p>
            <button
              type="button"
              onClick={() => {
                setQueryText('');
                setCategory('all');
                setBuildingFilter('all');
              }}
              className="px-4 py-2 text-xs font-medium text-white bg-blue-900 rounded-lg hover:bg-blue-800 transition-colors"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-4">Room Code</th>
                  <th className="py-3 px-4">Location &amp; Department</th>
                  <th className="py-3 px-4">Building &amp; Floor</th>
                  <th className="py-3 px-4">Hours</th>
                  <th className="py-3 px-4">Room Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredLocations.map((loc) => {
                  const b = buildingMap.get(loc.buildingId);
                  return (
                    <tr key={loc.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 font-mono text-xs font-semibold text-blue-900 whitespace-nowrap">
                        {loc.roomNumber}
                      </td>
                      <td className="py-3.5 px-4 min-w-[220px]">
                        <div className="font-medium text-slate-900">{loc.name}</div>
                        <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5">
                          <span className="capitalize">{loc.category}</span>
                          {loc.department && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span>{loc.department}</span>
                            </>
                          )}
                          {typeof loc.capacity === 'number' && loc.capacity > 0 && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="tabular-nums">Cap {loc.capacity}</span>
                            </>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="text-slate-800 font-medium">
                          {b ? `${b.shortName} (${b.code})` : loc.buildingId}
                        </div>
                        <div className="text-xs text-slate-500 tabular-nums">
                          Floor {loc.floor}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-xs text-slate-600 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          {loc.hours}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {renderStatus(statusMap.get(loc.id))}
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => openBuildingOnMap(loc.buildingId)}
                            className="px-2.5 py-1.5 text-xs font-medium text-slate-700 border border-slate-200 bg-white rounded-lg hover:bg-slate-100 transition-colors"
                          >
                            Map
                          </button>
                          <button
                            type="button"
                            onClick={() => navigateToLocation(loc)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-white bg-blue-900 rounded-lg hover:bg-blue-800 transition-colors"
                          >
                            <Navigation className="w-3 h-3" />
                            Directions
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
