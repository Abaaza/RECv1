import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Globe, Check, ChevronDown } from 'lucide-react';
import { supportedLanguages, changeLanguage, getCurrentLanguage } from '../i18n/config';

const LanguageSelector = ({ compact = false, showFlag = true, showName = true }) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [currentLang, setCurrentLang] = useState(getCurrentLanguage());
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLanguageChange = (langCode) => {
    changeLanguage(langCode);
    setCurrentLang(langCode);
    setIsOpen(false);
    
    // Trigger a custom event for other components to listen to
    window.dispatchEvent(new CustomEvent('languageChanged', { detail: { language: langCode } }));
  };

  const currentLanguage = supportedLanguages.find(lang => lang.code === currentLang);

  if (compact) {
    return (
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center space-x-1 px-2 py-1 text-sm text-gray-700 hover:text-gray-900 transition-colors"
          aria-label="Change language"
        >
          <Globe className="h-4 w-4" />
          <span className="font-medium">{currentLanguage?.code.toUpperCase()}</span>
        </button>

        {isOpen && (
          <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
            <div className="py-1">
              {supportedLanguages.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => handleLanguageChange(lang.code)}
                  className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center justify-between ${
                    lang.code === currentLang ? 'bg-blue-50 text-blue-600' : 'text-gray-700'
                  }`}
                >
                  <span className="flex items-center space-x-2">
                    <span>{lang.flag}</span>
                    <span>{lang.nativeName}</span>
                  </span>
                  {lang.code === currentLang && <Check className="h-4 w-4" />}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        {showFlag && <span className="text-xl">{currentLanguage?.flag}</span>}
        <Globe className="h-5 w-5 text-gray-600" />
        {showName && (
          <span className="font-medium text-gray-700">{currentLanguage?.nativeName}</span>
        )}
        <ChevronDown className={`h-4 w-4 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-gray-200 z-50 overflow-hidden">
          <div className="p-3 bg-gray-50 border-b border-gray-200">
            <h3 className="text-sm font-semibold text-gray-700">{t('settings.language')}</h3>
          </div>
          
          <div className="max-h-80 overflow-y-auto">
            {supportedLanguages.map((lang) => (
              <button
                key={lang.code}
                onClick={() => handleLanguageChange(lang.code)}
                className={`w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors flex items-center justify-between group ${
                  lang.code === currentLang ? 'bg-blue-50' : ''
                }`}
                dir={lang.rtl ? 'rtl' : 'ltr'}
              >
                <div className="flex items-center space-x-3">
                  <span className="text-2xl">{lang.flag}</span>
                  <div>
                    <div className={`font-medium ${
                      lang.code === currentLang ? 'text-blue-600' : 'text-gray-900'
                    }`}>
                      {lang.nativeName}
                    </div>
                    <div className="text-xs text-gray-500">{lang.name}</div>
                  </div>
                </div>
                
                {lang.code === currentLang && (
                  <Check className="h-5 w-5 text-blue-600" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default LanguageSelector;