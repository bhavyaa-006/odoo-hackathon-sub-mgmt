import { Check, Circle } from 'lucide-react';
import { PASSWORD_RULES } from '../../utils/passwordValidation';

export const PasswordChecklist = ({ password = '', className = '' }) => {
  const results = PASSWORD_RULES.map((rule) => ({
    ...rule,
    passed: rule.test(password),
  }));

  const allPassed = results.every((r) => r.passed);

  return (
    <div
      className={`p-3 bg-[#F5F5F5] rounded-lg border border-[#4B6584]/20 ${className}`}
      aria-label="Password requirement checklist"
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-[#333333] tracking-wide uppercase">
          Password Requirements
        </span>
        {password && (
          <span
            className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
              allPassed
                ? 'bg-[#E0F2F1] text-[#00796B]'
                : 'bg-[#FFEBEE] text-[#FF6F61]'
            }`}
          >
            {results.filter((r) => r.passed).length} of 4 met
          </span>
        )}
      </div>

      <ul className="space-y-1.5" role="list">
        {results.map((rule) => (
          <li
            key={rule.id}
            className={`flex items-center gap-2 text-xs transition-colors duration-150 ${
              rule.passed ? 'text-[#00796B] font-medium' : 'text-[#4B6584]'
            }`}
          >
            <span className="shrink-0 flex items-center justify-center">
              {rule.passed ? (
                <Check
                  className="w-3.5 h-3.5 stroke-[3] text-[#00796B]"
                  aria-hidden="true"
                />
              ) : (
                <Circle
                  className="w-3.5 h-3.5 text-[#4B6584]/50"
                  aria-hidden="true"
                />
              )}
            </span>
            <span className="sr-only">
              {rule.passed ? 'Requirement satisfied: ' : 'Requirement missing: '}
            </span>
            <span>{rule.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default PasswordChecklist;
