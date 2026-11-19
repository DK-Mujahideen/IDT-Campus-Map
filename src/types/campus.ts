export type NavPage =
  | 'landing'
  | 'auth'
  | 'dashboard'
  | 'map'
  | 'directory'
  | 'navigation'
  | 'rooms'
  | 'assistant'
  | 'admin';

export type BuildingCategory = 'academic' | 'labs' | 'admin' | 'facilities' | 'sports';

export type LocationCategory = 'classroom' | 'laboratory' | 'department' | 'office' | 'facility';

export type RoomAvailabilityState = 'available' | 'occupied' | 'unknown';

export type UserAffiliation = 'student' | 'faculty' | 'staff' | 'visitor';

export type MapLayoutFormat = 'svg' | 'json';

export type MapLayoutStatus = 'pending' | 'verified' | 'rejected';

export interface Building {
  id: string;
  code: string;
  name: string;
  shortName: string;
  category: BuildingCategory;
  floors: number;
  description: string;
  x: number;
  y: number;
  width: number;
  height: number;
  entranceNodeId: string;
  hours: string;
  accessible: boolean;
  isDemo: boolean;
  visibility: 'public' | 'archived';
}

export interface LocationItem {
  id: string;
  name: string;
  buildingId: string;
  floor: number;
  roomNumber: string;
  category: LocationCategory;
  department?: string;
  capacity?: number;
  hours: string;
  description?: string;
  popular: boolean;
  isDemo: boolean;
  visibility: 'public' | 'archived';
}

export interface MapNode {
  id: string;
  label: string;
  x: number;
  y: number;
  buildingId?: string;
  isDemo: boolean;
}

export interface RouteSegment {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  distanceMeters: number;
  accessible: boolean;
  pathLabel?: string;
  isDemo: boolean;
  visibility: 'public' | 'archived';
}

export interface RoomStatusItem {
  id: string;
  locationId: string;
  buildingId: string;
  roomNumber: string;
  status: RoomAvailabilityState;
  note?: string;
  updatedBy: string;
  updatedAt?: unknown;
  updatedAtLabel?: string;
  visibility: 'public' | 'archived';
}

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  role: 'user' | 'admin';
  affiliation?: UserAffiliation;
  department?: string;
  createdAt?: unknown;
}

export interface FeedbackItem {
  id: string;
  userId: string;
  authorName: string;
  category: 'map_correction' | 'room_issue' | 'navigation' | 'general';
  subject: string;
  message: string;
  status: 'open' | 'reviewed' | 'resolved';
  createdAt?: unknown;
  createdAtLabel?: string;
}

export interface CampusInfo {
  id: string;
  campusName: string;
  locationText: string;
  announcement: string;
  dataNotice: string;
  visibility: 'public';
  updatedBy: string;
  updatedAt?: unknown;
}

export interface MapLayoutSubmission {
  id: string;
  title: string;
  description: string;
  sourceReference: string;
  fileName: string;
  format: MapLayoutFormat;
  fileSizeBytes: number;
  buildingCount: number;
  floorScope: string;
  layoutContent: string;
  sha256Hash: string;
  hasSecurityWarnings: boolean;
  submittedByUid: string;
  submittedByName: string;
  status: MapLayoutStatus;
  isActive: boolean;
  reviewedBy: string;
  reviewNotes: string;
  createdAt?: unknown;
  createdAtLabel?: string;
  reviewedAt?: unknown;
  reviewedAtLabel?: string;
  isDemoSample?: boolean;
}

export interface CalculatedRoute {
  nodeIds: string[];
  nodes: MapNode[];
  segments: RouteSegment[];
  totalDistanceMeters: number;
  estimatedMinutes: number;
  steps: string[];
  accessibleOnly: boolean;
}
