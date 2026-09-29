-- Pattern Department (owner, 2026-09-29): a role for the pattern masters.
-- Its role_permissions rows are filled in at the config defaults on the next API boot
-- (PermissionService.ensureSeeded), and are edited on the Permissions page from then on.
ALTER TYPE "UserRole" ADD VALUE 'PATTERN_MASTER';
