# Smart Campus Security Specification

## 1. Data Invariants
1. **Admin-Only Campus Mutations**: Unauthenticated or non-admin users cannot create, update, or delete `buildings`, `locations`, `routes`, `room_status`, or `campus_info`.
2. **PII Isolation (`users`)**: User documents contain `email` PII and can only be read (`get`) by the document owner (`request.auth.uid == userId`) or a verified admin. Self-registration (`create`) must enforce `role == 'user'` unless the authenticated verified email matches the bootstrapped admin (`muja1311@gmail.com`). Users cannot escalate their own `role`.
3. **Feedback Ownership & Lifecycle**: Only verified signed-in users can submit `feedback`, must stamp `userId == request.auth.uid`, must initialize `status == 'open'`, and cannot read other users' feedback unless they are an admin. Only admins can change feedback `status` or delete feedback.
4. **Strict Field Allowlisting & Sizes**: Every write validates exact required and optional keys (`hasAll` + `hasOnly`), string lengths, numeric ranges, enum allowlists, and `isValidId()` regex (`^[a-zA-Z0-9_\\-]+$`).
5. **Email Verification Enforcement**: All authenticated write operations mandate `request.auth.token.email_verified == true`.
6. **Map Layout Submission & Admin Verification (`map_layouts`)**: Only verified signed-in users can submit a `map_layouts` document; it must initialize `status == 'pending'`, `isActive == false`, `reviewedBy == ''`, `reviewNotes == ''`, `submittedByUid == request.auth.uid`, and `createdAt == request.time`. Only verified admins can approve (`status: 'verified'`), reject (`status: 'rejected'`), toggle `isActive` (strictly requiring `status == 'verified'`), or delete a submission. Standard users can only read verified layouts or their own submissions.

## 2. The "Dirty Dozen+" Attack Payloads
1. Unauthenticated create on `/buildings/bldg_evil` -> `PERMISSION_DENIED`
2. Non-admin verified user update on `/room_status/rm_cs301` -> `PERMISSION_DENIED`
3. Shadow field injection (`isAdmin: true`) in `/users/{uid}` create -> `PERMISSION_DENIED`
4. Self role-escalation (`role: 'admin'`) in `/users/{uid}` update -> `PERMISSION_DENIED`
5. Unverified email spoofing admin email on `/buildings/bldg_1` -> `PERMISSION_DENIED`
6. Cross-user PII read (`get /users/other_uid`) by standard user -> `PERMISSION_DENIED`
7. Blanket `list` scrape on `/users` by standard user -> `PERMISSION_DENIED`
8. Oversized 10KB string in `/feedback/{id}.message` -> `PERMISSION_DENIED`
9. Invalid document ID (`../bad/id` or 200 chars) on `/feedback/{id}` -> `PERMISSION_DENIED`
10. Feedback identity spoofing (`userId: 'someone_else'`) on `/feedback/{id}` create -> `PERMISSION_DENIED`
11. Feedback status shortcutting (`status: 'resolved'`) on `/feedback/{id}` create -> `PERMISSION_DENIED`
12. Non-string or invalid enum `status: 'hacked'` on `/room_status/{id}` update by admin -> `PERMISSION_DENIED`
13. Self-verification shortcut (`status: 'verified'`, `isActive: true`) on `/map_layouts/{id}` create by non-admin -> `PERMISSION_DENIED`
14. Non-admin attempting to approve a pending layout on `/map_layouts/{id}` update -> `PERMISSION_DENIED`
15. Admin attempting to set `isActive: true` while `status: 'rejected'` on `/map_layouts/{id}` update -> `PERMISSION_DENIED`
16. Oversized `layoutContent` (> 100KB) or shadow field injection on `/map_layouts/{id}` create -> `PERMISSION_DENIED`
