import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { X, Save, DollarSign, ChevronDown } from 'lucide-react';
import { useCurrency } from '../context/CurrencyContext';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

interface Student {
    id: string;
    full_name: string;
}

interface AddPaymentFormProps {
    onClose: () => void;
    onSuccess: () => void;
}

export default function AddPaymentForm({ onClose, onSuccess }: AddPaymentFormProps) {
    const { t } = useTranslation();
    const { currency } = useCurrency();
    const [loading, setLoading] = useState(false);
    const [students, setStudents] = useState<Student[]>([]);

    const [formData, setFormData] = useState({
        student_id: '',
        guest_name: '',
        amount: '',
        payment_method: 'cash',
        notes: '',
        date: new Date().toISOString().slice(0, 10),
        is_guest: false
    });

    useEffect(() => {
        const fetchStudents = async () => {
            const { data } = await supabase.from('students').select('id, full_name');
            if (data) setStudents(data);
        };
        fetchStudents();
    }, []);

    // Theme-aware styles to ensure visibility
    const inputStyle = {
        backgroundColor: '#FFFFFF',
        color: '#1F2937',
        borderColor: 'rgb(209, 213, 219)'
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            // Get student name for notification
            const selectedStudent = !formData.is_guest ? students.find(s => s.id === formData.student_id) : null;
            const finalNotes = formData.is_guest
                ? `Guest - ${formData.guest_name}${formData.notes ? ' - ' + formData.notes : ''}`
                : formData.notes;

            const { data: { user } } = await supabase.auth.getUser();

            const { error } = await supabase.from('payments').insert([
                {
                    student_id: formData.is_guest ? null : formData.student_id,
                    amount: parseFloat(formData.amount),
                    payment_method: formData.payment_method,
                    payment_date: formData.date,
                    notes: finalNotes,
                    created_by: user?.id
                }
            ]);

            if (error) throw error;



            onSuccess();
            onClose();
        } catch (error: any) {
            console.error('Error adding payment:', error);
            toast.error('Error adding payment: ' + error.message);
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

            <div className="w-full max-w-[450px] bg-black/60 backdrop-blur-3xl rounded-[3rem] border border-white/10 shadow-[0_50px_100px_rgba(0,0,0,0.9)] overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-12 duration-700 relative flex flex-col max-h-[90vh]">
                {/* Dynamic Glass Shimmer */}
                <div className="absolute inset-0 bg-gradient-to-br from-white/[0.03] via-transparent to-transparent pointer-events-none"></div>

                {/* Header Section */}
                <div className="relative z-10 px-8 pt-10 pb-6 border-b border-white/5 flex-shrink-0">
                    <div className="flex items-start justify-between">
                        <div className="flex-1">
                            <h2 className="text-xl font-black text-white tracking-widest uppercase mb-1 drop-shadow-lg leading-tight">
                                Record Payment
                            </h2>
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
                <form onSubmit={handleSubmit} className="relative z-10 px-8 py-6 overflow-y-auto custom-scrollbar flex-1 space-y-6">

                    {/* Student Selection / Guest Toggle */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <label className="text-[9px] font-black uppercase tracking-[0.3em] text-white/20 ml-1">Payer Details</label>
                            <button
                                type="button"
                                onClick={() => setFormData(prev => ({ ...prev, is_guest: !prev.is_guest, student_id: '', guest_name: '' }))}
                                className={`text-[8px] font-black uppercase tracking-widest px-3 py-1.5 rounded-xl border transition-all duration-500 ${formData.is_guest
                                    ? 'bg-amber-500/20 text-amber-400 border-amber-500/20'
                                    : 'bg-white/5 text-white/40 border-white/5 hover:border-white/10 hover:text-white'
                                    }`}
                            >
                                {formData.is_guest ? 'Guest Active' : 'Switch to Guest'}
                            </button>
                        </div>

                        {!formData.is_guest ? (
                            <div className="space-y-2 group/field">
                                <div className="relative">
                                    <select
                                        required
                                        className="w-full px-5 py-3 bg-white/[0.02] border border-white/5 rounded-2xl focus:border-primary/40 outline-none transition-all text-white appearance-none cursor-pointer pr-12 text-xs tracking-wide font-bold"
                                        value={formData.student_id}
                                        onChange={e => setFormData({ ...formData, student_id: e.target.value })}
                                    >
                                        <option value="" className="bg-[#0a0a0f]">Select Athlete</option>
                                        {students.map(s => (
                                            <option key={s.id} value={s.id} className="bg-[#0a0a0f]">{s.full_name}</option>
                                        ))}
                                    </select>
                                    <ChevronDown className="absolute right-5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/20 pointer-events-none group-focus-within/field:text-primary transition-colors" />
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-2 group/field">
                                <input
                                    required
                                    type="text"
                                    placeholder=""
                                    className="w-full px-5 py-3 bg-white/[0.02] border border-white/5 rounded-2xl focus:border-amber-500/40 outline-none transition-all text-white placeholder:text-white/10 text-xs tracking-wide font-bold"
                                    value={formData.guest_name}
                                    onChange={e => setFormData({ ...formData, guest_name: e.target.value })}
                                />
                            </div>
                        )}
                    </div>

                    {/* Amount & Date */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2 group/field">
                            <label className="text-[9px] font-black uppercase tracking-[0.3em] text-white/20 ml-1 group-focus-within/field:text-primary transition-colors">Amount ({currency.code})</label>
                            <input
                                required
                                type="number"
                                className="w-full px-5 py-3 bg-white/[0.02] border border-white/5 rounded-2xl focus:border-primary/40 outline-none transition-all text-white placeholder:text-white/10 text-xs tracking-wide font-bold"
                                value={formData.amount}
                                onChange={e => setFormData({ ...formData, amount: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2 group/field">
                            <label className="text-[9px] font-black uppercase tracking-[0.3em] text-white/20 ml-1 group-focus-within/field:text-primary transition-colors">Date</label>
                            <input
                                required
                                type="date"
                                className="w-full px-5 py-3 bg-white/[0.02] border border-white/5 rounded-2xl focus:border-primary/40 outline-none transition-all text-white [color-scheme:dark] text-xs font-bold tracking-widest text-center"
                                value={formData.date}
                                onChange={e => setFormData({ ...formData, date: e.target.value })}
                            />
                        </div>
                    </div>

                    {/* Payment Method */}
                    <div className="space-y-4">
                        <label className="text-[9px] font-black uppercase tracking-[0.3em] text-white/20 ml-1">Method</label>
                        <div className="grid grid-cols-3 gap-2">
                            {['cash', 'bank_transfer', 'card'].map(method => (
                                <button
                                    key={method}
                                    type="button"
                                    onClick={() => setFormData({ ...formData, payment_method: method })}
                                    className={`py-3 px-2 rounded-xl border text-[8px] font-black uppercase tracking-[0.2em] transition-all duration-300 ${formData.payment_method === method
                                        ? 'bg-primary/20 border-primary/40 text-primary shadow-lg shadow-primary/5 scale-105'
                                        : 'bg-white/[0.02] border-white/5 text-white/20 hover:bg-white/[0.05] hover:border-white/10'
                                        }`}
                                >
                                    {method.replace('_', ' ')}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Notes */}
                    <div className="space-y-2 group/field">
                        <label className="text-[9px] font-black uppercase tracking-[0.3em] text-white/20 ml-1 group-focus-within/field:text-primary transition-colors">Internal Notes</label>
                        <textarea
                            className="w-full px-5 py-4 bg-white/[0.02] border border-white/5 rounded-3xl focus:border-primary/40 outline-none transition-all h-24 resize-none text-white placeholder:text-white/10 text-xs font-bold tracking-wide"
                            value={formData.notes}
                            onChange={e => setFormData({ ...formData, notes: e.target.value })}
                            placeholder=""
                        ></textarea>
                    </div>
                </form>

                {/* Footer Section - Single Premium Button */}
                <div className="relative z-10 px-8 py-8 border-t border-white/5 flex-shrink-0 flex items-center justify-between gap-6">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-6 py-4 text-[9px] font-black uppercase tracking-[0.3em] text-white/20 hover:text-white transition-all duration-500 whitespace-nowrap"
                    >
                        {t('common.cancel', 'Discard')}
                    </button>
                    <button
                        onClick={(e) => handleSubmit(e)}
                        disabled={loading}
                        className="flex-1 py-4 rounded-3xl bg-white text-black hover:bg-white/90 transition-all duration-500 shadow-[0_20px_40px_rgba(255,255,255,0.1)] active:scale-95 flex items-center justify-center group/btn overflow-hidden disabled:opacity-50 disabled:pointer-events-none"
                    >
                        {loading ? (
                            <span className="font-black uppercase tracking-[0.3em] text-[10px] animate-pulse">Processing...</span>
                        ) : (
                            <span className="font-black uppercase tracking-[0.3em] text-[10px] group-hover:tracking-[0.5em] transition-all duration-500">
                                Save Payment
                            </span>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
