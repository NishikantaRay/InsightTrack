/** @type {import('tailwindcss').Config} */
export default {
    content: ['./index.html', './src/**/*.{js,jsx}'],
    darkMode: 'class',
    theme: {
        extend: {
            colors: {
                accent: {
                    DEFAULT: '#6366F1',
                    light: '#818CF8',
                    bg: '#EEF2FF',
                },
                surface: {
                    DEFAULT: '#FFFFFF',
                    dark: '#1A1D27',
                },
                card: {
                    DEFAULT: '#FFFFFF',
                    dark: '#1E2130',
                },
                bg: {
                    DEFAULT: '#F8FAFC',
                    dark: '#0F1117',
                },
                border: {
                    DEFAULT: '#E2E8F0',
                    dark: '#2D3348',
                },
                text: {
                    primary: '#0F172A',
                    secondary: '#64748B',
                    muted: '#94A3B8',
                    'primary-dark': '#F1F5F9',
                    'secondary-dark': '#94A3B8',
                    'muted-dark': '#475569',
                },
                chart: {
                    1: '#6366F1',
                    2: '#8B5CF6',
                    3: '#06B6D4',
                    4: '#10B981',
                    5: '#F59E0B',
                    6: '#EF4444',
                },
                success: { DEFAULT: '#10B981', bg: '#ECFDF5' },
                warning: { DEFAULT: '#F59E0B', bg: '#FFFBEB' },
                error: { DEFAULT: '#EF4444', bg: '#FEF2F2' },
                info: { DEFAULT: '#3B82F6', bg: '#EFF6FF' },
            },
            fontFamily: {
                sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
            },
            borderRadius: {
                sm: '8px',
                md: '12px',
                lg: '16px',
                xl: '20px',
            },
            boxShadow: {
                card: '0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.06)',
                'card-hover': '0 4px 12px rgba(0,0,0,0.08)',
                'card-dark': '0 1px 3px rgba(0,0,0,0.2), 0 1px 2px rgba(0,0,0,0.3)',
            },
            spacing: {
                sidebar: '260px',
            },
        },
    },
    plugins: [],
};
