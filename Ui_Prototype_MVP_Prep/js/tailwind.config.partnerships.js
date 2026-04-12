module.exports = {
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        'surface-container-low': '#f0f3ff',
        'on-primary': '#ffffff',
        'on-primary-fixed-variant': '#34466d',
        'on-primary-fixed': '#041a3f',
        'secondary-fixed': '#ffddb8',
        'primary-fixed': '#d9e2ff',
        'on-secondary-fixed-variant': '#653e00',
        'inverse-primary': '#b4c6f4',
        'on-tertiary': '#ffffff',
        'surface-bright': '#f9f9ff',
        'on-error-container': '#93000a',
        'tertiary': '#060031',
        'on-surface': '#0b1c32',
        'tertiary-fixed': '#e4dfff',
        'error-container': '#ffdad6',
        'error': '#ba1a1a',
        'on-secondary': '#ffffff',
        'inverse-on-surface': '#ecf1ff',
        'on-tertiary-fixed-variant': '#4029bb',
        'surface-tint': '#4c5e86',
        'on-secondary-container': '#684000',
        'inverse-surface': '#223149',
        'outline-variant': '#c5c6cf',
        'surface-container-lowest': '#ffffff',
        'primary': '#00081e',
        'secondary-fixed-dim': '#ffb95f',
        'outline': '#75777f',
        'on-error': '#ffffff',
        'primary-container': '#0a1f44',
        'on-surface-variant': '#44464e',
        'tertiary-fixed-dim': '#c6bfff',
        'on-tertiary-container': '#8274ff',
        'on-tertiary-fixed': '#160066',
        'on-background': '#0b1c32',
        'surface': '#f9f9ff',
        'background': '#f9f9ff',
        'primary-fixed-dim': '#b4c6f4',
        'secondary-container': '#fea619',
        'surface-container-high': '#dee8ff',
        'surface-container-highest': '#d5e3ff',
        'surface-dim': '#cbdbf9',
        'secondary': '#855300',
        'on-secondary-fixed': '#2a1700',
        'surface-variant': '#d5e3ff',
        'on-primary-container': '#7687b2',
        'tertiary-container': '#1a0073',
        'surface-container': '#e7eeff'
      },
      borderRadius: {
        'DEFAULT': '0.125rem',
        'lg': '0.25rem',
        'xl': '0.5rem',
        'full': '0.75rem'
      },
      fontFamily: {
        'headline': ['Syne', 'Epilogue', 'sans-serif'],
        'body': ['Manrope', 'sans-serif'],
        'label': ['Inter', 'sans-serif']
      },
      spacing: {
        '128': '32rem',
        '144': '36rem'
      },
      minHeight: {
        '600px': '600px'
      }
    }
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/container-queries')
  ]
}
