/**
 * ALGIONS Pharmacy - Design System Tokens
 * Defined per Frontend Specification v1.0 Section 3.1
 */

export const tokens = {
  colors: {
    primary: {
      DEFAULT: '#0F766E', // Teal 600
      hover: '#0F5F59', // Teal 700
      light: '#CCFBF1', // Teal 100
      dark: '#115E59', // Teal 800
    },
    success: {
      DEFAULT: '#16A34A', // Green 600
      subtle: '#DCFCE7', // Green 100
      border: '#86EFAC', // Green 300
    },
    warning: {
      DEFAULT: '#F59E0B', // Amber 500
      subtle: '#FEF3C7', // Amber 100
      border: '#FCD34D', // Amber 300
    },
    danger: {
      DEFAULT: '#DC2626', // Red 600
      subtle: '#FEE2E2', // Red 100
      border: '#FCA5A5', // Red 300
    },
    info: {
      DEFAULT: '#2563EB', // Blue 600
      subtle: '#DBEAFE', // Blue 100
      border: '#93C5FD', // Blue 300
    },
    slate: {
      50: '#F8FAFC',
      100: '#F1F5F9',
      200: '#E2E8F0',
      300: '#CBD5E1',
      400: '#94A3B8',
      500: '#64748B',
      600: '#475569',
      700: '#334155',
      800: '#1E293B',
      900: '#0F172A',
    },
  },
  typography: {
    fontFamily: {
      ui: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      tabular: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
    },
    sizes: {
      xs: '12px',
      sm: '14px',
      base: '16px',
      lg: '20px',
      xl: '24px',
      totals: '32px',
    },
  },
  radius: {
    control: '6px',
    card: '10px',
    full: '9999px',
  },
} as const;
