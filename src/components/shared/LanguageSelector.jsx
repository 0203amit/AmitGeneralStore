import { useTranslation } from 'react-i18next';

const LANGUAGES = [
  { code: 'en', label: 'EN' },
  { code: 'hi', label: 'हिं' },
];

export default function LanguageSelector() {
  const { i18n } = useTranslation();
  const currentLang = i18n.language?.startsWith('hi') ? 'hi' : 'en';

  return (
    <div className="flex items-center gap-0.5 rounded-full border border-slate-200 p-0.5">
      {LANGUAGES.map(({ code, label }) => (
        <button
          key={code}
          onClick={() => i18n.changeLanguage(code)}
          aria-label={code === 'en' ? 'Switch to English' : 'हिंदी में बदलें'}
          className={`flex min-h-[44px] min-w-[44px] cursor-pointer items-center justify-center rounded-full text-xs font-medium transition-colors duration-200 ${
            currentLang === code
              ? 'bg-brand-primary text-white'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
