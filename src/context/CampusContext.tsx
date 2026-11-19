import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  DEMO_BUILDINGS,
  DEMO_CAMPUS_INFO,
  DEMO_LOCATIONS,
  DEMO_MAP_NODES,
  DEMO_ROOM_STATUSES,
  DEMO_ROUTES,
} from '../data/demoCampusData';
import { auth, db, googleProvider, PRIMARY_ADMIN_EMAIL } from '../firebase/config';
import { handleFirestoreError, OperationType } from '../firebase/errorHandler';
import type {
  Building,
  CampusInfo,
  FeedbackItem,
  LocationItem,
  MapLayoutFormat,
  MapLayoutStatus,
  MapLayoutSubmission,
  MapNode,
  NavPage,
  RoomAvailabilityState,
  RoomStatusItem,
  RouteSegment,
  UserAffiliation,
  UserProfile,
} from '../types/campus';
import {
  analyzeMapLayout,
  computeSha256Hex,
  INITIAL_DEMO_MAP_LAYOUTS,
  MAX_LAYOUT_CONTENT_CHARS,
} from '../utils/mapLayoutValidator';

export interface AuthSignupHints {
  displayName?: string;
  affiliation?: UserAffiliation;
  department?: string;
}

export interface SubmitMapLayoutInput {
  title: string;
  description: string;
  sourceReference: string;
  fileName: string;
  format: MapLayoutFormat;
  floorScope: string;
  layoutContent: string;
}

interface CampusContextValue {
  activePage: NavPage;
  setActivePage: (page: NavPage) => void;
  authMode: 'signin' | 'signup';
  setAuthMode: (mode: 'signin' | 'signup') => void;
  openAuthPage: (mode?: 'signin' | 'signup') => void;
  selectedBuildingId: string | null;
  setSelectedBuildingId: (id: string | null) => void;
  navStartNodeId: string;
  setNavStartNodeId: (id: string) => void;
  navEndNodeId: string;
  setNavEndNodeId: (id: string) => void;
  openBuildingOnMap: (buildingId: string) => void;
  navigateToBuilding: (buildingId: string, fromNodeId?: string) => void;
  navigateToLocation: (location: LocationItem, fromNodeId?: string) => void;

  // Data
  campusInfo: CampusInfo;
  buildings: Building[];
  locations: LocationItem[];
  mapNodes: MapNode[];
  routes: RouteSegment[];
  roomStatuses: RoomStatusItem[];
  feedbackList: FeedbackItem[];
  mapLayouts: MapLayoutSubmission[];
  activeVerifiedLayout: MapLayoutSubmission | null;
  isFirestoreBacked: boolean;

  // Auth
  user: User | null;
  userProfile: UserProfile | null;
  authReady: boolean;
  isAdmin: boolean;
  signInWithGoogle: (hints?: AuthSignupHints) => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (input: {
    displayName: string;
    email: string;
    password: string;
    affiliation: UserAffiliation;
    department: string;
  }) => Promise<{ verificationSent: boolean }>;
  resendVerificationEmail: () => Promise<void>;
  signOutUser: () => Promise<void>;
  authError: string | null;
  clearAuthError: () => void;

  // Mutations
  saveBuilding: (building: Building, isNew?: boolean) => Promise<void>;
  deleteBuilding: (buildingId: string) => Promise<void>;
  saveLocation: (location: LocationItem, isNew?: boolean) => Promise<void>;
  deleteLocation: (locationId: string) => Promise<void>;
  updateRoomStatus: (
    roomStatusId: string,
    status: RoomAvailabilityState,
    note?: string
  ) => Promise<void>;
  createRoomStatusForLocation: (
    location: LocationItem,
    status: RoomAvailabilityState,
    note?: string
  ) => Promise<void>;
  updateCampusInfo: (patch: {
    campusName: string;
    locationText: string;
    announcement: string;
    dataNotice: string;
  }) => Promise<void>;
  submitFeedback: (input: {
    category: FeedbackItem['category'];
    subject: string;
    message: string;
  }) => Promise<void>;
  updateFeedbackStatus: (
    feedbackId: string,
    status: FeedbackItem['status']
  ) => Promise<void>;
  submitMapLayout: (input: SubmitMapLayoutInput) => Promise<MapLayoutSubmission>;
  reviewMapLayout: (
    layoutId: string,
    decision: Extract<MapLayoutStatus, 'verified' | 'rejected'>,
    reviewNotes: string,
    activateIfVerified?: boolean
  ) => Promise<void>;
  setActiveMapLayout: (layoutId: string | null) => Promise<void>;
  deleteMapLayout: (layoutId: string) => Promise<void>;
  seedDemoDataToFirestore: () => Promise<void>;
  isSyncingSeed: boolean;
}

const CampusContext = createContext<CampusContextValue | null>(null);

function sanitizeId(raw: string): string {
  const cleaned = raw.trim().replace(/[^a-zA-Z0-9_-]/g, '-');
  return cleaned.slice(0, 64) || `item-${Date.now()}`;
}

export function CampusProvider({ children }: { children: React.ReactNode }) {
  const [activePage, setActivePage] = useState<NavPage>('landing');
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [selectedBuildingId, setSelectedBuildingId] = useState<string | null>('bldg-main');
  const [navStartNodeId, setNavStartNodeId] = useState<string>('node-gate');
  const [navEndNodeId, setNavEndNodeId] = useState<string>('node-lib');

  // Firestore-synced or demo-fallback collections
  const [fsBuildings, setFsBuildings] = useState<Building[] | null>(null);
  const [fsLocations, setFsLocations] = useState<LocationItem[] | null>(null);
  const [fsRoutes, setFsRoutes] = useState<RouteSegment[] | null>(null);
  const [fsRoomStatuses, setFsRoomStatuses] = useState<RoomStatusItem[] | null>(null);
  const [fsCampusInfo, setFsCampusInfo] = useState<CampusInfo | null>(null);
  const [feedbackList, setFeedbackList] = useState<FeedbackItem[]>([]);
  const [fsVerifiedLayouts, setFsVerifiedLayouts] = useState<MapLayoutSubmission[]>([]);
  const [fsUserLayouts, setFsUserLayouts] = useState<MapLayoutSubmission[]>([]);
  const [fsAdminLayouts, setFsAdminLayouts] = useState<MapLayoutSubmission[] | null>(null);
  const [demoMapLayouts, setDemoMapLayouts] = useState<MapLayoutSubmission[]>(
    INITIAL_DEMO_MAP_LAYOUTS
  );

  // Local mutable demo layer if Firestore isn't seeded yet
  const [demoBuildings, setDemoBuildings] = useState<Building[]>(DEMO_BUILDINGS);
  const [demoLocations, setDemoLocations] = useState<LocationItem[]>(DEMO_LOCATIONS);
  const [demoRoomStatuses, setDemoRoomStatuses] = useState<RoomStatusItem[]>(DEMO_ROOM_STATUSES);
  const [demoCampusInfo, setDemoCampusInfo] = useState<CampusInfo>(DEMO_CAMPUS_INFO);

  // Auth state
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isSyncingSeed, setIsSyncingSeed] = useState(false);
  const pendingSignupHintsRef = React.useRef<AuthSignupHints | null>(null);

  const isBootstrappedAdmin = Boolean(
    user && user.emailVerified && user.email === PRIMARY_ADMIN_EMAIL
  );
  const isAdmin = Boolean(isBootstrappedAdmin || userProfile?.role === 'admin');

  const openAuthPage = useCallback((mode: 'signin' | 'signup' = 'signin') => {
    setAuthError(null);
    setAuthMode(mode);
    setActivePage('auth');
  }, []);

  const clearAuthError = useCallback(() => setAuthError(null), []);

  // Auth listener & user profile sync
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (!firebaseUser) {
        setUserProfile(null);
        setAuthReady(true);
        return;
      }

      const userRef = doc(db, 'users', firebaseUser.uid);
      const hints = pendingSignupHintsRef.current;
      pendingSignupHintsRef.current = null;

      try {
        const snap = await getDoc(userRef);
        if (snap.exists()) {
          const existingProfile = snap.data() as UserProfile;
          if (
            firebaseUser.emailVerified &&
            hints &&
            (hints.affiliation || hints.department || hints.displayName)
          ) {
            const updatePayload: Partial<UserProfile> = {};
            if (hints.displayName?.trim()) {
              updatePayload.displayName = hints.displayName.trim().slice(0, 120);
            }
            if (hints.affiliation) {
              updatePayload.affiliation = hints.affiliation;
            }
            if (hints.department?.trim()) {
              updatePayload.department = hints.department.trim().slice(0, 100);
            }
            if (Object.keys(updatePayload).length > 0) {
              await updateDoc(userRef, updatePayload);
              setUserProfile({ ...existingProfile, ...updatePayload });
            } else {
              setUserProfile(existingProfile);
            }
          } else {
            setUserProfile(existingProfile);
          }
        } else if (firebaseUser.emailVerified && firebaseUser.email) {
          const initialRole =
            firebaseUser.email === PRIMARY_ADMIN_EMAIL ? 'admin' : 'user';
          const newProfile: Record<string, unknown> = {
            uid: firebaseUser.uid,
            displayName: (
              hints?.displayName?.trim() ||
              firebaseUser.displayName ||
              'Campus User'
            ).slice(0, 120),
            email: firebaseUser.email.slice(0, 180),
            role: initialRole as 'admin' | 'user',
            createdAt: serverTimestamp(),
          };
          if (hints?.affiliation) {
            newProfile.affiliation = hints.affiliation;
          }
          if (hints?.department?.trim()) {
            newProfile.department = hints.department.trim().slice(0, 100);
          }
          await setDoc(userRef, newProfile);
          setUserProfile({
            uid: firebaseUser.uid,
            displayName: String(newProfile.displayName),
            email: String(newProfile.email),
            role: initialRole,
            affiliation: hints?.affiliation,
            department: hints?.department?.trim().slice(0, 100),
          });
        }
      } catch (error) {
        console.warn('User profile sync warning:', error);
      } finally {
        setAuthReady(true);
      }
    });

    return () => unsubscribe();
  }, []);

  // Public directory Firestore listeners (visibility == 'public')
  useEffect(() => {
    const qBuildings = query(
      collection(db, 'buildings'),
      where('visibility', '==', 'public')
    );
    const unsubBuildings = onSnapshot(
      qBuildings,
      (snap) => {
        if (snap.empty) {
          setFsBuildings(null);
        } else {
          setFsBuildings(snap.docs.map((d) => d.data() as Building));
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'buildings');
      }
    );

    const qLocations = query(
      collection(db, 'locations'),
      where('visibility', '==', 'public')
    );
    const unsubLocations = onSnapshot(
      qLocations,
      (snap) => {
        if (snap.empty) {
          setFsLocations(null);
        } else {
          setFsLocations(snap.docs.map((d) => d.data() as LocationItem));
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'locations');
      }
    );

    const qRoutes = query(
      collection(db, 'routes'),
      where('visibility', '==', 'public')
    );
    const unsubRoutes = onSnapshot(
      qRoutes,
      (snap) => {
        if (snap.empty) {
          setFsRoutes(null);
        } else {
          setFsRoutes(snap.docs.map((d) => d.data() as RouteSegment));
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'routes');
      }
    );

    const qRooms = query(
      collection(db, 'room_status'),
      where('visibility', '==', 'public')
    );
    const unsubRooms = onSnapshot(
      qRooms,
      (snap) => {
        if (snap.empty) {
          setFsRoomStatuses(null);
        } else {
          setFsRoomStatuses(snap.docs.map((d) => d.data() as RoomStatusItem));
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'room_status');
      }
    );

    const qCampus = query(
      collection(db, 'campus_info'),
      where('visibility', '==', 'public')
    );
    const unsubCampus = onSnapshot(
      qCampus,
      (snap) => {
        if (snap.empty) {
          setFsCampusInfo(null);
        } else {
          setFsCampusInfo(snap.docs[0].data() as CampusInfo);
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'campus_info');
      }
    );

    return () => {
      unsubBuildings();
      unsubLocations();
      unsubRoutes();
      unsubRooms();
      unsubCampus();
    };
  }, []);

  // Feedback listener (only when authReady and user is authenticated)
  useEffect(() => {
    if (!authReady || !user) {
      setFeedbackList([]);
      return;
    }

    const feedbackQuery = isBootstrappedAdmin
      ? collection(db, 'feedback')
      : query(collection(db, 'feedback'), where('userId', '==', user.uid));

    const unsubFeedback = onSnapshot(
      feedbackQuery,
      (snap) => {
        setFeedbackList(snap.docs.map((d) => d.data() as FeedbackItem));
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'feedback');
      }
    );

    return () => unsubFeedback();
  }, [authReady, user, isBootstrappedAdmin]);

  // Verified map_layouts public listener
  useEffect(() => {
    const qVerified = query(
      collection(db, 'map_layouts'),
      where('status', '==', 'verified')
    );
    const unsubVerified = onSnapshot(
      qVerified,
      (snap) => {
        setFsVerifiedLayouts(snap.docs.map((d) => d.data() as MapLayoutSubmission));
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'map_layouts');
      }
    );
    return () => unsubVerified();
  }, []);

  // Admin or owner map_layouts listener
  useEffect(() => {
    if (!authReady || !user) {
      setFsAdminLayouts(null);
      setFsUserLayouts([]);
      return;
    }

    if (isBootstrappedAdmin) {
      const unsubAll = onSnapshot(
        collection(db, 'map_layouts'),
        (snap) => {
          setFsAdminLayouts(snap.docs.map((d) => d.data() as MapLayoutSubmission));
        },
        (error) => {
          handleFirestoreError(error, OperationType.LIST, 'map_layouts');
        }
      );
      return () => unsubAll();
    }

    setFsAdminLayouts(null);
    const qOwn = query(
      collection(db, 'map_layouts'),
      where('submittedByUid', '==', user.uid)
    );
    const unsubOwn = onSnapshot(
      qOwn,
      (snap) => {
        setFsUserLayouts(snap.docs.map((d) => d.data() as MapLayoutSubmission));
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'map_layouts');
      }
    );
    return () => unsubOwn();
  }, [authReady, user, isBootstrappedAdmin]);

  const isFirestoreBacked = Boolean(fsBuildings && fsBuildings.length > 0);
  const buildings = fsBuildings ?? demoBuildings;
  const locations = fsLocations ?? demoLocations;
  const routes = fsRoutes ?? DEMO_ROUTES;
  const roomStatuses = fsRoomStatuses ?? demoRoomStatuses;
  const campusInfo = fsCampusInfo ?? demoCampusInfo;

  // Merge cloud map_layouts with initial demo samples (until real cloud layouts exist)
  const mapLayouts = useMemo<MapLayoutSubmission[]>(() => {
    const merged = new Map<string, MapLayoutSubmission>();
    const cloudList =
      fsAdminLayouts !== null
        ? fsAdminLayouts
        : [...fsVerifiedLayouts, ...fsUserLayouts];

    cloudList.forEach((item) => merged.set(item.id, item));

    if (merged.size === 0) {
      demoMapLayouts.forEach((item) => merged.set(item.id, item));
    }

    return Array.from(merged.values());
  }, [fsAdminLayouts, fsVerifiedLayouts, fsUserLayouts, demoMapLayouts]);

  const activeVerifiedLayout = useMemo<MapLayoutSubmission | null>(
    () => mapLayouts.find((l) => l.status === 'verified' && l.isActive) ?? null,
    [mapLayouts]
  );

  // Combine static demo nodes + dynamic center nodes for any newly added admin buildings
  const mapNodes = useMemo<MapNode[]>(() => {
    const baseMap = new Map<string, MapNode>();
    DEMO_MAP_NODES.forEach((n) => baseMap.set(n.id, n));
    buildings.forEach((b) => {
      if (!baseMap.has(b.entranceNodeId)) {
        baseMap.set(b.entranceNodeId, {
          id: b.entranceNodeId,
          label: `${b.shortName} Entrance`,
          x: b.x + b.width / 2,
          y: b.y + b.height,
          buildingId: b.id,
          isDemo: b.isDemo,
        });
      }
    });
    return Array.from(baseMap.values());
  }, [buildings]);

  const openBuildingOnMap = useCallback((buildingId: string) => {
    setSelectedBuildingId(buildingId);
    setActivePage('map');
  }, []);

  const navigateToBuilding = useCallback(
    (buildingId: string, fromNodeId?: string) => {
      const building = buildings.find((b) => b.id === buildingId);
      if (!building) return;
      if (fromNodeId) {
        setNavStartNodeId(fromNodeId);
      }
      setNavEndNodeId(building.entranceNodeId);
      setSelectedBuildingId(building.id);
      setActivePage('navigation');
    },
    [buildings]
  );

  const navigateToLocation = useCallback(
    (location: LocationItem, fromNodeId?: string) => {
      navigateToBuilding(location.buildingId, fromNodeId);
    },
    [navigateToBuilding]
  );

  const signInWithGoogle = useCallback(async (hints?: AuthSignupHints) => {
    setAuthError(null);
    if (hints) {
      pendingSignupHintsRef.current = hints;
    }
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      pendingSignupHintsRef.current = null;
      const msg = error instanceof Error ? error.message : 'Google Sign-In failed.';
      setAuthError(msg);
      throw error;
    }
  }, []);

  const formatFirebaseAuthError = (error: unknown): string => {
    const code =
      typeof error === 'object' && error !== null && 'code' in error
        ? String((error as { code?: unknown }).code)
        : '';
    switch (code) {
      case 'auth/operation-not-allowed':
        return 'Email/Password sign-in is not yet enabled in your Firebase Console. Use "Continue with Google" now, or enable Email/Password under Firebase Console → Authentication → Sign-in method.';
      case 'auth/email-already-in-use':
        return 'An account with this email already exists. Switch to Sign In instead.';
      case 'auth/invalid-credential':
      case 'auth/wrong-password':
      case 'auth/user-not-found':
        return 'Invalid email or password. Please verify your credentials or continue with Google.';
      case 'auth/weak-password':
        return 'Password must be at least 6 characters long.';
      case 'auth/invalid-email':
        return 'Please enter a valid email address.';
      case 'auth/too-many-requests':
        return 'Too many login attempts. Please wait a moment and try again.';
      default:
        return error instanceof Error ? error.message : 'Authentication failed. Please try again.';
    }
  };

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    setAuthError(null);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (error) {
      const msg = formatFirebaseAuthError(error);
      setAuthError(msg);
      throw new Error(msg);
    }
  }, []);

  const signUpWithEmail = useCallback(
    async (input: {
      displayName: string;
      email: string;
      password: string;
      affiliation: UserAffiliation;
      department: string;
    }): Promise<{ verificationSent: boolean }> => {
      setAuthError(null);
      pendingSignupHintsRef.current = {
        displayName: input.displayName,
        affiliation: input.affiliation,
        department: input.department,
      };
      try {
        const cred = await createUserWithEmailAndPassword(
          auth,
          input.email.trim(),
          input.password
        );
        await updateProfile(cred.user, {
          displayName: input.displayName.trim().slice(0, 120),
        });
        let verificationSent = false;
        try {
          await sendEmailVerification(cred.user);
          verificationSent = true;
        } catch {
          verificationSent = false;
        }
        return { verificationSent };
      } catch (error) {
        pendingSignupHintsRef.current = null;
        const msg = formatFirebaseAuthError(error);
        setAuthError(msg);
        throw new Error(msg);
      }
    },
    []
  );

  const resendVerificationEmail = useCallback(async () => {
    if (!auth.currentUser) {
      throw new Error('Sign in first to resend a verification email.');
    }
    await sendEmailVerification(auth.currentUser);
  }, []);

  const signOutUser = useCallback(async () => {
    setAuthError(null);
    await signOut(auth);
  }, []);

  const seedDemoDataToFirestore = useCallback(async () => {
    if (!isAdmin) {
      throw new Error('Administrator authentication is required to seed Firestore.');
    }
    setIsSyncingSeed(true);
    try {
      // Write buildings first so relational exists() checks on locations pass
      const batch1 = writeBatch(db);
      for (const b of DEMO_BUILDINGS) {
        batch1.set(doc(db, 'buildings', b.id), {
          ...b,
          updatedAt: serverTimestamp(),
        });
      }
      for (const r of DEMO_ROUTES) {
        batch1.set(doc(db, 'routes', r.id), r);
      }
      batch1.set(doc(db, 'campus_info', DEMO_CAMPUS_INFO.id), {
        ...DEMO_CAMPUS_INFO,
        updatedBy: user?.email ?? 'Admin',
        updatedAt: serverTimestamp(),
      });
      await batch1.commit();

      // Batch 2: locations + room_status
      const batch2 = writeBatch(db);
      for (const l of DEMO_LOCATIONS) {
        batch2.set(doc(db, 'locations', l.id), l);
      }
      for (const rs of DEMO_ROOM_STATUSES) {
        batch2.set(doc(db, 'room_status', rs.id), {
          id: rs.id,
          locationId: rs.locationId,
          buildingId: rs.buildingId,
          roomNumber: rs.roomNumber,
          status: rs.status,
          note: rs.note ?? '',
          updatedBy: user?.email ?? 'Admin',
          updatedAt: serverTimestamp(),
          visibility: 'public',
        });
      }
      await batch2.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'buildings/locations/routes');
    } finally {
      setIsSyncingSeed(false);
    }
  }, [isAdmin, user]);

  const saveBuilding = useCallback(
    async (building: Building, isNew = false) => {
      const cleanBuilding: Building = {
        ...building,
        id: sanitizeId(building.id),
        code: building.code.trim().slice(0, 16),
        name: building.name.trim().slice(0, 120),
        shortName: building.shortName.trim().slice(0, 40),
        description: building.description.trim().slice(0, 600),
        hours: building.hours.trim().slice(0, 80),
        floors: Math.max(1, Math.min(20, Math.round(building.floors))),
        x: Math.max(0, Math.min(2000, Number(building.x))),
        y: Math.max(0, Math.min(2000, Number(building.y))),
        width: Math.max(40, Math.min(800, Number(building.width))),
        height: Math.max(40, Math.min(800, Number(building.height))),
        entranceNodeId: sanitizeId(building.entranceNodeId),
        visibility: 'public',
      };

      if (!isFirestoreBacked) {
        setDemoBuildings((prev) =>
          isNew
            ? [...prev, cleanBuilding]
            : prev.map((b) => (b.id === cleanBuilding.id ? cleanBuilding : b))
        );
        return;
      }

      try {
        await setDoc(doc(db, 'buildings', cleanBuilding.id), {
          ...cleanBuilding,
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `buildings/${cleanBuilding.id}`);
      }
    },
    [isFirestoreBacked]
  );

  const deleteBuilding = useCallback(
    async (buildingId: string) => {
      if (!isFirestoreBacked) {
        setDemoBuildings((prev) => prev.filter((b) => b.id !== buildingId));
        return;
      }
      try {
        await deleteDoc(doc(db, 'buildings', buildingId));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `buildings/${buildingId}`);
      }
    },
    [isFirestoreBacked]
  );

  const saveLocation = useCallback(
    async (location: LocationItem, isNew = false) => {
      const cleanLocation: LocationItem = {
        id: sanitizeId(location.id),
        name: location.name.trim().slice(0, 120),
        buildingId: sanitizeId(location.buildingId),
        floor: Math.max(0, Math.min(20, Math.round(location.floor))),
        roomNumber: location.roomNumber.trim().slice(0, 32),
        category: location.category,
        department: (location.department ?? '').trim().slice(0, 100),
        capacity: Math.max(0, Math.min(5000, Math.round(location.capacity ?? 40))),
        hours: location.hours.trim().slice(0, 80),
        description: (location.description ?? '').trim().slice(0, 500),
        popular: Boolean(location.popular),
        isDemo: Boolean(location.isDemo),
        visibility: 'public',
      };

      if (!isFirestoreBacked) {
        setDemoLocations((prev) =>
          isNew
            ? [...prev, cleanLocation]
            : prev.map((l) => (l.id === cleanLocation.id ? cleanLocation : l))
        );
        return;
      }

      try {
        await setDoc(doc(db, 'locations', cleanLocation.id), cleanLocation);
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `locations/${cleanLocation.id}`);
      }
    },
    [isFirestoreBacked]
  );

  const deleteLocation = useCallback(
    async (locationId: string) => {
      if (!isFirestoreBacked) {
        setDemoLocations((prev) => prev.filter((l) => l.id !== locationId));
        return;
      }
      try {
        await deleteDoc(doc(db, 'locations', locationId));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `locations/${locationId}`);
      }
    },
    [isFirestoreBacked]
  );

  const updateRoomStatus = useCallback(
    async (roomStatusId: string, status: RoomAvailabilityState, note?: string) => {
      const cleanNote = (note ?? '').trim().slice(0, 200);
      const actor = user?.email ?? user?.displayName ?? 'Admin';

      if (!isFirestoreBacked) {
        setDemoRoomStatuses((prev) =>
          prev.map((rs) =>
            rs.id === roomStatusId
              ? {
                  ...rs,
                  status,
                  note: cleanNote || rs.note,
                  updatedBy: actor,
                  updatedAtLabel: 'Updated just now',
                }
              : rs
          )
        );
        return;
      }

      try {
        await updateDoc(doc(db, 'room_status', roomStatusId), {
          status,
          note: cleanNote,
          updatedBy: actor.slice(0, 128),
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `room_status/${roomStatusId}`);
      }
    },
    [isFirestoreBacked, user]
  );

  const createRoomStatusForLocation = useCallback(
    async (location: LocationItem, status: RoomAvailabilityState, note?: string) => {
      const id = sanitizeId(`status-${location.id}`);
      const actor = user?.email ?? user?.displayName ?? 'Admin';
      const payload: RoomStatusItem = {
        id,
        locationId: location.id,
        buildingId: location.buildingId,
        roomNumber: location.roomNumber,
        status,
        note: (note ?? '').trim().slice(0, 200),
        updatedBy: actor.slice(0, 128),
        visibility: 'public',
      };

      if (!isFirestoreBacked) {
        setDemoRoomStatuses((prev) => [...prev, { ...payload, updatedAtLabel: 'Just now' }]);
        return;
      }

      try {
        await setDoc(doc(db, 'room_status', id), {
          ...payload,
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, `room_status/${id}`);
      }
    },
    [isFirestoreBacked, user]
  );

  const updateCampusInfo = useCallback(
    async (patch: {
      campusName: string;
      locationText: string;
      announcement: string;
      dataNotice: string;
    }) => {
      const actor = user?.email ?? 'Admin';
      const updated: CampusInfo = {
        id: 'primary',
        campusName: patch.campusName.trim().slice(0, 160),
        locationText: patch.locationText.trim().slice(0, 160),
        announcement: patch.announcement.trim().slice(0, 500),
        dataNotice: patch.dataNotice.trim().slice(0, 500),
        visibility: 'public',
        updatedBy: actor.slice(0, 128),
      };

      if (!isFirestoreBacked) {
        setDemoCampusInfo(updated);
        return;
      }

      try {
        await setDoc(doc(db, 'campus_info', 'primary'), {
          ...updated,
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, 'campus_info/primary');
      }
    },
    [isFirestoreBacked, user]
  );

  const submitFeedback = useCallback(
    async (input: {
      category: FeedbackItem['category'];
      subject: string;
      message: string;
    }) => {
      if (!user || !user.emailVerified) {
        throw new Error('Please sign in with a verified Google account to submit feedback.');
      }
      const id = sanitizeId(`fb-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`);
      try {
        await setDoc(doc(db, 'feedback', id), {
          id,
          userId: user.uid,
          authorName: (user.displayName || user.email || 'Campus User').slice(0, 100),
          category: input.category,
          subject: input.subject.trim().slice(0, 140),
          message: input.message.trim().slice(0, 1000),
          status: 'open',
          createdAt: serverTimestamp(),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, `feedback/${id}`);
      }
    },
    [user]
  );

  const updateFeedbackStatus = useCallback(
    async (feedbackId: string, status: FeedbackItem['status']) => {
      try {
        await updateDoc(doc(db, 'feedback', feedbackId), { status });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `feedback/${feedbackId}`);
      }
    },
    []
  );

  const submitMapLayout = useCallback(
    async (input: SubmitMapLayoutInput): Promise<MapLayoutSubmission> => {
      if (!user || !user.emailVerified) {
        throw new Error(
          'Please sign in with a verified account to upload a map layout for verification.'
        );
      }

      const trimmedContent = input.layoutContent.trim();
      if (trimmedContent.length < 10 || trimmedContent.length > MAX_LAYOUT_CONTENT_CHARS) {
        throw new Error('Layout file content must be between 10 and 100,000 characters.');
      }

      const cleanTitle = input.title.trim().slice(0, 120);
      const cleanDesc = input.description.trim().slice(0, 500);
      const cleanSource = input.sourceReference.trim().slice(0, 200);
      const cleanFileName = input.fileName.trim().slice(0, 120);
      const cleanFloorScope = input.floorScope.trim().slice(0, 40) || 'Campus Masterplan';

      if (cleanTitle.length < 3 || cleanDesc.length < 5 || cleanSource.length < 2) {
        throw new Error('Please provide a valid title, description, and source reference.');
      }

      const report = analyzeMapLayout(trimmedContent, input.format, cleanFileName);
      const sha256Hash = await computeSha256Hex(trimmedContent);
      const id = sanitizeId(`layout-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`);
      const fileSizeBytes = Math.min(200000, Math.max(1, new Blob([trimmedContent]).size));
      const submitterName = (
        userProfile?.displayName ||
        user.displayName ||
        user.email ||
        'Campus Contributor'
      ).slice(0, 100);

      const firestorePayload = {
        id,
        title: cleanTitle,
        description: cleanDesc,
        sourceReference: cleanSource,
        fileName: cleanFileName,
        format: input.format,
        fileSizeBytes: Math.round(fileSizeBytes),
        buildingCount: Math.max(0, Math.min(500, Math.round(report.buildingCount))),
        floorScope: cleanFloorScope,
        layoutContent: trimmedContent,
        sha256Hash: sha256Hash.slice(0, 64),
        hasSecurityWarnings: report.hasSecurityWarnings,
        submittedByUid: user.uid,
        submittedByName: submitterName,
        status: 'pending' as MapLayoutStatus,
        isActive: false,
        reviewedBy: '',
        reviewNotes: '',
        createdAt: serverTimestamp(),
      };

      try {
        await setDoc(doc(db, 'map_layouts', id), firestorePayload);
        return {
          ...firestorePayload,
          createdAtLabel: 'Submitted just now',
        };
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, `map_layouts/${id}`);
        throw error;
      }
    },
    [user, userProfile]
  );

  const reviewMapLayout = useCallback(
    async (
      layoutId: string,
      decision: Extract<MapLayoutStatus, 'verified' | 'rejected'>,
      reviewNotes: string,
      activateIfVerified = false
    ) => {
      if (!isAdmin || !user) {
        throw new Error('Administrator authentication is required to verify map layouts.');
      }

      const reviewer = (user.email || user.displayName || 'Admin').slice(0, 128);
      const cleanNotes = reviewNotes.trim().slice(0, 500);
      const shouldActivate = decision === 'verified' && activateIfVerified;

      const target = mapLayouts.find((l) => l.id === layoutId);
      if (target?.isDemoSample) {
        setDemoMapLayouts((prev) =>
          prev.map((item) => {
            if (item.id === layoutId) {
              return {
                ...item,
                status: decision,
                isActive: shouldActivate,
                reviewedBy: reviewer,
                reviewNotes: cleanNotes,
                reviewedAtLabel: 'Reviewed just now',
              };
            }
            if (shouldActivate && item.isActive) {
              return { ...item, isActive: false };
            }
            return item;
          })
        );
        return;
      }

      try {
        if (shouldActivate) {
          const currentlyActive = mapLayouts.filter(
            (l) => !l.isDemoSample && l.isActive && l.id !== layoutId
          );
          for (const other of currentlyActive) {
            await updateDoc(doc(db, 'map_layouts', other.id), {
              isActive: false,
              reviewedBy: reviewer,
              reviewedAt: serverTimestamp(),
            });
          }
        }

        await updateDoc(doc(db, 'map_layouts', layoutId), {
          status: decision,
          isActive: shouldActivate,
          reviewedBy: reviewer,
          reviewNotes: cleanNotes,
          reviewedAt: serverTimestamp(),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `map_layouts/${layoutId}`);
      }
    },
    [isAdmin, user, mapLayouts]
  );

  const setActiveMapLayout = useCallback(
    async (layoutId: string | null) => {
      if (!isAdmin || !user) {
        throw new Error('Administrator authentication is required to activate a map layout.');
      }
      const reviewer = (user.email || user.displayName || 'Admin').slice(0, 128);

      const hasOnlyDemo = mapLayouts.every((l) => l.isDemoSample);
      if (hasOnlyDemo) {
        setDemoMapLayouts((prev) =>
          prev.map((item) => ({
            ...item,
            isActive: item.id === layoutId && item.status === 'verified',
          }))
        );
        return;
      }

      try {
        for (const item of mapLayouts) {
          if (item.isDemoSample) continue;
          const nextActive = item.id === layoutId && item.status === 'verified';
          if (item.isActive !== nextActive) {
            await updateDoc(doc(db, 'map_layouts', item.id), {
              isActive: nextActive,
              reviewedBy: reviewer,
              reviewedAt: serverTimestamp(),
            });
          }
        }
      } catch (error) {
        handleFirestoreError(
          error,
          OperationType.UPDATE,
          `map_layouts/${layoutId ?? 'deactivate'}`
        );
      }
    },
    [isAdmin, user, mapLayouts]
  );

  const deleteMapLayout = useCallback(
    async (layoutId: string) => {
      if (!isAdmin) {
        throw new Error('Administrator authentication is required to delete a map layout.');
      }
      const target = mapLayouts.find((l) => l.id === layoutId);
      if (target?.isDemoSample) {
        setDemoMapLayouts((prev) => prev.filter((item) => item.id !== layoutId));
        return;
      }
      try {
        await deleteDoc(doc(db, 'map_layouts', layoutId));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `map_layouts/${layoutId}`);
      }
    },
    [isAdmin, mapLayouts]
  );

  const value: CampusContextValue = {
    activePage,
    setActivePage,
    authMode,
    setAuthMode,
    openAuthPage,
    selectedBuildingId,
    setSelectedBuildingId,
    navStartNodeId,
    setNavStartNodeId,
    navEndNodeId,
    setNavEndNodeId,
    openBuildingOnMap,
    navigateToBuilding,
    navigateToLocation,
    campusInfo,
    buildings,
    locations,
    mapNodes,
    routes,
    roomStatuses,
    feedbackList,
    mapLayouts,
    activeVerifiedLayout,
    isFirestoreBacked,
    user,
    userProfile,
    authReady,
    isAdmin,
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    resendVerificationEmail,
    signOutUser,
    authError,
    clearAuthError,
    saveBuilding,
    deleteBuilding,
    saveLocation,
    deleteLocation,
    updateRoomStatus,
    createRoomStatusForLocation,
    updateCampusInfo,
    submitFeedback,
    updateFeedbackStatus,
    submitMapLayout,
    reviewMapLayout,
    setActiveMapLayout,
    deleteMapLayout,
    seedDemoDataToFirestore,
    isSyncingSeed,
  };

  return <CampusContext.Provider value={value}>{children}</CampusContext.Provider>;
}

export function useCampus(): CampusContextValue {
  const ctx = useContext(CampusContext);
  if (!ctx) {
    throw new Error('useCampus must be used inside CampusProvider');
  }
  return ctx;
}
