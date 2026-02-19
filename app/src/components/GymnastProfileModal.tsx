import { useState, useEffect } from 'react';
import { X, User, Calendar, Star, ShieldCheck, Clock, Mail, MapPin, Phone, FileText, Send, Plus, Trash2, ChevronRight, Edit2, Award, Dumbbell, Check } from 'lucide-react';
import { format, differenceInYears, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, startOfWeek, endOfWeek } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import ConfirmModal from './ConfirmModal';
import AddAssessmentModal from './AddAssessmentModal';

interface GymnastProfileModalProps {
    student: any;
    onClose: () => void;
}

export default function GymnastProfileModal({ student, onClose }: GymnastProfileModalProps) {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState<'overview' | 'tests'>('overview');
    const [assessments, setAssessments] = useState<any[]>([]);
    const [ptSubscriptions, setPtSubscriptions] = useState<any[]>([]);
    const [attendanceCount, setAttendanceCount] = useState(0);
    const [attendanceDates, setAttendanceDates] = useState<string[]>([]);
    const [loadingAssessments, setLoadingAssessments] = useState(false);
    const [loadingData, setLoadingData] = useState(false);
    const [testToDelete, setTestToDelete] = useState<any | null>(null);
    const [showAddAssessment, setShowAddAssessment] = useState(false);

    useEffect(() => {
        if (student?.id) {
            if (activeTab === 'tests') fetchAssessments();
            if (activeTab === 'overview') {
                fetchAllData();
            }
        }
    }, [student?.id, activeTab]);

    const fetchAllData = async () => {
        setLoadingData(true);
        try {
            const [ptRes, attRes] = await Promise.all([
                supabase
                    .from('pt_subscriptions')
                    .select('*, coaches(full_name)')
                    .eq('student_id', student.id)
                    .order('created_at', { ascending: false }),
                supabase
                    .from('student_attendance')
                    .select('check_in_time')
                    .eq('student_id', student.id)
                    .order('check_in_time', { ascending: false })
            ]);

            if (!ptRes.error && ptRes.data) setPtSubscriptions(ptRes.data);
            if (!attRes.error && attRes.data) {
                setAttendanceCount(attRes.data.length);
                setAttendanceDates(attRes.data.map(a => a.check_in_time));
            }
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoadingData(false);
        }
    };

    const fetchAssessments = async () => {
        setLoadingAssessments(true);
        const { data, error } = await supabase
            .from('skill_assessments')
            .select('*')
            .eq('student_id', student.id)
            .order('date', { ascending: false });
        if (!error && data) setAssessments(data);
        setLoadingAssessments(false);
    };

    const confirmDeleteTest = async () => {
        if (!testToDelete) return;
        const originalAssessments = [...assessments];
        setAssessments(prev => prev.filter(a => a.id !== testToDelete));
        const { error } = await supabase.from('skill_assessments').delete().eq('id', testToDelete);
        if (!error) {
            toast.success('Assessment deleted');
            fetchAssessments();
        } else {
            setAssessments(originalAssessments);
            toast.error('Failed to delete assessment');
        }
        setTestToDelete(null);
    };

    const calculateAge = (dob: string) => {
        if (!dob) return 'N/A';
        try {
            const birthDate = parseISO(dob);
            const age = differenceInYears(new Date(), birthDate);
            if (age > 100 || age < 0) return '??';
            return age;
        } catch { return 'N/A'; }
    };

    if (!student) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-0 md:p-4 overflow-hidden">
            <div
                className="absolute inset-0 bg-black/80 backdrop-blur-xl animate-in fade-in duration-700"
                onClick={onClose}
            />

            <div className="w-full max-w-5xl h-full md:h-[85vh] bg-[#050505] md:bg-black/60 md:backdrop-blur-3xl rounded-none md:rounded-[3.5rem] border-0 md:border md:border-white/5 shadow-[0_50px_100px_rgba(0,0,0,0.9)] overflow-hidden animate-in md:zoom-in-95 md:slide-in-from-bottom-12 duration-700 relative flex flex-col md:flex-row">

                {/* --- SIDEBAR / MOBILE HEADER --- */}
                <div className="w-full md:w-[280px] bg-white/[0.02] md:bg-primary/5 border-b md:border-b-0 md:border-r border-white/5 relative z-10 flex flex-col p-6 md:p-8 flex-shrink-0">
                    <button
                        onClick={onClose}
                        className="absolute top-6 right-6 p-2 rounded-xl bg-white/5 text-white/40 md:hover:bg-rose-500 md:hover:text-white transition-all z-20"
                    >
                        <X className="w-4 h-4" />
                    </button>

                    {/* Identity (Row on Mobile, Col on Desktop) */}
                    <div className="flex flex-row md:flex-col items-center gap-5 md:gap-0 md:mb-8">
                        <div className="relative">
                            <div className="w-16 h-16 md:w-28 md:h-28 rounded-2xl md:rounded-[2rem] bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center text-primary font-black text-2xl md:text-4xl shadow-xl">
                                {student.full_name?.[0]}
                            </div>
                            <div className="absolute -bottom-1 -right-1 p-1.5 md:p-2 bg-white rounded-lg md:rounded-xl shadow-xl">
                                <Star className="w-2.5 h-2.5 md:w-3 md:h-3 text-primary" />
                            </div>
                        </div>

                        <div className="text-left md:text-center mt-0 md:mt-6 flex-1">
                            <h2 className="text-lg md:text-xl font-black text-white tracking-widest uppercase leading-tight truncate">
                                {student.full_name}
                            </h2>
                            <div className="flex items-center md:justify-center gap-2 mt-1">
                                <div className={`w-1 h-1 md:w-1.5 md:h-1.5 rounded-full ${student.is_active ? 'bg-emerald-500 shadow-[0_0_8px_#10B981]' : 'bg-rose-500 shadow-[0_0_8px_#F43F5E]'}`}></div>
                                <span className="text-[7px] md:text-[8px] font-black uppercase tracking-widest text-white/40">
                                    {student.is_active ? t('common.active') : t('common.inactive')}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Quick Stats Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-1 gap-3 mt-6 md:mt-0">
                        <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-1.5 md:space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-[7px] md:text-[8px] font-black uppercase tracking-widest text-white/20">Age</span>
                                <span className="text-xs font-black text-white">{calculateAge(student.birth_date)} <span className="text-[8px] text-white/20 uppercase">Yrs</span></span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-[7px] md:text-[8px] font-black uppercase tracking-widest text-white/20">Program</span>
                                <span className="text-[9px] font-black text-primary uppercase tracking-widest truncate ml-2">{student.training_type || 'Artistic'}</span>
                            </div>
                        </div>

                        <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-1.5 md:space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-[7px] md:text-[8px] font-black uppercase tracking-widest text-white/20">Coach</span>
                                <span className="text-[9px] font-black text-white uppercase truncate ml-2">{student.coaches?.full_name?.split(' ')[0] || '---'}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-[7px] md:text-[8px] font-black uppercase tracking-widest text-white/20">Expiry</span>
                                <span className="text-[9px] font-black text-white uppercase tracking-tighter">{student.subscription_expiry ? format(new Date(student.subscription_expiry), 'dd/MM/yy') : '---'}</span>
                            </div>
                        </div>
                    </div>

                    <div className="mt-auto pt-8 hidden md:block">
                        <button
                            onClick={onClose}
                            className="w-full py-3.5 rounded-2xl bg-white text-black hover:bg-white/90 transition-all font-black uppercase tracking-[0.2em] text-[9px] shadow-xl"
                        >
                            {t('common.dismiss')}
                        </button>
                    </div>
                </div>

                {/* --- MAIN CONTENT --- */}
                <div className="flex-1 flex flex-col relative z-20 overflow-hidden">
                    {/* Tabs Nav */}
                    <div className="px-6 md:px-8 pt-4 md:pt-8 flex items-center justify-between border-b border-white/5 flex-shrink-0">
                        <div className="flex gap-6 md:gap-8 overflow-x-auto no-scrollbar">
                            {[
                                { id: 'overview', label: 'Profile', icon: User },
                                { id: 'tests', label: 'Performance', icon: Award }
                            ].map((tab) => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id as any)}
                                    className={`pb-4 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest transition-all relative ${activeTab === tab.id ? 'text-white' : 'text-white/20'}`}
                                >
                                    <tab.icon className={`w-3.5 h-3.5 ${activeTab === tab.id ? 'text-primary' : ''}`} />
                                    {tab.label}
                                    {activeTab === tab.id && (
                                        <div className="absolute bottom-0 left-0 w-full h-0.5 bg-primary rounded-full shadow-[0_0_10px_rgba(var(--primary-rgb),0.5)]"></div>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Content Scroll Area */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-8 pb-12 md:pb-8">
                        {activeTab === 'overview' && (
                            <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-700">
                                {/* Training Stats */}
                                <div className="space-y-4">
                                    <h3 className="text-[10px] font-black uppercase tracking-widest text-white/20 ml-1">Training Activity</h3>
                                    <div className="space-y-4">
                                        {/* Attendance Calendar Card - Ultra Compact & Integrated */}
                                        <div className="p-4 md:p-6 rounded-[1.5rem] bg-white/[0.02] border border-white/5 flex flex-col items-center relative overflow-hidden group/cal max-w-[400px] mx-auto w-full">
                                            {/* Decorative Background Glow */}
                                            <div className="absolute -top-12 -right-12 w-32 h-32 bg-primary/5 rounded-full blur-[40px] pointer-events-none group-hover/cal:bg-primary/10 transition-colors duration-700"></div>

                                            <div className="w-full flex justify-between items-center gap-3 mb-6 relative z-10">
                                                <div>
                                                    <p className="text-[8px] font-black text-white/20 uppercase tracking-widest mb-0.5 whitespace-nowrap">Attendance</p>
                                                    <h4 className="text-lg font-black text-white uppercase tracking-tighter">{format(new Date(), 'MMMM')}</h4>
                                                </div>

                                                <div className="flex items-center gap-2">
                                                    {/* Integrated Stat: Check-ins */}
                                                    <div className="px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/5 flex flex-col items-center min-w-[55px]">
                                                        <span className="text-base font-black text-white tracking-tighter leading-none mb-0.5">{attendanceCount}</span>
                                                        <span className="text-[6px] font-black text-white/20 uppercase tracking-widest">Done</span>
                                                    </div>

                                                    {/* Integrated Stat: Remaining */}
                                                    <div className="px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/5 flex flex-col items-center min-w-[55px]">
                                                        <span className="text-base font-black text-primary tracking-tighter leading-none mb-0.5">
                                                            {(() => {
                                                                // Prioritize manually managed sessions_remaining field for consistency with badges
                                                                if (student?.sessions_remaining != null) {
                                                                    return student.sessions_remaining;
                                                                }
                                                                // Fallback to calculation if field is missing
                                                                const limit = student?.sessions_limit ?? student?.subscription_plans?.sessions_limit;
                                                                if (limit != null) {
                                                                    return Math.max(0, Number(limit) - (attendanceCount || 0));
                                                                }
                                                                return '∞';
                                                            })()}
                                                        </span>
                                                        <span className="text-[6px] font-black text-white/20 uppercase tracking-widest">Left</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-7 gap-1.5 md:gap-2 w-full text-center relative z-10">
                                                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                                                    <div key={i} className="text-[7px] font-black text-white/10 uppercase mb-1">{d}</div>
                                                ))}
                                                {(() => {
                                                    const today = new Date();
                                                    const monthStart = startOfMonth(today);
                                                    const monthEnd = endOfMonth(today);
                                                    const days = eachDayOfInterval({
                                                        start: startOfWeek(monthStart),
                                                        end: endOfWeek(monthEnd)
                                                    });

                                                    return days.map((day, idx) => {
                                                        const isCurrentMonth = day.getMonth() === today.getMonth();
                                                        const isAttended = attendanceDates.some(d => isSameDay(new Date(d), day));
                                                        const isToday = isSameDay(day, today);

                                                        return (
                                                            <div
                                                                key={idx}
                                                                className={`
                                                                    aspect-square flex items-center justify-center rounded-md md:rounded-lg text-[10px] font-black transition-all duration-500
                                                                    ${isAttended ? 'bg-[#10b981] text-black shadow-[0_0_12px_#10b981] scale-110 z-10' : ''}
                                                                    ${!isAttended && isCurrentMonth ? 'bg-white/[0.04] text-white/20' : ''}
                                                                    ${!isCurrentMonth ? 'opacity-0 pointer-events-none' : ''}
                                                                    ${isToday && !isAttended ? 'ring-1 ring-white/10' : ''}
                                                                `}
                                                            >
                                                                {day.getDate()}
                                                            </div>
                                                        );
                                                    });
                                                })()}
                                            </div>

                                            <div className="mt-6 pt-4 border-t border-white/5 w-full flex justify-center gap-6 relative z-10">
                                                <div className="flex items-center gap-1.5">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-[#10b981] shadow-[0_0_10px_#10b981]" />
                                                    <span className="text-[7px] font-black text-white/40 uppercase tracking-widest">Present</span>
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-white/[0.08]" />
                                                    <span className="text-[7px] font-black text-white/40 uppercase tracking-widest">None</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* PT Progress Timeline */}
                                {ptSubscriptions.length > 0 && (
                                    <div className="space-y-4">
                                        <h3 className="text-[10px] font-black uppercase tracking-widest text-white/20 ml-1">PT Progress</h3>
                                        <div className="space-y-3">
                                            {ptSubscriptions.map((sub) => {
                                                const total = sub.total_sessions || sub.sessions_remaining || 0;
                                                const attended = Math.max(0, total - (sub.sessions_remaining || 0));
                                                const percentage = total > 0 ? (attended / total) * 100 : 0;
                                                return (
                                                    <div key={sub.id} className="p-5 rounded-[1.5rem] bg-white/[0.02] border border-white/5">
                                                        <div className="flex flex-col sm:flex-row gap-4">
                                                            <div className="flex-1">
                                                                <p className="text-[7px] font-black text-primary uppercase mb-0.5">Coach</p>
                                                                <h4 className="text-base font-black text-white uppercase">{sub.coaches?.full_name || 'Coach'}</h4>
                                                            </div>
                                                            <div className="flex-1 space-y-2">
                                                                <div className="flex justify-between items-end">
                                                                    <span className="text-[8px] font-black text-white/30 uppercase">{attended}/{total}</span>
                                                                    <span className="text-[8px] font-black text-emerald-500 uppercase">{percentage.toFixed(0)}%</span>
                                                                </div>
                                                                <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                                                                    <div className="h-full bg-primary transition-all duration-1000" style={{ width: `${percentage}%` }} />
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* Information Grid */}
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                    <div className="space-y-4">
                                        <h3 className="text-[10px] font-black uppercase tracking-widest text-white/20 ml-1">Guardians</h3>
                                        <div className="p-6 rounded-[2rem] bg-white/[0.01] border border-white/5 space-y-6">
                                            <div className="flex items-center justify-between gap-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-xl bg-primary/5 border border-primary/10 flex items-center justify-center text-primary"><User size={16} /></div>
                                                    <div><p className="text-[7px] font-black text-primary/40 uppercase mb-0.5">{t('common.father')}</p><p className="text-xs font-black text-white uppercase truncate max-w-[120px]">{student.father_name || '---'}</p></div>
                                                </div>
                                                <a href={`tel:${student.contact_number}`} className="px-3 py-1.5 bg-primary/10 rounded-lg text-[8px] font-black uppercase text-primary border border-primary/20">Call</a>
                                            </div>
                                            <div className="flex items-center justify-between gap-4 border-t border-white/[0.03] pt-6">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-xl bg-emerald-500/5 border border-emerald-500/10 flex items-center justify-center text-emerald-500"><Send size={16} /></div>
                                                    <div><p className="text-[7px] font-black text-emerald-500/40 uppercase mb-0.5">WhatsApp</p><p className="text-xs font-black text-white uppercase truncate max-w-[120px]">{student.mother_name || '---'}</p></div>
                                                </div>
                                                <a href={`https://wa.me/${student.parent_contact?.replace(/\s/g, '')}`} target="_blank" className="px-3 py-1.5 bg-emerald-500/10 rounded-lg text-[8px] font-black uppercase text-emerald-500 border border-emerald-500/20">Chat</a>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <h3 className="text-[10px] font-black uppercase tracking-widest text-white/20 ml-1">System Info</h3>
                                        <div className="p-6 rounded-[2rem] bg-white/[0.01] border border-white/5 space-y-5">
                                            <div><span className="text-[8px] font-black text-white/10 uppercase mb-1 block">Email</span><p className="text-xs font-bold text-white/60 truncate">{student.email || 'No email'}</p></div>
                                            <div className="border-t border-white/[0.03] pt-5"><span className="text-[8px] font-black text-white/10 uppercase mb-1 block">Address</span><p className="text-xs font-bold text-white/60 line-clamp-2 uppercase leading-snug">{student.address || 'No address listed'}</p></div>
                                            <div className="flex justify-between items-center border-t border-white/[0.03] pt-5">
                                                <div>
                                                    <p className="text-[8px] font-black text-white/10 uppercase">UID</p>
                                                    <p className="text-[10px] font-mono font-black text-white/40 truncate max-w-[120px]">
                                                        {String(student.id).slice(0, 15)}
                                                    </p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-[8px] font-black text-white/10 uppercase">Joined</p>
                                                    <p className="text-[11px] font-black text-white/60 uppercase">
                                                        {student.created_at ? format(new Date(student.created_at), 'dd MMM yyyy • HH:mm') : '---'}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'tests' && (
                            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-700 pb-12">
                                <div className="flex justify-between items-center px-1">
                                    <h3 className="text-[10px] font-black uppercase tracking-widest text-white/20">Assessment History</h3>
                                    <button onClick={() => setShowAddAssessment(true)} className="bg-primary hover:bg-primary/90 text-white text-[9px] font-black uppercase tracking-widest px-4 py-2 rounded-xl flex items-center gap-2 transition-all shadow-lg active:scale-95"><Plus size={14} /> New Test</button>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {loadingAssessments ? (
                                        <div className="col-span-2 py-20 flex flex-col items-center justify-center opacity-20"><div className="w-8 h-8 border-2 border-white/10 border-t-white/40 rounded-full animate-spin mb-4"></div><p className="text-[9px] font-black uppercase">Loading...</p></div>
                                    ) : assessments.length === 0 ? (
                                        <div className="col-span-2 py-16 border-2 border-dashed border-white/5 rounded-[2rem] flex flex-col items-center justify-center opacity-30 text-center px-10"><FileText size={32} className="mb-4" /><p className="text-[10px] font-black uppercase">No records found</p></div>
                                    ) : (
                                        assessments.map((test) => (
                                            <div key={test.id} className="bg-white/[0.02] border border-white/5 rounded-[1.5rem] overflow-hidden">
                                                <div className="p-5 border-b border-white/[0.03] flex justify-between items-start">
                                                    <div className="space-y-1"><h4 className="text-xs font-black text-white uppercase">{test.title}</h4><p className="text-[8px] text-white/20 uppercase font-black">{format(parseISO(test.date), 'MMM dd, yyyy')}</p></div>
                                                    <div className="text-right"><div className="text-2xl font-black text-primary leading-none">{test.total_score}</div><span className="text-[7px] text-white/10 uppercase font-black">Score</span></div>
                                                </div>
                                                <div className="p-5 space-y-3 bg-black/10">
                                                    {test.skills?.map((skill: any, idx: number) => (
                                                        <div key={idx} className="space-y-1">
                                                            <div className="flex justify-between items-center text-[9px]"><span className="text-white/40 font-black uppercase truncate mr-4">{skill.name}</span><span className="font-black text-white/60">{skill.score} <span className="text-white/10">/ {skill.max_score}</span></span></div>
                                                            <div className="w-full h-1 bg-white/[0.03] rounded-full overflow-hidden"><div className="h-full bg-primary/40 transition-all duration-1000" style={{ width: `${(skill.score / skill.max_score) * 100}%` }} /></div>
                                                        </div>
                                                    ))}
                                                </div>
                                                <div className="px-5 py-3 flex justify-end bg-white/[0.01] border-t border-white/[0.03]">
                                                    <button onClick={() => setTestToDelete(test.id)} className="text-white/10 hover:text-rose-500 transition-colors"><Trash2 size={14} /></button>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <ConfirmModal
                isOpen={!!testToDelete}
                onClose={() => setTestToDelete(null)}
                onConfirm={confirmDeleteTest}
                title="DELETE ASSESSMENT?"
                message="Are you sure you want to delete this assessment record?"
                confirmText="DELETE"
                type="danger"
            />

            <AddAssessmentModal
                studentId={student.id}
                isOpen={showAddAssessment}
                onClose={() => setShowAddAssessment(false)}
                onSuccess={fetchAssessments}
            />
        </div>
    );
}
