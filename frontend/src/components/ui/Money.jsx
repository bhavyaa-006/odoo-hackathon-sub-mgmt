import { formatMoney } from '../../utils/formatters';

export const Money = ({
  amountMinor,
  currency = 'INR',
  parentheses = false,
  isCredit = false,
  className = '',
}) => {
  const formatted = formatMoney(amountMinor, currency, { parentheses });
  const isNegative = Number(amountMinor) < 0 || isCredit;

  return (
    <span
      className={`font-semibold tabular-nums ${
        isNegative ? 'text-[#FF6F61]' : ''
      } ${className}`}
      title={`${amountMinor} minor units`}
    >
      {formatted}
    </span>
  );
};

export default Money;
