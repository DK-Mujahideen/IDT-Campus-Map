import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  DoorOpen,
  HelpCircle,
  Lock,
  Navigation,
  Search,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { useCampus } from '../context/CampusContext';
import type { RoomAvailabilityState } from '../types/campus';

type StatusFilter = RoomAvailabilityState | 'all';

export function RoomAvailabilityPage() {
  const {
    buildings,
    locations,
    roomStatuses,
    isAdmin,
    isFirestoreBacked,
    signInWithGoogle,
    updateRoomStatus,
    navigateToLocation,
  } = useCampus();

  const [filter, setFilter] = useState<StatusFilter>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);

  const locationById = useMemo(() => {
    const map = new Map(locations.map((l) => [l.id, l]));
    return map;
  }, [locations]);

  const buildingById = useMemo(() => {
    const map = new Map(buildings.map((b) => [b.id, b]));
    return map;
  }, [buildings]);

  const counts = useMemo(() => {
    return {
      all: roomStatuses.length,
      available: roomStatuses.filter((r) => r.status === 'available').length,
      occupied: roomStatuses.filter((r) => r.status === 'occupied').length,
      unknown: roomStatuses.filter((r) => r.status === 'unknown').length,
    };
  }, [roomStatuses]);

  const filteredRooms = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return roomStatuses.filter((rs) => {
      if (filter !== 'all' && rs.status !== filter) return false;
      if (!q) return true;
      const loc = locationById.get(rs.locationId);
      const bldg = buildingById.get(rs.buildingId);
      return (
        rs.roomNumber.toLowerCase().includes(q) ||
        (loc?.name.toLowerCase().includes(q) ?? false) ||
        (bldg?.name.toLowerCase().includes(q) ?? false) ||
        (rs.note?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [roomStatuses, filter, searchTerm, locationById, buildingById]);

  const handleStatusChange = async (
    id: string,
    newStatus: RoomAvailabilityState,
    currentNote?: string
  ) => {
    setSavingId(id);
    try {
      await updateRoomStatus(id, newStatus, currentNote);
    } finally {
      setSavingId(null);
    }
  };

  const handleSaveNote = async (id: string, currentStatus: RoomAvailabilityState) => {
    setSavingId(id);
    try {
      await updateRoomStatus(id, currentStatus, noteDraft);
      setEditingNoteId(null);
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Status Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs font-medium text-slate-500">Available Now</div>
            <div className="font-display text-2xl font-bold text-emerald-700 tabular-nums mt-1">
              {counts.available}
            </div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs font-medium text-slate-500">Occupied / In Session</div>
            <div className="font-display text-2xl font-bold text-red-700 tabular-nums mt-1">
              {counts.occupied}
            </div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-red-50 text-red-700 flex items-center justify-center">
            <XCircle className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs font-medium text-slate-500">Status Unknown</div>
            <div className="font-display text-2xl font-bold text-amber-700 tabular-nums mt-1">
              {counts.unknown}
            </div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center">
            <HelpCircle className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter & Admin Sync Notice */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg">
          {(
            [
              { id: 'all', label: `All (${counts.all})` },
              { id: 'available', label: `Available (${counts.available})` },
              { id: 'occupied', label: `Occupied (${counts.occupied})` },
              { id: 'unknown', label: `Unknown (${counts.unknown})` },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                filter === tab.id
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search room or note..."
              className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          {isAdmin ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-800 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 whitespace-nowrap">
              <ShieldCheck className="w-4 h-4" />
              Admin Controls Active {isFirestoreBacked ? '(Firestore)' : '(Demo)'}
            </span>
          ) : (
            <button
              type="button"
              onClick={() => void signInWithGoogle()}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 border border-slate-200 bg-white rounded-lg px-3 py-2 hover:bg-slate-50 transition-colors whitespace-nowrap"
            >
              <Lock className="w-3.5 h-3.5 text-slate-400" />
              Admin Login to Update
            </button>
          )}
        </div>
      </div>

      {/* Room Status Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        {filteredRooms.length === 0 ? (
          <div className="p-12 text-center">
            <DoorOpen className="w-8 h-8 text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-medium text-slate-900">No rooms match this filter</p>
            <p className="text-xs text-slate-500 mt-1">
              Clear your search or select another availability state.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-4">Room</th>
                  <th className="py-3 px-4">Space &amp; Building</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Session / Status Note</th>
                  <th className="py-3 px-4 text-right">
                    {isAdmin ? 'Admin Controls' : 'Navigation'}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredRooms.map((rs) => {
                  const loc = locationById.get(rs.locationId);
                  const bldg = buildingById.get(rs.buildingId);
                  const isSaving = savingId === rs.id;

                  return (
                    <tr key={rs.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-4 font-mono text-xs font-semibold text-blue-900 whitespace-nowrap">
                        {rs.roomNumber}
                      </td>
                      <td className="py-3.5 px-4 min-w-[200px]">
                        <div className="font-medium text-slate-900">
                          {loc?.name ?? rs.roomNumber}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          {bldg ? `${bldg.shortName} (${bldg.code})` : rs.buildingId}
                          {loc ? ` · Floor ${loc.floor}` : ''}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {rs.status === 'available' && (
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                            <CheckCircle2 className="w-4 h-4" />
                            Available
                          </span>
                        )}
                        {rs.status === 'occupied' && (
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-700">
                            <XCircle className="w-4 h-4" />
                            Occupied
                          </span>
                        )}
                        {rs.status === 'unknown' && (
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700">
                            <HelpCircle className="w-4 h-4" />
                            Unknown
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 min-w-[220px]">
                        {editingNoteId === rs.id && isAdmin ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={noteDraft}
                              onChange={(e) => setNoteDraft(e.target.value)}
                              maxLength={200}
                              className="flex-1 px-2.5 py-1.5 text-xs border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
                              placeholder="Enter note..."
                            />
                            <button
                              type="button"
                              disabled={isSaving}
                              onClick={() => void handleSaveNote(rs.id, rs.status)}
                              className="px-2.5 py-1.5 text-xs font-medium bg-blue-900 text-white rounded-md hover:bg-blue-800"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingNoteId(null)}
                              className="px-2 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-md"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs text-slate-600">
                              {rs.note || 'No status note recorded'}
                            </span>
                            {isAdmin && (
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingNoteId(rs.id);
                                  setNoteDraft(rs.note ?? '');
                                }}
                                className="text-xs font-medium text-blue-700 hover:underline shrink-0"
                              >
                                Edit note
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        {isAdmin ? (
                          <div className="inline-flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
                            {(
                              [
                                { val: 'available', label: 'Available' },
                                { val: 'occupied', label: 'Occupied' },
                                { val: 'unknown', label: 'Unknown' },
                              ] as const
                            ).map((opt) => (
                              <button
                                key={opt.val}
                                type="button"
                                disabled={isSaving}
                                onClick={() =>
                                  void handleStatusChange(rs.id, opt.val, rs.note)
                                }
                                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                                  rs.status === opt.val
                                    ? 'bg-white text-slate-900 shadow-xs'
                                    : 'text-slate-600 hover:text-slate-900'
                                }`}
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>
                        ) : loc ? (
                          <button
                            type="button"
                            onClick={() => navigateToLocation(loc)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-blue-900 rounded-lg hover:bg-blue-800 transition-colors"
                          >
                            <Navigation className="w-3 h-3" />
                            Directions
                          </button>
                        ) : null}
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
