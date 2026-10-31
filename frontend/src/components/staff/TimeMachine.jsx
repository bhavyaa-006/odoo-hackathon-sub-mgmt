import { useState } from 'react';
import { Calendar, FastForward, AlertCircle, CheckCircle2, X } from 'lucide-react';
import { staffService } from '../../services/staff.service';

export const TimeMachineModal = ({ isOpen, onClose, currentDate, onDateChange }) => {
  const [loading, setLoading] = useState(false);
  const [customDays, setCustomDays] = useState(30);
  const [notification, setNotification] = useState(null);

  if (!isOpen) return null;

  const handleAdvance = async (days) => {
    try {
      setLoading(true);
      const res = await staffService.advanceTimeMachine(days);
      setNotification({
        type: 'success',
        message: res.message || `Advanced clock by +${days} days.`,
      });
      if (onDateChange) {
        onDateChange(res.current_date);
      }
      setTimeout(() => {
        setNotification(null);
      }, 4000);
    } catch (err) {
      setNotification({
        type: 'error',
        message: err.userMessage || 'Time Machine service is currently blocked on backend integration.',
      });
    } finally {
      setLoading(false);
    }
  };


  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="time-machine-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in"
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#1F4E79] to-[#00796B] px-6 py-4 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/10 rounded-xl">
              <Calendar className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h3 id="time-machine-title" className="font-heading font-bold text-base tracking-wide">
                Simulated Time Machine
              </h3>
              <p className="text-xs text-white/80">Staff Workspace Operations Testing</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {notification && (
            <div
              className={`p-3 rounded-xl text-xs flex items-center gap-2.5 ${
                notification.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-rose-50 text-rose-800 border border-rose-200'
              }`}
            >
              {notification.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span>{notification.message}</span>
            </div>
          )}

          {/* Current Date Display */}
          <div className="bg-[#F5F5F5] rounded-xl p-4 border border-slate-200 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#4B6584]">
                Current Simulated Date
              </span>
              <div className="text-xl font-bold font-heading text-[#1F4E79] mt-0.5">
                {currentDate || '2026-10-31'}
              </div>
            </div>
            <div className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-[#1F4E79] border border-blue-200">
              Operations Clock
            </div>
          </div>

          <p className="text-xs text-[#4B6584] leading-relaxed">
            Advance the workspace clock forward to trigger billing run eligibility, test invoice aging,
            and inspect automated dunning schedule updates across all customer accounts.
          </p>

          {/* Quick Actions */}
          <div className="space-y-2">
            <span className="text-xs font-bold text-[#333333]">Quick Forward Increments</span>
            <div className="grid grid-cols-3 gap-2.5">
              <button
                type="button"
                disabled={loading}
                onClick={() => handleAdvance(7)}
                className="py-2.5 px-3 rounded-xl border border-[#4B6584]/20 hover:border-[#1F4E79] hover:bg-[#E3F2FD]/50 text-xs font-bold text-[#1F4E79] transition-all flex flex-col items-center gap-1 cursor-pointer disabled:opacity-50"
              >
                <FastForward className="w-4 h-4 text-[#00796B]" />
                <span>+7 Days</span>
              </button>

              <button
                type="button"
                disabled={loading}
                onClick={() => handleAdvance(30)}
                className="py-2.5 px-3 rounded-xl border border-[#1F4E79] bg-[#E3F2FD]/30 hover:bg-[#E3F2FD] text-xs font-bold text-[#1F4E79] transition-all flex flex-col items-center gap-1 cursor-pointer disabled:opacity-50"
              >
                <FastForward className="w-4 h-4 text-[#1F4E79]" />
                <span>+1 Month</span>
              </button>

              <button
                type="button"
                disabled={loading}
                onClick={() => handleAdvance(90)}
                className="py-2.5 px-3 rounded-xl border border-[#4B6584]/20 hover:border-[#1F4E79] hover:bg-[#E3F2FD]/50 text-xs font-bold text-[#1F4E79] transition-all flex flex-col items-center gap-1 cursor-pointer disabled:opacity-50"
              >
                <FastForward className="w-4 h-4 text-[#FFC107]" />
                <span>+3 Months</span>
              </button>
            </div>
          </div>

          {/* Custom Advance Input */}
          <div className="space-y-2">
            <label htmlFor="custom-advance-days" className="text-xs font-bold text-[#333333] block">
              Custom Days Forward
            </label>
            <div className="flex gap-2">
              <input
                id="custom-advance-days"
                type="number"
                min="1"
                max="365"
                value={customDays}
                onChange={(e) => setCustomDays(Number(e.target.value))}
                className="flex-1 px-3.5 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#1F4E79] focus:border-transparent font-medium"
              />
              <button
                type="button"
                disabled={loading || !customDays || customDays <= 0}
                onClick={() => handleAdvance(customDays)}
                className="px-4 py-2 bg-[#1F4E79] text-white font-bold text-xs rounded-xl hover:bg-[#163a5c] transition-colors disabled:opacity-50 cursor-pointer"
              >
                Advance
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-[#F5F5F5] border-t border-slate-200 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-[#4B6584] hover:text-[#333333] transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default TimeMachineModal;
