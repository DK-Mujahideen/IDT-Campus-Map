/**
 * Security Rule Verification Specification & Test Matrix for Smart Campus.
 * Documents the 12 adversarial payloads tested against firestore.rules.
 */

export interface SecurityTestCase {
  id: number;
  name: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  path: string;
  auth: { uid: string; email: string; email_verified: boolean } | null;
  payload?: Record<string, unknown>;
  expectedResult: 'ALLOW' | 'PERMISSION_DENIED';
}

export const DIRTY_DOZEN_SECURITY_TESTS: SecurityTestCase[] = [
  {
    id: 1,
    name: 'Unauthenticated create on buildings',
    operation: 'create',
    path: '/buildings/bldg_evil',
    auth: null,
    payload: { id: 'bldg_evil', name: 'Fake Block', visibility: 'public' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 2,
    name: 'Non-admin verified user update on room_status',
    operation: 'update',
    path: '/room_status/rm_cs301',
    auth: { uid: 'student_1', email: 'student@msajce.edu', email_verified: true },
    payload: { status: 'available' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 3,
    name: 'Shadow field injection on users create',
    operation: 'create',
    path: '/users/student_1',
    auth: { uid: 'student_1', email: 'student@msajce.edu', email_verified: true },
    payload: { uid: 'student_1', displayName: 'Student', email: 'student@msajce.edu', role: 'user', isAdmin: true },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 4,
    name: 'Self role escalation on users update',
    operation: 'update',
    path: '/users/student_1',
    auth: { uid: 'student_1', email: 'student@msajce.edu', email_verified: true },
    payload: { role: 'admin' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 5,
    name: 'Unverified email spoofing admin on buildings create',
    operation: 'create',
    path: '/buildings/bldg_spoof',
    auth: { uid: 'spoof_uid', email: 'muja1311@gmail.com', email_verified: false },
    payload: { id: 'bldg_spoof', name: 'Spoof Block', visibility: 'public' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 6,
    name: 'Cross-user PII read on users collection',
    operation: 'get',
    path: '/users/other_uid',
    auth: { uid: 'student_1', email: 'student@msajce.edu', email_verified: true },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 7,
    name: 'Blanket list scrape on users collection by non-admin',
    operation: 'list',
    path: '/users',
    auth: { uid: 'student_1', email: 'student@msajce.edu', email_verified: true },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 8,
    name: 'Oversized message string on feedback create',
    operation: 'create',
    path: '/feedback/fb_1',
    auth: { uid: 'student_1', email: 'student@msajce.edu', email_verified: true },
    payload: { id: 'fb_1', userId: 'student_1', authorName: 'Student', category: 'general', subject: 'Hi', message: 'A'.repeat(2000), status: 'open' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 9,
    name: 'Invalid document ID path poisoning',
    operation: 'create',
    path: '/feedback/bad$id',
    auth: { uid: 'student_1', email: 'student@msajce.edu', email_verified: true },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 10,
    name: 'Feedback identity spoofing (mismatched userId)',
    operation: 'create',
    path: '/feedback/fb_2',
    auth: { uid: 'student_1', email: 'student@msajce.edu', email_verified: true },
    payload: { id: 'fb_2', userId: 'other_student', authorName: 'Other', category: 'general', subject: 'Test', message: 'Valid body', status: 'open' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 11,
    name: 'Feedback status shortcutting to resolved on create',
    operation: 'create',
    path: '/feedback/fb_3',
    auth: { uid: 'student_1', email: 'student@msajce.edu', email_verified: true },
    payload: { id: 'fb_3', userId: 'student_1', authorName: 'Student', category: 'general', subject: 'Test', message: 'Valid body', status: 'resolved' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 12,
    name: 'Invalid enum value on room_status update by admin',
    operation: 'update',
    path: '/room_status/rm_cs301',
    auth: { uid: 'admin_uid', email: 'muja1311@gmail.com', email_verified: true },
    payload: { status: 'hacked' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 13,
    name: 'Map layout self-verification shortcut on create',
    operation: 'create',
    path: '/map_layouts/layout_spoof',
    auth: { uid: 'student_1', email: 'student@msajce.edu', email_verified: true },
    payload: {
      id: 'layout_spoof',
      submittedByUid: 'student_1',
      status: 'verified',
      isActive: true,
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 14,
    name: 'Non-admin attempting to verify pending map layout',
    operation: 'update',
    path: '/map_layouts/layout_1',
    auth: { uid: 'student_1', email: 'student@msajce.edu', email_verified: true },
    payload: { status: 'verified', reviewedBy: 'student_1', reviewNotes: 'Looks legit' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 15,
    name: 'Activating a rejected map layout',
    operation: 'update',
    path: '/map_layouts/layout_1',
    auth: { uid: 'admin_uid', email: 'muja1311@gmail.com', email_verified: true },
    payload: { status: 'rejected', isActive: true },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 16,
    name: 'Oversized layoutContent payload on map_layouts create',
    operation: 'create',
    path: '/map_layouts/layout_huge',
    auth: { uid: 'student_1', email: 'student@msajce.edu', email_verified: true },
    payload: {
      id: 'layout_huge',
      submittedByUid: 'student_1',
      layoutContent: 'X'.repeat(120000),
      status: 'pending',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
];
