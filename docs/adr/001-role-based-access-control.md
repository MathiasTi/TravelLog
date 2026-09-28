# ADR 001: Decentralized Role-Based Access Control (RBAC) for Trip Collaboration

## Status
**Accepted** (Version 1.4.0)

## Context
Travelers need to invite friends, family, and tour groups to their trips. However, different companions require different levels of access:
1. **Trip Owners / Organizers**: Require full administrative control over settings, itinerary, and member roles.
2. **Co-Travelers (Editors)**: Need to record memories, upload photos/videos, and log route stops together.
3. **Family / Followers (Viewers)**: Wish to follow along on the map and view stories in read-only mode without accidentally modifying the itinerary.

## Decision
We implemented a role-based access control (RBAC) system with three distinct roles:
- `owner`: Full administrative privileges, collaborator role management, password configuration, and trip deletion.
- `editor`: Read & write access to journal entries, photo uploads, reordering, and comments.
- `viewer`: Read-only access to view maps, chronological timeline, gallery, and travel statistics.

### Architectural Rules
1. **Single Source of Truth**: All permission logic is centralized in `src/utils/permissions.ts` with pure, deterministic helper functions (`getUserRoleInTrip`, `isTripOwner`, `canCreateOrEditEntries`, `canManageCollaborators`, `canDeleteEntry`).
2. **Owner Invariant Protection**: A trip must always have at least one owner. The UI and logic strictly disallow removing the final owner or demoting the last owner to prevent orphaned trips.
3. **Permission-Aware UI Feedback**: All write controls (Add Memory button, Reorder controls, Map pin drops, Edit/Delete icons) dynamically adapt their visual state and provide informative badges explaining permissions.

## Consequences
- **Positive**:
  - Secure and transparent permission sharing.
  - Zero accidental overrides by read-only viewers.
  - Smooth multi-user collaboration.
- **Negative**:
  - Requires permission checks across interactive surfaces. Handled via pure utility functions to prevent duplication.
