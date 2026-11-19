import React, { useState } from 'react';
import {
  Building2,
  CheckCircle2,
  Database,
  Info,
  Lock,
  LogIn,
  MapPin,
  MessageSquare,
  Plus,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { AdminMapVerificationPanel } from '../components/AdminMapVerificationPanel';
import { MapLayoutUploadModal } from '../components/MapLayoutUploadModal';
import { useCampus } from '../context/CampusContext';
import type {
  Building,
  BuildingCategory,
  FeedbackItem,
  LocationCategory,
  LocationItem,
  RoomAvailabilityState,
} from '../types/campus';

type AdminTab =
  | 'map_verification'
  | 'buildings'
  | 'locations'
  | 'rooms'
  | 'campus_info'
  | 'feedback';

export function AdminDashboardPage() {
  const {
    user,
    isAdmin,
    authError,
    signInWithGoogle,
    openAuthPage,
    campusInfo,
    buildings,
    locations,
    roomStatuses,
    feedbackList,
    mapLayouts,
    isFirestoreBacked,
    isSyncingSeed,
    seedDemoDataToFirestore,
    saveBuilding,
    deleteBuilding,
    saveLocation,
    deleteLocation,
    updateRoomStatus,
    createRoomStatusForLocation,
    updateCampusInfo,
    updateFeedbackStatus,
  } = useCampus();

  const [tab, setTab] = useState<AdminTab>('map_verification');
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  const pendingLayoutCount = mapLayouts.filter((l) => l.status === 'pending').length;

  // Building Form
  const [bldgForm, setBldgForm] = useState<Building>({
    id: '',
    code: '',
    name: '',
    shortName: '',
    category: 'academic',
    floors: 2,
    description: '',
    x: 420,
    y: 120,
    width: 160,
    height: 85,
    entranceNodeId: 'node-north-plaza',
    hours: '08:30 AM – 05:00 PM',
    accessible: true,
    isDemo: true,
    visibility: 'public',
  });
  const [editingBuildingId, setEditingBuildingId] = useState<string | null>(null);

  // Location Form
  const [locForm, setLocForm] = useState<LocationItem>({
    id: '',
    name: '',
    buildingId: buildings[0]?.id ?? 'bldg-main',
    floor: 1,
    roomNumber: '',
    category: 'classroom',
    department: '',
    capacity: 60,
    hours: '08:30 AM – 05:00 PM',
    description: '',
    popular: false,
    isDemo: true,
    visibility: 'public',
  });
  const [editingLocationId, setEditingLocationId] = useState<string | null>(null);

  // Campus Info Form
  const [infoForm, setInfoForm] = useState({
    campusName: campusInfo.campusName,
    locationText: campusInfo.locationText,
    announcement: campusInfo.announcement,
    dataNotice: campusInfo.dataNotice,
  });

  if (!user || !isAdmin) {
    return (
      <div className="max-w-xl mx-auto mt-8 bg-white border border-slate-200 rounded-xl shadow-xs p-8">
        <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-900 flex items-center justify-center mb-5">
          <Lock className="w-6 h-6" />
        </div>
        <h2 className="font-display text-xl font-bold text-slate-900 mb-2">
          Administrator Authentication Required
        </h2>
        <p className="text-sm text-slate-600 leading-relaxed mb-6">
          Campus modifications—including adding buildings, editing room directories, updating
          room availability, and reviewing user feedback—are protected by Firebase Authentication
          and Firestore Security Rules.
        </p>

        {user && !isAdmin && (
          <div className="mb-5 p-3.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900">
            Signed in as <span className="font-semibold">{user.email}</span>. This account does
            not currently have administrator permissions in Firestore.
          </div>
        )}

        {authError && (
          <div className="mb-5 p-3.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800">
            {authError}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void signInWithGoogle()}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-900 text-white text-sm font-medium rounded-lg hover:bg-blue-800 transition-colors cursor-pointer"
          >
            <LogIn className="w-4 h-4" />
            Sign in with Google
          </button>
          <button
            type="button"
            onClick={() => openAuthPage('signin')}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-white text-slate-700 border border-slate-200 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
          >
            Open Sign In / Sign Up Page
          </button>
        </div>
      </div>
    );
  }

  const showMessage = (msg: string) => {
    setErrorBanner(null);
    setStatusBanner(msg);
    setTimeout(() => setStatusBanner(null), 4500);
  };

  const handleBuildingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorBanner(null);
    try {
      const id =
        editingBuildingId ||
        `bldg-${bldgForm.code.toLowerCase().replace(/[^a-z0-9]/g, '') || Date.now()}`;
      await saveBuilding({ ...bldgForm, id }, !editingBuildingId);
      showMessage(
        editingBuildingId
          ? `Updated building ${bldgForm.name}.`
          : `Added building ${bldgForm.name}.`
      );
      setEditingBuildingId(null);
      setBldgForm({
        ...bldgForm,
        id: '',
        code: '',
        name: '',
        shortName: '',
        description: '',
      });
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : 'Failed to save building.');
    }
  };

  const handleLocationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorBanner(null);
    try {
      const id =
        editingLocationId ||
        `loc-${locForm.roomNumber.toLowerCase().replace(/[^a-z0-9]/g, '') || Date.now()}`;
      await saveLocation({ ...locForm, id }, !editingLocationId);
      showMessage(
        editingLocationId
          ? `Updated location ${locForm.name}.`
          : `Added location ${locForm.name}.`
      );
      setEditingLocationId(null);
      setLocForm({
        ...locForm,
        id: '',
        name: '',
        roomNumber: '',
        description: '',
      });
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : 'Failed to save location.');
    }
  };

  const handleCampusInfoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorBanner(null);
    try {
      await updateCampusInfo(infoForm);
      showMessage('Campus information and announcements updated.');
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : 'Failed to update campus info.');
    }
  };

  const handleSeedFirestore = async () => {
    setErrorBanner(null);
    try {
      await seedDemoDataToFirestore();
      showMessage('Demonstration campus dataset synced to Firestore.');
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : 'Failed to seed Firestore.');
    }
  };

  const untrackedLocations = locations.filter(
    (loc) => !roomStatuses.some((rs) => rs.locationId === loc.id)
  );

  return (
    <div className="space-y-6">
      {/* Admin Header Card */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-900 text-white flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-display text-lg font-bold text-slate-900">
              Smart Campus Admin Console
            </h2>
            <p className="text-xs text-slate-600 mt-0.5">
              Authenticated as <span className="font-semibold">{user.email}</span> · Data source:{' '}
              <span className="font-semibold text-blue-800">
                {isFirestoreBacked ? 'Live Firestore Database' : 'Local Demo Dataset'}
              </span>
            </p>
          </div>
        </div>

        <button
          type="button"
          disabled={isSyncingSeed}
          onClick={() => void handleSeedFirestore()}
          className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 whitespace-nowrap shrink-0"
        >
          <Database className="w-4 h-4" />
          {isSyncingSeed
            ? 'Syncing to Firestore...'
            : isFirestoreBacked
            ? 'Reset / Re-sync Demo Data to Firestore'
            : 'Initialize Firestore with Demo Data'}
        </button>
      </div>

      {statusBanner && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl px-4 py-3 text-xs font-medium flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          {statusBanner}
        </div>
      )}

      {errorBanner && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-xl px-4 py-3 text-xs font-medium">
          {errorBanner}
        </div>
      )}

      {/* Admin Sub-Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-200/70 rounded-xl w-fit">
        {(
          [
            {
              id: 'map_verification',
              label:
                pendingLayoutCount > 0
                  ? `Map Verification (${pendingLayoutCount} pending)`
                  : `Map Verification (${mapLayouts.length})`,
            },
            { id: 'buildings', label: `Buildings (${buildings.length})` },
            { id: 'locations', label: `Locations (${locations.length})` },
            { id: 'rooms', label: `Room Status (${roomStatuses.length})` },
            { id: 'campus_info', label: 'Campus Info' },
            { id: 'feedback', label: `Feedback (${feedbackList.length})` },
          ] as const
        ).map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`px-3.5 py-2 text-xs font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
              tab === item.id
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Tab 0: Map Layout Legitimacy Verification */}
      {tab === 'map_verification' && (
        <AdminMapVerificationPanel
          onOpenUploadModal={() => setUploadModalOpen(true)}
          onStatusMessage={showMessage}
          onErrorMessage={(msg) => setErrorBanner(msg)}
        />
      )}

      {/* Tab 1: Buildings Management */}
      {tab === 'buildings' && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          <form
            onSubmit={handleBuildingSubmit}
            className="xl:col-span-5 bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4"
          >
            <h3 className="font-display text-base font-semibold text-slate-900 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-blue-800" />
              {editingBuildingId ? 'Edit Building' : 'Add Building'}
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Code</label>
                <input
                  type="text"
                  required
                  maxLength={16}
                  value={bldgForm.code}
                  onChange={(e) => setBldgForm({ ...bldgForm, code: e.target.value })}
                  placeholder="BLK-C"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Short Name
                </label>
                <input
                  type="text"
                  required
                  maxLength={40}
                  value={bldgForm.shortName}
                  onChange={(e) => setBldgForm({ ...bldgForm, shortName: e.target.value })}
                  placeholder="Research Wing"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Full Name</label>
              <input
                type="text"
                required
                maxLength={120}
                value={bldgForm.name}
                onChange={(e) => setBldgForm({ ...bldgForm, name: e.target.value })}
                placeholder="Innovation & Research Block C"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Category
                </label>
                <select
                  value={bldgForm.category}
                  onChange={(e) =>
                    setBldgForm({
                      ...bldgForm,
                      category: e.target.value as BuildingCategory,
                    })
                  }
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                >
                  <option value="academic">Academic</option>
                  <option value="labs">Labs &amp; Workshops</option>
                  <option value="admin">Administration</option>
                  <option value="facilities">Facilities</option>
                  <option value="sports">Sports</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Floors</label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={bldgForm.floors}
                  onChange={(e) =>
                    setBldgForm({ ...bldgForm, floors: Number(e.target.value) || 1 })
                  }
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
            </div>

            <div className="grid grid-cols-4 gap-2">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">SVG X</label>
                <input
                  type="number"
                  min={50}
                  max={900}
                  value={bldgForm.x}
                  onChange={(e) => setBldgForm({ ...bldgForm, x: Number(e.target.value) })}
                  className="w-full px-2.5 py-2 text-xs font-mono border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">SVG Y</label>
                <input
                  type="number"
                  min={40}
                  max={560}
                  value={bldgForm.y}
                  onChange={(e) => setBldgForm({ ...bldgForm, y: Number(e.target.value) })}
                  className="w-full px-2.5 py-2 text-xs font-mono border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Width</label>
                <input
                  type="number"
                  min={60}
                  max={360}
                  value={bldgForm.width}
                  onChange={(e) =>
                    setBldgForm({ ...bldgForm, width: Number(e.target.value) })
                  }
                  className="w-full px-2.5 py-2 text-xs font-mono border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Height</label>
                <input
                  type="number"
                  min={50}
                  max={240}
                  value={bldgForm.height}
                  onChange={(e) =>
                    setBldgForm({ ...bldgForm, height: Number(e.target.value) })
                  }
                  className="w-full px-2.5 py-2 text-xs font-mono border border-slate-300 rounded-lg"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Hours</label>
              <input
                type="text"
                required
                maxLength={80}
                value={bldgForm.hours}
                onChange={(e) => setBldgForm({ ...bldgForm, hours: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Description
              </label>
              <textarea
                required
                maxLength={600}
                rows={3}
                value={bldgForm.description}
                onChange={(e) => setBldgForm({ ...bldgForm, description: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>

            <div className="flex items-center justify-between gap-4">
              <label className="flex items-center gap-2 text-xs text-slate-700">
                <input
                  type="checkbox"
                  checked={bldgForm.accessible}
                  onChange={(e) =>
                    setBldgForm({ ...bldgForm, accessible: e.target.checked })
                  }
                />
                Accessible Entrance
              </label>
              <label className="flex items-center gap-2 text-xs text-slate-700">
                <input
                  type="checkbox"
                  checked={bldgForm.isDemo}
                  onChange={(e) => setBldgForm({ ...bldgForm, isDemo: e.target.checked })}
                />
                Mark as Demo Data
              </label>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-900 text-white text-xs font-medium rounded-lg hover:bg-blue-800"
              >
                <Plus className="w-3.5 h-3.5" />
                {editingBuildingId ? 'Update Building' : 'Save Building'}
              </button>
              {editingBuildingId && (
                <button
                  type="button"
                  onClick={() => setEditingBuildingId(null)}
                  className="px-3 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel Edit
                </button>
              )}
            </div>
          </form>

          <div className="xl:col-span-7 bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 text-sm font-semibold text-slate-900">
              Registered Buildings
            </div>
            <div className="divide-y divide-slate-100">
              {buildings.map((b) => (
                <div
                  key={b.id}
                  className="px-6 py-4 flex items-center justify-between gap-4 hover:bg-slate-50/70"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-900 truncate">
                      <span className="font-mono text-blue-700 mr-2">{b.code}</span>
                      {b.name}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5 tabular-nums">
                      {b.floors} Floors · SVG ({b.x}, {b.y}) · {b.isDemo ? 'Demo' : 'Verified'}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingBuildingId(b.id);
                        setBldgForm(b);
                      }}
                      className="px-2.5 py-1.5 text-xs font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-100"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => void deleteBuilding(b.id)}
                      aria-label={`Delete ${b.name}`}
                      className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Locations Management */}
      {tab === 'locations' && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          <form
            onSubmit={handleLocationSubmit}
            className="xl:col-span-5 bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4"
          >
            <h3 className="font-display text-base font-semibold text-slate-900 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-blue-800" />
              {editingLocationId ? 'Edit Location' : 'Add Room or Facility'}
            </h3>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Name</label>
              <input
                type="text"
                required
                maxLength={120}
                value={locForm.name}
                onChange={(e) => setLocForm({ ...locForm, name: e.target.value })}
                placeholder="Robotics Innovation Lab"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Room Code
                </label>
                <input
                  type="text"
                  required
                  maxLength={32}
                  value={locForm.roomNumber}
                  onChange={(e) => setLocForm({ ...locForm, roomNumber: e.target.value })}
                  placeholder="B-210"
                  className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Building
                </label>
                <select
                  value={locForm.buildingId}
                  onChange={(e) => setLocForm({ ...locForm, buildingId: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                >
                  {buildings.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.shortName} ({b.code})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Category
                </label>
                <select
                  value={locForm.category}
                  onChange={(e) =>
                    setLocForm({
                      ...locForm,
                      category: e.target.value as LocationCategory,
                    })
                  }
                  className="w-full px-2.5 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                >
                  <option value="classroom">Classroom</option>
                  <option value="laboratory">Laboratory</option>
                  <option value="department">Department</option>
                  <option value="office">Office</option>
                  <option value="facility">Facility</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Floor</label>
                <input
                  type="number"
                  min={0}
                  max={20}
                  value={locForm.floor}
                  onChange={(e) =>
                    setLocForm({ ...locForm, floor: Number(e.target.value) || 0 })
                  }
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Capacity
                </label>
                <input
                  type="number"
                  min={0}
                  max={5000}
                  value={locForm.capacity ?? 40}
                  onChange={(e) =>
                    setLocForm({ ...locForm, capacity: Number(e.target.value) || 0 })
                  }
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Department
                </label>
                <input
                  type="text"
                  maxLength={100}
                  value={locForm.department ?? ''}
                  onChange={(e) => setLocForm({ ...locForm, department: e.target.value })}
                  placeholder="CSE / ECE"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Hours</label>
                <input
                  type="text"
                  required
                  maxLength={80}
                  value={locForm.hours}
                  onChange={(e) => setLocForm({ ...locForm, hours: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
            </div>

            <div className="flex items-center justify-between gap-4">
              <label className="flex items-center gap-2 text-xs text-slate-700">
                <input
                  type="checkbox"
                  checked={locForm.popular}
                  onChange={(e) => setLocForm({ ...locForm, popular: e.target.checked })}
                />
                Feature in Popular Destinations
              </label>
              <label className="flex items-center gap-2 text-xs text-slate-700">
                <input
                  type="checkbox"
                  checked={locForm.isDemo}
                  onChange={(e) => setLocForm({ ...locForm, isDemo: e.target.checked })}
                />
                Demo Data
              </label>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-900 text-white text-xs font-medium rounded-lg hover:bg-blue-800"
              >
                <Plus className="w-3.5 h-3.5" />
                {editingLocationId ? 'Update Location' : 'Save Location'}
              </button>
              {editingLocationId && (
                <button
                  type="button"
                  onClick={() => setEditingLocationId(null)}
                  className="px-3 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
              )}
            </div>
          </form>

          <div className="xl:col-span-7 bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 text-sm font-semibold text-slate-900">
              Mapped Locations &amp; Facilities
            </div>
            <div className="divide-y divide-slate-100 max-h-[560px] overflow-y-auto">
              {locations.map((loc) => (
                <div
                  key={loc.id}
                  className="px-6 py-3.5 flex items-center justify-between gap-4 hover:bg-slate-50/70"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-slate-900 truncate">
                      <span className="font-mono text-xs text-blue-700 mr-2">
                        {loc.roomNumber}
                      </span>
                      {loc.name}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5 capitalize">
                      {loc.category} · Floor {loc.floor} ·{' '}
                      {loc.isDemo ? 'Demo' : 'Verified'}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingLocationId(loc.id);
                        setLocForm(loc);
                      }}
                      className="px-2.5 py-1.5 text-xs font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-100"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => void deleteLocation(loc.id)}
                      aria-label={`Delete ${loc.name}`}
                      className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Room Status Management */}
      {tab === 'rooms' && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-display text-sm font-semibold text-slate-900">
                Tracked Room Availability
              </h3>
            </div>
            <div className="divide-y divide-slate-100">
              {roomStatuses.map((rs) => (
                <div
                  key={rs.id}
                  className="px-6 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div>
                    <div className="text-sm font-semibold text-slate-900">
                      <span className="font-mono text-blue-700 mr-2">{rs.roomNumber}</span>
                      {locations.find((l) => l.id === rs.locationId)?.name ?? rs.locationId}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">{rs.note}</div>
                  </div>
                  <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg w-fit">
                    {(['available', 'occupied', 'unknown'] as RoomAvailabilityState[]).map(
                      (st) => (
                        <button
                          key={st}
                          type="button"
                          onClick={() => void updateRoomStatus(rs.id, st, rs.note)}
                          className={`px-3 py-1 text-xs font-medium rounded-md capitalize ${
                            rs.status === st
                              ? 'bg-white text-slate-900 shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          {st}
                        </button>
                      )
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {untrackedLocations.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs">
              <h3 className="font-display text-sm font-semibold text-slate-900 mb-3">
                Enable Live Status Tracking for Additional Rooms
              </h3>
              <div className="flex flex-wrap gap-2">
                {untrackedLocations.map((loc) => (
                  <button
                    key={loc.id}
                    type="button"
                    onClick={() =>
                      void createRoomStatusForLocation(
                        loc,
                        'available',
                        'Enabled by administrator'
                      )
                    }
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50"
                  >
                    <Plus className="w-3.5 h-3.5 text-blue-700" />
                    {loc.roomNumber} · {loc.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 4: Campus Info */}
      {tab === 'campus_info' && (
        <form
          onSubmit={handleCampusInfoSubmit}
          className="max-w-2xl bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4"
        >
          <h3 className="font-display text-base font-semibold text-slate-900 flex items-center gap-2">
            <Info className="w-4 h-4 text-blue-800" />
            Manage Institution Metadata &amp; Demonstration Notice
          </h3>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Institution Title
            </label>
            <input
              type="text"
              required
              maxLength={160}
              value={infoForm.campusName}
              onChange={(e) => setInfoForm({ ...infoForm, campusName: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Campus Address / Location Line
            </label>
            <input
              type="text"
              required
              maxLength={160}
              value={infoForm.locationText}
              onChange={(e) => setInfoForm({ ...infoForm, locationText: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Campus Notice / Data Disclaimer
            </label>
            <textarea
              required
              maxLength={500}
              rows={3}
              value={infoForm.dataNotice}
              onChange={(e) => setInfoForm({ ...infoForm, dataNotice: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Current Announcement
            </label>
            <textarea
              maxLength={500}
              rows={2}
              value={infoForm.announcement}
              onChange={(e) => setInfoForm({ ...infoForm, announcement: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>

          <button
            type="submit"
            className="px-4 py-2 bg-blue-900 text-white text-xs font-medium rounded-lg hover:bg-blue-800"
          >
            Save Campus Information
          </button>
        </form>
      )}

      {/* Tab 5: User Feedback */}
      {tab === 'feedback' && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <h3 className="font-display text-sm font-semibold text-slate-900 flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-blue-800" />
              Submitted Campus Feedback
            </h3>
          </div>

          {feedbackList.length === 0 ? (
            <div className="p-10 text-center text-xs text-slate-500">
              No feedback submissions recorded in Firestore yet.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {feedbackList.map((fb) => (
                <div
                  key={fb.id}
                  className="p-6 flex flex-col sm:flex-row sm:items-start justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="text-sm font-semibold text-slate-900">{fb.subject}</div>
                    <div className="text-xs text-slate-500">
                      {fb.authorName} · <span className="capitalize">{fb.category.replace('_', ' ')}</span>
                    </div>
                    <p className="text-xs text-slate-700 leading-relaxed pt-1">{fb.message}</p>
                  </div>

                  <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg shrink-0 w-fit">
                    {(['open', 'reviewed', 'resolved'] as FeedbackItem['status'][]).map(
                      (st) => (
                        <button
                          key={st}
                          type="button"
                          disabled={fb.status === 'resolved'}
                          onClick={() => void updateFeedbackStatus(fb.id, st)}
                          className={`px-2.5 py-1 text-xs font-medium rounded-md capitalize ${
                            fb.status === st
                              ? 'bg-white text-slate-900 shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          } disabled:opacity-70`}
                        >
                          {st}
                        </button>
                      )
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      <MapLayoutUploadModal
        open={uploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
        onSubmitted={(title) =>
          showMessage(`Uploaded "${title}" to the Map Verification queue.`)
        }
      />
    </div>
  );
}
