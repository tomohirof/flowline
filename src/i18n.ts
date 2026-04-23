import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

import jaCommon from './locales/ja/common.json'
import jaLanding from './locales/ja/landing.json'
import jaDashboard from './locales/ja/dashboard.json'
import jaEditor from './locales/ja/editor.json'
import jaSettings from './locales/ja/settings.json'
import jaAuth from './locales/ja/auth.json'
import jaShared from './locales/ja/shared.json'
import jaAdmin from './locales/ja/admin.json'

import enCommon from './locales/en/common.json'
import enLanding from './locales/en/landing.json'
import enDashboard from './locales/en/dashboard.json'
import enEditor from './locales/en/editor.json'
import enSettings from './locales/en/settings.json'
import enAuth from './locales/en/auth.json'
import enShared from './locales/en/shared.json'
import enAdmin from './locales/en/admin.json'

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      ja: {
        common: jaCommon,
        landing: jaLanding,
        dashboard: jaDashboard,
        editor: jaEditor,
        settings: jaSettings,
        auth: jaAuth,
        shared: jaShared,
        admin: jaAdmin,
      },
      en: {
        common: enCommon,
        landing: enLanding,
        dashboard: enDashboard,
        editor: enEditor,
        settings: enSettings,
        auth: enAuth,
        shared: enShared,
        admin: enAdmin,
      },
    },
    fallbackLng: 'ja',
    defaultNS: 'common',
    detection: {
      order: ['localStorage', 'navigator'],
    },
    interpolation: {
      escapeValue: false,
    },
  })

i18n.on('languageChanged', (lng: string) => {
  document.documentElement.lang = lng
})

// side-effect only — imported as `import './i18n'`
