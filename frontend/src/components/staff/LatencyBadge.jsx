import { useState, useEffect } from 'react';
import { Activity } from 'lucide-react';
import api from '../../services/api';

export const LatencyBadge = () => {
  const [latency, setLatency] = useState(null);
  const [isOnline, setIsOnline] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const measureLatency = async () => {
      const start = performance.now();
      try {
        await api.get('/health', { timeout: 3000 });
        const duration = Math.round(performance.now() - start);
        if (isMounted) {
          setLatency(duration);
          setIsOnline(true);
        }
      } catch {
        if (isMounted) {
          setLatency(null);
          setIsOnline(false);
        }
      }
    };

    measureLatency();
    const interval = setInterval(measureLatency, 15000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <div
      title={isOnline ? `Connected to Brightloop Backend (${latency}ms roundtrip)` : 'API Disconnected or Unavailable'}
      className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-[#F5F5F5] text-[#4B6584] border border-[#4B6584]/20 select-none"
    >
      <span className="relative flex h-2 w-2">
        <span
          className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
            isOnline ? 'bg-emerald-400' : 'bg-rose-400'
          }`}
        />
        <span
          className={`relative inline-flex rounded-full h-2 w-2 ${
            isOnline ? 'bg-emerald-500' : 'bg-rose-500'
          }`}
        />
      </span>
      <Activity className="w-3 h-3 text-[#4B6584]" />
      <span>{isOnline ? `${latency}ms` : 'API Offline'}</span>
    </div>
  );
};

export default LatencyBadge;
