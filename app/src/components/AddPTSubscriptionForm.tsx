import { useState, useEffect } from 'react';
import { X, User, Calendar, DollarSign, TrendingUp, ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { format, addMonths } from 'date-fns';
import { useQueryClient } from '@tanstack/react-query';
import { useCurrency } from '../context/CurrencyContext';

interface AddPTSubscriptionFormProps {
    onClose: () => void;
    onSuccess: () => void;
    editData?: any;
}

interface Coach {
    id: string;
    full_name: string;
    pt_rate: number;
    role: string;
    profile_id: string;
}

interface Student {
    id: string;
    full_name: string;
}

export default function AddPTSubscriptionForm({ onClose, onSuccess, editData }: AddPTSubscriptionFormProps) {
    const { t } = useTranslation();
    const { currency } = useCurrency();
    const queryClient = useQueryClient();
    const [loading, setLoading] = useState(false);
    const [coaches, setCoaches] = useState<Coach[]>([]);
    const [students, setStudents] = useState<Student[]>([]);

    const [isGuest, setIsGuest] = useState(editData ? !editData.student_id : false);
    const [formData, setFormData] = useState({
        student_id: editData?.student_id?.toString() || '',
        student_name: editData?.student_name || '',
        coach_id: editData?.coach_id || '',
        sessions_total: editData?.sessions_total || '',
        start_date: editData?.start_date || format(new Date(), 'yyyy-MM-dd'),
        expiry_date: editData?.expiry_date || format(addMonths(new Date(), 12), 'yyyy-MM-dd'),
        price: editData?.total_price || '',
        student_phone: editData?.student_phone || ''
    });

    const selectedCoach = coaches.find(c => c.id === formData.coach_id);
    const pricePerSession = selectedCoach?.pt_rate || 0;

    useEffect(() => {
        fetchCoaches();
        fetchStudents();
    }, []);

    const fetchCoaches = async () => {
        const { data, error } = await supabase
            .from('coaches')
            .select(`
                id, 
                full_name, 
                pt_rate,
                profile_id,
                profiles:profile_id (role)
            `)
            .order('full_name');

        if (error) {
            console.error('Error fetching coaches:', error);
        } else {
            const enrichedCoaches = (data || []).map((c: any) => ({
                ...c,
                role: c.profiles?.role
            })).filter((c: any) => c.role !== 'reception' && c.role !== 'cleaner');

            setCoaches(enrichedCoaches);
        }
    };

    const fetchStudents = async () => {
        const { data, error } = await supabase
            .from('students')
            .select('id, full_name')
            .order('full_name');

        if (error) {
            console.error('Error fetching students:', error);
        } else {
            setStudents(data || []);
        }
    };

    // Lock body scroll when modal is open
    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validate: requires coach AND (student_id OR (isGuest AND student_name))
        const hasStudent = isGuest ? !!formData.student_name.trim() : !!formData.student_id;

        if (!hasStudent || !formData.coach_id) {
            toast.error(t('common.fillRequired'));
            return;
        }

        if (formData.sessions_total < 1) {
            toast.error('Number of sessions must be at least 1');
            return;
        }

        setLoading(true);

        try {
            const totalSessions = Number(formData.sessions_total);
            const totalPrice = Number(formData.price);

            const payload = {
                student_id: isGuest ? null : formData.student_id,
                student_name: isGuest ? formData.student_name : null,
                coach_id: formData.coach_id,
                sessions_total: totalSessions,
                sessions_remaining: editData?.id ? (editData.sessions_remaining + (totalSessions - editData.sessions_total)) : totalSessions,
                start_date: formData.start_date,
                expiry_date: formData.expiry_date,
                total_price: totalPrice,
                price_per_session: totalPrice / totalSessions,
                student_phone: formData.student_phone,
                status: 'active'
            };

            if (editData?.id) {
                const { error } = await supabase
                    .from('pt_subscriptions')
                    .update(payload)
                    .eq('id', editData.id);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('pt_subscriptions')
                    .insert(payload);
                if (error) throw error;
            }

            // Record payment for PT Subscription (only for new ones or if specifically requested - let's do only for new for now)
            if (!editData?.id) {
                try {
                    const paymentData: any = {
                        amount: Number(formData.price),
                        payment_date: formData.start_date || format(new Date(), 'yyyy-MM-dd'),
                        payment_method: 'cash',
                        notes: `PT Subscription - ${isGuest ? formData.student_name : (students.find(s => s.id === formData.student_id)?.full_name)} - Coach ${selectedCoach?.full_name}`
                    };

                    if (!isGuest && formData.student_id) {
                        paymentData.student_id = formData.student_id;
                    }

                    const { error: paymentError } = await supabase.from('payments').insert(paymentData);
                    if (paymentError) {
                        console.error('PT Payment record failed:', paymentError);
                        toast.error('Subscription created but payment record failed. Please add it manually in Finance.');
                    } else {
                        console.log('PT Payment recorded successfully');
                    }
                } catch (payErr) {
                    console.error('Payment record failed:', payErr);
                }


            }

            // Invalidate queries to update Revenue UI and PT lists
            queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
            queryClient.invalidateQueries({ queryKey: ['payments'] });

            toast.success(t('common.saveSuccess'));
            onSuccess();
            onClose();
        } catch (error: any) {
            console.error('Error with PT subscription:', error);
            toast.error(error.message || t('common.error'));
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

            <div className="w-full max-w-2xl bg-black/60 backdrop-blur-3xl rounded-[3rem] border border-white/5 shadow-[0_50px_100px_rgba(0,0,0,0.9)] overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-12 duration-700 relative flex flex-col max-h-[90vh]">
                {/* Dynamic Glass Shimmer */}
                <div className="absolute inset-0 bg-gradient-to-br from-white/[0.03] via-transparent to-transparent pointer-events-none"></div>

                {/* Header Section */}
                <div className="relative z-10 px-8 pt-10 pb-6 border-b border-white/5 flex-shrink-0">
                    <div className="flex items-start justify-between">
                        <div className="flex-1">
                            <h2 className="text-xl font-black text-white tracking-widest uppercase mb-1 drop-shadow-lg leading-tight">
                                {editData ? 'Modify Subscription' : 'New PT Subscription'}
                            </h2>
                            <p className="text-[9px] font-black text-white/40 uppercase tracking-widest">
                                {editData ? 'Update Training Lifecycle' : 'Professional Training Registration'}
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

                    {/* Mode Toggle & Student Selection */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between px-1">
                            <label className="text-[9px] font-black uppercase tracking-[0.3em] text-white/20">Client Identification</label>
                            <button
                                type="button"
                                onClick={() => {
                                    setIsGuest(!isGuest);
                                    setFormData(prev => ({ ...prev, student_id: '', student_name: '', student_phone: '' }));
                                }}
                                className="px-4 py-1.5 rounded-full bg-white/5 border border-white/5 text-[8px] font-black uppercase tracking-widest text-primary hover:bg-primary/10 transition-all"
                            >
                                {isGuest ? 'Internal Member' : 'External Guest'}
                            </button>
                        </div>

                        <div className="animate-in fade-in slide-in-from-top-2 duration-500">
                            {isGuest ? (
                                <div className="space-y-2 group/field">
                                    <label className="text-[9px] font-black uppercase tracking-[0.3em] text-white/20 ml-1 group-focus-within/field:text-primary transition-colors">Guest Designation</label>
                                    <input
                                        type="text"
                                        value={formData.student_name}
                                        onChange={(e) => setFormData({ ...formData, student_name: e.target.value })}
                                        placeholder="Full Legal Name"
                                        className="w-full px-5 py-3 bg-white/[0.02] border border-white/5 rounded-2xl focus:border-primary/40 outline-none transition-all text-white placeholder:text-white/10 text-xs font-bold"
                                        required
                                    />
                                </div>
                            ) : (
                                <div className="space-y-2 group/field">
                                    <label className="text-[9px] font-black uppercase tracking-[0.3em] text-white/20 ml-1 group-focus-within/field:text-primary transition-colors">Academy Gymnast</label>
                                    <div className="relative">
                                        <select
                                            value={formData.student_id}
                                            onChange={(e) => setFormData({ ...formData, student_id: e.target.value })}
                                            className="w-full px-5 py-3 bg-white/[0.02] border border-white/5 rounded-2xl focus:border-primary/40 outline-none transition-all text-white appearance-none cursor-pointer pr-12 text-xs font-bold"
                                            required
                                        >
                                            <option value="" disabled className="bg-[#0a0a0f]">Select Athlete Profile</option>
                                            {students.map(student => (
                                                <option key={student.id} value={student.id} className="bg-[#0a0a0f]">{student.full_name}</option>
                                            ))}
                                        </select>
                                        <ChevronDown className="absolute right-5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/10 pointer-events-none group-focus-within/field:text-primary transition-colors" />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                        {/* Phone */}
                        <div className="space-y-2 group/field">
                            <label className="text-[9px] font-black uppercase tracking-[0.3em] text-white/20 ml-1 group-focus-within/field:text-primary transition-colors">Secure Contact</label>
                            <input
                                type="tel"
                                value={formData.student_phone}
                                onChange={(e) => setFormData({ ...formData, student_phone: e.target.value })}
                                className="w-full px-5 py-3 bg-white/[0.02] border border-white/5 rounded-2xl focus:border-primary/40 outline-none transition-all text-white text-xs font-bold"
                                placeholder="+XXX-XXXX-XXXX"
                            />
                        </div>

                        {/* Coach Selection */}
                        <div className="space-y-2 group/field">
                            <label className="text-[9px] font-black uppercase tracking-[0.3em] text-white/20 ml-1 group-focus-within/field:text-primary transition-colors">Assign Specialist</label>
                            <div className="relative">
                                <select
                                    value={formData.coach_id}
                                    onChange={(e) => setFormData({ ...formData, coach_id: e.target.value })}
                                    className="w-full px-5 py-3 bg-white/[0.02] border border-white/5 rounded-2xl focus:border-primary/40 outline-none transition-all text-white appearance-none cursor-pointer pr-12 text-xs font-bold"
                                    required
                                >
                                    <option value="" disabled className="bg-[#0a0a0f]">Lead Coach</option>
                                    {coaches.map(coach => (
                                        <option key={coach.id} value={coach.id} className="bg-[#0a0a0f]">{coach.full_name}</option>
                                    ))}
                                </select>
                                <ChevronDown className="absolute right-5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/10 pointer-events-none group-focus-within/field:text-primary transition-colors" />
                            </div>
                        </div>

                        {/* Sessions Count */}
                        <div className="space-y-2 group/field">
                            <label className="text-[9px] font-black uppercase tracking-[0.3em] text-white/20 ml-1 group-focus-within/field:text-primary transition-colors">Training Units</label>
                            <input
                                type="number"
                                min="1"
                                value={formData.sessions_total}
                                onChange={(e) => setFormData({ ...formData, sessions_total: e.target.value })}
                                className="w-full px-5 py-3 bg-white/[0.02] border border-white/5 rounded-2xl focus:border-primary/40 outline-none transition-all text-white text-xs font-bold"
                                required
                            />
                        </div>

                        {/* Start Date */}
                        <div className="space-y-2 group/field">
                            <label className="text-[9px] font-black uppercase tracking-[0.3em] text-white/20 ml-1 group-focus-within/field:text-primary transition-colors">Activation Date</label>
                            <input
                                type="date"
                                value={formData.start_date}
                                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                                className="w-full px-5 py-3 bg-white/[0.02] border border-white/5 rounded-2xl focus:border-primary/40 outline-none transition-all text-white [color-scheme:dark] text-[10px] font-bold tracking-widest text-center"
                                required
                            />
                        </div>
                    </div>

                    {/* Investment / Price */}
                    <div className="space-y-3 group/field">
                        <label className="text-[9px] font-black uppercase tracking-[0.3em] text-white/20 ml-1 group-focus-within/field:text-primary transition-colors">Financial Investment</label>
                        <div className="relative p-6 bg-white/[0.01] border border-white/5 rounded-[2rem] flex items-center justify-between group-focus-within/field:bg-white/[0.03] transition-all">
                            <input
                                type="number"
                                min="0"
                                value={formData.price}
                                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                                className="bg-transparent border-none outline-none text-4xl font-black text-white w-full tracking-tighter"
                                required
                            />
                            <div className="flex flex-col items-end">
                                <span className="text-[10px] font-black text-white/20 uppercase tracking-widest">{currency.code}</span>
                                {selectedCoach && (
                                    <span className="text-[8px] font-black text-primary/40 uppercase tracking-widest whitespace-nowrap mt-1">
                                        Rate: {selectedCoach.pt_rate} / Session
                                    </span>
                                )}
                            </div>
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
                        disabled={loading}
                        className="flex-1 py-4 rounded-3xl bg-white text-black hover:bg-white/90 transition-all duration-500 shadow-[0_20px_40px_rgba(255,255,255,0.1)] active:scale-95 flex items-center justify-center group/btn overflow-hidden disabled:opacity-50 disabled:pointer-events-none"
                    >
                        {loading ? (
                            <span className="font-black uppercase tracking-[0.3em] text-[10px] animate-pulse">Processing...</span>
                        ) : (
                            <span className="font-black uppercase tracking-[0.3em] text-[10px] group-hover:tracking-[0.5em] transition-all duration-500">
                                {editData ? 'Commit Updates' : 'Authorize Subscription'}
                            </span>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
