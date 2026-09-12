---
slug: design-dashboard
title: Use the Design Dashboard
keywords:
  # English
  - design dashboard
  - design hub
  - design studio
  - style dashboard
  - designer workspace
  - mood boards
  - catalogue generator
  - recent styles
  - team activity
  - styles by season
  # Hinglish
  - design dashboard dekhna
  - designer ka page
  - mood board banana
  - catalogue banana
  - recent styles dekhna
  - team activity dekhna
  # Devanagari
  - डिज़ाइन डैशबोर्ड
  - डिज़ाइन हब
  - स्टाइल डैशबोर्ड
  - मूड बोर्ड
  - कैटलॉग जनरेटर
  - टीम एक्टिविटी
  - सीजन के हिसाब से स्टाइल
sources:
  - frontend/src/config/navigation.ts
  - frontend/src/pages/DesignDashboard.tsx
  - frontend/src/services/designerDashboard.service.ts
  - frontend/src/types/designerDashboard.types.ts
route: /design-dashboard
---

## Steps

### Opening the Design Dashboard

1. Click **Pre-Production** in the left sidebar
2. Click **Design Studio** (Palette icon)
3. The Design Hub page opens at `/design-dashboard`

### Viewing Style Statistics

The dashboard displays 4 stat cards at the top:

1. **Total Styles** - Shows the total count of all styles in the system
2. **Drafts** - Shows count of styles in DRAFT status
3. **Active** - Shows count of styles in ACTIVE status
4. **Archived** - Shows count of ARCHIVED styles

### Viewing Recent Styles

1. The **Recent Styles** section shows a grid of your latest work
2. Each card displays:
   - Style image (or placeholder if no image)
   - Status badge (DRAFT, ACTIVE, DISCONTINUED, ARCHIVED)
   - Style code
   - Buyer reference (if available)
   - Style name
   - Season (if assigned)
3. Click any style card to open that style's detail page
4. Click **View All** button to go to the full Styles list

### Using Quick Actions

The **Quick Actions** card provides shortcuts:

1. **New Style** - Click to create a new style at `/styles/new`
2. **New Mood Board** - Click to create a mood board at `/mood-boards/new`
3. **Generate Catalogue** - Click to open the catalogue generator at `/catalogue-generator`

### Viewing Team Activity

The **Team Activity** section shows recent comments from team members:

1. Each entry shows:
   - Team member's avatar with initials
   - Team member's name
   - Style code link (click to view that style)
   - Comment excerpt
   - Timestamp (e.g., "2 hours ago")
2. Click the style code link to navigate directly to that style

### Viewing Styles by Season

If styles are assigned to seasons, a **Styles by Season** card appears:

1. Shows each season name
2. Displays a progress bar showing proportion of total styles
3. Shows the count number for each season
4. Up to 5 seasons are displayed

### Header Actions

From the page header, you can:

1. Click **Mood Boards** button to view all mood boards at `/mood-boards`
2. Click **New Style** button to create a new style

## Understanding the Metrics

| Card | Description |
|------|-------------|
| Total Styles | All styles across all statuses |
| Drafts | Styles not yet finalized (DRAFT status) |
| Active | Styles currently in production or available (ACTIVE status) |
| Archived | Styles no longer in use (ARCHIVED status) |

### Status Colors on Style Cards

| Status | Color |
|--------|-------|
| DRAFT | Gray background |
| ACTIVE | Green background |
| DISCONTINUED | Yellow/orange background |
| ARCHIVED | Red background |

## Related Pages

- **Mood Boards** (`/mood-boards`) - Create and manage design inspiration boards
- **Catalogue Generator** (`/catalogue-generator`) - Generate lookbooks and catalogues
- **Styles** (`/styles`) - View and manage all styles
- **New Style** (`/styles/new`) - Create a new style
