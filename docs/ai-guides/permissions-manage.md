---
slug: permissions-manage
title: Control what each role can do (Permissions page)
keywords:
  # English
  - permissions
  - user permissions
  - access control
  - roles
  - role permissions
  - permission matrix
  - reset permissions
  - audit log
  - enable permission
  - disable permission
  - cannot create
  - access denied
  - your role does not have access
  - only an administrator can do this
  - menu item missing
  - all on
  - all off
  # Hinglish
  - permission dena
  - permission hatana
  - access control karna
  - role set karna
  - permission change karna
  - permission reset karna
  - access nahi hai
  - menu me nahi dikh raha
  - permision
  - permisson
  # Devanagari (MANDATORY)
  - परमिशन
  - एक्सेस कंट्रोल
  - यूज़र परमिशन
  - रोल परमिशन
  - परमिशन देना
  - परमिशन हटाना
  - एक्सेस नहीं है
  - अनुमति
sources:
  - frontend/src/config/navigation.ts
  - frontend/src/components/Sidebar.tsx
  - frontend/src/pages/PermissionManagement.tsx
  - frontend/src/config/permissions.config.ts
  - frontend/src/hooks/usePermissions.ts
  - frontend/src/services/permission.service.ts
  - backend/src/config/permissions.config.ts
  - backend/src/middleware/auth.middleware.ts
route: /admin/permissions
---

## What this page does

The Permission Management page decides what each role can do in the system. Every switch is enforced by the server: when a switch is off, users in that role cannot create, change, approve or delete anything in that module, and the module disappears from their sidebar. They can still open other pages and look things up.

Only administrators can open this page.

## Steps to change a permission

1. Open **Team & Settings → Permissions** in the sidebar. The page title is **Permission Management**.
2. Find the module in the **Permission Matrix** table (rows are modules, columns are roles). Use the **Search permissions...** box or the **All Categories** dropdown to narrow the list, or click a role card at the top to show only that role's column.
3. Click the switch where the module row meets the role column. Blue is enabled, grey is disabled.
4. The change saves immediately — a message confirms **Enabled … for …** or **Disabled … for …**.

## When the change reaches the user

- The server applies it straight away: the next save that user attempts is allowed or refused.
- Their sidebar updates when they next reload the app or sign in.
- A refused save shows the message **Your role does not have access to …. Ask an administrator to enable it on the Permissions page.**

## Turn everything on or off for one role

1. In the role cards at the top, click **All on** or **All off** under the role.
2. Confirm with **Yes, enable all** or **Yes, disable all**.
3. **All off** leaves the role able to sign in and look things up, but not create or change anything until modules are switched back on.

## Admin is always full access

The **Admin** column is always on and cannot be changed. User management, this Permissions page, audit logs, Tally and e-Invoice settings, permanent deletes and financial approvals are always admin-only — no switch on this page opens them to other roles.

## Available roles

- **Admin** — full system access, always
- **Merchandiser**, **Production Mgr**, **Sales**, **Accounts**, **Inventory**, **Quality**, **Purchase**, **Factory Sup.** — whatever their switches say

## Reset to defaults

1. Click **Reset to Defaults** (top right).
2. Read the warning: this puts every role back to a restricted built-in set (for example Sales keeps Orders, Quotations, Invoices, Styles and Customers) and discards every change made on this page. Users lose access to modules that default to off.
3. Click **Yes, Reset All** to proceed, or **Cancel**.

## Export the matrix

Click **Export CSV** (top right). The file `permission-matrix.csv` downloads and opens in Excel or Google Sheets.

## See who changed what

Click **Recent Changes** at the bottom to expand it. Each entry shows the module, the role, whether it was enabled or disabled, who did it and when.

## Traps

- A user who cannot see a module in the sidebar, or gets "Your role does not have access", needs that module's switch turned on for their role here — then they reload the app.
- "Only an administrator can do this" means the action is on the admin-only list above; no switch can open it.
- The Admin column cannot be changed; use a different role for someone who should have less.
- **Reset to Defaults** affects every role at once, not only the role you have filtered to.
