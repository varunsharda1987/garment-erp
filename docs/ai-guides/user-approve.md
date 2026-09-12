---
slug: user-approve
title: Approve Pending Users
keywords:
  # English
  - approve user
  - pending users
  - user approval
  - new user registration
  - approve registration
  - reject user
  - pending approvals
  # Hinglish
  - user approve karna
  - pending user approve
  - naya user approve
  - user reject karna
  - registration approve
  # Devanagari
  - यूज़र अप्रूव
  - पेंडिंग यूज़र
  - नया यूज़र अप्रूव
  - यूज़र रिजेक्ट
  - रजिस्ट्रेशन अप्रूव
sources:
  - frontend/src/config/navigation.ts
  - frontend/src/pages/PendingUsersPage.tsx
  - frontend/src/services/user.service.ts
route: /users/pending
---

## Steps
(Approve or reject new user registrations)

1. Open **Team & Settings** in the sidebar
2. Click **Pending Approvals**
3. Review the list of pending users showing:
   - Name and phone number
   - Email address
   - Requested role (e.g., ADMIN, PRODUCTION_MANAGER, MERCHANDISER)
   - Registration time (e.g., "2 days ago")
4. For each user, choose one action:
   - Click **Approve** (green button) to allow them to log in with their requested role
   - Click **Reject** (red button) to permanently delete their registration
5. Confirm the action in the dialog that appears

## Traps
- **Reject is permanent**: Rejected users are permanently deleted. They must register again if they need access.
- **Role is fixed at approval**: The user gets the role they requested during registration. To change it later, go to Users list and edit their role.
- **Admin only**: Only users with the `users` permission can access this page.
- **No partial approval**: You cannot modify the requested role during approval. Approve as-is or reject.
