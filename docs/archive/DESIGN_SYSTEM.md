# Garment ERP Design System

This document outlines the design system for the Garment ERP application. External designers should follow these guidelines to maintain consistency across all pages.

## Tech Stack

- **CSS Framework:** Tailwind CSS
- **Component Library:** shadcn/ui (built on Radix UI primitives)
- **Dark Mode:** Supported (class-based toggle)
- **Reference:** https://ui.shadcn.com/docs/components

---

## Color Palette

### Light Mode

| Token | HSL Value | Hex | Usage |
|-------|-----------|-----|-------|
| Background | `hsl(0 0% 100%)` | `#FFFFFF` | Page background |
| Foreground | `hsl(222.2 84% 4.9%)` | `#020817` | Primary text |
| Primary | `hsl(222.2 47.4% 11.2%)` | `#0F172A` | Primary buttons, links |
| Primary Foreground | `hsl(210 40% 98%)` | `#F8FAFC` | Text on primary |
| Secondary | `hsl(210 40% 96.1%)` | `#F1F5F9` | Secondary buttons, backgrounds |
| Secondary Foreground | `hsl(222.2 47.4% 11.2%)` | `#0F172A` | Text on secondary |
| Muted | `hsl(210 40% 96.1%)` | `#F1F5F9` | Subtle backgrounds |
| Muted Foreground | `hsl(215.4 16.3% 46.9%)` | `#64748B` | Secondary text, placeholders |
| Accent | `hsl(210 40% 96.1%)` | `#F1F5F9` | Hover states |
| Accent Foreground | `hsl(222.2 47.4% 11.2%)` | `#0F172A` | Text on accent |
| Border | `hsl(214.3 31.8% 91.4%)` | `#E2E8F0` | Borders, dividers |
| Input | `hsl(214.3 31.8% 91.4%)` | `#E2E8F0` | Input borders |
| Ring | `hsl(222.2 84% 4.9%)` | `#020817` | Focus rings |

### Dark Mode

| Token | HSL Value | Hex | Usage |
|-------|-----------|-----|-------|
| Background | `hsl(222.2 84% 4.9%)` | `#020817` | Page background |
| Foreground | `hsl(210 40% 98%)` | `#F8FAFC` | Primary text |
| Primary | `hsl(210 40% 98%)` | `#F8FAFC` | Primary buttons, links |
| Primary Foreground | `hsl(222.2 47.4% 11.2%)` | `#0F172A` | Text on primary |
| Secondary | `hsl(217.2 32.6% 17.5%)` | `#1E293B` | Secondary buttons, backgrounds |
| Secondary Foreground | `hsl(210 40% 98%)` | `#F8FAFC` | Text on secondary |
| Muted | `hsl(217.2 32.6% 17.5%)` | `#1E293B` | Subtle backgrounds |
| Muted Foreground | `hsl(215 20.2% 65.1%)` | `#94A3B8` | Secondary text, placeholders |
| Accent | `hsl(217.2 32.6% 17.5%)` | `#1E293B` | Hover states |
| Accent Foreground | `hsl(210 40% 98%)` | `#F8FAFC` | Text on accent |
| Border | `hsl(217.2 32.6% 17.5%)` | `#1E293B` | Borders, dividers |
| Input | `hsl(217.2 32.6% 17.5%)` | `#1E293B` | Input borders |
| Ring | `hsl(212.7 26.8% 83.9%)` | `#CBD5E1` | Focus rings |

### Semantic Colors (Same for Both Modes)

| Token | HSL Value | Hex | Usage |
|-------|-----------|-----|-------|
| Destructive | `hsl(0 84.2% 60.2%)` | `#EF4444` | Delete buttons, errors |
| Destructive Foreground | `hsl(210 40% 98%)` | `#F8FAFC` | Text on destructive |
| Success | `hsl(142.1 76.2% 36.3%)` | `#22C55E` | Success states, confirmations |
| Success Foreground | `hsl(210 40% 98%)` | `#F8FAFC` | Text on success |
| Warning | `hsl(38 92% 50%)` | `#F59E0B` | Warning states, alerts |
| Warning Foreground | `hsl(222.2 47.4% 11.2%)` | `#0F172A` | Text on warning |
| Info | `hsl(221.2 83.2% 53.3%)` | `#3B82F6` | Information, highlights |
| Info Foreground | `hsl(210 40% 98%)` | `#F8FAFC` | Text on info |

---

## Typography

### Font Family
System font stack (Tailwind default):
```
font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont,
  "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif;
```

### Font Sizes

| Name | Size | Line Height | Usage |
|------|------|-------------|-------|
| `text-xs` | 12px | 16px | Small labels, badges |
| `text-sm` | 14px | 20px | **Default body text**, form labels |
| `text-base` | 16px | 24px | Large body text |
| `text-lg` | 18px | 28px | Subheadings |
| `text-xl` | 20px | 28px | Section headings |
| `text-2xl` | 24px | 32px | Page titles |
| `text-3xl` | 30px | 36px | Large titles |

### Font Weights

| Weight | Value | Usage |
|--------|-------|-------|
| Normal | 400 | Body text |
| Medium | 500 | Labels, emphasized text |
| Semibold | 600 | Headings, buttons |
| Bold | 700 | Strong emphasis |

---

## Spacing

### Base Unit
4px (0.25rem) - All spacing should be multiples of this unit.

### Spacing Scale

| Name | Value | Pixels |
|------|-------|--------|
| `0` | 0 | 0px |
| `1` | 0.25rem | 4px |
| `2` | 0.5rem | 8px |
| `3` | 0.75rem | 12px |
| `4` | 1rem | 16px |
| `5` | 1.25rem | 20px |
| `6` | 1.5rem | 24px |
| `8` | 2rem | 32px |
| `10` | 2.5rem | 40px |
| `12` | 3rem | 48px |
| `16` | 4rem | 64px |

### Common Spacing Patterns

- **Page padding:** 32px (2rem)
- **Card padding:** 24px (1.5rem)
- **Form field gap:** 16px (1rem)
- **Button padding:** 16px horizontal, 8px vertical
- **Table cell padding:** 12px (0.75rem)

---

## Border Radius

| Name | Value | Usage |
|------|-------|-------|
| `sm` | 4px | Small elements, badges |
| `md` | 6px | Inputs, small buttons |
| `lg` | 8px | **Default** - Cards, buttons, modals |
| `xl` | 12px | Large cards |
| `full` | 9999px | Pills, avatars |

---

## Shadows

| Name | Value | Usage |
|------|-------|-------|
| `shadow-sm` | `0 1px 2px 0 rgb(0 0 0 / 0.05)` | Subtle elevation |
| `shadow` | `0 1px 3px 0 rgb(0 0 0 / 0.1)` | Default buttons |
| `shadow-md` | `0 4px 6px -1px rgb(0 0 0 / 0.1)` | Cards, dropdowns |
| `shadow-lg` | `0 10px 15px -3px rgb(0 0 0 / 0.1)` | Modals, popovers |

---

## Components

### Buttons

#### Variants

| Variant | Description | Usage |
|---------|-------------|-------|
| **Default** | Dark bg, light text | Primary actions (Save, Submit) |
| **Secondary** | Light gray bg | Secondary actions (Cancel) |
| **Outline** | Border only, transparent bg | Tertiary actions |
| **Destructive** | Red bg | Delete, dangerous actions |
| **Ghost** | No bg, hover effect | Icon buttons, subtle actions |
| **Link** | Underlined text | Navigation links |

#### Sizes

| Size | Height | Padding | Font Size |
|------|--------|---------|-----------|
| **sm** | 32px | 12px horizontal | 12px |
| **default** | 36px | 16px horizontal | 14px |
| **lg** | 40px | 32px horizontal | 14px |
| **icon** | 36x36px | - | - |

#### States
- **Hover:** Slight opacity change (90%)
- **Focus:** Ring outline (2px)
- **Disabled:** 50% opacity, no pointer events

---

### Form Inputs

#### Text Input
- Height: 36px
- Border: 1px solid border color
- Border radius: 6px (md)
- Padding: 12px horizontal
- Font size: 14px
- Focus: Ring outline

#### Select
- Same dimensions as text input
- Dropdown icon on right
- Options in popover

#### Checkbox
- Size: 16x16px
- Border radius: 4px
- Checked: Primary color with checkmark

#### Radio
- Size: 16x16px
- Border radius: full (circle)
- Selected: Primary color dot

#### Textarea
- Min height: 80px
- Same styling as text input
- Resizable vertically

---

### Cards

- Background: Card color (white/dark)
- Border: 1px solid border color
- Border radius: 8px (lg)
- Padding: 24px
- Shadow: shadow-sm (optional)

#### Card Sections
- **Header:** Title + optional description/actions
- **Content:** Main content area
- **Footer:** Actions, metadata

---

### Tables

- Header background: Muted color
- Header text: Muted foreground, semibold
- Row border: 1px solid border color
- Cell padding: 12px
- Hover state: Slight background change

#### Features
- Sortable columns (indicator icons)
- Pagination controls at bottom
- Optional row selection (checkbox)

---

### Modals/Dialogs

- Overlay: Black at 80% opacity
- Background: Card color
- Border radius: 8px (lg)
- Max width: 500px (default), adjustable
- Padding: 24px
- Shadow: shadow-lg

#### Sections
- **Header:** Title + close button
- **Content:** Scrollable if needed
- **Footer:** Action buttons (right-aligned)

---

### Badges

- Height: 22px
- Padding: 8px horizontal
- Border radius: full (pill shape)
- Font size: 12px
- Font weight: medium

#### Variants
- Default (secondary colors)
- Destructive (red)
- Success (green)
- Warning (yellow)
- Outline (border only)

---

### Alerts

- Border radius: 8px
- Padding: 16px
- Icon on left
- Border-left: 4px solid (variant color)

#### Variants
- Default (muted)
- Destructive (red)
- Success (green)
- Warning (yellow)
- Info (blue)

---

### Tabs

- Tab list: Border-bottom
- Tab item: Padding 12px, no border
- Active tab: Border-bottom 2px primary, semibold text
- Hover: Background accent

---

## Page Layouts

### List Page Structure
```
┌─────────────────────────────────────────────┐
│ Header: Title + Add Button                  │
├─────────────────────────────────────────────┤
│ Filters: Search + Filter dropdowns          │
├─────────────────────────────────────────────┤
│ Table                                       │
│ ┌─────┬─────────┬─────────┬────────┐       │
│ │ ID  │ Name    │ Status  │ Actions│       │
│ ├─────┼─────────┼─────────┼────────┤       │
│ │ ... │ ...     │ ...     │ ...    │       │
│ └─────┴─────────┴─────────┴────────┘       │
├─────────────────────────────────────────────┤
│ Pagination: Page info + Navigation          │
└─────────────────────────────────────────────┘
```

### Detail Page Structure
```
┌─────────────────────────────────────────────┐
│ Header: Back link + Title + Actions         │
├─────────────────────────────────────────────┤
│ Tabs (optional)                             │
├─────────────────────────────────────────────┤
│ Content Cards                               │
│ ┌─────────────────┐ ┌─────────────────┐    │
│ │ Card 1          │ │ Card 2          │    │
│ │ Key: Value      │ │ Key: Value      │    │
│ │ Key: Value      │ │ Key: Value      │    │
│ └─────────────────┘ └─────────────────┘    │
└─────────────────────────────────────────────┘
```

### Form Page Structure
```
┌─────────────────────────────────────────────┐
│ Header: Back link + Title                   │
├─────────────────────────────────────────────┤
│ Form Card                                   │
│ ┌─────────────────────────────────────────┐ │
│ │ Section Title                           │ │
│ │ ┌─────────────┐ ┌─────────────┐        │ │
│ │ │ Label       │ │ Label       │        │ │
│ │ │ [Input    ] │ │ [Input    ] │        │ │
│ │ └─────────────┘ └─────────────┘        │ │
│ │                                         │ │
│ │ Section Title                           │ │
│ │ ┌─────────────────────────────┐        │ │
│ │ │ Label                       │        │ │
│ │ │ [Textarea                 ] │        │ │
│ │ └─────────────────────────────┘        │ │
│ └─────────────────────────────────────────┘ │
├─────────────────────────────────────────────┤
│ Footer: Cancel + Save buttons (right)       │
└─────────────────────────────────────────────┘
```

---

## Icons

We use **Lucide React** icons throughout the application.

- Icon library: https://lucide.dev/icons
- Default size: 16x16px (in buttons), 20x20px (standalone)
- Stroke width: 2px (default)

### Common Icons
| Action | Icon Name |
|--------|-----------|
| Add/Create | `Plus` |
| Edit | `Pencil` |
| Delete | `Trash2` |
| View | `Eye` |
| Search | `Search` |
| Filter | `Filter` |
| Close | `X` |
| Back | `ArrowLeft` |
| More options | `MoreVertical` |
| Success | `Check` |
| Error | `AlertCircle` |
| Warning | `AlertTriangle` |
| Info | `Info` |

---

## Design Guidelines

### Do's
- Use the defined color tokens consistently
- Follow the spacing scale (multiples of 4px)
- Use standard button variants
- Maintain consistent padding within cards
- Ensure sufficient color contrast (WCAG AA)
- Support both light and dark modes
- Include hover and focus states for all interactive elements

### Don'ts
- Don't introduce new colors outside the palette
- Don't use custom border radius values
- Don't create new button styles
- Don't use shadows inconsistently
- Don't ignore dark mode compatibility
- Don't skip focus states (accessibility)

---

## Resources

- **shadcn/ui Documentation:** https://ui.shadcn.com/docs
- **Tailwind CSS:** https://tailwindcss.com/docs
- **Lucide Icons:** https://lucide.dev/icons
- **Radix UI Primitives:** https://www.radix-ui.com/primitives
- **shadcn/ui Figma Kit:** https://www.figma.com/community/file/1203061493325953101

---

## Container & Layout

- **Max container width:** 1400px
- **Container padding:** 32px (2rem)
- **Sidebar width:** 256px (when present)
- **Breakpoints:**
  - sm: 640px
  - md: 768px
  - lg: 1024px
  - xl: 1280px
  - 2xl: 1400px
