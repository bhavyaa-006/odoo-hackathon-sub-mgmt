import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Sparkles,
  X,
  Users,
  FileText,
  Layers,
  Bot,
  HelpCircle,
  Clock,
  Send,
  Loader2,
} from 'lucide-react';
import { staffService } from '../../services/staff.service';

export const AskBrightloop = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const [activeTab, setActiveTab] = useState('search'); // 'search' | 'ai'
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  // AI query state
  const [aiQuestion, setAiQuestion] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResponse, setAiResponse] = useState(null);

  const handleClose = useCallback(() => {
    setQuery('');
    setResults([]);
    setAiQuestion('');
    setAiResponse(null);
    setActiveTab('search');
    onClose();
  }, [onClose]);

  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Global keyboard shortcut Cmd+K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) handleClose();
      }
      if (e.key === 'Escape' && isOpen) {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleClose]);

  // Handle entity search debounce
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (!query.trim()) {
        setResults([]);
        return;
      }
      setLoading(true);
      try {
        const res = await staffService.searchAll(query);
        setResults(res.results || []);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 180);

    return () => clearTimeout(timer);
  }, [query]);

  const handleSelectResult = (link) => {
    handleClose();
    navigate(link);
  };

  const handleRunAiPrompt = async (promptText) => {
    setActiveTab('ai');
    setAiQuestion(promptText);
    setAiLoading(true);
    try {
      const res = await staffService.askAI(promptText);
      setAiResponse(res);
    } catch {
      setAiResponse({
        answer: 'Failed to retrieve AI analysis. Please verify your connection or try again.',
        sources: [],
      });
    } finally {
      setAiLoading(false);
    }
  };

  const handleCustomAiSubmit = (e) => {
    e.preventDefault();
    if (aiQuestion.trim()) {
      handleRunAiPrompt(aiQuestion.trim());
    }
  };

  const PRESET_QUERIES = [
    {
      title: 'Current MRR & Growth',
      prompt: 'What is our current Monthly Recurring Revenue and net churn rate?',
      icon: Sparkles,
    },
    {
      title: 'Critical Overdue Invoices',
      prompt: 'Which invoices are currently overdue past 60 days?',
      icon: Clock,
    },
    {
      title: 'Active Dunning Retries',
      prompt: 'What accounts are currently undergoing dunning cycle retries?',
      icon: HelpCircle,
    },
    {
      title: 'Indian GST Compliance',
      prompt: 'Summarize GST rules applied to enterprise SaaS subscriptions in Karnataka vs Inter-state.',
      icon: FileText,
    },
  ];

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Ask Brightloop Command Palette"
      className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-16 sm:pt-24 bg-slate-900/60 backdrop-blur-xs animate-in fade-in"
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[80vh]">
        {/* Top Control Bar with Tabs */}
        <div className="p-4 border-b border-slate-200 flex items-center gap-3">
          <div className="flex bg-[#F5F5F5] rounded-xl p-1 gap-1 border border-slate-200">
            <button
              onClick={() => setActiveTab('search')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'search'
                  ? 'bg-white text-[#1F4E79] shadow-xs'
                  : 'text-[#4B6584] hover:text-[#333333]'
              }`}
            >
              <Search className="w-3.5 h-3.5" />
              <span>Search Records</span>
            </button>
            <button
              onClick={() => setActiveTab('ai')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'ai'
                  ? 'bg-white text-[#00796B] shadow-xs'
                  : 'text-[#4B6584] hover:text-[#333333]'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-[#00796B]" />
              <span>Ask AI Copilot</span>
            </button>
          </div>

          <div className="flex-1" />

          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg text-[#4B6584] hover:text-[#333333] hover:bg-[#F5F5F5] transition-colors"
            aria-label="Close command palette"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Tab View */}
        {activeTab === 'search' && (
          <div className="flex flex-col flex-1 min-h-0">
            {/* Input Bar */}
            <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-3">
              <Search className="w-5 h-5 text-[#4B6584]" />
              <input
                ref={inputRef}
                type="text"
                placeholder="Search customers, invoices (INV-...), subscriptions (SUB-...), quotations..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="flex-1 text-sm bg-transparent border-0 focus:outline-none placeholder:text-[#4B6584]/60 font-medium text-[#333333]"
              />
              {loading && <Loader2 className="w-4 h-4 text-[#1F4E79] animate-spin" />}
              <span className="hidden sm:inline-block px-2 py-0.5 text-[10px] font-bold text-[#4B6584] bg-[#F5F5F5] rounded border border-slate-200">
                ESC to close
              </span>
            </div>

            {/* Results or Suggestions */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {results.length > 0 ? (
                <div className="space-y-1.5">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-[#4B6584] px-2 mb-2">
                    Matching Records ({results.length})
                  </div>
                  {results.map((item, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSelectResult(item.link)}
                      className="w-full text-left p-3 rounded-xl hover:bg-[#E3F2FD]/50 border border-transparent hover:border-[#1F4E79]/20 transition-all flex items-center justify-between group cursor-pointer"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="p-2 bg-[#F5F5F5] group-hover:bg-[#E3F2FD] text-[#1F4E79] rounded-lg">
                          {item.type === 'Customer' ? (
                            <Users className="w-4 h-4" />
                          ) : item.type === 'Invoice' ? (
                            <FileText className="w-4 h-4" />
                          ) : (
                            <Layers className="w-4 h-4" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-[#333333] group-hover:text-[#1F4E79] truncate">
                            {item.title}
                          </div>
                          <div className="text-[11px] text-[#4B6584] truncate">
                            {item.subtitle}
                          </div>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-100 group-hover:bg-[#1F4E79] group-hover:text-white rounded-full transition-colors">
                        {item.type}
                      </span>
                    </button>
                  ))}
                </div>
              ) : query.trim() ? (
                !loading && (
                  <div className="text-center py-10 text-[#4B6584]">
                    <Search className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    <p className="text-xs font-medium">No records found matching "{query}"</p>
                    <p className="text-[11px] text-[#4B6584]/80 mt-1">
                      Try searching with a customer name, GSTIN, or invoice number.
                    </p>
                  </div>
                )
              ) : (
                <div className="space-y-3">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-[#4B6584] px-1">
                    Quick AI Prompts
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {PRESET_QUERIES.map((preset, idx) => {
                      const Icon = preset.icon;
                      return (
                        <button
                          key={idx}
                          onClick={() => handleRunAiPrompt(preset.prompt)}
                          className="p-3 text-left rounded-xl border border-slate-200 hover:border-[#00796B] hover:bg-[#E0F2F1]/30 transition-all group flex items-start gap-2.5 cursor-pointer"
                        >
                          <Icon className="w-4 h-4 text-[#00796B] shrink-0 mt-0.5" />
                          <div>
                            <div className="text-xs font-bold text-[#333333] group-hover:text-[#00796B]">
                              {preset.title}
                            </div>
                            <div className="text-[11px] text-[#4B6584] line-clamp-1 mt-0.5">
                              {preset.prompt}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* AI Copilot Tab View */}
        {activeTab === 'ai' && (
          <div className="flex flex-col flex-1 min-h-0">
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {aiLoading ? (
                <div className="py-12 flex flex-col items-center justify-center text-center">
                  <Bot className="w-10 h-10 text-[#00796B] animate-bounce mb-3" />
                  <p className="text-xs font-bold text-[#333333]">Analyzing workspace operational data...</p>
                  <p className="text-[11px] text-[#4B6584] mt-1">
                    Synthesizing ledger metrics, contracts, and aging schedules.
                  </p>
                </div>
              ) : aiResponse ? (
                <div className="space-y-4">
                  <div className="bg-[#E0F2F1]/40 border border-[#00796B]/20 rounded-2xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Sparkles className="w-4 h-4 text-[#00796B]" />
                      <span className="text-xs font-bold text-[#00796B] uppercase tracking-wider">
                        Brightloop AI Response
                      </span>
                    </div>
                    <div className="text-xs text-[#333333] leading-relaxed whitespace-pre-line font-normal">
                      {aiResponse.answer}
                    </div>
                  </div>

                  {aiResponse.sources && aiResponse.sources.length > 0 && (
                    <div className="space-y-1.5">
                      <span className="text-[11px] font-bold text-[#4B6584] uppercase tracking-wider">
                        Referenced Sources & Ledgers
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {aiResponse.sources.map((src, i) => (
                          <span
                            key={i}
                            className="text-[10px] font-semibold px-2 py-0.5 bg-slate-100 text-[#4B6584] rounded-md border border-slate-200"
                          >
                            {src}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Bot className="w-10 h-10 text-[#00796B] mx-auto mb-2 opacity-80" />
                  <h4 className="text-xs font-bold text-[#333333]">Ask Anything About Operations</h4>
                  <p className="text-[11px] text-[#4B6584] max-w-sm mx-auto mt-1">
                    Query MRR breakdown, dunning status, delinquent accounts, or GST invoicing requirements.
                  </p>
                </div>
              )}
            </div>

            {/* AI Prompt Input Bar */}
            <form onSubmit={handleCustomAiSubmit} className="p-4 border-t border-slate-200 bg-[#F5F5F5]">
              <div className="flex items-center gap-2 bg-white rounded-xl border border-slate-300 px-3 py-2 focus-within:ring-2 focus-within:ring-[#00796B] focus-within:border-transparent">
                <input
                  type="text"
                  placeholder="Ask a question about financial or subscription health..."
                  value={aiQuestion}
                  onChange={(e) => setAiQuestion(e.target.value)}
                  className="flex-1 text-xs bg-transparent border-0 focus:outline-none font-medium text-[#333333]"
                />
                <button
                  type="submit"
                  disabled={!aiQuestion.trim() || aiLoading}
                  className="p-1.5 bg-[#00796B] text-white rounded-lg hover:bg-[#005f54] transition-colors disabled:opacity-50 cursor-pointer"
                  aria-label="Send prompt"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Footer shortcuts */}
        <div className="px-4 py-2 bg-slate-50 border-t border-slate-200 text-[11px] text-[#4B6584] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-[#1F4E79]">Tip:</span>
            <span>Use ⌘K anywhere to toggle this palette.</span>
          </div>
          <span className="text-[10px] text-slate-400">Phase 3 Staff Operations AI</span>
        </div>
      </div>
    </div>
  );
};

export default AskBrightloop;
