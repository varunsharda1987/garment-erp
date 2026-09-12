---
slug: user-create
title: Add a New User
keywords:
  # English
  - add user
  - create user
  - new user
  - user registration
  - user management
  - staff account
  - employee account
  - add staff
  - create account
  # Hinglish
  - user add karna
  - new user banana
  - staff add karna
  - account banana
  - user create karna
  # Devanagari (MANDATORY)
  - यूज़र
  - नया यूज़र
  - यूज़र बनाना
  - स्टाफ एड करना
  - अकाउंट बनाना
sources:
  - frontend/src/config/navigation.ts
  - frontend/src/pages/Users.tsx
  - frontend/src/pages/UserForm.tsx
route: /users/new
---

## Steps
(Add new user)

1. Go to **Team & Settings** > **Users** in the sidebar
2. Click **+ Add User** button (top right)
3. Fill in the required fields:
   - **Email** - User's email address (used for login)
   - **Password** - Minimum 8 characters, must contain at least one uppercase letter, one lowercase letter, and one number
   - **First Name** - User's first name
   - **Last Name** - User's last name
4. Fill in optional fields:
   - **Phone** - Contact phone number
   - **WhatsApp Number** - For internal messaging (include country code without +, e.g., 919876543210 for India)
5. Select **Role** from dropdown:
   - Admin
   - Merchandiser
   - Production Manager
   - Sales
   - Inventory
   - Accounts
   - Quality
   - Purchase
   - Factory Supervisor
6. Select **Department** from dropdown:
   - Merchandising, Production, Cutting, Stitching, Finishing, Checking, Packing, Quality Control, Inventory/Stores, Sales/Marketing, Accounts/Finance, Purchase, Design, Dispatch, Maintenance, HR/Admin
7. Click **Create User** to save

## Traps
- Only **Admin** users can create, edit, or deactivate other users
- Password must meet all requirements: 8+ characters, 1 uppercase, 1 lowercase, 1 number
- Email must be unique - cannot create two users with the same email
- WhatsApp number format: include country code without the + symbol (e.g., 919876543210)
- You cannot deactivate your own account

## After saving
- New user appears in the Users list with "Active" status
- User can immediately log in with their email and password
- Role determines what features and pages the user can access
- To deactivate a user later: click "Deactivate" button next to their name in the list
- To permanently delete an inactive user: click "Delete" button (cannot be undone)
- To view pending user approvals: click "Pending Approvals" button at the top
