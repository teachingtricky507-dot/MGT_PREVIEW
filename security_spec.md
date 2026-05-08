# Security Specification - Emergent

## Data Invariants
1. **User Identity**: A user can only modify their own profile. Profile data (email, displayName) is restricted to the owner for write.
2. **Project Membership**: Only project members can read issues, comments, activities, and messages linked to that project.
3. **Project Ownership**: Only the project owner can update project settings or delete the project.
4. **Issue Integrity**: Issues must belong to a valid project ID. Status and Priority must match predefined enums.
5. **Comment Authorship**: Only the author of a comment can update or delete it.
6. **Activity & Messages**: These are immutable logs once created, though they must be correctly associated with a project.

## The "Dirty Dozen" Payloads (Red Team Audit)
1. **Unauthorized Project Read**: A user attempts to read a project document they are not a member of.
2. **Unauthorized Issue Read**: A user attempts to list issues for a project they are not a member of.
3. **Member Escalation**: A non-owner member attempts to update the project's member list or ownerId.
4. **Identity Spoofing**: A user creates an issue but sets the `reporterId` to another user's UID.
5. **Status Corruption**: A user updates an issue status to a value not in the enum (e.g., `status: 'DELETED'`).
6. **Message Impersonation**: A user sends a chat message but sets the `senderId` to another user.
7. **Foreign Project Write**: A user attempts to create an issue in a project they are a member of, but provides a `projectId` field that doesn't match the path.
8. **PII Leakage**: A user attempts to read another user's private info (if we had any, currently profile is public for members).
9. **Timestamp Manipulation**: A user sets `createdAt` to a date in the past instead of `request.time`.
10. **Orphaned Message**: A user creates a message in a project subcollection with a `projectId` field pointing to a different non-existent project.
11. **Shadow Update**: A user updates an issue with a "Ghost Field" `isVerified: true`.
12. **Recursive Access Attack**: A user attempts to use a deeply nested document ID that is actually a long 1MB string.

## Red Team Conflict Report
| Collection | Identity Spoofing | State Shortcutting | Resource Poisoning |
|------------|-------------------|--------------------|-------------------|
| users      | Blocked (isOwner) | N/A                | Blocked (size)    |
| projects   | Blocked (isOwner) | N/A                | Blocked (size)    |
| issues     | Blocked (isMember)| Blocked (isValid)  | Blocked (size)    |
| comments   | Blocked (isAuthor)| N/A                | Blocked (size)    |
| activities | Blocked (isSystem)| N/A                | Blocked (size)    |
| messages   | Blocked (isSender)| N/A                | Blocked (size)    |
