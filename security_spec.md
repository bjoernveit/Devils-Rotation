# Security Specification

## Data Invariants
1. Every `/users/{userId}` document can only be read, created, updated, or deleted by the authenticated user whose `request.auth.uid == userId`.
2. `UserProfile` stores only `uid`, `username` (3–30 chars matching `^[a-zA-Z0-9._\-]+$`), `createdAt`, and `updatedAt` — no PII (`email`, phone, address).
3. Every `/users/{userId}/plans/{planId}` document requires its parent `/users/{userId}` document to exist and belong to `request.auth.uid`.
4. `GamePlan` enforces strict keys (`ownerId`, `players`, `lineups`, optional `completedMinutes`, optional `clockMode`, `updatedAt`), bounded array lengths (`players.size() <= 40`, each interval `<= 15`, `completedMinutes.size() <= 20`), enum validation on `clockMode`, and server-enforced `request.time` timestamps.

## Dirty Dozen Payloads (Expected: PERMISSION_DENIED)
1. Unauthenticated read on `/users/uid1/plans/default`.
2. Authenticated `uid2` reading `/users/uid1`.
3. Authenticated `uid2` creating `/users/uid1/plans/default` with `ownerId: "uid1"`.
4. Authenticated `uid1` creating `/users/uid1` with `uid: "uid2"`.
5. Authenticated `uid1` creating `/users/uid1` with extra ghost field `isAdmin: true`.
6. Authenticated `uid1` updating `/users/uid1` to mutate `createdAt` or `uid`.
7. Authenticated `uid1` creating `/users/uid1` with `username` shorter than 3 chars or containing `@` / spaces.
8. Authenticated `uid1` creating `/users/uid1/plans/default` when parent `/users/uid1` does not exist.
9. Authenticated `uid1` writing `/users/uid1/plans/default` with client-forged `updatedAt` != `request.time`.
10. Authenticated `uid1` writing `/users/uid1/plans/default` with > 40 players or > 15 slots in an interval.
11. Authenticated `uid1` writing `/users/uid1/plans/default` with missing or extra keys in `lineups`.
12. Authenticated `uid1` attempting to list `/users`.
