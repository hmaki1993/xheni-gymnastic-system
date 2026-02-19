import { useState } from 'react';
import { Banknote, Clock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useMonthlyPayroll } from '../hooks/useData';
import { useCurrency } from '../context/CurrencyContext';

interface PayrollEntry {
    coach_id: string;
    coach_name: string;
    role?: string;
    total_pt_sessions: number;
    pt_rate: number;
    salary: number;
    total_hours: number;
    total_earnings: number;
}

interface PayrollProps {
    onViewAttendance?: (coachId: string) => void;
    refreshTrigger?: number;
}

export default function Payroll({ onViewAttendance }: PayrollProps) {
    const { t } = useTranslation();
    const { currency } = useCurrency();
    const [month, setMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM

    // Helper for role badge colors
    const getRoleBadgeStyles = (role: string) => {
        const styles: Record<string, string> = {
            admin: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30 shadow-[0_0_10px_rgba(99,102,241,0.15)]',
            head_coach: 'bg-amber-500/20 text-amber-300 border-amber-500/30 shadow-[0_0_10px_rgba(245,158,11,0.15)]',
            coach: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.15)]',
            reception: 'bg-blue-500/20 text-blue-300 border-blue-500/30 shadow-[0_0_10px_rgba(59,130,246,0.15)]',
            cleaner: 'bg-slate-500/20 text-slate-300 border-slate-500/30 shadow-[0_0_10px_rgba(148,163,184,0.15)]'
        };
        return styles[role?.toLowerCase()] || 'bg-white/10 text-white/50 border-white/10';
    };

    // Use the shared hook for calculations
    const { data, isLoading: loading } = useMonthlyPayroll(month);
    const payrollData = data?.payrollData || [];


    return (
        <div className="glass-card rounded-[3rem] overflow-hidden border border-white/10 shadow-premium mt-12 bg-white/[0.01] animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="p-10 border-b border-white/5 flex flex-col sm:flex-row items-center justify-between bg-white/[0.02] gap-6">
                <h3 className="text-2xl font-black text-white uppercase tracking-tight flex items-center gap-4">
                    <div className="p-3 bg-primary/20 rounded-2xl text-primary shadow-inner">
                        <Banknote className="w-6 h-6" />
                    </div>
                    {t('coaches.payrollTitle')}
                </h3>
                <div className="relative group w-full sm:w-auto">
                    <div className="relative">
                        <input
                            type="text"
                            value={month}
                            onChange={(e) => setMonth(e.target.value)}
                            placeholder="YYYY-MM"
                            className="w-32 bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all font-black uppercase tracking-widest text-xs text-center placeholder:text-white/20"
                        />
                        <div className="absolute inset-x-0 bottom-0 h-[2px] bg-gradient-to-r from-transparent via-primary/50 to-transparent opacity-0 group-focus-within:opacity-100 transition-opacity"></div>
                    </div>
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead className="bg-white/[0.01] text-white/30 font-black text-[10px] uppercase tracking-[0.3em] border-b border-white/5">
                        <tr>
                            <th className="px-10 py-8">{t('common.name')}</th>
                            <th className="px-10 py-8 text-center">{t('coaches.workHours')}</th>
                            <th className="px-10 py-8 text-center">{t('coaches.sessionCount')}</th>
                            <th className="px-10 py-8 text-center">{t('coaches.rate')}</th>
                            <th className="px-10 py-8 text-center">{t('coaches.baseSalary')}</th>
                            <th className="px-10 py-8 text-right">{t('coaches.totalEarnings')}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {loading ? (
                            <tr><td colSpan={6} className="px-10 py-32 text-center text-white/20 font-black uppercase tracking-[0.2em] italic">{t('common.loading')}</td></tr>
                        ) : payrollData.length === 0 ? (
                            <tr><td colSpan={6} className="px-10 py-32 text-center text-white/20 font-black uppercase tracking-[0.2em] italic">{t('common.noResults')}</td></tr>
                        ) : (
                            payrollData.map((row) => (
                                <tr key={row.coach_id} className="hover:bg-white/[0.02] transition-all duration-500 group border-l-2 border-transparent hover:border-primary">
                                    <td className="px-10 py-8">
                                        <div className="flex items-center justify-between group/name">
                                            <div className="flex items-center gap-5">
                                                <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-xs font-black text-white/40 group-hover:bg-primary/20 group-hover:text-primary transition-all duration-500 shadow-inner">
                                                    {row.coach_name?.[0] || '?'}
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="font-black text-white text-xl tracking-tight group-hover:text-primary transition-colors">{row.coach_name}</span>
                                                    {row.role && (
                                                        <div className={`mt-2 px-3 py-1 rounded-lg flex items-center self-start border transition-all duration-300 ${getRoleBadgeStyles(row.role)}`}>
                                                            <span className="text-[9px] font-black uppercase tracking-[0.2em]">
                                                                {t(`roles.${row.role}`)}
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            {onViewAttendance && (
                                                <button
                                                    onClick={() => onViewAttendance(row.coach_id)}
                                                    className="p-3 hover:bg-white/10 rounded-2xl text-white/20 hover:text-primary transition-all opacity-0 group-hover:opacity-100"
                                                    title="View Logs"
                                                >
                                                    <Clock className="w-5 h-5" />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-10 py-8 text-center">
                                        <span className="text-white/60 font-black text-sm tracking-widest uppercase bg-white/5 px-4 py-2 rounded-xl group-hover:text-white transition-colors">{row.total_hours}h</span>
                                    </td>
                                    <td className="px-10 py-8 text-center">
                                        <span className="text-white/40 font-black text-lg group-hover:text-white transition-colors">{row.total_pt_sessions}</span>
                                    </td>
                                    <td className="px-10 py-8 text-center">
                                        <div className="flex flex-col items-center">
                                            <span className="text-white/40 font-bold text-sm">{row.pt_rate}</span>
                                            <span className="text-[7px] font-black text-white/20 uppercase tracking-widest">Base Rate</span>
                                        </div>
                                    </td>
                                    <td className="px-10 py-8 text-center">
                                        <span className="text-white/40 font-bold text-sm tracking-tight">{row.salary?.toLocaleString()}</span>
                                    </td>
                                    <td className="px-10 py-8 text-right">
                                        <div className="flex flex-col items-end group-hover:scale-110 transition-transform duration-500 origin-right">
                                            <span className="text-3xl font-black text-emerald-400 tracking-tighter">
                                                {row.total_earnings.toLocaleString()}
                                            </span>
                                            <span className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em]">{currency.code}</span>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
