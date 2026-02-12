import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase';
import { X, Save, UserPlus, Upload, ChevronDown } from 'lucide-react';
import { parseISO, addMonths, format } from 'date-fns';
import toast from 'react-hot-toast';

const COUNTRIES = [
    { code: 'KW', dial_code: '+965', flag: '🇰🇼', name: 'Kuwait' },
    { code: 'SA', dial_code: '+966', flag: '🇸🇦', name: 'Saudi Arabia' },
    { code: 'AE', dial_code: '+971', flag: '🇦🇪', name: 'UAE' },
    { code: 'QA', dial_code: '+974', flag: '🇶🇦', name: 'Qatar' },
    { code: 'BH', dial_code: '+973', flag: '🇧🇭', name: 'Bahrain' },
    { code: 'OM', dial_code: '+968', flag: '🇴🇲', name: 'Oman' },
    { code: 'EG', dial_code: '+20', flag: '🇪🇬', name: 'Egypt' },
    { code: 'US', dial_code: '+1', flag: '🇺🇸', name: 'USA' },
    { code: 'UK', dial_code: '+44', flag: '🇬🇧', name: 'UK' },
];

import { useQueryClient } from '@tanstack/react-query';
import { useSubscriptionPlans, useCoaches } from '../hooks/useData';
import { useCurrency } from '../context/CurrencyContext';

interface AddStudentFormProps {
    onClose: () => void;
    onSuccess: () => void;
    initialData?: any;
}

export default function AddStudentForm({ onClose, onSuccess, initialData }: AddStudentFormProps) {
    const { t, i18n } = useTranslation();
    const { currency } = useCurrency();
    const queryClient = useQueryClient();
    const [loading, setLoading] = useState(false);
    const { data: plansData, isLoading: isLoadingPlans } = useSubscriptionPlans();
    const plans = plansData || [];

    const [formData, setFormData] = useState({
        full_name: initialData?.full_name || '',
        father_name: initialData?.father_name || '',
        mother_name: initialData?.mother_name || '',
        email: initialData?.email || '',
        address: initialData?.address || '',
        birth_date: initialData?.birth_date || '',
        gender: initialData?.gender || 'male',
        training_type: initialData?.training_type || '',
        contact_number: initialData?.contact_number || '',
        country_code_student: '+965',
        parent_contact: initialData?.parent_contact || '',
        country_code_parent: '+965',
        subscription_type: initialData?.subscription_plan_id || '', // Correctly map plan ID
        subscription_start: initialData?.subscription_start || format(new Date(), 'yyyy-MM-dd'),
        subscription_expiry: initialData?.subscription_expiry || '', // Manual expiry date
        training_days: initialData?.training_days || [],
        training_schedule: initialData?.training_schedule || [],
        coach_id: initialData?.coach_id || '',
        notes: initialData?.notes || ''
    });

    // Update subscription_type when plans are loaded
    useEffect(() => {
        if (plans.length > 0 && (!formData.subscription_type || formData.subscription_type === '') && !initialData) {
            setFormData(prev => ({ ...prev, subscription_type: plans[0].id }));
        }
    }, [plans, initialData]);


    // Auto-calculate expiry date when plan or start date changes
    useEffect(() => {
        if (formData.subscription_start && formData.subscription_type && plans.length > 0) {
            const calculatedExpiry = calculateExpiry(formData.subscription_start, formData.subscription_type);
            // Always update to calculated expiry when plan or start date changes
            // User can manually edit after if needed
            setFormData(prev => ({ ...prev, subscription_expiry: calculatedExpiry }));
        }
    }, [formData.subscription_start, formData.subscription_type, plans]);

    const { data: coaches } = useCoaches();

    const daysOfWeek = ['sat', 'sun', 'mon', 'tue', 'wed', 'thu', 'fri'];

    const toggleDay = (day: string) => {
        setFormData(prev => {
            const isAlreadyActive = prev.training_days.includes(day);
            if (isAlreadyActive) {
                return {
                    ...prev,
                    training_days: prev.training_days.filter((d: string) => d !== day),
                    training_schedule: prev.training_schedule.filter((s: any) => s.day !== day)
                };
            } else {
                return {
                    ...prev,
                    training_days: [...prev.training_days, day],
                    training_schedule: [...prev.training_schedule, { day, start: '16:00', end: '18:00' }]
                };
            }
        });
    };

    const updateTime = (day: string, type: 'start' | 'end', value: string) => {
        setFormData(prev => ({
            ...prev,
            training_schedule: prev.training_schedule.map((s: any) =>
                s.day === day ? { ...s, [type]: value } : s
            )
        }));
    };

    const calculateAge = (birthDate: string) => {
        if (!birthDate) return 0;
        const today = new Date();
        const birth = new Date(birthDate);
        let age = today.getFullYear() - birth.getFullYear();
        const m = today.getMonth() - birth.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
            age--;
        }
        return age;
    };


    const calculateExpiry = (start: string, planId: string) => {
        if (!start || !plans || plans.length === 0) return format(addMonths(new Date(), 1), 'yyyy-MM-dd');

        const date = parseISO(start);
        const plan = plans.find(p => p.id === planId) || plans[0];

        if (!plan) return format(addMonths(date, 1), 'yyyy-MM-dd');

        const monthsToAdd = plan.duration_months || 1;
        return format(addMonths(date, monthsToAdd), 'yyyy-MM-dd');
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
        setLoading(true);

        try {
            if (plans.length === 0) {
                toast.error("No subscription plans found. Please create a plan first.");
                setLoading(false);
                return;
            }

            // Use manual expiry date from form (already calculated by useEffect or manually edited)
            // Ensure we don't send empty string - fallback to calculated expiry
            const expiry = (formData.subscription_expiry && formData.subscription_expiry.trim() !== '')
                ? formData.subscription_expiry
                : calculateExpiry(formData.subscription_start, formData.subscription_type);

            // 1. Determine Group (Auto-Grouping Logic Disabled)
            const trainingGroupId = null;

            const studentData = {
                full_name: formData.full_name,
                father_name: formData.father_name,
                mother_name: formData.mother_name,
                email: formData.email,
                address: formData.address,
                birth_date: formData.birth_date && formData.birth_date.trim() !== '' ? formData.birth_date : null,
                gender: formData.gender,
                training_type: formData.training_type,
                age: calculateAge(formData.birth_date),
                contact_number: `${formData.country_code_student} ${formData.contact_number}`,
                parent_contact: `${formData.country_code_parent} ${formData.parent_contact}`,
                subscription_expiry: expiry && expiry.trim() !== '' ? expiry : null,
                training_days: formData.training_days,
                training_schedule: formData.training_schedule,
                coach_id: formData.coach_id && formData.coach_id.trim() !== '' ? formData.coach_id : null,
                subscription_plan_id: formData.subscription_type && formData.subscription_type.trim() !== '' ? formData.subscription_type : null,
                notes: formData.notes,
                training_group_id: trainingGroupId || null // Assign to Training Group
            };

            let error;
            let studentId = initialData?.id;

            if (initialData) {
                // Update existing student
                ({ error } = await supabase
                    .from('students')
                    .update(studentData)
                    .eq('id', initialData.id));
            } else {
                // Insert new student and get the ID
                const { data, error: insertError } = await supabase
                    .from('students')
                    .insert([studentData])
                    .select('id')
                    .single();
                error = insertError;
                studentId = data?.id;

                // Record initial payment for new student
                if (studentId && formData.subscription_type) {
                    const selectedPlan = plans.find(p => p.id === formData.subscription_type);
                    if (selectedPlan && selectedPlan.price > 0) {
                        try {
                            const { error: paymentError } = await supabase.from('payments').insert({
                                student_id: studentId,
                                amount: Number(selectedPlan.price),
                                payment_date: formData.subscription_start || format(new Date(), 'yyyy-MM-dd'),
                                payment_method: 'cash', // Default to cash
                                notes: `New Registration - ${selectedPlan.name}`
                            });

                            if (paymentError) {
                                console.error('Initial payment record failed:', paymentError);
                                toast.error('Gymnast added but payment record failed. Please add it manually in Finance.');
                            } else {
                                console.log('Initial payment recorded successfully');
                            }
                        } catch (payErr) {
                            console.error('Payment insertion error:', payErr);
                            toast.error('Payment record failed due to a system error.');
                        }
                    }
                }
            }

            if (error) throw error;

            // Handle training schedule and auto-create training sessions
            if (studentId && formData.training_schedule.length > 0) {
                // First, clear existing schedule for updates, or just insert for new students
                if (initialData) {
                    await supabase.from('student_training_schedule').delete().eq('student_id', studentId);
                }

                const trainingInserts = formData.training_schedule.map((s: any) => ({
                    student_id: studentId,
                    day_of_week: s.day,
                    start_time: s.start,
                    end_time: s.end
                }));

                const { error: trainingError } = await supabase
                    .from('student_training_schedule')
                    .insert(trainingInserts);

                if (trainingError) throw trainingError;

                // --- AUTO-CREATE CLASS LOGIC ---
                if (formData.coach_id) {
                    const dayMapping: { [key: string]: string } = {
                        'sat': 'Saturday',
                        'sun': 'Sunday',
                        'mon': 'Monday',
                        'tue': 'Tuesday',
                        'wed': 'Wednesday',
                        'thu': 'Thursday',
                        'fri': 'Friday'
                    };

                    for (const schedule of formData.training_schedule) {
                        const { day, start, end } = schedule as { day: string, start: string, end: string };
                        const fullDayName = dayMapping[day];

                        // Check if session exists using Full Day Name
                        const { data: sessions } = await supabase
                            .from('training_sessions')
                            .select('id')
                            .eq('coach_id', formData.coach_id)
                            .eq('day_of_week', fullDayName)
                            .eq('start_time', start)
                            .eq('end_time', end)
                            .limit(1);

                        // If NOT exists, create it
                        if (!sessions || sessions.length === 0) {
                            await supabase
                                .from('training_sessions')
                                .insert([{
                                    coach_id: formData.coach_id,
                                    day_of_week: fullDayName,
                                    start_time: start,
                                    end_time: end,
                                    title: 'Group Training', // Default Title
                                    capacity: 20             // Default Capacity
                                }]);
                        }
                    }

                }
            }

            queryClient.invalidateQueries({ queryKey: ['students'] });
            queryClient.invalidateQueries({ queryKey: ['payments'] });
            queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
            if (formData.coach_id) queryClient.invalidateQueries({ queryKey: ['training_groups'] }); // Invalidate groups too

            toast.success(initialData ? 'Gymnast updated successfully' : 'Gymnast added successfully', {
                icon: '🎉',
                style: {
                    borderRadius: '20px',
                    background: '#10B981',
                    color: '#fff',
                },
            });
            onSuccess();
            onClose();
        } catch (error) {
            console.error('Error saving gymnast:', error);
            const msg = (error as any).message || 'Unknown error';
            toast.error(`Error saving gymnast: ${msg}`);
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

            <div className="w-full max-w-[500px] bg-black/60 backdrop-blur-3xl rounded-[3rem] border border-white/10 shadow-[0_50px_100px_rgba(0,0,0,0.9)] overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-12 duration-700 relative flex flex-col max-h-[90vh]">
                {/* Dynamic Glass Shimmer */}
                <div className="absolute inset-0 bg-gradient-to-br from-white/[0.03] via-transparent to-transparent pointer-events-none"></div>

                {/* Header Section */}
                <div className="relative z-10 px-8 pt-10 pb-6 border-b border-white/5 flex-shrink-0">
                    <div className="flex items-start justify-between">
                        <div className="flex-1">
                            <h2 className="text-xl font-black text-white tracking-widest uppercase mb-1 drop-shadow-lg leading-tight">
                                {initialData ? 'Edit Gymnast' : t('dashboard.addStudent', 'New Athlete')}
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

                    {/* Name Field */}
                    <div className="space-y-2 group/field">
                        <label className="text-[9px] font-black uppercase tracking-[0.3em] text-white/20 ml-1 group-focus-within/field:text-primary transition-colors">{t('common.fullName', 'Full Name')}</label>
                        <input
                            required
                            type="text"
                            className="w-full px-5 py-3 bg-white/[0.02] border border-white/5 rounded-2xl focus:border-primary/40 outline-none transition-all text-white placeholder:text-white/10 text-xs tracking-wide font-bold"
                            value={formData.full_name}
                            onChange={e => setFormData({ ...formData, full_name: e.target.value })}
                        />
                    </div>

                    {/* Birth Date & Age */}
                    <div className="space-y-2 group/field">
                        <div className="flex items-center justify-between ml-1">
                            <label className="text-[9px] font-black uppercase tracking-[0.3em] text-white/20 group-focus-within/field:text-primary transition-colors">{t('students.birthDate', 'Birth Date')}</label>
                            {formData.birth_date && (
                                <span className="text-[9px] font-black uppercase tracking-widest text-primary/60">
                                    {calculateAge(formData.birth_date)} {i18n.language === 'ar' ? 'سنة' : 'Years Old'}
                                </span>
                            )}
                        </div>
                        <input
                            required
                            type="date"
                            className="w-full px-5 py-3 bg-white/[0.02] border border-white/5 rounded-2xl focus:border-primary/40 outline-none transition-all text-white [color-scheme:dark] text-xs font-bold uppercase tracking-widest"
                            value={formData.birth_date}
                            onChange={e => setFormData({ ...formData, birth_date: e.target.value })}
                        />
                    </div>

                    {/* Gender Toggle */}
                    <div className="space-y-2">
                        <label className="text-[9px] font-black uppercase tracking-[0.3em] text-white/20 ml-1">Gender</label>
                        <div className="flex bg-white/[0.02] rounded-2xl p-1.5 border border-white/5 relative">
                            {['male', 'female'].map(g => (
                                <button key={g} type="button" onClick={() => setFormData({ ...formData, gender: g })}
                                    className={`flex-1 py-3 rounded-xl text-[9px] font-black uppercase tracking-[0.2em] transition-all duration-500 relative z-10 ${formData.gender === g ? 'text-white' : 'text-white/20 hover:text-white/40'}`}>
                                    {g}
                                </button>
                            ))}
                            <div className={`absolute top-1.5 bottom-1.5 w-[calc(50%-6px)] rounded-xl transition-all duration-500 ease-out shadow-lg ${formData.gender === 'male' ? 'left-1.5 bg-blue-600/20 border border-blue-500/30' : 'left-[calc(50%+3px)] bg-pink-600/20 border border-pink-500/30'}`}></div>
                        </div>
                    </div>

                    {/* Training Type */}
                    <div className="space-y-2 group/field">
                        <label className="text-[9px] font-black uppercase tracking-[0.3em] text-white/20 ml-1 group-focus-within/field:text-primary transition-colors">Program</label>
                        <div className="relative">
                            <select
                                value={formData.training_type}
                                onChange={e => setFormData({ ...formData, training_type: e.target.value })}
                                className="w-full px-5 py-3 bg-white/[0.02] border border-white/5 rounded-2xl focus:border-primary/40 outline-none transition-all text-white appearance-none text-xs tracking-wide font-bold cursor-pointer"
                                required
                            >
                                <option value="" disabled className="bg-[#0a0a0f]">Select Sport</option>
                                <option value="Artistic Gymnastics" className="bg-[#0a0a0f]">Artistic Gymnastics</option>
                                <option value="Rhythmic Gymnastics" className="bg-[#0a0a0f]">Rhythmic Gymnastics</option>
                                <option value="Parkour" className="bg-[#0a0a0f]">Parkour</option>
                                <option value="Fitness" className="bg-[#0a0a0f]">Fitness</option>
                            </select>
                            <ChevronDown className="absolute right-5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/20 pointer-events-none group-focus-within/field:text-primary transition-colors" />
                        </div>
                    </div>

                    {/* Primary Guardian & Phone */}
                    <div className="grid grid-cols-1 gap-4">
                        <div className="space-y-2 group/field">
                            <label className="text-[9px] font-black uppercase tracking-[0.3em] text-white/20 ml-1 group-focus-within/field:text-primary transition-colors">Primary Guardian</label>
                            <input
                                type="text"
                                className="w-full px-5 py-3 bg-white/[0.02] border border-white/5 rounded-2xl focus:border-primary/40 outline-none transition-all text-white placeholder:text-white/10 text-xs"
                                value={formData.father_name}
                                onChange={e => setFormData({ ...formData, father_name: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2 group/field">
                            <label className="text-[9px] font-black uppercase tracking-[0.3em] text-white/20 ml-1 group-focus-within/field:text-primary transition-colors">{t('common.phoneNumber', "Phone Number")}</label>
                            <div className="flex gap-3 relative">
                                <div className="relative group/dropdown">
                                    <button type="button" className="h-full pl-4 pr-3 bg-white/[0.02] border border-white/5 rounded-2xl flex items-center gap-2 hover:border-primary/40 transition-all min-w-[90px]">
                                        <span className="text-lg filter drop-shadow-lg">{COUNTRIES.find(c => c.dial_code === formData.country_code_student)?.flag}</span>
                                        <ChevronDown className="w-3 h-3 text-white/20 group-hover/dropdown:text-primary transition-colors" />
                                    </button>
                                    <div className="absolute top-[110%] left-0 w-64 bg-[#0a0a0f] border border-white/10 rounded-2xl overflow-hidden hidden group-hover/dropdown:block shadow-2xl max-h-48 overflow-y-auto custom-scrollbar z-50">
                                        {COUNTRIES.map(c => (
                                            <button key={c.code} type="button" onClick={() => setFormData({ ...formData, country_code_student: c.dial_code })} className="flex items-center gap-3 w-full px-5 py-3 hover:bg-white/5 transition-all text-left border-b border-white/5 last:border-0 group/item">
                                                <span className="text-xl">{c.flag}</span>
                                                <span className="text-[10px] font-bold text-white/40 group-hover/item:text-white flex-1 uppercase tracking-wider">{c.name}</span>
                                                <span className="text-[9px] font-black text-primary">{c.dial_code}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <input
                                    required
                                    type="tel"
                                    className="w-full px-5 py-3 bg-white/[0.02] border border-white/5 rounded-2xl focus:border-primary/40 outline-none transition-all text-white placeholder:text-white/10 text-xs font-bold"
                                    value={formData.contact_number}
                                    onChange={e => setFormData({ ...formData, contact_number: e.target.value })}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Secondary Guardian & WhatsApp */}
                    <div className="grid grid-cols-1 gap-4">
                        <div className="space-y-2 group/field">
                            <label className="text-[9px] font-black uppercase tracking-[0.3em] text-white/20 ml-1 group-focus-within/field:text-primary transition-colors">Secondary Guardian</label>
                            <input
                                type="text"
                                className="w-full px-5 py-3 bg-white/[0.02] border border-white/5 rounded-2xl focus:border-primary/40 outline-none transition-all text-white placeholder:text-white/10 text-xs"
                                value={formData.mother_name}
                                onChange={e => setFormData({ ...formData, mother_name: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2 group/field">
                            <label className="text-[9px] font-black uppercase tracking-[0.3em] text-emerald-400 ml-1 group-focus-within/field:text-emerald-300 transition-colors">WhatsApp for Reports</label>
                            <div className="flex gap-3 relative">
                                <div className="relative group/dropdown">
                                    <button type="button" className="h-full pl-4 pr-3 bg-white/[0.02] border border-white/5 rounded-2xl flex items-center gap-2 hover:border-emerald-500/40 transition-all min-w-[90px]">
                                        <span className="text-lg filter drop-shadow-lg">{COUNTRIES.find(c => c.dial_code === formData.country_code_parent)?.flag}</span>
                                        <ChevronDown className="w-3 h-3 text-white/20 group-hover/dropdown:text-emerald-400 transition-colors" />
                                    </button>
                                    <div className="absolute top-[110%] left-0 w-64 bg-[#0a0a0f] border border-white/10 rounded-2xl overflow-hidden hidden group-hover/dropdown:block shadow-2xl max-h-48 overflow-y-auto custom-scrollbar z-50">
                                        {COUNTRIES.map(c => (
                                            <button key={c.code} type="button" onClick={() => setFormData({ ...formData, country_code_parent: c.dial_code })} className="flex items-center gap-3 w-full px-5 py-3 hover:bg-emerald-500/10 transition-all text-left border-b border-white/5 last:border-0 group/item">
                                                <span className="text-xl">{c.flag}</span>
                                                <span className="text-[10px] font-bold text-white/40 group-hover/item:text-white flex-1 uppercase tracking-wider">{c.name}</span>
                                                <span className="text-[9px] font-black text-emerald-500">{c.dial_code}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <input
                                    type="tel"
                                    className="w-full px-5 py-3 bg-white/[0.02] border border-white/5 rounded-2xl focus:border-emerald-500/40 outline-none transition-all text-white placeholder:text-white/10 text-xs font-bold"
                                    value={formData.parent_contact}
                                    onChange={e => setFormData({ ...formData, parent_contact: e.target.value })}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Email & Address */}
                    <div className="grid grid-cols-1 gap-4">
                        <div className="space-y-2 group/field text-sm">
                            <label className="text-[9px] font-black uppercase tracking-[0.3em] text-white/20 ml-1 group-focus-within/field:text-primary transition-colors">Email Address</label>
                            <input
                                type="email"
                                className="w-full px-5 py-3 bg-white/[0.02] border border-white/5 rounded-2xl focus:border-primary/40 outline-none transition-all text-white placeholder:text-white/10 text-xs"
                                value={formData.email}
                                onChange={e => setFormData({ ...formData, email: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2 group/field text-sm">
                            <label className="text-[9px] font-black uppercase tracking-[0.3em] text-white/20 ml-1 group-focus-within/field:text-primary transition-colors">Physical Address</label>
                            <input
                                type="text"
                                className="w-full px-5 py-3 bg-white/[0.02] border border-white/5 rounded-2xl focus:border-primary/40 outline-none transition-all text-white placeholder:text-white/10 text-xs"
                                value={formData.address}
                                onChange={e => setFormData({ ...formData, address: e.target.value })}
                            />
                        </div>
                    </div>

                    {/* Attendance Cycle */}
                    <div className="space-y-6 pt-6 border-t border-white/[0.05]">
                        <label className="text-[9px] font-black uppercase tracking-[0.3em] text-white/20 ml-1">
                            {t('students.trainingDays', 'Attendance Cycle')}
                        </label>
                        <div className="flex flex-col gap-6">
                            <div className="flex flex-wrap gap-2">
                                {daysOfWeek.map(day => {
                                    const isActive = formData.training_days.includes(day);
                                    return (
                                        <button
                                            key={day}
                                            type="button"
                                            onClick={() => toggleDay(day)}
                                            className={`px-3 py-2 rounded-xl border text-[8px] font-black uppercase tracking-[0.2em] transition-all duration-300 ${isActive
                                                ? 'bg-primary/20 border-primary/40 text-primary shadow-lg shadow-primary/5'
                                                : 'bg-white/[0.02] border-white/5 text-white/20 hover:bg-white/[0.05] hover:border-white/10'
                                                }`}
                                        >
                                            {t(`students.days.${day}`)}
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Time Inputs for Active Days */}
                            <div className="grid grid-cols-1 gap-3 mt-2">
                                {formData.training_schedule.map((schedule: any) => (
                                    <div
                                        key={schedule.day}
                                        className="p-4 bg-white/[0.02] border border-white/5 rounded-3xl flex items-center justify-between gap-4 animate-in zoom-in-95 duration-500"
                                    >
                                        <span className="text-[9px] font-black uppercase text-primary tracking-[0.3em] min-w-[60px]">
                                            {t(`students.days.${schedule.day}`)}
                                        </span>
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="time"
                                                value={schedule.start}
                                                onChange={(e) => updateTime(schedule.day, 'start', e.target.value)}
                                                className="bg-white/[0.03] border border-white/5 rounded-xl px-3 py-1.5 text-[9px] text-white focus:border-primary/40 transition-all outline-none [color-scheme:dark]"
                                            />
                                            <span className="text-white/10 text-[8px] font-black">-</span>
                                            <input
                                                type="time"
                                                value={schedule.end}
                                                onChange={(e) => updateTime(schedule.day, 'end', e.target.value)}
                                                className="bg-white/[0.03] border border-white/5 rounded-xl px-3 py-1.5 text-[9px] text-white focus:border-primary/40 transition-all outline-none [color-scheme:dark]"
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Subscription & Coach */}
                    <div className="space-y-6 pt-6 border-t border-white/[0.05]">
                        <div className="flex items-center gap-2 ml-1 mb-4">
                            <div className="w-1.5 h-1.5 rounded-full bg-primary/40 animate-pulse"></div>
                            <h3 className="text-[9px] font-black uppercase tracking-[0.3em] text-white/20">
                                Subscription Details
                            </h3>
                        </div>

                        <div className="space-y-3 group/field">
                            <div className="flex items-center justify-between ml-1">
                                <label className="text-[9px] font-black uppercase tracking-[0.3em] text-white/20 group-focus-within/field:text-primary transition-colors">Plan Type</label>
                                {plans.find(p => p.id === formData.subscription_type)?.price > 0 && (
                                    <span className="text-[9px] font-black text-primary uppercase tracking-widest bg-primary/10 px-2 py-0.5 rounded-lg border border-primary/20">
                                        {plans.find(p => p.id === formData.subscription_type)?.price} {currency.code}
                                    </span>
                                )}
                            </div>
                            <div className="relative">
                                <select
                                    className="w-full px-5 py-3 bg-white/[0.02] border border-white/5 rounded-2xl focus:border-primary/40 outline-none transition-all text-white appearance-none cursor-pointer pr-12 focus:bg-white/[0.04] text-xs font-bold tracking-wide"
                                    value={formData.subscription_type}
                                    onChange={e => setFormData({ ...formData, subscription_type: e.target.value })}
                                >
                                    {plans.map(plan => (
                                        <option key={plan.id} value={plan.id} className="bg-[#0a0a0f]">{plan.name}</option>
                                    ))}
                                </select>
                                <ChevronDown className="absolute inset-y-0 right-5 my-auto w-3.5 h-3.5 text-white/10 pointer-events-none group-focus-within/field:text-primary transition-colors" />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2 group/field">
                                <label className="text-[9px] font-black uppercase tracking-[0.3em] text-white/20 ml-1 group-focus-within/field:text-primary transition-colors">Start Date</label>
                                <input
                                    type="date"
                                    className="w-full px-5 py-3 bg-white/[0.02] border border-white/5 rounded-2xl focus:border-primary/40 outline-none transition-all text-white [color-scheme:dark] text-xs font-bold tracking-widest"
                                    value={formData.subscription_start}
                                    onChange={e => setFormData({ ...formData, subscription_start: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2 group/field">
                                <label className="text-[9px] font-black uppercase tracking-[0.3em] text-white/20 ml-1 group-focus-within/field:text-primary transition-colors">Expiry Date</label>
                                <input
                                    type="date"
                                    className="w-full px-5 py-3 bg-white/[0.02] border border-white/5 rounded-2xl focus:border-primary/40 outline-none transition-all text-white [color-scheme:dark] text-xs font-bold tracking-widest"
                                    value={formData.subscription_expiry}
                                    onChange={e => setFormData({ ...formData, subscription_expiry: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="space-y-2 group/field">
                            <label className="text-[9px] font-black uppercase tracking-[0.3em] text-white/20 ml-1 group-focus-within/field:text-primary transition-colors">Assigned Coach</label>
                            <div className="relative">
                                <select
                                    className="w-full px-5 py-3 bg-white/[0.02] border border-white/5 rounded-2xl focus:border-primary/40 outline-none transition-all text-white appearance-none cursor-pointer pr-12 focus:bg-white/[0.04] text-xs font-bold tracking-wide"
                                    value={formData.coach_id}
                                    onChange={e => setFormData({ ...formData, coach_id: e.target.value })}
                                >
                                    <option value="" className="bg-[#0a0a0f]">{t('students.selectCoach')}</option>
                                    {coaches?.filter(c => c.role !== 'reception' && c.role !== 'cleaner').map(coach => (
                                        <option key={coach.id} value={coach.id} className="bg-[#0a0a0f]">
                                            {coach.full_name} ({t(`roles.${coach.role}`)})
                                        </option>
                                    ))}
                                </select>
                                <ChevronDown className="absolute inset-y-0 right-5 my-auto w-3.5 h-3.5 text-white/10 pointer-events-none group-focus-within/field:text-primary transition-colors" />
                            </div>
                        </div>
                    </div>

                    {/* Notes */}
                    <div className="space-y-2 group/field">
                        <label className="text-[9px] font-black uppercase tracking-[0.3em] text-white/20 ml-1 group-focus-within/field:text-primary transition-colors">Additional Notes</label>
                        <textarea
                            placeholder=""
                            className="w-full px-5 py-4 bg-white/[0.02] border border-white/5 rounded-[2rem] focus:border-primary/40 outline-none transition-all text-white placeholder:text-white/10 text-xs min-h-[100px] resize-none"
                            value={formData.notes}
                            onChange={e => setFormData({ ...formData, notes: e.target.value })}
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
                        {t('common.cancel', 'Cancel')}
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
                                {initialData ? 'Update Profile' : 'Confirm Registration'}
                            </span>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
