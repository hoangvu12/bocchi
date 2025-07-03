/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/index.html', './src/renderer/src/**/*.{js,ts,jsx,tsx}'],
  darkMode: ['class'],
  theme: {
    extend: {
      colors: {
        cream: {
          50: '#fefefe',
          100: '#fcfbfa',
          200: '#f8f6f3',
          300: '#f0ebe5',
          400: '#e5ddd2',
          500: '#d3c5b6',
          600: '#b8a593',
          700: '#9a8470',
          800: '#7d6856',
          900: '#665447',
          950: '#3a2f29'
        },
        terracotta: {
          50: '#fef7f5',
          100: '#fee9e5',
          200: '#fcc7bc',
          300: '#f9a08c',
          400: '#f47560',
          500: '#d4654e',
          600: '#c24b35',
          700: '#a13829',
          800: '#842f24',
          900: '#6f2922',
          950: '#3c130f'
        },
        charcoal: {
          50: '#f6f6f6',
          100: '#e7e7e7',
          200: '#d1d1d1',
          300: '#b0b0b0',
          400: '#888888',
          500: '#6d6d6d',
          600: '#5d5d5d',
          700: '#4f4f4f',
          800: '#3d3d3d',
          900: '#2d2d2d',
          950: '#1a1a1a'
        },
        background: {
          light: '#f5f2ed',
          dark: '#1a1a1a'
        },
        surface: {
          light: '#ffffff',
          dark: '#2d2d2d'
        },
        text: {
          primary: {
            light: '#0a0a0a',
            dark: '#ffffff'
          },
          secondary: {
            light: '#2d2d2d',
            dark: '#b0b0b0'
          },
          muted: {
            light: '#4a4a4a',
            dark: '#888888'
          }
        },
        border: {
          light: '#e7e7e7',
          dark: '#3d3d3d'
        }
      },
      fontFamily: {
        sans: ['Figtree', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif']
      },
      animation: {
        dots: 'dots 1.5s steps(5, end) infinite',
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-down': 'slideDown 0.2s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        progress: 'progress 2s ease-in-out infinite',
        'card-hover': 'cardHover 0.3s ease-out forwards',
        'scale-in': 'scaleIn 0.2s ease-out',
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out'
      },
      keyframes: {
        dots: {
          '0%, 20%': {
            color: 'transparent',
            textShadow: '0.25em 0 0 transparent, 0.5em 0 0 transparent'
          },
          '40%': {
            color: 'white',
            textShadow: '0.25em 0 0 transparent, 0.5em 0 0 transparent'
          },
          '60%': {
            color: 'white',
            textShadow: '0.25em 0 0 white, 0.5em 0 0 transparent'
          },
          '80%, 100%': {
            color: 'white',
            textShadow: '0.25em 0 0 white, 0.5em 0 0 white'
          }
        },
        fadeIn: {
          from: {
            opacity: '0'
          },
          to: {
            opacity: '1'
          }
        },
        slideDown: {
          from: {
            opacity: '0',
            transform: 'translateY(-10px)'
          },
          to: {
            opacity: '1',
            transform: 'translateY(0)'
          }
        },
        slideUp: {
          from: {
            opacity: '0',
            transform: 'translateY(20px)'
          },
          to: {
            opacity: '1',
            transform: 'translateY(0)'
          }
        },
        progress: {
          '0%': {
            transform: 'translateX(-100%)'
          },
          '100%': {
            transform: 'translateX(100%)'
          }
        },
        cardHover: {
          '0%': {
            transform: 'translateY(0) scale(1)'
          },
          '100%': {
            transform: 'translateY(-4px) scale(1.02)'
          }
        },
        scaleIn: {
          '0%': {
            transform: 'scale(0.95)',
            opacity: '0'
          },
          '100%': {
            transform: 'scale(1)',
            opacity: '1'
          }
        },
        'accordion-down': {
          from: {
            height: '0'
          },
          to: {
            height: 'var(--radix-accordion-content-height)'
          }
        },
        'accordion-up': {
          from: {
            height: 'var(--radix-accordion-content-height)'
          },
          to: {
            height: '0'
          }
        }
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))'
      },
      transitionProperty: {
        height: 'height',
        spacing: 'margin, padding'
      },
      borderRadius: {
        xs: '4px',
        sm: '6px',
        md: '8px',
        lg: '12px',
        xl: '16px',
        '2xl': '20px',
        '3xl': '24px',
        pill: '9999px'
      },
      fontSize: {
        xxs: '0.625rem',
        xs: '0.75rem',
        sm: '0.875rem',
        base: '1rem',
        lg: '1.125rem',
        xl: '1.25rem',
        '2xl': '1.5rem',
        '3xl': '1.875rem',
        '4xl': '2.25rem',
        '5xl': '3rem'
      },
      spacing: {
        18: '4.5rem',
        88: '22rem',
        128: '32rem'
      },
      boxShadow: {
        soft: '0 2px 8px rgba(0, 0, 0, 0.04)',
        medium: '0 4px 16px rgba(0, 0, 0, 0.08)',
        large: '0 8px 32px rgba(0, 0, 0, 0.12)',
        xl: '0 16px 48px rgba(0, 0, 0, 0.16)',
        'dark-soft': '0 2px 8px rgba(0, 0, 0, 0.2)',
        'dark-medium': '0 4px 16px rgba(0, 0, 0, 0.3)',
        'dark-large': '0 8px 32px rgba(0, 0, 0, 0.4)'
      }
    }
  },
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  plugins: [require('@tailwindcss/typography')]
}
