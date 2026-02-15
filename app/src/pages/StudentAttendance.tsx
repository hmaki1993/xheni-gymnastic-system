import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday, subMonths, addMonths } from 'date-fns';
import { Users, Search, ChevronLeft, Calendar, CheckCircle, XCircle, ChevronRight, X, MessageSquare } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useTheme } from '../context/ThemeContext';
import toast from 'react-hot-toast';

export default function StudentAttendance() {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const [todaysClasses, setTodaysClasses] = useState<any[]>([]);
    const [loadingClasses, setLoadingClasses] = useState(true);
    const [searchGymnast, setSearchGymnast] = useState('');
    const [showHistoryModal, setShowHistoryModal] = useState(false);
    const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
    const [selectedStudentName, setSelectedStudentName] = useState<string | null>(null);

    // --- Fetch Logic ---
    const fetchTodaysClasses = async () => {
        try {
            setLoadingClasses(true);
            const todayIdx = new Date().getDay(); // 0 = Sunday
            const dayMap = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
            const todayDay = dayMap[todayIdx];
            const dateStr = format(new Date(), 'yyyy-MM-dd');

            // 1. Fetch Students
            const { data: students, error: studentsError } = await supabase
                .from('students')
                .select('*, coaches(full_name), subscription_plans(name, sessions_limit)')
                .contains('training_days', [todayDay]);

            if (studentsError) throw studentsError;

            // 2. Fetch Attendance
            const { data: attendance, error: attendanceError } = await supabase
                .from('student_attendance')
                .select('*')
                .eq('date', dateStr);

            if (attendanceError) throw attendanceError;

            // 3. Merge
            const merged = (students || [])
                .filter(student => {
                    const type = student.training_type?.toLowerCase() || '';
                    return !type.includes('pt') && !type.includes('personal training');
                })
                .map(student => {
                    const record = attendance?.find(a => a.student_id === student.id);
                    const todaySchedule = student.training_schedule?.find((s: any) => s.day === todayDay);
                    const plan = (student as any).subscription_plans;

                    let status = 'pending';
                    if (record) {
                        if (record.status === 'absent') status = 'absent';
                        else if (record.check_out_time) status = 'completed';
                        else status = 'present';
                    }

                    return {
                        ...student,
                        scheduledStart: todaySchedule?.start || '',
                        status,
                        checkInTime: record?.check_in_time,
                        checkOutTime: record?.check_out_time,
                        sessionsLimit: plan?.sessions_limit || 0
                    };
                }).sort((a, b) => {
                    if (a.scheduledStart !== b.scheduledStart) return a.scheduledStart.localeCompare(b.scheduledStart);
                    return a.full_name.localeCompare(b.full_name);
                });

            setTodaysClasses(merged);
        } catch (error) {
            console.error('Error fetching classes:', error);
            toast.error('Failed to load attendance');
        } finally {
            setLoadingClasses(false);
        }
    };

    useEffect(() => {
        fetchTodaysClasses();
        // Subscribe to changes
        const sub = supabase
            .channel('student_attendance_page')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'student_attendance' }, () => {
                fetchTodaysClasses();
            })
            .subscribe();
        return () => { supabase.removeChannel(sub); };
    }, []);

    const filteredGymnasts = useMemo(() => {
        if (!searchGymnast.trim()) return todaysClasses;
        const query = searchGymnast.toLowerCase().trim();
        return todaysClasses.filter(s => {
            const coachName = Array.isArray(s.coaches)
                ? s.coaches[0]?.full_name
                : s.coaches?.full_name;

            return s.full_name?.toLowerCase().includes(query) ||
                coachName?.toLowerCase().includes(query);
        });
    }, [todaysClasses, searchGymnast]);

    // Handle Status Update (Same logic as Dashboard but simplified without history modal for now)
    const handleStatusUpdate = async (studentId: string, newStatus: string) => {
        try {
            const today = format(new Date(), 'yyyy-MM-dd');

            // Check existing
            const { data: existing } = await supabase
                .from('student_attendance')
                .select('*')
                .eq('student_id', studentId)
                .eq('date', today)
                .maybeSingle();

            const payload: any = {
                student_id: studentId,
                date: today,
                status: newStatus
            };

            if (newStatus === 'present') {
                if (!existing || !existing.check_in_time) {
                    payload.check_in_time = new Date().toISOString();
                }
                payload.check_out_time = null;
            } else if (newStatus === 'completed') {
                if (!existing?.check_in_time) payload.check_in_time = new Date().toISOString(); // Auto check-in if missed
                payload.check_out_time = new Date().toISOString();
            }

            // --- Session Counting Logic ---
            if (newStatus === 'present' && (!existing || existing.status !== 'present')) {
                // Fetch the student's current sessions_remaining
                const { data: student } = await supabase
                    .from('students')
                    .select('*')
                    .eq('id', studentId)
                    .single();

                if (student && student.sessions_remaining !== null && student.sessions_remaining > 0) {
                    await supabase
                        .from('students')
                        .update({ sessions_remaining: student.sessions_remaining - 1 })
                        .eq('id', studentId);
                }
            }

            const { error } = await supabase
                .from('student_attendance')
                .upsert(existing ? { ...existing, ...payload } : payload);

            if (error) throw error;
            toast.success(t('common.saved'));
        } catch (err) {
            console.error(err);
            toast.error('Error updating status');
        }
    };


    return (
        <div className="p-4 sm:p-8 max-w-[1600px] mx-auto space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                <div className="space-y-2">
                    <button
                        onClick={() => navigate('/')}
                        className="flex items-center gap-2 text-white/50 hover:text-white transition-colors group"
                    >
                        <ChevronLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                        <span className="font-bold uppercase tracking-wider text-xs">Back to Dashboard</span>
                    </button>
                    <h1 className="text-3xl sm:text-4xl font-black text-white uppercase tracking-tighter">
                        Student Attendance
                    </h1>
                    <p className="text-white/40 font-medium">Manage daily gymnast check-ins</p>
                </div>

                <div className="flex items-center gap-4">
                    <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Search className="h-4 w-4 text-white/30 group-focus-within:text-primary transition-colors" />
                        </div>
                        <input
                            type="text"
                            value={searchGymnast}
                            onChange={(e) => setSearchGymnast(e.target.value)}
                            className="bg-white/5 border border-white/10 text-white text-sm rounded-xl focus:ring-2 focus:ring-primary/50 focus:border-primary block w-64 pl-10 p-3 transition-all"
                        />
                    </div>
                </div>
            </div>

            {/* Attendance List */}
            <div className="glass-card rounded-2xl border border-white/10 p-6">
                {loadingClasses ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filteredGymnasts.map((student, index) => (

                            <div key={student.id}
                                onClick={() => {
                                    setSelectedStudentId(student.id);
                                    setSelectedStudentName(student.full_name);
                                    setShowHistoryModal(true);
                                }}
                                className={`group relative flex flex-col justify-between p-4 aspect-square rounded-[2rem] border transition-all duration-300 cursor-pointer hover:shadow-2xl hover:-translate-y-1 backdrop-blur-md overflow-hidden
                                    ${student.status === 'present' ? 'bg-[#0E1D21]/80 border-emerald-500/30 shadow-[0_0_20px_rgba(16,185,129,0.1)]' :
                                        student.status === 'completed' ? 'bg-white/5 border-white/5 opacity-50' :
                                            student.status === 'absent' ? 'bg-[#0E1D21]/80 border-rose-500/30' :
                                                'bg-[#0E1D21]/60 border-white/5 hover:bg-white/5 hover:border-white/10'}`}
                            >
                                {/* Top: Time & Status */}
                                <div className="flex flex-col items-center w-full pt-2">
                                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center shadow-inner backdrop-blur-sm border transition-colors duration-300 mb-3
                                        ${student.status === 'present' ? 'bg-emerald-500/10 border-emerald-500/20' :
                                            student.status === 'absent' ? 'bg-rose-500/10 border-rose-500/20' :
                                                'bg-black/20 border-white/5'}`}>
                                        <span className={`text-lg font-black tracking-tighter ${student.status === 'present' ? 'text-emerald-400' : student.status === 'absent' ? 'text-rose-400' : 'text-white/90'}`}>
                                            {student.scheduledStart ? format(new Date(`2000-01-01T${student.scheduledStart}`), 'HH:mm') : '--:--'}
                                        </span>
                                    </div>

                                    <h3 className="text-lg font-black text-white leading-tight text-center tracking-tight drop-shadow-lg mb-1 line-clamp-2 px-1">
                                        {student.full_name}
                                    </h3>

                                    <div className="flex items-center gap-1.5 opacity-80">
                                        <Users className={`w-3 h-3 ${student.status === 'absent' ? 'text-white/40' : 'text-emerald-400/80'}`} />
                                        <span className={`text-[10px] font-bold uppercase tracking-widest truncate max-w-[120px] ${student.status === 'absent' ? 'text-white/40' : 'text-emerald-400/80'}`}>
                                            {(() => {
                                                const coachName = Array.isArray(student.coaches)
                                                    ? student.coaches[0]?.full_name
                                                    : student.coaches?.full_name;
                                                return coachName || 'NO COACH';
                                            })()}
                                        </span>
                                    </div>
                                </div>

                                {/* Bottom: Info & Actions */}
                                <div className="w-full flex items-center justify-between gap-2 mt-auto pt-3 border-t border-white/5">
                                    {/* Action Info / Sessions */}
                                    <div className="flex flex-col items-center gap-1">
                                        {/* Time Badge */}
                                        <div className="h-9 px-3 rounded-xl bg-black/20 border border-white/5 flex items-center gap-1.5 backdrop-blur-sm">
                                            <span className="text-[9px] font-black text-white/30 uppercase tracking-widest">At</span>
                                            <span className="text-xs font-black text-white/80 leading-none pt-0.5">
                                                {student.scheduledStart ? format(new Date(`2000-01-01T${student.scheduledStart}`), 'HH:mm') : '--:--'}
                                            </span>
                                        </div>

                                        {/* Sessions Counter Badge */}
                                        <div className={`px-2 py-0.5 rounded-md border text-[8px] font-black uppercase tracking-tighter
                                            ${student.sessions_remaining <= 2 ? 'bg-rose-500/10 border-rose-500/20 text-rose-500' : 'bg-primary/10 border-primary/20 text-primary'}`}>
                                            {student.sessions_remaining ?? 0} / {student.sessionsLimit ?? 0} Sessions
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                                        {student.status === 'present' ? (
                                            <button
                                                onClick={() => handleStatusUpdate(student.id, 'completed')}
                                                className="w-10 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/20 text-emerald-400 flex items-center justify-center hover:bg-emerald-500/30 transition-all"
                                                title="Check Out"
                                            >
                                                <CheckCircle className="w-4 h-4" />
                                            </button>
                                        ) : student.status === 'absent' ? (
                                            <div className="w-10 h-9 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 flex items-center justify-center" title="Absent">
                                                <XCircle className="w-4 h-4" />
                                            </div>
                                        ) : student.status === 'completed' ? (
                                            <div className="w-10 h-9 rounded-xl bg-white/5 border border-white/5 text-white/30 flex items-center justify-center" title="Completed">
                                                <CheckCircle className="w-4 h-4" />
                                            </div>
                                        ) : (
                                            <>
                                                <button
                                                    onClick={() => handleStatusUpdate(student.id, 'present')}
                                                    className="w-10 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center hover:bg-emerald-500/20 hover:scale-105 transition-all"
                                                >
                                                    <CheckCircle className="w-4.5 h-4.5" />
                                                </button>
                                                <button
                                                    onClick={() => handleStatusUpdate(student.id, 'absent')}
                                                    className="w-10 h-9 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 flex items-center justify-center hover:bg-rose-500/20 hover:scale-105 transition-all"
                                                >
                                                    <XCircle className="w-4.5 h-4.5" />
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                        {filteredGymnasts.length === 0 && (
                            <div className="col-span-full py-12 text-center text-white/30 font-medium">
                                No students found for today.
                            </div>
                        )}
                    </div>
                )}
            </div>

            {showHistoryModal && selectedStudentId && (
                <StudentHistoryModal
                    studentId={selectedStudentId}
                    studentName={selectedStudentName || 'Student'}
                    onClose={() => setShowHistoryModal(false)}
                />
            )}
        </div>
    );
}

function StudentHistoryModal({ studentId, studentName, onClose }: { studentId: string, studentName: string, onClose: () => void }) {
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [history, setHistory] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchHistory();
    }, [currentMonth, studentId]);

    const fetchHistory = async () => {
        try {
            setLoading(true);
            const start = startOfMonth(currentMonth);
            const end = endOfMonth(currentMonth);

            const { data, error } = await supabase
                .from('student_attendance') // Changed from 'class_attendance' to 'student_attendance'
                .select('*')
                .eq('student_id', studentId)
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
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={onClose}>
            <div className="glass-card w-full max-w-lg rounded-2xl border border-white/10 overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300" onClick={e => e.stopPropagation()}>
                <div className="p-5 border-b border-white/10 flex items-center justify-between bg-white/5">
                    <div>
                        <h2 className="text-lg font-black text-white uppercase tracking-tight flex items-center gap-2">
                            <Calendar className="w-5 h-5 text-primary" />
                            Attendance History
                        </h2>
                        <p className="text-white/40 font-bold uppercase tracking-wider text-[10px] mt-0.5">{studentName}</p>
                    </div>
                    <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-full transition-colors">
                        <X className="w-5 h-5 text-white/40" />
                    </button>
                </div>

                <div className="p-5">
                    <div className="flex items-center justify-between mb-6">
                        <button
                            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                            className="p-2 hover:bg-white/5 rounded-xl transition-all border border-white/5 text-white/60 hover:text-white">
                            <ChevronLeft className="w-5 h-5" />
                        </button>
                        <h3 className="text-base font-black text-white uppercase tracking-tight">
                            {format(currentMonth, 'MMMM yyyy')}
                        </h3>
                        <button
                            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                            className="p-2 hover:bg-white/5 rounded-xl transition-all border border-white/5 text-white/60 hover:text-white">
                            <ChevronRight className="w-5 h-5" />
                        </button>
                    </div>

                    {loading ? (
                        <div className="h-48 flex items-center justify-center">
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-7 gap-2">
                            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
                                <div key={i} className="text-center text-[9px] font-black text-white/20 uppercase tracking-widest mb-1">
                                    {day}
                                </div>
                            ))}

                            {blanks.map((_, i) => (
                                <div key={`blank-${i}`} className="aspect-square" />
                            ))}

                            {monthDays.map((day) => {
                                const dateStr = format(day, 'yyyy-MM-dd');
                                const record = history.find(h => h.date === dateStr);
                                let statusClass = 'bg-white/5 border-white/5 text-white/20';
                                let statusText = 'NO RECORD';

                                if (record) {
                                    if (record.status === 'present' || record.status === 'completed') {
                                        statusClass = 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400';
                                        statusText = 'PRESENT';
                                    } else if (record.status === 'absent') {
                                        statusClass = 'bg-rose-500/10 border-rose-500/20 text-rose-400';
                                        statusText = 'ABSENT';
                                    }
                                }

                                return (
                                    <div
                                        key={day.toISOString()}
                                        className={`aspect-square rounded-lg flex flex-col items-center justify-center border transition-all relative group/day
                                    ${isToday(day) ? 'ring-2 ring-primary/50 ring-offset-2 ring-offset-[#0E1D21]' : ''}
                                    ${statusClass}`}
                                    >
                                        <span className="text-xs font-black">{format(day, 'd')}</span>
                                        {record && (
                                            <div className="flex flex-col items-center leading-none mt-1">
                                                {record.status === 'absent' ? (
                                                    <XCircle className="w-3 h-3" />
                                                ) : (
                                                    <span className="text-[9px] font-black text-white">
                                                        {record.check_in_time ? format(new Date(record.check_in_time), 'HH:mm') : ''}
                                                    </span>
                                                )}
                                            </div>
                                        )}

                                        <div className="absolute bottom-[110%] left-1/2 -translate-x-1/2 px-2 py-1 bg-white/10 backdrop-blur-md rounded-lg border border-white/10 text-[9px] font-black uppercase tracking-wider text-white opacity-0 group-hover/day:opacity-100 pointer-events-none transition-all scale-95 group-hover/day:scale-100 z-10 whitespace-nowrap shadow-xl">
                                            {statusText}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-3 mt-6">
                        <div className="bg-emerald-500/5 border border-emerald-500/10 p-3 rounded-xl text-center">
                            <div className="text-xl font-black text-emerald-400">
                                {history.filter(h => h.status === 'present' || h.status === 'completed').length}
                            </div>
                            <div className="text-[9px] font-black text-emerald-500/60 uppercase tracking-widest mt-0.5">Present</div>
                        </div>
                        <div className="bg-rose-500/5 border border-rose-500/10 p-3 rounded-xl text-center">
                            <div className="text-xl font-black text-rose-400">
                                {history.filter(h => h.status === 'absent').length}
                            </div>
                            <div className="text-[9px] font-black text-rose-500/60 uppercase tracking-widest mt-0.5">Absent</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

