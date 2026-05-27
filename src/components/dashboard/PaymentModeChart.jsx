import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { formatCurrency } from '../../utils/dateHelpers';

const PAYMENT_MODE_LABELS = {
  gpay: 'GPay',
  phonepe: 'PhonePe',
  paytm: 'Paytm',
  neft: 'NEFT',
  rtgs: 'RTGS',
  card: 'Card',
  other: 'Other',
  net_banking: 'Net Banking',
};

const PAYMENT_MODE_COLORS = {
  gpay: '#3b82f6',
  phonepe: '#8b5cf6',
  paytm: '#06b6d4',
  neft: '#10b981',
  rtgs: '#14b8a6',
  card: '#f97316',
  other: '#94a3b8',
  net_banking: '#10b981',
};

/**
 * Payment mode distribution pie chart and top-5 traders bar chart.
 * @param {{ records: Array<Object> }} props - Active records from Sheet
 */
export default function PaymentModeChart({ records }) {
  const { t } = useTranslation();

  const { modeData, traderData } = useMemo(() => {
    // Payment mode distribution (count by mode)
    const modeCounts = {};
    const traderTotals = {};

    for (const record of records) {
      // Payment mode aggregation
      const mode = record.payment_mode || 'other';
      modeCounts[mode] = (modeCounts[mode] || 0) + 1;

      // Trader spending aggregation
      const trader = (record.trader_name || '').trim();
      const amount = parseFloat(record.bill_amount) || 0;
      if (trader) {
        traderTotals[trader] = (traderTotals[trader] || 0) + amount;
      }
    }

    const modeData = Object.entries(modeCounts).map(([mode, count]) => ({
      name: PAYMENT_MODE_LABELS[mode] || mode,
      value: count,
      color: PAYMENT_MODE_COLORS[mode] || PAYMENT_MODE_COLORS.other,
    }));

    const traderData = Object.entries(traderTotals)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, total]) => ({ name, total }));

    return { modeData, traderData };
  }, [records]);

  if (records.length === 0) return null;

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* Payment Mode Distribution */}
      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="mb-4 text-sm font-semibold text-slate-700">
          {t('dashboard.paymentModeDistribution')}
        </h3>
        {modeData.length > 0 ? (
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={modeData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={90}
                dataKey="value"
                paddingAngle={2}
                label={({ name, percent }) =>
                  `${name} ${(percent * 100).toFixed(0)}%`
                }
              >
                {modeData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value) => [`${value} ${t('dashboard.records')}`, t('dashboard.count')]}
              />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <p className="py-10 text-center text-sm text-slate-400">
            {t('dashboard.noPaymentData')}
          </p>
        )}
      </div>

      {/* Top 5 Traders by Spend */}
      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="mb-4 text-sm font-semibold text-slate-700">
          {t('dashboard.topTradersBySpend')}
        </h3>
        {traderData.length > 0 ? (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart
              data={traderData}
              layout="vertical"
              margin={{ left: 10, right: 20 }}
            >
              <XAxis
                type="number"
                tickFormatter={(v) => `\u20B9${formatCurrency(v)}`}
                tick={{ fontSize: 11 }}
              />
              <YAxis
                type="category"
                dataKey="name"
                width={100}
                tick={{ fontSize: 12 }}
              />
              <Tooltip
                formatter={(value) => [`\u20B9${formatCurrency(value)}`, t('dashboard.totalSpend')]}
              />
              <Bar dataKey="total" fill="#3C3489" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="py-10 text-center text-sm text-slate-400">
            {t('dashboard.noTraderData')}
          </p>
        )}
      </div>
    </div>
  );
}
