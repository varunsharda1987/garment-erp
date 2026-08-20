---
slug: season-create
title: "Add a Season (Season Master)"
keywords:
  - season
  - season master
  - SS
  - AW
  - spring summer
  - autumn winter
  - add season
  - season kaise banaye
  - naya season
  - सीजन
  - सीज़न
  - मौसम
  - नया सीजन
  - collection year
sources:
  - frontend/src/pages/SeasonMasterList.tsx
  - frontend/src/pages/SeasonMasterForm.tsx
  - frontend/src/pages/MasterDataDashboard.tsx
  - frontend/src/types/season.types.ts
  - frontend/src/config/navigation.ts
  - frontend/src/components/Sidebar.tsx
  - frontend/src/App.tsx
  - backend/src/schemas/season.schema.ts
---

**Before you start:** Seasons is not a direct sidebar link. Open **Materials & Masters → All Masters** in the sidebar, then the **Configuration** section, then click **Seasons**. You can also press **Ctrl+K** and type "Seasons".

## Steps

1. The page is titled **Season Master**. Check the list first — the season you need may already exist.
2. **Fastest way for a whole range of years:** click **Generate Seasons**. Enter **Start Year** and **End Year**, then click **Generate Seasons** in the dialog. The system creates both SS (Spring/Summer) and AW (Autumn/Winter) for every year in the range and skips any that already exist.
3. **To add one season by hand:** click **Add Season**. The form opens as **Add New Season**.
4. Choose **Season Type** — only two values exist: **SS** (Spring/Summer) or **AW** (Autumn/Winter). Required.
5. Choose **Year** from the dropdown. Required. Only years between 2000 and 2100 are accepted.
6. **Season Code** fills in automatically from the type and year (for example SS26). Required. You may edit it, but keep it short — maximum 20 characters, and it is saved in capitals.
7. **Season Name** also fills in automatically (for example Spring/Summer 2026). Required, maximum 100 characters. Change it if your team uses a different name.
8. Leave **Active Status** switched on so the season appears in dropdowns elsewhere. Switch it off to hide it without deleting.
9. Check the **Preview** box at the bottom, then click **Create Season**. Use **Cancel** or **Back to Seasons** to leave without saving.

## Notes and traps

- **Season Type**, **Year** and **Season Code** are locked when you edit an existing season. Only the name and the active switch can be changed afterwards. If the type or year is wrong, delete the season and create it again.
- **Generate Seasons** refuses a range where the end year is before the start year, and refuses ranges longer than 20 years.
- Generating is safe to repeat — existing seasons are skipped, not duplicated. The success message tells you how many were created and how many were skipped.
- Use the **Year**, **Type** and **Status** filters at the top of the list to find a season quickly.
