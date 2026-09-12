---
slug: mood-board-create
title: Create a Mood Board
keywords:
  # English
  - mood board
  - design board
  - inspiration board
  - create mood board
  - new mood board
  - design inspiration
  - color palette
  - image board
  # Hinglish
  - mood board banana
  - mood board create karna
  - design board banana
  - naya mood board
  - inspiration board banana
  # Devanagari
  - मूड बोर्ड
  - मूड बोर्ड बनाना
  - डिज़ाइन बोर्ड
  - इंस्पिरेशन बोर्ड
  - नया मूड बोर्ड
sources:
  - frontend/src/config/navigation.ts
  - frontend/src/pages/MoodBoardDetail.tsx
  - frontend/src/pages/MoodBoardList.tsx
route: /mood-boards/new
---

## How to Access

1. Open command palette (Ctrl+K) and type "Mood Boards"
2. Or go to Design Studio and click Mood Boards link

## Steps to Create a Mood Board

1. Click **New Mood Board** button on the Mood Boards page
2. In the "Create Mood Board" dialog:
   - Enter **Name** (required) - e.g., "Spring 2026 Collection"
   - Enter **Description** (optional)
   - Select **Status**: Draft, Active, or Archived
3. Click **Create**

## Adding Items to the Canvas

After creating, use the left toolbar to add items:

### Add Image
1. Click the **Image** button (Upload icon)
2. Select an image file from your computer
3. Image appears on canvas - drag to position, resize as needed

### Add Text
1. Click the **Text** button (T icon)
2. Enter **Title** (required) - e.g., "Color Palette Notes"
3. Enter **Caption** (optional)
4. Click **Add Text**

### Add Color Swatch
1. Click the **Color** button (Palette icon)
2. Pick from preset colors or enter custom hex code
3. Click **Add Color**

## Managing Canvas Items

- **Select** an item by clicking it
- **Move** items by dragging
- **Resize** items by dragging corners
- **Bring to Front** - moves selected item above others
- **Send to Back** - moves selected item below others
- **Delete** - removes selected item from canvas

## Update Settings

1. Click **Settings** button in header
2. Modify name, description, or status
3. Click **Save**

## Filtering Mood Boards

On the list page:
- Use search box to find by name
- Filter by status (Draft, Active, Archived, or All)

## Traps

- **Name is required** - Cannot create a mood board without a name
- **Mood Boards in SEARCH_ONLY_ITEMS** - Access via command palette (Ctrl+K) or Design Studio, not directly in sidebar
- **Images upload one at a time** - Select one image per upload action
- **Delete is permanent** - Deleting a mood board removes all its items; cannot be undone
