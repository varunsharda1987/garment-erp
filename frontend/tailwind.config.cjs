/* ============================================================
   KASHAYA FABS ERP — Tailwind Config
   tailwind.config.cjs
   
   Extends shadcn/ui defaults with:
   - Brand semantic tokens (success, warning, info)
   - Brand client tokens (kasya, nihsamah, external)
   - Sidebar tokens
   - Display / body font families
   - Custom shadow scale
   ============================================================ */

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class'],

  content: [
    './index.html',
    './src/**/*.{ts,tsx,js,jsx}',
    './node_modules/@shadcn/ui/**/*.{ts,tsx}',
  ],

  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: { '2xl': '1400px' },
    },

    extend: {
      /* ── COLORS ─────────────────────────────────────────── */
      colors: {
        /* ── shadcn base tokens (wired to CSS vars) ── */
        border:      'hsl(var(--border))',
        input:       'hsl(var(--input))',
        ring:        'hsl(var(--ring))',
        background:  'hsl(var(--background))',
        foreground:  'hsl(var(--foreground))',

        primary: {
          DEFAULT:    'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT:    'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT:    'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT:    'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT:    'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT:    'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT:    'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },

        /* ── SEMANTIC extras (now usable as bg-success etc.) ── */
        success: {
          DEFAULT:    'hsl(var(--success))',
          foreground: 'hsl(var(--success-foreground))',
          muted:      'hsl(var(--success-muted))',
        },
        warning: {
          DEFAULT:    'hsl(var(--warning))',
          foreground: 'hsl(var(--warning-foreground))',
          muted:      'hsl(var(--warning-muted))',
        },
        info: {
          DEFAULT:    'hsl(var(--info))',
          foreground: 'hsl(var(--info-foreground))',
          muted:      'hsl(var(--info-muted))',
        },

        /* ── BRAND CLIENT TOKENS ─────────────────────────── */
        /* Use as bg-kasya, text-kasya, bg-kasya-muted etc.  */
        kasya: {
          DEFAULT:    'hsl(var(--brand-kasya))',
          muted:      'hsl(var(--brand-kasya-muted))',
        },
        nihsamah: {
          DEFAULT:    'hsl(var(--brand-nihsamah))',
          muted:      'hsl(var(--brand-nihsamah-muted))',
        },
        external: {
          DEFAULT:    'hsl(var(--brand-external))',
          muted:      'hsl(var(--brand-external-muted))',
        },

        /* ── SIDEBAR ─────────────────────────────────────── */
        sidebar: {
          DEFAULT:    'hsl(var(--sidebar))',
          foreground: 'hsl(var(--sidebar-foreground))',
          muted:      'hsl(var(--sidebar-muted))',
          border:     'hsl(var(--sidebar-border))',
          accent: {
            DEFAULT:    'hsl(var(--sidebar-accent))',
            foreground: 'hsl(var(--sidebar-accent-foreground))',
          },
          ring:       'hsl(var(--sidebar-ring))',
        },

        /* ── CHART PALETTE ───────────────────────────────── */
        chart: {
          1: 'hsl(var(--chart-1))',
          2: 'hsl(var(--chart-2))',
          3: 'hsl(var(--chart-3))',
          4: 'hsl(var(--chart-4))',
          5: 'hsl(var(--chart-5))',
        },
      },

      /* ── TYPOGRAPHY ─────────────────────────────────────── */
      fontFamily: {
        display: ['Cormorant Garamond', 'Georgia', 'serif'],
        sans:    ['DM Sans', 'system-ui', 'sans-serif'],
        mono:    ['JetBrains Mono', 'Fira Code', 'monospace'],
      },

      fontSize: {
        /* ERP-specific scale — tighter than Tailwind defaults */
        'xxs':  ['0.625rem',  { lineHeight: '1rem' }],         /* 10px */
        'xs':   ['0.6875rem', { lineHeight: '1rem' }],         /* 11px */
        'sm':   ['0.8125rem', { lineHeight: '1.25rem' }],      /* 13px */
        'base': ['0.875rem',  { lineHeight: '1.5rem' }],       /* 14px */
        'md':   ['1rem',      { lineHeight: '1.5rem' }],       /* 16px */
        'lg':   ['1.125rem',  { lineHeight: '1.75rem' }],      /* 18px */
        'xl':   ['1.25rem',   { lineHeight: '1.75rem' }],      /* 20px */
        '2xl':  ['1.5rem',    { lineHeight: '2rem' }],         /* 24px */
        '3xl':  ['1.875rem',  { lineHeight: '2.25rem' }],      /* 30px */

        /* Display sizes — for Cormorant Garamond headings */
        'display-sm': ['1.75rem',  { lineHeight: '2rem',    letterSpacing: '-0.015em' }], /* 28px */
        'display-md': ['2.25rem',  { lineHeight: '2.5rem',  letterSpacing: '-0.02em'  }], /* 36px */
        'display-lg': ['3rem',     { lineHeight: '3.25rem', letterSpacing: '-0.025em' }], /* 48px */
      },

      /* ── BORDER RADIUS ──────────────────────────────────── */
      borderRadius: {
        lg:   'var(--radius)',
        md:   'calc(var(--radius) - 2px)',
        sm:   'calc(var(--radius) - 4px)',
        xl:   'calc(var(--radius) + 4px)',
        '2xl':'calc(var(--radius) + 8px)',
      },

      /* ── SHADOWS ────────────────────────────────────────── */
      boxShadow: {
        xs:  'var(--shadow-xs)',
        sm:  'var(--shadow-sm)',
        md:  'var(--shadow-md)',
        lg:  'var(--shadow-lg)',
        /* Focus ring style — used for interactive elements */
        focus: '0 0 0 2px hsl(var(--background)), 0 0 0 4px hsl(var(--ring))',
      },

      /* ── SPACING ────────────────────────────────────────── */
      spacing: {
        /* Sidebar width tokens */
        'sidebar':          '220px',
        'sidebar-collapsed': '56px',
        /* Common ERP panel sizes */
        'panel-sm': '280px',
        'panel-md': '360px',
        'panel-lg': '480px',
      },

      /* ── ANIMATION ──────────────────────────────────────── */
      keyframes: {
        /* shadcn accordion animations */
        'accordion-down': {
          from: { height: '0' },
          to:   { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to:   { height: '0' },
        },
        /* Subtle fade-in for page/panel transitions */
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        /* Slide-in for drawers / sheets */
        'slide-in-right': {
          from: { transform: 'translateX(100%)' },
          to:   { transform: 'translateX(0)' },
        },
      },
      animation: {
        'accordion-down':  'accordion-down 0.2s ease-out',
        'accordion-up':    'accordion-up 0.2s ease-out',
        'fade-in':         'fade-in 0.2s ease-out',
        'slide-in-right':  'slide-in-right 0.25s ease-out',
      },
    },
  },

  safelist: [
    'border-l-primary',
    'border-l-accent',
    'border-l-info',
    'border-l-success',
    'border-l-destructive',
    'border-l-warning',
    'bg-info-muted',
    'bg-success-muted',
    'bg-warning-muted',
    'text-info',
    'text-success',
    'text-warning',
  ],

  plugins: [
    require('tailwindcss-animate'),
  ],
}
