import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import enUS from '../src/locales/en-US.json'

await i18n.use(initReactI18next).init({
  resources: { 'en-US': { translation: enUS } },
  lng: 'en-US',
  fallbackLng: 'en-US',
  interpolation: { escapeValue: false },
})
