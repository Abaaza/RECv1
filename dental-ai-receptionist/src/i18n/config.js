import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import Backend from 'i18next-http-backend';

// Import translations
import enTranslations from './locales/en/translation.json';
import esTranslations from './locales/es/translation.json';
import frTranslations from './locales/fr/translation.json';
import zhTranslations from './locales/zh/translation.json';
import arTranslations from './locales/ar/translation.json';
import hiTranslations from './locales/hi/translation.json';
import ptTranslations from './locales/pt/translation.json';
import ruTranslations from './locales/ru/translation.json';

const resources = {
  en: { translation: enTranslations },
  es: { translation: esTranslations },
  fr: { translation: frTranslations },
  zh: { translation: zhTranslations },
  ar: { translation: arTranslations },
  hi: { translation: hiTranslations },
  pt: { translation: ptTranslations },
  ru: { translation: ruTranslations }
};

const DETECTION_OPTIONS = {
  order: ['localStorage', 'navigator', 'htmlTag'],
  caches: ['localStorage'],
  lookupLocalStorage: 'preferredLanguage',
  lookupFromPathIndex: 0,
  lookupFromSubdomainIndex: 0,
  checkWhitelist: true
};

i18n
  .use(Backend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    debug: process.env.NODE_ENV === 'development',
    
    detection: DETECTION_OPTIONS,
    
    interpolation: {
      escapeValue: false // React already escapes values
    },
    
    react: {
      useSuspense: true,
      bindI18n: 'languageChanged',
      bindI18nStore: '',
      transEmptyNodeValue: '',
      transSupportBasicHtmlNodes: true,
      transKeepBasicHtmlNodesFor: ['br', 'strong', 'i', 'p']
    },
    
    ns: ['translation'],
    defaultNS: 'translation',
    
    keySeparator: '.',
    
    saveMissing: true,
    saveMissingTo: 'localStorage',
    
    missingKeyHandler: (lng, ns, key, fallbackValue) => {
      if (process.env.NODE_ENV === 'development') {
        console.warn(`Missing translation: ${lng}/${ns}/${key}`);
      }
    }
  });

// Language configuration
export const supportedLanguages = [
  { code: 'en', name: 'English', nativeName: 'English', flag: '🇺🇸', rtl: false },
  { code: 'es', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸', rtl: false },
  { code: 'fr', name: 'French', nativeName: 'Français', flag: '🇫🇷', rtl: false },
  { code: 'zh', name: 'Chinese', nativeName: '中文', flag: '🇨🇳', rtl: false },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', flag: '🇸🇦', rtl: true },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', flag: '🇮🇳', rtl: false },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português', flag: '🇵🇹', rtl: false },
  { code: 'ru', name: 'Russian', nativeName: 'Русский', flag: '🇷🇺', rtl: false }
];

// Helper functions
export const getCurrentLanguage = () => i18n.language || 'en';

export const changeLanguage = (lng) => {
  i18n.changeLanguage(lng);
  localStorage.setItem('preferredLanguage', lng);
  
  // Update document direction for RTL languages
  const langConfig = supportedLanguages.find(l => l.code === lng);
  document.dir = langConfig?.rtl ? 'rtl' : 'ltr';
  document.documentElement.lang = lng;
};

export const getLanguageConfig = (code) => {
  return supportedLanguages.find(lang => lang.code === code);
};

// Format functions for different locales
export const formatDate = (date, format = 'short') => {
  const locale = getCurrentLanguage();
  const options = {
    short: { year: 'numeric', month: 'short', day: 'numeric' },
    long: { year: 'numeric', month: 'long', day: 'numeric' },
    time: { hour: '2-digit', minute: '2-digit' },
    full: { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit' 
    }
  };
  
  return new Intl.DateTimeFormat(locale, options[format]).format(new Date(date));
};

export const formatCurrency = (amount, currency = 'USD') => {
  const locale = getCurrentLanguage();
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency
  }).format(amount);
};

export const formatNumber = (number, options = {}) => {
  const locale = getCurrentLanguage();
  return new Intl.NumberFormat(locale, options).format(number);
};

// Pluralization rules
export const getPluralRules = () => {
  const locale = getCurrentLanguage();
  return new Intl.PluralRules(locale);
};

// Phone number formatting based on locale
export const formatPhoneNumber = (phone) => {
  const locale = getCurrentLanguage();
  // Add locale-specific phone formatting logic here
  return phone;
};

export default i18n;