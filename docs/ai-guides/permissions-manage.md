---
slug: permissions-manage
title: Manage User Permissions
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
  # Hinglish
  - permission dena
  - permission hatana
  - access control karna
  - role set karna
  - permission change karna
  - permission reset karna
  # Devanagari (MANDATORY)
  - परमिशन
  - एक्सेस कंट्रोल
  - यूज़र परमिशन
  - रोल परमिशन
  - परमिशन देना
  - परमिशन हटाना
sources:
  - frontend/src/config/navigation.ts
  - frontend/src/pages/PermissionManagement.tsx
  - frontend/src/config/permissions.config.ts
  - backend/src/config/permissions.config.ts
  - frontend/src/services/permission.service.ts
route: /admin/permissions
---

## Overview

The Permission Management page allows administrators to control which features each role can access. Permissions are organized in a matrix showing all roles against all system features.

## Steps to manage permissions

1. **Open the page**: Admin (sidebar) > Permissions
2. **View the permission matrix**: See all permissions as rows and roles as columns
3. **Toggle a permission**: Click the switch in the cell where the permission row meets the role column
   - Blue switch = Enabled (role can access)
   - Gray switch = Disabled (role cannot access)
4. **Changes save automatically** when you toggle a switch

## Filter permissions

1. **Search**: Type in the search box to find specific permissions by name
2. **Filter by category**: Select a module group from the dropdown (Dashboard, Styles, Orders, Manufacturing, etc.)
3. **Filter by role**: 
   - Click a role card at the top to show only that role's column
   - Click the same card again to show all roles
   - Or use the role dropdown in the filters

## Available roles

The system has 9 roles:
- **Admin** - Full system access
- **Merchandiser** - Styles, customers, costing
- **Production Manager** - Production tracking, work orders
- **Sales** - Orders, quotations, customers
- **Accounts** - Invoices, payments, finance
- **Inventory** - Stock management
- **Quality** - Inspections, testing
- **Purchase** - POs, suppliers, procurement
- **Factory Supervisor** - Shop floor operations

## Permission categories

Permissions are grouped by module:
- **Dashboard** - Main dashboard, process guide, production status, AI assistant
- **Styles** - Style management, CAD planning, cost sheets
- **Orders** - Order management, work orders, BOM, MRP
- **Manufacturing** - Samples, printing, dyeing, cutting, stitching, finishing, challans, dispatch, job work
- **Inventory** - Stock dashboard, stock levels, stock counts, movements
- **Procurement** - Purchase orders, GRN, material requirements
- **Masters** - Customers, suppliers, fabric masters, trim masters, colors, seasons
- **Finance** - Reports, chart of accounts, invoices, quotations
- **Quality** - Testing
- **Messaging** - WhatsApp, internal messaging
- **Admin** - User management, permissions, override history

## Reset to defaults

1. Click the **Reset to Defaults** button (top right)
2. A confirmation dialog appears warning that all custom changes will be lost
3. Click **Yes, Reset All** to restore original permissions
4. All permissions return to their default configuration

## Export permissions

1. Click the **Export CSV** button (top right)
2. A file `permission-matrix.csv` downloads
3. Open in Excel or Google Sheets to review/share the permission matrix

## View audit log

1. Click the **Recent Changes** section at the bottom to expand it
2. See a list of permission changes with:
   - What permission was enabled/disabled
   - Which role was affected
   - Who made the change
   - When it happened

## Role summary cards

At the top of the page, each role shows:
- How many permissions are enabled (e.g., "45 / 50 modules")
- Click a card to filter the matrix to only that role

## Traps

- **Admin permission cannot be disabled for Admin role** - This prevents locking yourself out
- **Changes take effect immediately** - Users with that role see the change on their next page load
- **Reset to Defaults affects ALL roles** - Not just the currently filtered role
- **Only admins can access this page** - The permissions permission itself controls access
