import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase';
import { X, RefreshCw, Calendar, DollarSign, User } from 'lucide-react';
import { format, addMonths } from 'date-fns';
import toast from 'react-hot-toast';
import { useQueryClient } from '@tanstack/react-query';
import { useCurrency } from '../context/CurrencyContext';

interface RenewPTSubscriptionFormProps {
    subscription: any;
    onClose: () => void;
    onSuccess: () => void;
    role?: string;
}

export default function RenewPTSubscriptionForm({ subscription, onClose, onSuccess, role }: RenewPTSubscriptionFormProps) {
    const { t } = useTranslation();
    const { currency } = useCurrency();
    const queryClient = useQueryClient();
    const [loading, setLoading] = useState(false);

    const [formData, setFormData] = useState({
        sessions_to_add: 0,
        renewal_price: 0,
        expiry_date: subscription.expiry_date || format(addMonths(new Date(), 12), 'yyyy-MM-dd'),
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (formData.sessions_to_add <= 0) {
            toast.error('Please add at least 1 session');
            return;
        }

        setLoading(true);
        const loadingToast = toast.loading('Renewing subscription...');

        try {
            // 1. Update PT Subscription
            const newTotalCount = subscription.sessions_total + formData.sessions_to_add;
            const newRemainingCount = subscription.sessions_remaining + formData.sessions_to_add;
            const newTotalPrice = (Number(subscription.total_price) || 0) + formData.renewal_price;

            const { error: subError } = await supabase
                .from('pt_subscriptions')
                .update({
                    sessions_total: newTotalCount,
                    sessions_remaining: newRemainingCount,
                    total_price: newTotalPrice,
                    expiry_date: formData.expiry_date,
                    status: 'active',
                    updated_at: new Date().toISOString()
                })
                .eq('id', subscription.id);

            if (subError) throw subError;

            // 2. Record Payment
            const { error: paymentError } = await supabase
                .from('payments')
                .insert({
                    student_id: subscription.student_id,
                    amount: formData.renewal_price,
                    payment_date: new Date().toISOString(),
                    payment_method: 'cash',
                    notes: `PT Renewal - ${formData.sessions_to_add} sessions for ${subscription.students?.full_name || subscription.student_name}`
                });

            if (paymentError) throw paymentError;

            // 3. Refresh data
            queryClient.invalidateQueries({ queryKey: ['pt_subscriptions'] });
            queryClient.invalidateQueries({ queryKey: ['payments'] });

            toast.success('Subscription renewed successfully!', { id: loadingToast });
            onSuccess();
            onClose();
        } catch (error: any) {
            console.error('Error renewing PT subscription:', error);
            toast.error(error.message || 'Failed to renew subscription', { id: loadingToast });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-hidden">
            {/* Ultra-Neutral Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-md animate-in fade-in duration-1000"
                onClick={onClose}
            />

            <div className="w-full max-w-lg bg-black/60 backdrop-blur-3xl rounded-[3rem] border border-white/5 shadow-[0_50px_100px_rgba(0,0,0,0.9)] overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-12 duration-700 relative flex flex-col max-h-[90vh]">
                {/* Dynamic Glass Shimmer */}
                <div className="absolute inset-0 bg-gradient-to-br from-white/[0.03] via-transparent to-transparent pointer-events-none"></div>

                {/* Header Section */}
                <div className="relative z-10 px-8 pt-10 pb-6 border-b border-white/5 flex-shrink-0 bg-accent/5">
                    <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0 pr-4">
                            <h2 className="text-xl font-black text-white tracking-widest uppercase mb-1 drop-shadow-lg leading-tight truncate">
                                Renew Professional Training
                            </h2>
                            <p className="text-[9px] font-black text-accent uppercase tracking-widest">
                                {subscription.students?.full_name || subscription.student_name} • Extension Protocol
                            </p>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-3 rounded-2xl bg-white/5 hover:bg-rose-500 text-white/40 hover:text-white transition-all border border-white/5 active:scale-90"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>

                {/* Scrollable Form Body */}
                <form onSubmit={handleSubmit} className="relative z-10 px-8 py-6 overflow-y-auto custom-scrollbar flex-1 space-y-8">

                    {/* Specialist Info */}
                    <div className="space-y-2 group/field opacity-60">
                        <label className="text-[9px] font-black uppercase tracking-[0.3em] text-white/20 ml-1">Current Specialist</label>
                        <div className="flex items-center gap-3 px-5 py-3 bg-white/[0.02] border border-white/5 rounded-2xl text-white/40">
                            <User className="w-3.5 h-3.5" />
                            <span className="text-xs font-bold tracking-wide">{subscription.coaches?.full_name || 'N/A'}</span>
                        </div>
                    </div>

                    {/* Sessions to Add - Premium Counter */}
                    <div className="space-y-6 text-center py-8 bg-white/[0.01] border border-white/[0.03] rounded-[2.5rem] relative overflow-hidden group/counter">
                        <div className="absolute inset-0 bg-gradient-to-b from-accent/[0.02] to-transparent pointer-events-none"></div>
                        <label className="relative z-10 text-[9px] font-black uppercase tracking-[0.3em] text-white/20 block mb-4">Add Training Volume</label>

                        <div className="relative z-10 flex items-center justify-center gap-10">
                            <button
                                type="button"
                                onClick={() => setFormData(prev => ({ ...prev, sessions_to_add: Math.max(0, prev.sessions_to_add - 1) }))}
                                className="w-14 h-14 rounded-full border border-white/5 flex items-center justify-center text-white/20 hover:text-white hover:bg-accent hover:border-accent transition-all text-2xl font-black active:scale-90 shadow-xl"
                            >-</button>

                            <div className="flex flex-col items-center">
                                <input
                                    required
                                    type="number"
                                    className="w-24 bg-transparent border-none text-center text-5xl font-black text-white outline-none appearance-none tracking-tighter"
                                    value={formData.sessions_to_add}
                                    onChange={e => setFormData({ ...formData, sessions_to_add: parseInt(e.target.value) || 0 })}
                                />
                                <span className="text-[8px] font-black uppercase tracking-widest text-accent mt-2">Units</span>
                            </div>

                            <button
                                type="button"
                                onClick={() => setFormData(prev => ({ ...prev, sessions_to_add: prev.sessions_to_add + 1 }))}
                                className="w-14 h-14 rounded-full border border-white/5 flex items-center justify-center text-white/20 hover:text-white hover:bg-accent hover:border-accent transition-all text-2xl font-black active:scale-90 shadow-xl"
                            >+</button>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                        {/* Renewal Price */}
                        {role !== 'head_coach' && (
                            <div className="space-y-2 group/field">
                                <label className="text-[9px] font-black uppercase tracking-[0.3em] text-white/20 ml-1 group-focus-within/field:text-accent transition-colors">Renewal Commitment</label>
                                <div className="relative">
                                    <input
                                        required
                                        type="number"
                                        className="w-full px-5 py-3 bg-white/[0.02] border border-white/5 rounded-2xl focus:border-accent/40 outline-none transition-all text-white text-xs font-bold"
                                        value={formData.renewal_price}
                                        onChange={e => setFormData({ ...formData, renewal_price: parseFloat(e.target.value) || 0 })}
                                    />
                                    <div className="absolute right-5 top-1/2 -translate-y-1/2 text-[9px] font-black text-white/20 uppercase tracking-widest">{currency.code}</div>
                                </div>
                            </div>
                        )}

                        {/* New Expiry Date */}
                        <div className="space-y-2 group/field">
                            <label className="text-[9px] font-black uppercase tracking-[0.3em] text-white/20 ml-1 group-focus-within/field:text-accent transition-colors">Lifecycle Extension</label>
                            <input
                                required
                                type="date"
                                className="w-full px-5 py-3 bg-white/[0.02] border border-white/5 rounded-2xl focus:border-accent/40 outline-none transition-all text-white [color-scheme:dark] text-[10px] font-bold tracking-widest text-center"
                                value={formData.expiry_date}
                                onChange={e => setFormData({ ...formData, expiry_date: e.target.value })}
                            />
                        </div>
                    </div>
                </form>

                {/* Footer Section - Single Premium Button */}
                <div className="relative z-10 px-8 py-8 border-t border-white/5 flex-shrink-0 flex items-center justify-between gap-6">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-6 py-4 text-[9px] font-black uppercase tracking-[0.3em] text-white/20 hover:text-white transition-all duration-500 whitespace-nowrap"
                    >
                        Discard
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={loading || formData.sessions_to_add <= 0}
                        className="flex-1 py-4 rounded-3xl bg-accent text-white hover:bg-accent/90 transition-all duration-500 shadow-[0_20px_40px_rgba(var(--accent-rgb),0.2)] active:scale-95 flex items-center justify-center group/btn overflow-hidden disabled:opacity-50 disabled:pointer-events-none"
                    >
                        {loading ? (
                            <span className="font-black uppercase tracking-[0.3em] text-[10px] animate-pulse">Processing...</span>
                        ) : (
                            <span className="font-black uppercase tracking-[0.3em] text-[10px] group-hover:tracking-[0.5em] transition-all duration-500">
                                Authorize Extension
                            </span>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
