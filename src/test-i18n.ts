import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

i18n.use(initReactI18next).init({
  lng: 'ja',
  fallbackLng: 'ja',
  defaultNS: 'common',
  resources: {},
  returnNull: false,
  returnEmptyString: false,
  interpolation: {
    escapeValue: false,
  },
})

// side-effect only — imported as `import './test-i18n'`
