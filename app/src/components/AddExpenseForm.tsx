import { useState } from 'react';
import { X, Receipt, ChevronDown } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { useCurrency } from '../context/CurrencyContext';

interface AddExpenseFormProps {
    onClose: () => void;
    onSuccess: () => void;
    onAdd: (expense: { description: string; amount: number; category: string; expense_date: string }) => Promise<void>;
}

export default function AddExpenseForm({ onClose, onSuccess, onAdd }: AddExpenseFormProps) {
    const { currency } = useCurrency();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        description: '',
        amount: '',
        category: 'other',
        expense_date: format(new Date(), 'yyyy-MM-dd')
    });

    const categories = [
        { value: 'rent', label: 'Rent' },
        { value: 'equipment', label: 'Equipment' },
        { value: 'utilities', label: 'Utilities (Electric, Water, etc.)' },
        { value: 'salaries', label: 'Salaries & Bonuses' },
        { value: 'other', label: 'Other' }
    ];

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.description || !formData.amount) {
            toast.error('Please fill in all required fields');
            return;
        }

        setLoading(true);
        try {
            await onAdd({
                description: formData.description,
                amount: parseFloat(formData.amount),
                category: formData.category,
                expense_date: formData.expense_date
            });



            toast.success('Expense added successfully');
            onSuccess();
            onClose();
        } catch (error: any) {
            console.error('Error adding expense:', error);
            toast.error(error.message || 'Failed to add expense');
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
                                Add Expense
                            </h2>
                            <p className="text-[9px] font-black text-white/40 uppercase tracking-widest">
                                Financial Outflow Transaction
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
                <form onSubmit={handleSubmit} className="relative z-10 px-8 py-6 overflow-y-auto custom-scrollbar flex-1 space-y-6">

                    {/* Description */}
                    <div className="space-y-2 group/field">
                        <label className="text-[9px] font-black uppercase tracking-[0.3em] text-white/20 ml-1 group-focus-within/field:text-primary transition-colors">Description *</label>
                        <input
                            required
                            type="text"
                            className="w-full px-5 py-3 bg-white/[0.02] border border-white/5 rounded-2xl focus:border-primary/40 outline-none transition-all text-white placeholder:text-white/10 text-xs tracking-wide font-bold"
                            value={formData.description}
                            onChange={e => setFormData({ ...formData, description: e.target.value })}
                            placeholder=""
                        />
                    </div>

                    {/* Amount & Date */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2 group/field">
                            <label className="text-[9px] font-black uppercase tracking-[0.3em] text-white/20 ml-1 group-focus-within/field:text-primary transition-colors">Amount ({currency.code}) *</label>
                            <input
                                required
                                type="number"
                                step="0.01"
                                className="w-full px-5 py-3 bg-white/[0.02] border border-white/5 rounded-2xl focus:border-primary/40 outline-none transition-all text-white placeholder:text-white/10 text-xs tracking-wide font-bold"
                                value={formData.amount}
                                onChange={e => setFormData({ ...formData, amount: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2 group/field">
                            <label className="text-[9px] font-black uppercase tracking-[0.3em] text-white/20 ml-1 group-focus-within/field:text-primary transition-colors">Date *</label>
                            <input
                                required
                                type="date"
                                className="w-full px-5 py-3 bg-white/[0.02] border border-white/5 rounded-2xl focus:border-primary/40 outline-none transition-all text-white [color-scheme:dark] text-xs font-bold tracking-widest text-center"
                                value={formData.expense_date}
                                onChange={e => setFormData({ ...formData, expense_date: e.target.value })}
                            />
                        </div>
                    </div>

                    {/* Category */}
                    <div className="space-y-2 group/field">
                        <label className="text-[9px] font-black uppercase tracking-[0.3em] text-white/20 ml-1 group-focus-within/field:text-primary transition-colors">Category *</label>
                        <div className="relative">
                            <select
                                required
                                value={formData.category}
                                onChange={e => setFormData({ ...formData, category: e.target.value })}
                                className="w-full px-5 py-3 bg-white/[0.02] border border-white/5 rounded-2xl focus:border-primary/40 outline-none transition-all text-white appearance-none cursor-pointer pr-12 text-xs tracking-wide font-bold"
                            >
                                {categories.map(cat => (
                                    <option key={cat.value} value={cat.value} className="bg-[#0a0a0f]">
                                        {cat.label}
                                    </option>
                                ))}
                            </select>
                            <ChevronDown className="absolute right-5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/20 pointer-events-none group-focus-within/field:text-primary transition-colors" />
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
                        onClick={(e) => handleSubmit(e)}
                        disabled={loading}
                        className="flex-1 py-4 rounded-3xl bg-white text-black hover:bg-white/90 transition-all duration-500 shadow-[0_20px_40px_rgba(255,255,255,0.1)] active:scale-95 flex items-center justify-center group/btn overflow-hidden disabled:opacity-50 disabled:pointer-events-none"
                    >
                        {loading ? (
                            <span className="font-black uppercase tracking-[0.3em] text-[10px] animate-pulse">Processing...</span>
                        ) : (
                            <span className="font-black uppercase tracking-[0.3em] text-[10px] group-hover:tracking-[0.5em] transition-all duration-500">
                                Add Expense
                            </span>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
