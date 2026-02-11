import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Clock } from 'lucide-react';

interface PremiumClockProps {
    className?: string;
}

export default function PremiumClock({ className = "" }: PremiumClockProps) {
    const [time, setTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    const hours = format(time, 'HH');
    const minutes = format(time, 'mm');
    const seconds = format(time, 'ss');
    const amPm = format(time, 'aaa');

    return (
        <div className={`inline-flex items-center gap-3 px-4 py-1.5 bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 transition-all duration-700 group ${className}`}>
            <div className="flex items-center gap-2.5">
                {/* Minimalist Icon Box */}
                <div className="flex items-center justify-center w-7 h-7 bg-primary/20 rounded-xl border border-primary/20 transition-all duration-500 group-hover:bg-primary/30">
                    <Clock className="w-3.5 h-3.5 text-primary drop-shadow-[0_0_5px_rgba(var(--primary-rgb),0.5)]" />
                </div>

                <div className="flex items-baseline gap-1" style={{ textShadow: '0 0 10px rgba(255, 255, 255, 0.1)' }}>
                    <span className="text-sm font-black text-white tracking-widest font-mono leading-none">
                        {hours}
                    </span>
                    <span className="text-primary font-black animate-pulse text-sm leading-none">:</span>
                    <span className="text-sm font-black text-white tracking-widest font-mono leading-none">
                        {minutes}
                    </span>
                    <span className="text-[9px] font-black text-white/30 ml-1 font-mono tracking-tighter self-center uppercase">
                        {seconds}
                    </span>
                </div>
            </div>

            {/* Refined Label Stack */}
            <div className="flex flex-col items-start gap-1">
                <span className="text-[7px] font-black text-white/30 uppercase tracking-[0.3em] leading-none mb-0.5">{format(time, 'eee')}</span>
                <span className="text-[10px] font-black text-primary uppercase tracking-widest leading-none">{amPm}</span>
            </div>
        </div>
    );
}
