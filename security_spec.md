# Bruv-study Firestore Security Specification (Phase 0)

## 1. Data Invariants
1. **Owner Isolation (`/users/{userId}` & Subcollections)**:
   - A user workspace document and all child `subjects`, `sessions`, `todos`, and `ddays` can only be read or mutated by the verified owner (`request.auth.uid == userId && request.auth.token.email_verified == true`).
   - Every child document (`Subject`, `StudySession`, `TodoItem`, `DDayTarget`) must reference a valid existing parent `/users/{userId}` document (`exists(...)`) and match `data.userId == request.auth.uid`.
2. **Referential Integrity on Study Sessions & Todos**:
   - A `StudySession` or `TodoItem` must reference an existing `Subject` under `/users/{userId}/subjects/{subjectId}` (`exists(...)`).
3. **Immutable Ownership & Server Timestamps**:
   - `uid`, `userId`, `ownerId`, `authorId`, `groupId`, and `createdAt` are immutable after creation.
   - All `createdAt` and `updatedAt` timestamps must equal `request.time`.
4. **Zero-PII Public Collections & Scoped List Queries**:
   - `/leaderboard/{userId}` contains zero PII (`email`, `phone`, `address`) and enforces `allow list` via `resource.data.isPublic == true || resource.data.userId == request.auth.uid`.
   - `/studyGroups/{groupId}` enforces `allow list` via `resource.data.isPrivate == false || resource.data.ownerId == request.auth.uid`.
   - Subcollection `members` and `missions` list queries evaluate `resource.data.isPrivateGroup == false || resource.data.userId == request.auth.uid` / `authorId == request.auth.uid` without `get()` inside `allow list`.
5. **Strict Key & Size Boundaries**:
   - Every string enforces `.size()` bounds; every array enforces `.size() <= MAX`; shadow/ghost keys are rejected via `hasOnly(...)` on create and `affectedKeys().hasOnly(...)` on update.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Identity Spoofing (User Workspace)**: Authenticated user `uidA` tries creating `/users/uidB` with `{ uid: "uidB", ... }` -> **Expected: PERMISSION_DENIED**.
2. **Unverified Email Write**: Authenticated user with `email_verified: false` attempts to write `/users/uidA/subjects/s1` -> **Expected: PERMISSION_DENIED**.
3. **Shadow / Ghost Field Injection**: User `uidA` sends `{ ..., isAdmin: true, proBypass: true }` on `/users/uidA` -> **Expected: PERMISSION_DENIED** (`hasOnly` rejects unknown fields).
4. **Orphaned Session Without Subject**: User `uidA` creates `/users/uidA/sessions/sess1` pointing to non-existent `subjectId: "missing-subj"` -> **Expected: PERMISSION_DENIED**.
5. **Forged Client Timestamp**: User `uidA` creates a subject with `createdAt: "2020-01-01T00:00:00Z"` instead of `request.time` -> **Expected: PERMISSION_DENIED**.
6. **ID Poisoning Attack**: User `uidA` attempts to write `/users/uidA/subjects/invalid$id*with<script>` or a 200-char document ID -> **Expected: PERMISSION_DENIED** (`isValidId` rejects).
7. **Immutable Field Mutation**: User `uidA` updates `/studyGroups/g1` trying to change `ownerId` to `"uidB"` -> **Expected: PERMISSION_DENIED**.
8. **Unbounded Array / Denial-of-Wallet**: User `uidA` sends `allowedTools` with 50 items or non-string entries `[12345]` -> **Expected: PERMISSION_DENIED**.
9. **Public Leaderboard Hijack**: User `uidA` tries updating `/leaderboard/uidB` -> **Expected: PERMISSION_DENIED**.
10. **Non-Owner Study Group Edit**: User `uidB` tries updating `name` or `maxMembers` of a group owned by `uidA` -> **Expected: PERMISSION_DENIED**.
11. **Group Member Cross-User Impersonation**: User `uidB` tries writing `/studyGroups/g1/members/uidA` with `userId: "uidA"` -> **Expected: PERMISSION_DENIED**.
12. **Blanket List / Private Group Scraping**: User `uidB` runs an unfiltered query on `/studyGroups` trying to read private groups owned by `uidA` -> **Expected: PERMISSION_DENIED**.
