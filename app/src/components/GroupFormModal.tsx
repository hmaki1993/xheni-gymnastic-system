import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase';
import { X, Save, Clock, Calendar, User, Timer, Search, Check, Users, ChevronDown } from 'lucide-react';
import { useCoaches, useStudents } from '../hooks/useData';
import toast from 'react-hot-toast';

interface GroupFormModalProps {
    initialData?: any;
    onClose: () => void;
    onSuccess: () => void;
}

const DAYS = ['saturday', 'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday'];

export default function GroupFormModal({ initialData, onClose, onSuccess }: GroupFormModalProps) {
    const { t } = useTranslation();
    const { data: coaches } = useCoaches();
    const { data: students } = useStudents();
    const [loading, setLoading] = useState(false);
    const [studentSearch, setStudentSearch] = useState('');
    const [selectedStudents, setSelectedStudents] = useState<string[]>([]);

    const [formData, setFormData] = useState({
        name: '',
        coach_id: '',
        days: [] as string[],
        startTime: '16:00', // Default 4 PM
        duration: 60 // Minutes
    });

    useEffect(() => {
        // Lock body scroll when modal is open
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, []);

    useEffect(() => {
        if (initialData) {
            let days = [] as string[];
            let startTime = '16:00';
            let duration = 60;

            if (initialData.schedule_key) {
                const parts = initialData.schedule_key.split('|');
                if (parts.length > 0) {
                    const firstPart = parts[0].split(':');
                    // Format is day:startH:startM:endH:endM
                    if (firstPart.length >= 5) {
                        const start = `${firstPart[1]}:${firstPart[2]}`; // HH:mm
                        const end = `${firstPart[3]}:${firstPart[4]}`;   // HH:mm

                        if (start && end) {
                            try {
                                const [startH, startM] = start.split(':').map(Number);
                                const [endH, endM] = end.split(':').map(Number);
                                const startTotal = startH * 60 + startM;
                                const endTotal = endH * 60 + endM;
                                duration = endTotal - startTotal;
                            } catch (e) {
                                console.error('Error parsing time for duration:', e);
                            }
                        }
                        startTime = start;
                    } else if (firstPart.length === 3) {
                        // Fallback for potentially old format or simple day:time (unlikely but safe)
                        const start = firstPart[1];
                        // Try to see if it parses
                        if (start.includes(':')) {
                            startTime = start;
                        }
                    }

                    days = parts.map((p: string) => p.split(':')[0]);
                }
            }

            setFormData({
                name: initialData.name,
                coach_id: initialData.coach_id,
                days: days,
                startTime: startTime,
                duration: duration > 0 ? duration : 60
            });

            if (initialData.students) {
                setSelectedStudents(initialData.students.map((s: any) => s.id));
            } else if (students) {
                const groupStudents = students.filter((s: any) => s.training_group_id === initialData.id);
                setSelectedStudents(groupStudents.map((s: any) => s.id));
            }
        }
    }, [initialData, students]);

    const toggleDay = (day: string) => {
        setFormData(prev => ({
            ...prev,
            days: prev.days.includes(day)
                ? prev.days.filter(d => d !== day)
                : [...prev.days, day]
        }));
    };

    const toggleStudent = (studentId: string) => {
        setSelectedStudents(prev =>
            prev.includes(studentId)
                ? prev.filter(id => id !== studentId)
                : [...prev, studentId]
        );
    };

    const filteredStudents = students?.filter((s: any) =>
        s.full_name.toLowerCase().includes(studentSearch.toLowerCase())
    ) || [];

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const [startH, startM] = formData.startTime.split(':').map(Number);
            const totalStartMinutes = startH * 60 + startM;
            const totalEndMinutes = totalStartMinutes + parseInt(String(formData.duration));

            const endH = Math.floor(totalEndMinutes / 60);
            const endM = totalEndMinutes % 60;
            const endTime = `${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')}`;

            const scheduleKey = formData.days
                .map(d => `${d}:${formData.startTime}:${endTime}`)
                .sort()
                .join('|');

            const payload = {
                name: formData.name,
                coach_id: formData.coach_id,
                schedule_key: scheduleKey,
                updated_at: new Date().toISOString()
            };

            let groupId = initialData?.id;

            if (initialData?.id) {
                const { error } = await supabase
                    .from('training_groups')
                    .update(payload)
                    .eq('id', initialData.id);
                if (error) throw error;
                toast.success('Group updated successfully');
            } else {
                const { data: newGroup, error } = await supabase
                    .from('training_groups')
                    .insert([payload])
                    .select()
                    .single();

                if (error) throw error;
                groupId = newGroup.id;
                toast.success('Group created successfully');
            }



            if (groupId) {
                const { error: updateError } = await supabase
                    .from('students')
                    .update({
                        training_group_id: groupId,
                        coach_id: formData.coach_id
                    })
                    .in('id', selectedStudents);

                if (updateError) {
                    console.error('Error updating students:', updateError);
                    toast.error('Group saved but failed to update some students');
                }

                if (initialData?.id) {
                    const previouslySelected = students?.filter((s: any) => s.training_group_id === initialData.id).map((s: any) => s.id) || [];
                    const toRemove = previouslySelected.filter(id => !selectedStudents.includes(id));

                    if (toRemove.length > 0) {
                        await supabase
                            .from('students')
                            .update({ training_group_id: null })
                            .in('id', toRemove);
                    }
                }
            }

            onSuccess();
            onClose();
        } catch (error) {
            console.error('Error saving group:', error);
            toast.error('Failed to save group');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-hidden">
            {/* Ultra-Neutral Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-md animate-in fade-in duration-1000"
                onClick={onClose}
            />

            <div className="w-full max-w-[800px] bg-black/60 backdrop-blur-3xl rounded-[2rem] sm:rounded-[3rem] border border-white/10 shadow-[0_50px_100px_rgba(0,0,0,0.9)] overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-12 duration-700 relative flex flex-col max-h-[90vh]">
                {/* Dynamic Glass Shimmer */}
                <div className="absolute inset-0 bg-gradient-to-br from-white/[0.03] via-transparent to-transparent pointer-events-none"></div>

                {/* Header Section */}
                <div className="relative z-10 px-5 sm:px-8 pt-8 sm:pt-10 pb-4 sm:pb-6 border-b border-white/5 flex-shrink-0">
                    <div className="flex items-start justify-between">
                        <div className="flex-1">
                            <h2 className="text-xl font-black text-white tracking-widest uppercase mb-1 drop-shadow-lg leading-tight">
                                {initialData ? t('common.editGroup') : t('common.createGroup')}
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
                <form onSubmit={handleSubmit} className="relative z-10 px-5 sm:px-8 py-5 sm:py-6 overflow-y-auto custom-scrollbar flex-1 flex flex-col md:flex-row gap-6 sm:gap-8">

                    {/* Left Column: Group Details */}
                    <div className="flex-1 space-y-6">
                        {/* Name */}
                        <div className="space-y-2 group/field">
                            <label className="text-[9px] font-black uppercase tracking-[0.3em] text-white/20 ml-1 group-focus-within/field:text-primary transition-colors">{t('common.groupName')}</label>
                            <input
                                required
                                type="text"
                                className="w-full px-5 py-3 bg-white/[0.02] border border-white/5 rounded-2xl focus:border-primary/40 outline-none transition-all text-white placeholder:text-white/10 text-xs tracking-wide font-bold"
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                            />
                        </div>

                        {/* Coach */}
                        <div className="space-y-2 group/field">
                            <label className="text-[9px] font-black uppercase tracking-[0.3em] text-white/20 ml-1 group-focus-within/field:text-primary transition-colors">{t('common.coach')}</label>
                            <div className="relative">
                                <select
                                    required
                                    value={formData.coach_id}
                                    onChange={e => setFormData({ ...formData, coach_id: e.target.value })}
                                    className="w-full px-5 py-3 bg-white/[0.02] border border-white/5 rounded-2xl focus:border-primary/40 outline-none transition-all text-white appearance-none cursor-pointer pr-12 text-xs tracking-wide font-bold"
                                >
                                    <option value="" className="bg-[#0a0a0f]"></option>
                                    {coaches?.filter((c: any) => c.role !== 'reception' && c.role !== 'cleaner').map((coach: any) => (
                                        <option key={coach.id} value={coach.id} className="bg-[#0a0a0f]">
                                            {coach.full_name}
                                        </option>
                                    ))}
                                </select>
                                <ChevronDown className="absolute right-5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/20 pointer-events-none group-focus-within/field:text-primary transition-colors" />
                            </div>
                        </div>

                        {/* Schedule */}
                        <div className="space-y-4 pt-4 border-t border-white/5">
                            <label className="text-[9px] font-black uppercase tracking-[0.3em] text-white/20 ml-1">{t('common.trainingDays')}</label>
                            <div className="flex flex-wrap gap-1.5 sm:gap-2">
                                {DAYS.map(day => (
                                    <button
                                        key={day}
                                        type="button"
                                        onClick={() => toggleDay(day)}
                                        className={`px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg sm:rounded-xl border text-[7.5px] sm:text-[8px] font-black uppercase tracking-[0.2em] transition-all duration-300 ${formData.days.includes(day)
                                            ? 'bg-primary/20 border-primary/40 text-primary shadow-lg shadow-primary/5'
                                            : 'bg-white/[0.02] border-white/5 text-white/20 hover:bg-white/[0.05] hover:border-white/10'
                                            }`}
                                    >
                                        {t(`students.days.${day.substring(0, 3)}`)}
                                    </button>
                                ))}
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2 group/field">
                                    <label className="text-[9px] font-black uppercase tracking-[0.3em] text-white/20 ml-1 group-focus-within/field:text-primary transition-colors">{t('students.startTime')}</label>
                                    <input
                                        type="time"
                                        required
                                        value={formData.startTime}
                                        onChange={e => setFormData({ ...formData, startTime: e.target.value })}
                                        className="w-full px-5 py-3 bg-white/[0.02] border border-white/5 rounded-2xl focus:border-primary/40 outline-none transition-all text-white [color-scheme:dark] text-xs font-bold tracking-widest"
                                    />
                                </div>
                                <div className="space-y-2 group/field">
                                    <label className="text-[9px] font-black uppercase tracking-[0.3em] text-white/20 ml-1 group-focus-within/field:text-primary transition-colors">{t('coaches.duration')}</label>
                                    <div className="relative">
                                        <select
                                            value={formData.duration}
                                            onChange={e => setFormData({ ...formData, duration: parseInt(e.target.value) })}
                                            className="w-full px-5 py-3 bg-white/[0.02] border border-white/5 rounded-2xl focus:border-primary/40 outline-none transition-all text-white appearance-none cursor-pointer pr-12 text-xs tracking-wide font-bold"
                                        >
                                            <option value="60" className="bg-[#0a0a0f]">{t('common.hour1')}</option>
                                            <option value="90" className="bg-[#0a0a0f]">{t('common.hour1_5')}</option>
                                            <option value="120" className="bg-[#0a0a0f]">{t('common.hour2')}</option>
                                            <option value="150" className="bg-[#0a0a0f]">{t('common.hour2_5')}</option>
                                            <option value="180" className="bg-[#0a0a0f]">{t('common.hour3')}</option>
                                            <option value="240" className="bg-[#0a0a0f]">{t('common.hour4')}</option>
                                        </select>
                                        <ChevronDown className="absolute right-5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/20 pointer-events-none group-focus-within/field:text-primary transition-colors" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Student Selection */}
                    <div className="flex-1 flex flex-col min-h-[300px] h-fit md:h-[500px] bg-white/[0.01] border border-white/5 rounded-2xl sm:rounded-3xl overflow-hidden">
                        <div className="p-4 border-b border-white/5">
                            <label className="text-[9px] font-black uppercase tracking-[0.3em] text-white/20 ml-1 mb-3 block">
                                {t('dashboard.addStudent')} <span className="text-primary ml-1">({selectedStudents.length})</span>
                            </label>
                            <div className="relative group/search">
                                <input
                                    type="text"
                                    value={studentSearch}
                                    onChange={e => setStudentSearch(e.target.value)}
                                    placeholder=""
                                    className="w-full bg-white/[0.02] border border-white/5 rounded-xl pl-10 pr-4 py-3 text-white focus:outline-none focus:border-primary/40 text-xs font-bold placeholder:text-white/20 transition-all"
                                />
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20 group-focus-within/search:text-primary transition-colors" />
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
                            {filteredStudents.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-white/20 p-4 text-center">
                                    <User className="w-8 h-8 mb-2 opacity-30" />
                                    <p className="text-[9px] font-black uppercase tracking-widest opacity-50">{t('common.noResults')}</p>
                                </div>
                            ) : (
                                filteredStudents.map((student: any) => {
                                    const isSelected = selectedStudents.includes(student.id);
                                    return (
                                        <div
                                            key={student.id}
                                            onClick={() => toggleStudent(student.id)}
                                            className={`p-3 rounded-xl cursor-pointer flex items-center justify-between transition-all group duration-300 ${isSelected
                                                ? 'bg-primary/10 border border-primary/20'
                                                : 'hover:bg-white/5 border border-transparent'
                                                }`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-black transition-colors ${isSelected ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-white/5 text-white/30 group-hover:bg-white/10 group-hover:text-white'}`}>
                                                    {student.full_name.charAt(0).toUpperCase()}
                                                </div>
                                                <div>
                                                    <p className={`text-xs font-bold transition-colors ${isSelected ? 'text-white' : 'text-white/50 group-hover:text-white'}`}>
                                                        {student.full_name}
                                                    </p>
                                                    {student.training_groups?.name && (
                                                        <p className="text-[8px] text-white/20 uppercase tracking-wider group-hover:text-white/40 transition-colors">
                                                            {student.training_groups.name}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                            {isSelected && (
                                                <div className="w-5 h-5 bg-primary rounded-full flex items-center justify-center shadow-lg shadow-primary/30 animate-in zoom-in spin-in-90 duration-300">
                                                    <Check className="w-3 h-3 text-white" />
                                                </div>
                                            )}
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </form>

                {/* Footer Section */}
                <div className="relative z-10 px-5 sm:px-8 py-5 sm:py-6 border-t border-white/5 flex-shrink-0 flex items-center justify-between gap-4 sm:gap-6">
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
                            <span className="font-black uppercase tracking-[0.3em] text-[10px] animate-pulse">Saving...</span>
                        ) : (
                            <span className="font-black uppercase tracking-[0.3em] text-[10px] group-hover:tracking-[0.5em] transition-all duration-500">
                                {initialData ? 'Update Group' : 'Create Group'}
                            </span>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
