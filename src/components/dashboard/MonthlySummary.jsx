import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { IndianRupee, TrendingDown, FileText } from 'lucide-react';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { parseDate, formatCurrency } from '../../utils/dateHelpers';

/**
 * Summary cards showing monthly spending and record counts.
 * - Total spent this month (by bill_date)
 * - Total spent last month (by bill_date)
 * - Records created this month (by created_at)
 * @param {{ records: Array<Object> }} props - Active records from Sheet
 */
export default function MonthlySummary({ records }) {
  const { t } = useTranslation();

  const { spentThisMonth, spentLastMonth, createdThisMonth } = useMemo(() => {
    const now = new Date();
    const thisMonthStart = startOfMonth(now);
    const thisMonthEnd = endOfMonth(now);
    const lastMonth = subMonths(now, 1);
    const lastMonthStart = startOfMonth(lastMonth);
    const lastMonthEnd = endOfMonth(lastMonth);

    let spentThis = 0;
    let spentLast = 0;
    let createdThis = 0;

    for (const record of records) {
      // Spending aggregation by bill_date
      const billDate = parseDate(record.bill_date);
      const amount = parseFloat(record.bill_amount) || 0;

      if (billDate && billDate >= thisMonthStart && billDate <= thisMonthEnd) {
        spentThis += amount;
      } else if (billDate && billDate >= lastMonthStart && billDate <= lastMonthEnd) {
        spentLast += amount;
      }

      // Record count by created_at
      if (record.created_at) {
        const createdDate = new Date(record.created_at);
        if (
          !isNaN(createdDate.getTime()) &&
          createdDate >= thisMonthStart &&
          createdDate <= thisMonthEnd
        ) {
          createdThis++;
        }
      }
    }

    return {
      spentThisMonth: spentThis,
      spentLastMonth: spentLast,
      createdThisMonth: createdThis,
    };
  }, [records]);

  const thisMonthYear = format(new Date(), 'MMM yyyy');
  const lastMonthYear = format(subMonths(new Date(), 1), 'MMM yyyy');

  const cards = [
    {
      label: t('dashboard.spentThisMonth', { month: thisMonthYear }),
      value: `\u20B9${formatCurrency(spentThisMonth)}`,
      icon: IndianRupee,
      color: 'text-brand-primary',
      bg: 'bg-brand-primary/10',
    },
    {
      label: t('dashboard.spentLastMonth', { month: lastMonthYear }),
      value: `\u20B9${formatCurrency(spentLastMonth)}`,
      icon: TrendingDown,
      color: 'text-brand-accent',
      bg: 'bg-brand-accent/10',
    },
    {
      label: t('dashboard.recordsThisMonth'),
      value: String(createdThisMonth),
      icon: FileText,
      color: 'text-brand-green',
      bg: 'bg-brand-green/10',
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.label}
            className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition-shadow duration-200 hover:shadow-md"
          >
            <div className="flex items-center gap-3">
              <div className={`rounded-lg p-2 ${card.bg}`}>
                <Icon className={`h-5 w-5 ${card.color}`} />
              </div>
              <div>
                <p className="text-sm text-slate-500">{card.label}</p>
                <p className="font-heading text-xl font-semibold text-slate-900">
                  {card.value}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
