import { useTranslation } from 'react-i18next';

/**
 * Animated loading spinner for async operations.
 * @param {{ size?: 'sm'|'md'|'lg', className?: string }} props
 */
export default function LoadingSpinner({ size = 'md', className = '' }) {
  const { t } = useTranslation();
  const sizes = {
    sm: 'h-4 w-4 border',
    md: 'h-8 w-8 border-2',
    lg: 'h-12 w-12 border-2',
  };

  return (
    <div className={`flex items-center justify-center ${className}`} role="status">
      <div
        className={`animate-spin rounded-full border-slate-200 border-t-brand-primary ${sizes[size] || sizes.md}`}
      />
      <span className="sr-only">{t('common.loading')}</span>
    </div>
  );
}
