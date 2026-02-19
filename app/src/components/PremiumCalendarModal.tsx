import { useState, useEffect } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isToday, subMonths, addMonths } from 'date-fns';
import { X, ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

interface PremiumCalendarModalProps {
    subscriptionId: string;
    studentName: string;
    onClose: () => void;
}

export default function PremiumCalendarModal({ subscriptionId, studentName, onClose }: PremiumCalendarModalProps) {
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [history, setHistory] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchHistory();
    }, [currentMonth, subscriptionId]);

    const fetchHistory = async () => {
        try {
            setLoading(true);
            const start = startOfMonth(currentMonth);
            const end = endOfMonth(currentMonth);

            const { data, error } = await supabase
                .from('pt_sessions')
                .select('*')
                .eq('subscription_id', subscriptionId)
                .gte('date', format(start, 'yyyy-MM-dd'))
                .lte('date', format(end, 'yyyy-MM-dd'));

            if (error) throw error;
            setHistory(data || []);
        } catch (error) {
            console.error('Error fetching history:', error);
            toast.error('Failed to load history');
        } finally {
            setLoading(false);
        }
    };

    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);
    const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
    const startDay = monthStart.getDay();
    const blanks = Array(startDay).fill(null);

    return (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl animate-in fade-in duration-500">
            <div className="glass-card w-full max-w-md rounded-[2rem] border border-white/10 overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)] animate-in zoom-in-95 duration-500 bg-[#0a0c10]/80">
                {/* Visual Header Decoration */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-accent to-primary opacity-50"></div>

                <div className="p-6 border-b border-white/5 flex items-center justify-between relative">
                    <div className="space-y-0.5">
                        <div className="flex items-center gap-2.5">
                            <div className="w-1 h-5 bg-primary rounded-full shadow-[0_0_15px_rgba(var(--primary-rgb),0.5)]"></div>
                            <h2 className="text-xl font-black text-white uppercase tracking-tighter">
                                Training Journey
                            </h2>
                        </div>
                        <p className="text-white/40 font-black uppercase tracking-[0.3em] text-[9px] ml-3.5">{studentName}</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/5 hover:bg-rose-500/20 text-white/40 hover:text-rose-500 transition-all border border-white/5 hover:border-rose-500/20 active:scale-90"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className="p-6">
                    <div className="flex items-center justify-between mb-6 px-1">
                        <button
                            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                            className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/5 border border-white/5 text-white/40 hover:text-white hover:bg-white/10 transition-all hover:scale-105"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <h3 className="text-lg font-black text-white uppercase tracking-tight">
                            {format(currentMonth, 'MMMM yyyy')}
                        </h3>
                        <button
                            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                            className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/5 border border-white/5 text-white/40 hover:text-white hover:bg-white/10 transition-all hover:scale-105"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>

                    {loading ? (
                        <div className="h-[250px] flex items-center justify-center">
                            <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-7 gap-2">
                            {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map((day, i) => (
                                <div key={i} className="text-center text-[8px] font-black text-white/20 uppercase tracking-[0.3em] mb-2">
                                    {day}
                                </div>
                            ))}

                            {blanks.map((_, i) => (
                                <div key={`blank-${i}`} className="aspect-square opacity-0" />
                            ))}

                            {monthDays.map((day) => {
                                const dateStr = format(day, 'yyyy-MM-dd');
                                const record = history.find(h => h.date === dateStr);
                                const isAttended = !!record;
                                const isCurrentToday = isToday(day);

                                return (
                                    <div
                                        key={day.toISOString()}
                                        className={`aspect-square rounded-xl flex flex-col items-center justify-center border transition-all duration-500 relative group/day
                                            ${isCurrentToday ? 'border-primary ring-1 ring-primary/30 ring-offset-2 ring-offset-[#0a0c10]' : ''}
                                            ${isAttended
                                                ? 'bg-primary border-primary text-white shadow-[0_0_20px_rgba(var(--primary-rgb),0.3)] scale-105 z-10'
                                                : 'bg-white/5 border-white/5 text-white/20 hover:border-white/10 hover:bg-white/[0.08]'}`}
                                    >
                                        <span className={`text-xs font-black ${isAttended ? 'text-white' : ''}`}>
                                            {format(day, 'd')}
                                        </span>
                                        {record && (
                                            <div className="absolute bottom-1.5">
                                                <div className="w-0.5 h-0.5 rounded-full bg-white/60"></div>
                                            </div>
                                        )}

                                        {/* Tooltip on hover */}
                                        <div className="absolute -bottom-9 left-1/2 -translate-x-1/2 px-2.5 py-1 bg-white/10 backdrop-blur-md rounded-lg border border-white/10 text-[7px] font-black uppercase tracking-widest text-white opacity-0 group-hover/day:opacity-100 pointer-events-none transition-all scale-90 group-hover/day:scale-100 z-[1001] whitespace-nowrap shadow-2xl">
                                            {isAttended ? `Attended at ${format(new Date(record.created_at), 'HH:mm')}` : 'No Session'}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-3 mt-8">
                        <div className="bg-primary/10 border border-primary/20 p-4 rounded-2xl relative overflow-hidden group/stat">
                            <div className="absolute -right-4 -top-4 w-12 h-12 bg-primary/10 rounded-full blur-xl group-hover/stat:scale-150 transition-transform duration-700"></div>
                            <div className="text-2xl font-black text-primary tracking-tighter">
                                {history.length}
                            </div>
                            <div className="text-[8px] font-black text-primary/50 uppercase tracking-[0.2em] mt-0.5">Sessions This Month</div>
                        </div>
                        <div className="bg-white/5 border border-white/10 p-4 rounded-2xl relative overflow-hidden group/stat">
                            <div className="absolute -right-4 -top-4 w-12 h-12 bg-white/5 rounded-full blur-xl group-hover/stat:scale-150 transition-transform duration-700"></div>
                            <div className="text-2xl font-black text-white/40 tracking-tighter">
                                {monthDays.length > 0 ? Math.round((history.length / monthDays.length) * 100) : 0}%
                            </div>
                            <div className="text-[8px] font-black text-white/20 uppercase tracking-[0.2em] mt-0.5">Consistency Rate</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
