import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Sparkles,
  Send,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
} from 'lucide-react';
import { dunningService } from '../../../services/dunning.service';
import Money from '../../../components/ui/Money';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';

export const DunningDetailPage = () => {
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [dunningCase, setDunningCase] = useState(null);
  const [retryLoading, setRetryLoading] = useState(false);
  const [activeTone, setActiveTone] = useState('friendly'); // 'friendly' | 'firm' | 'final'
  const [aiReminder, setAiReminder] = useState(null);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [sendingReminder, setSendingReminder] = useState(false);
  const [notice, setNotice] = useState(null);

  const fetchCase = useCallback(async () => {
    try {
      setLoading(true);
      const res = await dunningService.getDunningCase(id);
      setDunningCase(res);
      if (res?.ai_reminders?.[activeTone]) {
        setAiReminder(res.ai_reminders[activeTone]);
      }
    } catch (err) {
      console.error('Failed to load dunning case:', err);
    } finally {
      setLoading(false);
    }
  }, [id, activeTone]);

  useEffect(() => {
    let isMounted = true;
    const run = async () => {
      try {
        setLoading(true);
        const res = await dunningService.getDunningCase(id);
        if (isMounted) {
          setDunningCase(res);
          if (res?.ai_reminders?.[activeTone]) {
            setAiReminder(res.ai_reminders[activeTone]);
          }
        }
      } catch (err) {
        console.error('Failed to load dunning case:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    run();
    return () => {
      isMounted = false;
    };
  }, [id, activeTone]);

  const handleToneChange = async (tone) => {
    setActiveTone(tone);
    try {
      setAiGenerating(true);
      const res = await dunningService.generateAIReminder(id, tone);
      setAiReminder(res.reminder || res);
    } catch {
      if (dunningCase?.ai_reminders?.[tone]) {
        setAiReminder(dunningCase.ai_reminders[tone]);
      }
    } finally {
      setAiGenerating(false);
    }
  };

  const handleSimulateRetry = async () => {
    try {
      setRetryLoading(true);
      const res = await dunningService.retryAttempt(id);
      setNotice({
        type: res.success ? 'success' : 'error',
        message: res.message || 'Payment retry simulated.',
      });
      fetchCase();
      setTimeout(() => setNotice(null), 4000);
    } catch (err) {
      setNotice({
        type: 'error',
        message: err.message || 'Failed to simulate payment retry.',
      });
    } finally {
      setRetryLoading(false);
    }
  };

  const handleSendReminder = () => {
    setSendingReminder(true);
    setTimeout(() => {
      setSendingReminder(false);
      setNotice({
        type: 'success',
        message: `AI ${activeTone.toUpperCase()} reminder dispatched to ${dunningCase?.customer_email}!`,
      });
      setTimeout(() => setNotice(null), 4000);
    }, 600);
  };

  if (loading) {
    return (
      <div className="py-24 flex items-center justify-center">
        <LoadingSpinner size="lg" message="Loading dunning case details..." />
      </div>
    );
  }

  if (!dunningCase) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center max-w-lg mx-auto my-12">
        <AlertCircle className="w-10 h-10 text-rose-500 mx-auto mb-3" />
        <h3 className="text-base font-bold text-[#1F4E79]">Dunning Case Not Found</h3>
        <Link
          to="/staff/dunning"
          className="inline-flex items-center gap-1.5 mt-4 px-4 py-2 bg-[#1F4E79] text-white rounded-xl text-xs font-bold"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Dunning</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <Link
        to="/staff/dunning"
        className="inline-flex items-center gap-1.5 text-xs font-bold text-[#4B6584] hover:text-[#1F4E79] transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Back to Dunning Cases</span>
      </Link>

      {notice && (
        <div
          className={`p-3.5 rounded-xl text-xs flex items-center gap-2.5 ${
            notice.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          {notice.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span>{notice.message}</span>
        </div>
      )}

      {/* Case Header Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl font-bold font-heading text-[#1F4E79]">
              {dunningCase.case_number}
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase bg-amber-100 text-amber-800">
              {dunningCase.recovery_status}
            </span>
          </div>
          <p className="text-xs text-[#4B6584] mt-1">
            Account:{' '}
            <Link
              to={`/staff/customers/${dunningCase.customer_id}`}
              className="font-bold text-[#1F4E79] hover:underline"
            >
              {dunningCase.customer_company}
            </Link>{' '}
            • Invoice:{' '}
            <Link
              to={`/staff/invoices/${dunningCase.invoice_id}`}
              className="font-bold text-[#1F4E79] hover:underline"
            >
              {dunningCase.invoice_number}
            </Link>
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className="text-[10px] text-[#4B6584] uppercase font-bold block">
              Delinquent Amount
            </span>
            <div className="text-lg font-bold text-rose-600">
              <Money minor={dunningCase.outstanding_amount_minor || 0} />
            </div>
          </div>

          <button
            type="button"
            disabled={retryLoading}
            onClick={handleSimulateRetry}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#1F4E79] hover:bg-[#163a5c] text-white text-xs font-bold rounded-xl transition-colors shadow-xs cursor-pointer disabled:opacity-50"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${retryLoading ? 'animate-spin' : ''}`} />
            <span>Simulate Gateway Retry</span>
          </button>
        </div>
      </div>

      {/* Two Column Layout: Retry Attempt Timeline & AI Reminder Writer */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Attempt History */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#4B6584]">
              Retry History ({dunningCase.retry_count} / {dunningCase.max_retries} attempts)
            </h3>
            <span className="text-[11px] text-[#00796B] font-semibold">
              Next scheduled: {new Date(dunningCase.next_retry_date).toLocaleDateString()}
            </span>
          </div>

          <div className="space-y-4">
            {(dunningCase.attempts || []).map((att) => (
              <div
                key={att.id}
                className="p-4 rounded-xl border border-rose-100 bg-rose-50/40 text-xs space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#1F4E79]">
                    Attempt #{att.attempt_number}
                  </span>
                  <span className="font-mono text-[10px] font-bold text-rose-700 bg-white px-2 py-0.5 rounded border border-rose-200 uppercase">
                    {att.error_code}
                  </span>
                </div>
                <div className="text-[11px] text-[#4B6584]">
                  Gateway: {att.gateway} • Date: {new Date(att.date).toLocaleString()}
                </div>
                <p className="text-xs text-[#333333] font-medium leading-relaxed">
                  {att.error_message}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: AI Dunning Reminder Writer */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-[#00796B]" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#1F4E79]">
                AI Dunning Reminder Writer
              </h3>
            </div>
            <span className="text-[10px] font-bold text-[#00796B] bg-[#E0F2F1] px-2 py-0.5 rounded-full">
              Automated
            </span>
          </div>

          {/* Tone Selector */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'friendly', label: '1. Friendly Nudge' },
              { id: 'firm', label: '2. Firm Due Date' },
              { id: 'final', label: '3. Final Suspension' },
            ].map((toneObj) => (
              <button
                key={toneObj.id}
                type="button"
                onClick={() => handleToneChange(toneObj.id)}
                className={`py-2 px-2.5 rounded-xl text-xs font-bold transition-all text-center cursor-pointer ${
                  activeTone === toneObj.id
                    ? 'bg-[#00796B] text-white shadow-xs'
                    : 'bg-[#F5F5F5] text-[#4B6584] hover:bg-slate-200 hover:text-[#333333]'
                }`}
              >
                {toneObj.label}
              </button>
            ))}
          </div>

          {/* AI Generated Message Preview */}
          {aiGenerating ? (
            <div className="py-12 flex flex-col items-center justify-center text-center">
              <Sparkles className="w-8 h-8 text-[#00796B] animate-spin mb-2" />
              <span className="text-xs text-[#4B6584]">Generating calibrated AI copy...</span>
            </div>
          ) : aiReminder ? (
            <div className="space-y-3">
              <div className="p-3 rounded-xl bg-[#F5F5F5] border border-slate-200 text-xs">
                <span className="text-[10px] font-bold text-[#4B6584] uppercase block mb-1">
                  Email Subject
                </span>
                <p className="font-bold text-[#333333]">{aiReminder.subject}</p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                <span className="text-[10px] font-bold text-[#4B6584] uppercase block mb-1">
                  Message Body
                </span>
                <p className="text-[#333333] whitespace-pre-line leading-relaxed font-sans font-normal">
                  {aiReminder.body}
                </p>
              </div>

              <button
                type="button"
                disabled={sendingReminder}
                onClick={handleSendReminder}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-[#00796B] hover:bg-[#005f54] text-white text-xs font-bold rounded-xl transition-colors shadow-xs cursor-pointer disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                <span>
                  {sendingReminder ? 'Dispatching...' : `Dispatch ${activeTone.toUpperCase()} Notice`}
                </span>
              </button>
            </div>
          ) : (
            <div className="p-8 text-center text-xs text-[#4B6584]">
              Select a tone above to generate AI dunning copy.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DunningDetailPage;
