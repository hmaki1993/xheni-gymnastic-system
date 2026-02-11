import { useState, useEffect, useRef } from 'react';
import { Clock, Calendar, CheckCircle, XCircle, Globe, User, Users, ChevronRight, TrendingUp, Wallet, RotateCcw, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useOutletContext } from 'react-router-dom';
import { format, subMonths } from 'date-fns';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import GroupDetailsModal from '../components/GroupDetailsModal';
import GroupsList from '../components/GroupsList';
import LiveStudentsWidget from '../components/LiveStudentsWidget';
import GroupFormModal from '../components/GroupFormModal';
import ConfirmModal from '../components/ConfirmModal';
import { useCurrency } from '../context/CurrencyContext';
import PremiumClock from '../components/PremiumClock';
import { useTheme } from '../context/ThemeContext';
import BatchAssessmentModal from '../components/BatchAssessmentModal';
import AssessmentHistoryModal from '../components/AssessmentHistoryModal';

export default function CoachDashboard() {
    const { t, i18n } = useTranslation();
    const { settings } = useTheme();
    const { currency } = useCurrency();
    const { role, fullName, userId } = useOutletContext<{ role: string, fullName: string, userId: string | null }>() || { role: null, fullName: null, userId: null };
    const [isCheckedIn, setIsCheckedIn] = useState(false);
    const [checkInTime, setCheckInTime] = useState<string | null>(null);
    const [currentTime] = useState(new Date());
    const [savedSessions, setSavedSessions] = useState<any[]>([]);
    const [syncLoading, setSyncLoading] = useState(true);
    const [dailyTotalSeconds, setDailyTotalSeconds] = useState(0);
    const [ptSubscriptions, setPtSubscriptions] = useState<any[]>([]);
    const [ptRate, setPtRate] = useState<number>(0);
    const [totalEarnings, setTotalEarnings] = useState<number>(0);
    const [baseSalary, setBaseSalary] = useState<number>(0);
    const [recordingId, setRecordingId] = useState<string | null>(null);
    const [coachId, setCoachId] = useState<string | null>(null);
    const [subToClear, setSubToClear] = useState<any>(null);
    const [showClearModal, setShowClearModal] = useState(false);
    const [showClearHistoryModal, setShowClearHistoryModal] = useState(false);
    const [showGroupForm, setShowGroupForm] = useState(false);
    const [showBatchTest, setShowBatchTest] = useState(false);
    const [showHistory, setShowHistory] = useState(false);
    const [editingGroup, setEditingGroup] = useState<any>(null);
    const [pendingAssignments, setPendingAssignments] = useState<any[]>([]);
    const [selectedAssignment, setSelectedAssignment] = useState<any>(null);

    // No longer need interval here as PremiumClock handles it
    // But we might need currentTime for the date display if we don't want it to be static
    // Actually, format(new Date(), ...) is fine for a static date if it doesn't cross midnight during the session.
    // Let's keep a simple static date or use the clock's time if possible.
    // For now, I'll just use format(new Date(), ...) below.


    const [elapsedTime, setElapsedTime] = useState(0);

    useEffect(() => {
        let interval: any;
        if (isCheckedIn) {
            interval = setInterval(() => {
                const today = format(new Date(), 'yyyy-MM-dd');
                const startTime = localStorage.getItem(`checkInStart_${today}`);
                if (startTime) {
                    const params = JSON.parse(startTime);
                    const now = new Date().getTime();
                    setElapsedTime(Math.floor((now - params.timestamp) / 1000));
                }
            }, 1000);
        } else {
            setElapsedTime(0);
        }
        return () => clearInterval(interval);
    }, [isCheckedIn]);

    useEffect(() => {
        const initializeDashboard = async () => {
            setSyncLoading(true);
            const todayStr = format(new Date(), 'yyyy-MM-dd');
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    // 1. Get numeric Coach ID
                    const { data: coachData } = await supabase
                        .from('coaches')
                        .select('id, pt_rate, salary')
                        .eq('profile_id', user.id)
                        .single();

                    if (coachData) {
                        console.log('Fetched Coach ID:', coachData.id);
                        setCoachId(coachData.id);
                        setPtRate(coachData.pt_rate || 0);
                        setBaseSalary(Number(coachData.salary) || 0);

                        // 2. Sync Attendance: Priority to OPEN sessions
                        let { data: attendance } = await supabase
                            .from('coach_attendance')
                            .select('*')
                            .eq('coach_id', coachData.id)
                            .is('check_out_time', null)
                            .order('created_at', { ascending: false })
                            .limit(1)
                            .maybeSingle();

                        if (!attendance) {
                            // If no active session, get latest closed record
                            const { data: latest } = await supabase
                                .from('coach_attendance')
                                .select('*')
                                .eq('coach_id', coachData.id)
                                .order('created_at', { ascending: false })
                                .limit(1)
                                .maybeSingle();
                            attendance = latest;
                        }

                        if (attendance) {
                            const start = new Date(attendance.check_in_time);

                            // Scenario A: Still checked in (no check_out_time) - Restore active session
                            if (!attendance.check_out_time) {
                                setIsCheckedIn(true);
                                setCheckInTime(format(start, 'HH:mm:ss'));
                                setElapsedTime(Math.floor((new Date().getTime() - start.getTime()) / 1000));

                                // Ensure local storage is in sync for the timer
                                localStorage.setItem(`checkInStart_${format(new Date(), 'yyyy-MM-dd')}`, JSON.stringify({
                                    timestamp: start.getTime(),
                                    recordId: attendance.id
                                }));
                            }
                            // Scenario B: Checked out TODAY - Show daily summary
                            else if (attendance.date === todayStr) {
                                setIsCheckedIn(false);
                                const end = new Date(attendance.check_out_time);
                                setDailyTotalSeconds(Math.floor((end.getTime() - start.getTime()) / 1000));
                            }
                            // Scenario C: Checked out on a previous day - Reset (default state)
                            else {
                                setIsCheckedIn(false);
                                setDailyTotalSeconds(0);
                            }
                        }

                        // 3. Fetch PT data
                        fetchTodaySessions(coachData.id);
                        fetchPTSubscriptions(coachData.id, coachData.pt_rate || 0);
                        fetchAssignments(coachData.id);
                    } else {
                        console.warn('No coach profile found for user:', user.id);
                        // 🛡️ ENHANCED SAFETY: Only show error if:
                        // 1. Context role is strictly 'coach'
                        // 2. The Auth user we just fetched MATCHES the global state user (prevent transition leaks)
                        if (role === 'coach' && user.id === userId) {
                            toast.error('Coach profile not found. Please contact admin.');
                        }
                    }
                } else {
                    console.error('No authenticated user found in initialization');
                }
            } catch (err: any) {
                console.error('Initialization failed detailed:', err);
                toast.error('Dashboard init failed: ' + err.message);
            }
            setSyncLoading(false);
        };

        initializeDashboard();
    }, []);

    useEffect(() => {
        if (!coachId) return;

        // If Head Coach, listen to ALL changes, otherwise only for THIS coach
        const filter = (role === 'head_coach') ? undefined : `coach_id=eq.${coachId}`;

        const ptSessionsSubscription = supabase.channel(`pt_sessions_changes_${coachId}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'pt_sessions',
                filter: filter
            }, () => {
                fetchTodaySessions(coachId);
            })
            .subscribe();

        const ptSubscriptionsChannel = supabase.channel(`pt_subscriptions_changes_${coachId}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'pt_subscriptions',
                filter: filter
            }, () => {
                fetchPTSubscriptions(coachId, ptRate);
            })
            .subscribe();

        return () => {
            ptSessionsSubscription.unsubscribe();
            ptSubscriptionsChannel.unsubscribe();
        };
    }, [coachId, ptRate, role]);

    const [attendanceStatus, setAttendanceStatus] = useState<'present' | 'absent' | 'idle'>('idle');


    useEffect(() => {
        const checkStatus = async () => {
            if (!coachId) return;
            // FETCH ACTIVE RECORD FIRST (Prioritize check-in state)
            let { data } = await supabase
                .from('coach_attendance')
                .select('*')
                .eq('coach_id', coachId)
                .is('check_out_time', null)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (!data) {
                // If no active session, get latest closed record
                const { data: latest } = await supabase
                    .from('coach_attendance')
                    .select('*')
                    .eq('coach_id', coachId)
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();
                data = latest;
            }

            const today = format(new Date(), 'yyyy-MM-dd');

            if (data) {
                if (data.status === 'absent') {
                    setAttendanceStatus('absent');
                    setIsCheckedIn(false);
                } else if (!data.check_out_time) {
                    setAttendanceStatus('present');
                    setIsCheckedIn(true);
                } else if (data.date === today) {
                    // Checked out today
                    setAttendanceStatus('idle'); // or 'completed' if we had that status
                    setIsCheckedIn(false);
                } else {
                    // Checked out on previous day
                    setAttendanceStatus('idle');
                    setIsCheckedIn(false);
                }
            } else {
                setAttendanceStatus('idle');
                setIsCheckedIn(false);
            }
        };

        checkStatus();
    }, [coachId]);

    const fetchSavedSessions = async (id: string) => {
        try {
            // Fetch last 100 sessions for history log
            let query = supabase
                .from('pt_sessions')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(100);

            if (role !== 'head_coach') {
                query = query.eq('coach_id', id);
            }

            const { data } = await query;
            setSavedSessions(data || []);
        } catch (error) {
            console.error('Error fetching sessions:', error);
        }
    };

    const fetchTodaySessions = async (id: string) => {
        try {
            // Head Coach sees ALL sessions, regular Coach only their own
            let query = supabase
                .from('pt_sessions')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(100);

            if (role !== 'head_coach') {
                query = query.eq('coach_id', id);
            }

            const { data } = await query;
            setSavedSessions(data || []);
        } catch (error) {
            console.error('Error fetching sessions:', error);
        }
    };


    const fetchPTSubscriptions = async (id: string, rate: number) => {
        try {
            const startOfMonth = format(new Date(), 'yyyy-MM-01');

            // For earnings, we still only calculate for the specific coach (unrelated to view)
            const { data: sessionsData } = await supabase
                .from('pt_sessions')
                .select('sessions_count')
                .eq('coach_id', id)
                .gte('date', startOfMonth);

            const totalSessions = sessionsData?.reduce((sum, s) => sum + (s.sessions_count || 1), 0) || 0;
            setTotalEarnings(totalSessions * rate);

            // Fetch PT Subscriptions: Head Coach sees ALL, Coach sees their own
            let query = supabase
                .from('pt_subscriptions')
                .select('*, students(id, full_name), coaches(full_name)')
                .order('status', { ascending: true });

            if (role !== 'head_coach' && role !== 'admin') {
                query = query.eq('coach_id', id);
            }

            const { data } = await query;

            if (data) {
                setPtSubscriptions(data);
            }
        } catch (error) {
            console.error('Error fetching PT subscriptions:', error);
        }
    };

    const fetchAssignments = async (coachId: string) => {
        try {
            const { data, error } = await supabase
                .from('skill_assessments')
                .select(`
                    id,
                    title,
                    date,
                    coach_id,
                    skills,
                    students(id, full_name, photo_url, coaches(full_name))
                `)
                .eq('coach_id', coachId)
                .eq('evaluation_status', 'assigned')
                .order('created_at', { ascending: false });

            if (error) throw error;

            if (data) {
                const grouped = data.reduce((acc: any, curr: any) => {
                    const key = `${curr.title}-${curr.date}`;
                    if (!acc[key]) {
                        acc[key] = {
                            key,
                            title: curr.title,
                            date: curr.date,
                            assessorId: curr.coach_id,
                            skills: curr.skills,
                            students: []
                        };
                    }
                    acc[key].students.push({
                        id: curr.students?.id,
                        assessment_id: curr.id, // Track the specific record ID
                        full_name: curr.students?.full_name,
                        photo_url: curr.students?.photo_url,
                        coach_name: (curr.students?.coaches as any)?.[0]?.full_name || (curr.students?.coaches as any)?.full_name || '',
                        status: 'present'
                    });
                    return acc;
                }, {});

                setPendingAssignments(Object.values(grouped));
            }
        } catch (err) {
            console.error('Error fetching assignments:', err);
        }
    };

    const handleCheckIn = async () => {
        if (!coachId) return toast.error(t('common.error'));
        const now = new Date();
        const todayStr = format(now, 'yyyy-MM-dd');
        try {
            const { data, error } = await supabase
                .from('coach_attendance')
                .upsert({
                    coach_id: coachId,
                    date: todayStr,
                    check_in_time: now.toISOString(),
                    check_out_time: null, // Clear check-out time if re-checking in same day
                    status: 'present'
                }, { onConflict: 'coach_id,date' })
                .select().single();

            if (error) throw error;
            setIsCheckedIn(true);
            setCheckInTime(format(now, 'HH:mm:ss'));
            localStorage.setItem(`checkInStart_${todayStr}`, JSON.stringify({ timestamp: now.getTime(), recordId: data.id }));
            toast.success(t('coach.checkInSuccess'));
        } catch (error: any) {
            console.error('Check-in error detailed:', error);
            toast.error(error.message || t('common.error'));
        }
    };

    const handleCheckOut = async () => {
        const now = new Date();
        const today = format(now, 'yyyy-MM-dd');
        const savedStart = localStorage.getItem(`checkInStart_${today}`);
        try {
            if (savedStart) {
                const { recordId, timestamp } = JSON.parse(savedStart);
                await supabase.from('coach_attendance').update({ check_out_time: now.toISOString() }).eq('id', recordId);
                setDailyTotalSeconds(Math.floor((now.getTime() - timestamp) / 1000));
            }
            setIsCheckedIn(false);
            setCheckInTime(null);
            setElapsedTime(0);
            localStorage.removeItem(`checkInStart_${today}`);
            toast.success(t('coach.checkOutSuccess'));
        } catch (error) {
            toast.error(t('common.error'));
        }
    };

    const handleRecordSession = async (sub: any) => {
        if (!coachId || recordingId) return;
        if (sub.sessions_remaining <= 0) return toast.error('No sessions remaining');

        setRecordingId(sub.id);
        const loadingToast = toast.loading('Recording session...');
        try {
            // 1. Record the session
            const studentData = Array.isArray(sub.students) ? sub.students[0] : sub.students;
            const studentName = (studentData?.full_name || sub.student_name || '').trim();

            const { error: sessionError } = await supabase.from('pt_sessions').insert({
                coach_id: sub.coach_id, // Record for the coach assigned to the subscription
                date: format(new Date(), 'yyyy-MM-dd'),
                sessions_count: 1,
                student_name: studentName,
                subscription_id: sub.id
            });
            if (sessionError) throw sessionError;

            // 2. Decrement remaining and update status
            const newRemaining = sub.sessions_remaining - 1;
            const { error: subError } = await supabase
                .from('pt_subscriptions')
                .update({
                    sessions_remaining: newRemaining,
                    status: newRemaining === 0 ? 'expired' : sub.status,
                    updated_at: new Date().toISOString()
                })
                .eq('id', sub.id);
            if (subError) throw subError;

            // 3. Refresh data
            await Promise.all([
                fetchTodaySessions(coachId),
                fetchPTSubscriptions(coachId, ptRate)
            ]);
            toast.success('Session recorded!', { id: loadingToast });
        } catch (error) {
            console.error('Error recording session:', error);
            toast.error('Failed to record session', { id: loadingToast });
        } finally {
            setRecordingId(null);
        }
    };

    const handleClearHistory = async () => {
        if (!coachId) return;

        const loadingToast = toast.loading('Clearing history...');
        try {
            const { error } = await supabase
                .from('pt_sessions')
                .delete()
                .eq('coach_id', coachId);

            if (error) throw error;

            await Promise.all([
                fetchTodaySessions(coachId),
                fetchPTSubscriptions(coachId, ptRate)
            ]);

            toast.success('History cleared!', { id: loadingToast });
            setShowClearHistoryModal(false);
        } catch (error) {
            console.error('Clear history failed:', error);
            toast.error('Failed to clear history', { id: loadingToast });
        }
    };

    const handleClearSessions = async () => {
        if (!coachId || !subToClear) return;

        const loadingToast = toast.loading('Clearing sessions...');
        try {
            const { error } = await supabase
                .from('pt_subscriptions')
                .update({
                    sessions_remaining: 0,
                    status: 'expired',
                    updated_at: new Date().toISOString()
                })
                .eq('id', subToClear.id);

            if (error) throw error;

            await Promise.all([
                fetchTodaySessions(coachId),
                fetchPTSubscriptions(coachId, ptRate)
            ]);

            toast.success('All sessions cleared!', { id: loadingToast });
            setShowClearModal(false);
            setSubToClear(null);
        } catch (error) {
            console.error('Clear failed:', error);
            toast.error('Failed to clear sessions', { id: loadingToast });
        }
    };

    const handleResetSession = async (sub: any) => {
        if (!coachId || recordingId) return;

        // Find the most recent session for THIS specific subscription in the last 24h
        const recentSession = savedSessions.find(s =>
            s.subscription_id === sub.id &&
            (new Date().getTime() - new Date(s.created_at).getTime()) < (24 * 60 * 60 * 1000)
        );

        if (!recentSession) {
            return toast.error('No recent record found to reset');
        }

        setRecordingId(sub.id);
        const loadingToast = toast.loading('Resetting record...');
        try {
            // 1. Delete the specific session
            const { error: deleteError } = await supabase
                .from('pt_sessions')
                .delete()
                .eq('id', recentSession.id);

            if (deleteError) throw deleteError;

            // 2. Refund the session and set status back to active
            const newRemaining = sub.sessions_remaining + 1;
            const { error: subError } = await supabase
                .from('pt_subscriptions')
                .update({
                    sessions_remaining: newRemaining,
                    status: 'active',
                    updated_at: new Date().toISOString()
                })
                .eq('id', sub.id);

            if (subError) throw subError;

            // 3. Refresh data
            await Promise.all([
                fetchTodaySessions(coachId),
                fetchPTSubscriptions(coachId, ptRate)
            ]);
            toast.success('Session reset successfully', { id: loadingToast });
        } catch (error) {
            console.error('Reset failed:', error);
            toast.error('Reset failed', { id: loadingToast });
        } finally {
            setRecordingId(null);
        }
    };

    // Helper to group sessions by date
    const groupedSessions = savedSessions.reduce((acc: any, session) => {
        const date = format(new Date(session.created_at), 'yyyy-MM-dd');
        if (!acc[date]) {
            acc[date] = [];
        }
        acc[date].push(session);
        return acc;
    }, {});

    const sortedDates = Object.keys(groupedSessions).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Premium Welcome Header */}
            <div className="relative group p-8 rounded-[3rem] bg-white/[0.02] border border-white/5 backdrop-blur-md overflow-hidden mb-8 transition-all hover:border-white/10 shadow-2xl">
                <div className="absolute top-0 right-0 w-64 h-64 bg-accent/10 blur-[100px] rounded-full -mr-32 -mt-32"></div>

                <div className="flex flex-col sm:flex-row items-center justify-between gap-6 relative z-10 animate-in fade-in slide-in-from-left duration-700">
                    <div>
                        <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.4em] mb-2">{format(new Date(), 'EEEE, dd MMMM yyyy')}</p>
                        <h1 className="text-3xl sm:text-4xl font-black text-white uppercase tracking-tighter flex items-center gap-4">
                            <span className="text-white/40 font-medium lowercase italic">{t('dashboard.welcome')},</span>
                            <span className="premium-gradient-text">{fullName || 'COACH'}! 👋</span>
                        </h1>
                    </div>

                    {/* Compact Date & Clock Widget */}
                    {settings.clock_position === 'dashboard' && (
                        <PremiumClock className="!bg-white/[0.03] !border-white/10 !rounded-full !shadow-lg backdrop-blur-xl" />
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                {/* Attendance Card */}
                <div className="glass-card p-8 rounded-[2.5rem] border border-white/10 shadow-premium relative overflow-hidden group col-span-1 md:col-span-2">
                    <div className="absolute -top-24 -right-24 w-64 h-64 bg-primary/5 rounded-full blur-3xl transition-all duration-700"></div>
                    <div className="flex items-center justify-between mb-4 relative z-10">
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] mt-1 flex items-center gap-2">
                                <span className={`w-1.5 h-1.5 rounded-full transition-all duration-500 ${isCheckedIn ? 'bg-emerald-400 shadow-[0_0_10px_2px_rgba(52,211,153,0.8)] animate-pulse' : 'bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.5)]'}`}></span>
                                <span className={isCheckedIn ? 'text-emerald-400 drop-shadow-[0_0_10px_rgba(52,211,153,0.5)]' : 'text-rose-500 drop-shadow-[0_0_10px_rgba(244,63,94,0.3)]'}>
                                    {isCheckedIn ? t('coaches.workingNow') : t('coaches.away')}
                                </span>
                            </p>
                        </div>
                        <div className="p-3 bg-primary/20 rounded-xl text-primary">
                            <Clock className="w-5 h-5" />
                        </div>
                    </div>
                    <div className="flex flex-col items-center gap-6 relative z-10">
                        {isCheckedIn ? (
                            <div className="text-3xl sm:text-4xl md:text-5xl font-black text-white tracking-widest font-mono animate-in zoom-in-95 duration-500">
                                {formatTimer(elapsedTime)}
                            </div>
                        ) : dailyTotalSeconds > 0 ? (
                            <div className="flex flex-col items-center gap-1 animate-in fade-in slide-in-from-top-4 duration-700">
                                <div className="text-3xl sm:text-4xl md:text-5xl font-black text-emerald-400 tracking-widest font-mono drop-shadow-[0_0_20px_rgba(52,211,153,0.3)]">
                                    {formatTimer(dailyTotalSeconds)}
                                </div>
                                <div className="flex items-center gap-2 px-3 py-1 bg-emerald-500/10 rounded-full border border-emerald-500/20">
                                    <span className="text-[9px] font-black text-emerald-400 uppercase tracking-[0.2em]">Summary</span>
                                </div>
                            </div>
                        ) : (
                            <div className="text-3xl sm:text-4xl md:text-5xl font-black text-white/10 tracking-widest font-mono">00:00:00</div>
                        )}
                        <button
                            onClick={isCheckedIn ? handleCheckOut : handleCheckIn}
                            className={`group/btn w-full py-4 rounded-[1.5rem] font-black uppercase tracking-widest text-[11px] flex items-center justify-center gap-3 transition-all hover:scale-102 active:scale-98 shadow-premium ${isCheckedIn ? 'bg-rose-500/10 border border-rose-500/20 text-rose-500 hover:bg-rose-500 hover:text-white' : 'bg-primary text-white hover:bg-primary/90'}`}
                        >
                            {isCheckedIn ? <XCircle className="w-5 h-5" /> : <CheckCircle className="w-5 h-5" />}
                            {isCheckedIn ? t('coach.checkOut') : t('coach.checkIn')}
                        </button>
                    </div>
                </div>

                {/* Total Earnings Card */}
                <div className="glass-card p-8 rounded-[2.5rem] border border-white/10 shadow-premium relative overflow-hidden group col-span-1 md:col-span-2">
                    <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl transition-all duration-700"></div>
                    <div className="flex items-center justify-between mb-4 relative z-10">
                        <div>
                            <h2 className="text-lg font-black text-white uppercase tracking-tight">Earnings</h2>
                            <p className="text-[9px] font-black text-white/40 uppercase tracking-[0.2em] mt-1">Salary + PT Month</p>
                        </div>
                        <div className="p-3 bg-amber-500/20 rounded-xl text-amber-500">
                            <Wallet className="w-5 h-5" />
                        </div>
                    </div>
                    <div className="flex-1 flex flex-col justify-center items-center py-4 relative z-10">
                        <div className="flex items-baseline gap-2">
                            <h3 className="text-5xl font-black text-amber-500 tracking-tighter">{(totalEarnings + baseSalary).toLocaleString()}</h3>
                            <span className="text-xs font-black text-white/20 uppercase tracking-widest">{currency.code}</span>
                        </div>
                        <div className="flex gap-4 mt-4">
                            <div className="text-center">
                                <p className="text-[8px] font-black text-white/30 uppercase tracking-widest mb-0.5">Base</p>
                                <p className="text-xs font-bold text-white/60">{baseSalary.toLocaleString()} {currency.code}</p>
                            </div>
                            <div className="w-px h-6 bg-white/10"></div>
                            <div className="text-center">
                                <p className="text-[8px] font-black text-white/30 uppercase tracking-widest mb-0.5">PT</p>
                                <p className="text-xs font-bold text-white/60">{totalEarnings.toLocaleString()} {currency.code}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* PT Sessions Recording Card */}
            <div className="glass-card p-8 rounded-[2.5rem] border border-white/10 shadow-premium relative overflow-hidden">
                <div className="relative z-10">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-black text-white uppercase tracking-tight flex items-center gap-3">
                            <div className="p-2.5 bg-primary/20 rounded-xl text-primary"><User className="w-5 h-5" /></div>
                            {t('coach.ptSessions', 'PT History Log')}
                        </h2>

                        {savedSessions.length > 0 && (
                            <button
                                onClick={() => setShowClearHistoryModal(true)}
                                className="flex items-center gap-2 px-6 py-3 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/20 rounded-2xl transition-all font-black uppercase tracking-widest text-[10px] group"
                            >
                                <Trash2 className="w-4 h-4 group-hover:scale-110 transition-transform" />
                                Clear All
                            </button>
                        )}
                    </div>

                    {savedSessions.length > 0 ? (
                        <div className="space-y-8">
                            {sortedDates.map((date) => {
                                const sessions = groupedSessions[date];
                                const isToday = date === format(new Date(), 'yyyy-MM-dd');

                                return (
                                    <div key={date} className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                                        <div className="flex items-center gap-4 mb-4">
                                            <div className={`px-4 py-2 rounded-xl border border-white/5 shadow-inner ${isToday ? 'bg-accent/20 text-accent' : 'bg-white/5 text-white/60'}`}>
                                                <span className="font-black uppercase tracking-widest text-xs">
                                                    {isToday ? 'Today' : format(new Date(date), 'EEEE, MMM dd')}
                                                </span>
                                            </div>
                                            <div className="h-px flex-1 bg-white/5"></div>
                                            <div className="px-3 py-1 rounded-lg bg-white/5 border border-white/10 text-white/40 font-mono text-xs font-bold">
                                                {sessions.length} Session{sessions.length !== 1 ? 's' : ''}
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                            {sessions.map((session: any) => (
                                                <div key={session.id} className="flex items-center justify-between p-5 rounded-[2rem] bg-white/[0.02] border border-white/5 hover:border-primary/30 transition-all group">
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary/80"><User className="w-5 h-5" /></div>
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <p className="font-bold text-white text-sm tracking-tight">{session.student_name}</p>
                                                            </div>
                                                            <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest">{format(new Date(session.created_at), 'hh:mm a')}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="py-16 text-center border-2 border-dashed border-white/5 rounded-[3rem]">
                            <div className="w-20 h-20 mx-auto mb-6 rounded-3xl bg-white/5 flex items-center justify-center text-white/20">
                                <User className="w-10 h-10" />
                            </div>
                            <p className="text-white/30 font-bold uppercase tracking-widest text-xs">No history found</p>
                        </div>
                    )}
                </div>
            </div>

            {/* My Groups Section */}
            <div className="glass-card p-8 rounded-[2.5rem] border border-white/10 shadow-premium">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-black text-white uppercase tracking-tight flex items-center gap-3">
                        <div className="p-2.5 bg-accent/20 rounded-xl text-accent"><User className="w-5 h-5" /></div>
                        {t('dashboard.myGroups', 'My Groups')}
                    </h2>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setShowHistory(true)}
                            className="bg-white/5 hover:bg-white/10 text-white/60 hover:text-white border border-white/5 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all hover:scale-105 active:scale-95 flex items-center gap-2"
                        >
                            <Clock className="w-4 h-4" />
                            History
                        </button>
                    </div>
                </div>
                <GroupsList
                    coachId={coachId || undefined}
                    onEdit={(role === 'admin' || role === 'head_coach') ? (group) => {
                        setEditingGroup(group);
                        setShowGroupForm(true);
                    } : undefined}
                />
            </div>

            {
                showGroupForm && (
                    <GroupFormModal
                        initialData={editingGroup}
                        onClose={() => setShowGroupForm(false)}
                        onSuccess={() => {
                            // Success handled by realtime or implicit refetch if needed
                            // But let's trigger a hard refresh if we want consistency
                            window.location.reload();
                        }}
                    />
                )
            }

            <BatchAssessmentModal
                isOpen={showBatchTest}
                onClose={() => {
                    setShowBatchTest(false);
                    setSelectedAssignment(null);
                }}
                onSuccess={() => {
                    toast.success('Batch test saved successfully');
                    if (coachId) fetchAssignments(coachId);
                }}
                currentCoachId={coachId}
                initialAssignment={selectedAssignment}
            />

            <AssessmentHistoryModal
                isOpen={showHistory}
                onClose={() => setShowHistory(false)}
                currentCoachId={coachId}
            />

            {/* My PT Students Section & Live Floor */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                <div className="xl:col-span-2 glass-card p-8 rounded-[2.5rem] border border-white/10 shadow-premium relative bg-gradient-to-br from-white/[0.02] to-transparent">
                    <h2 className="text-xl font-black text-white uppercase tracking-tight mb-4 flex items-center gap-3">
                        <div className="p-2.5 bg-gradient-to-br from-accent to-primary rounded-xl text-white shadow-lg"><User className="w-5 h-5" /></div>
                        My PT Students
                    </h2>

                    {ptSubscriptions.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {ptSubscriptions.map((subscription) => (
                                <div key={subscription.id} className="glass-card p-6 rounded-[2rem] border border-white/10 hover:border-accent/40 transition-all duration-700 group hover:scale-[1.01] relative overflow-hidden flex flex-col h-full bg-[#0a0c10]/40">
                                    {/* Premium Card Hover Glow */}
                                    <div className="absolute inset-0 bg-gradient-to-br from-accent/10 via-transparent to-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-700 rounded-[2rem]"></div>
                                    <div className="absolute -top-24 -right-24 w-48 h-48 bg-accent/10 rounded-full blur-[100px] opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>

                                    <div className="relative z-10 flex flex-col h-full">
                                        {/* Student Info & Actions */}
                                        <div className="flex items-start justify-between mb-6">
                                            <div className="flex items-center gap-4">
                                                <div className="relative">
                                                    <div className="absolute -inset-1 bg-gradient-to-br from-accent to-primary rounded-xl blur opacity-20 group-hover:opacity-50 transition-opacity"></div>
                                                    <div className="relative w-12 h-12 rounded-xl bg-[#0a0c10] border border-white/10 flex items-center justify-center text-white font-black text-xl shadow-2xl group-hover:scale-105 transition-transform duration-500">
                                                        {(subscription.students?.full_name || subscription.student_name || 'S')?.[0]}
                                                    </div>
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <h3 className="font-black text-white text-lg tracking-tight group-hover:text-accent transition-colors leading-tight truncate">{subscription.students?.full_name || subscription.student_name || 'Unknown'}</h3>
                                                    <p className="text-[9px] font-black text-white/30 uppercase tracking-widest mt-1 flex items-center gap-2">
                                                        <span className="w-1 h-1 rounded-full bg-accent/50"></span>
                                                        PT Student
                                                        {role === 'head_coach' && (
                                                            <>
                                                                <span className="w-1 h-1 rounded-full bg-primary/50 mx-1"></span>
                                                                <span className="text-primary/70 italic">Coach: {subscription.coaches?.full_name || 'Unknown'}</span>
                                                            </>
                                                        )}
                                                    </p>
                                                </div>
                                            </div>

                                            {(() => {
                                                const recentSession = savedSessions.find(s => {
                                                    const isMatch = s.subscription_id === subscription.id;
                                                    const sDate = new Date(s.created_at);
                                                    const hoursAgo = (new Date().getTime() - sDate.getTime()) / (1000 * 60 * 60);
                                                    return isMatch && hoursAgo < 24;
                                                });
                                                const isRecentlyRecorded = !!recentSession;
                                                const isLoading = recordingId === subscription.id;

                                                return (
                                                    <div className="flex items-center gap-3">
                                                        <button
                                                            onClick={() => isRecentlyRecorded ? handleResetSession(subscription) : handleRecordSession(subscription)}
                                                            disabled={isLoading || (subscription.sessions_remaining <= 0 && !isRecentlyRecorded)}
                                                            className={`p-3 rounded-xl transition-all shadow-lg active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed group/record relative border
                                                                ${isRecentlyRecorded
                                                                    ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30 hover:bg-emerald-500/20 shadow-emerald-500/10'
                                                                    : 'bg-primary/20 text-primary border-primary/30 hover:bg-primary hover:text-white shadow-primary/10'}`}
                                                            title={isRecentlyRecorded ? "Reset Session" : "Record Session"}
                                                        >
                                                            {isLoading ? (
                                                                <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                                            ) : isRecentlyRecorded ? (
                                                                <RotateCcw className="w-5 h-5 transition-transform group-hover/record:rotate-[-45deg]" />
                                                            ) : (
                                                                <CheckCircle className="w-5 h-5 transition-transform group-hover/record:scale-110" />
                                                            )}
                                                            {isRecentlyRecorded && (
                                                                <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-[#0a0c10] shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                                                            )}
                                                        </button>
                                                        {!isRecentlyRecorded && subscription.sessions_remaining > 0 && (
                                                            <button
                                                                onClick={() => {
                                                                    setSubToClear(subscription);
                                                                    setShowClearModal(true);
                                                                }}
                                                                className="p-3 rounded-xl bg-white/5 text-white/20 hover:text-rose-500 hover:bg-rose-500/10 border border-white/5 transition-all hover:scale-110 active:scale-90"
                                                                title="Clear All Sessions"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                    </div>
                                                );
                                            })()}
                                        </div>

                                        {/* Progress Section */}
                                        <div className="flex-1 space-y-6">
                                            {/* Data Boxes */}
                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="p-3 bg-white/5 rounded-2xl border border-white/5 flex items-center gap-2.5">
                                                    <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center text-accent">
                                                        <TrendingUp className="w-4 h-4" />
                                                    </div>
                                                    <div>
                                                        <p className="text-[8px] font-black text-white/30 uppercase tracking-[0.2em] mb-0.5">{t('pt.sessionsRemaining')}</p>
                                                        <p className="text-lg font-black text-accent">{subscription.sessions_remaining}</p>
                                                    </div>
                                                </div>
                                                <div className="p-3 bg-white/5 rounded-2xl border border-white/5 flex items-center gap-2.5">
                                                    <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-white/40">
                                                        <div className="text-[9px] font-bold">{currency.symbol}</div>
                                                    </div>
                                                    <div>
                                                        <p className="text-[8px] font-black text-white/30 uppercase tracking-[0.2em] mb-0.5">Rate</p>
                                                        <p className="text-base font-black text-white">{ptRate}</p>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Progress Bar */}
                                            <div className="space-y-2 p-4 bg-gradient-to-br from-white/5 to-transparent rounded-[1.5rem] border border-white/5">
                                                <div className="flex items-center justify-between px-1">
                                                    <span className="text-[8px] font-black text-white/30 uppercase tracking-[0.2em]">{t('pt.progress')}</span>
                                                    <span className="text-[9px] font-black text-accent px-1.5 py-0.5 bg-accent/10 rounded-lg">
                                                        {subscription.sessions_remaining}/{subscription.sessions_total}
                                                    </span>
                                                </div>
                                                <div className="h-2 bg-[#0a0c10] rounded-full overflow-hidden border border-white/5 p-0.5">
                                                    <div
                                                        className="h-full bg-gradient-to-r from-accent to-primary transition-all duration-1000 rounded-full"
                                                        style={{ width: `${(subscription.sessions_remaining / subscription.sessions_total) * 100}%` }}
                                                    ></div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Footer: Expiry & Status */}
                                        <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-between">
                                            <div>
                                                <p className="text-[8px] font-black text-white/30 uppercase tracking-[0.2em] mb-0.5">{t('students.expiry')}</p>
                                                <p className="text-xs font-bold text-white/80">{format(new Date(subscription.expiry_date), 'dd MMM yyyy')}</p>
                                            </div>

                                            {(() => {
                                                const isExpired = new Date(subscription.expiry_date) < new Date() || subscription.status === 'expired' || subscription.sessions_remaining <= 0;
                                                return isExpired ? (
                                                    <div className="flex items-center gap-2 px-3 py-1.5 bg-rose-500/10 border border-rose-500/20 rounded-xl">
                                                        <div className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping"></div>
                                                        <span className="text-[9px] font-black text-rose-500 uppercase tracking-widest">{t('pt.expired')}</span>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-2 px-3 py-1.5 bg-accent/10 border border-accent/20 rounded-xl">
                                                        <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse"></div>
                                                        <span className="text-[9px] font-black text-accent uppercase tracking-widest">{t('pt.active')}</span>
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-16">
                            <div className="w-24 h-24 mx-auto mb-6 rounded-[2rem] bg-white/5 border border-white/10 flex items-center justify-center text-white/20"><User className="w-12 h-12" /></div>
                            <p className="text-white/40 font-black uppercase tracking-widest text-sm">No PT Students Yet</p>
                        </div>
                    )}
                </div>

                {/* Pending Assignments Section */}
                {pendingAssignments.length > 0 && (
                    <div className="xl:col-span-2 glass-card p-8 rounded-[2.5rem] border border-amber-500/20 shadow-[0_20px_50px_rgba(245,158,11,0.1)] relative overflow-hidden group bg-amber-500/[0.02]">
                        <div className="flex items-center justify-between mb-6 relative z-10">
                            <div>
                                <h2 className="text-xl font-black text-white uppercase tracking-tight flex items-center gap-3">
                                    <div className="p-2.5 bg-amber-500/20 rounded-xl text-amber-500"><Calendar className="w-5 h-5" /></div>
                                    Pending Assessments
                                </h2>
                                <p className="text-[10px] font-black text-amber-500/60 uppercase tracking-[0.2em] mt-1">Assigned by admin</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 relative z-10">
                            {pendingAssignments.map((assignment) => (
                                <div
                                    key={assignment.key}
                                    onClick={() => {
                                        setSelectedAssignment(assignment);
                                        setShowBatchTest(true);
                                    }}
                                    className="p-5 rounded-[2rem] bg-white/[0.03] border border-white/5 hover:border-amber-500/30 transition-all cursor-pointer group/assignment"
                                >
                                    <div className="flex items-center justify-between mb-3">
                                        <h3 className="font-black text-white uppercase tracking-tight text-sm truncate">{assignment.title}</h3>
                                        <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500">
                                            <ChevronRight className="w-4 h-4" />
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4 text-white/40">
                                        <div className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest">
                                            <Users className="w-3.5 h-3.5" />
                                            {assignment.students.length} Students
                                        </div>
                                        <div className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest">
                                            <TrendingUp className="w-3.5 h-3.5" />
                                            {assignment.skills.length} Skills
                                        </div>
                                    </div>
                                    <button className="w-full mt-4 py-2.5 rounded-xl bg-amber-500/10 text-amber-500 text-[9px] font-black uppercase tracking-widest hover:bg-amber-500 hover:text-white transition-all">
                                        Grade Now
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Live Floor Widget - Takes up 1 column on large screens */}
                <div className="xl:col-span-1 h-full min-h-[500px]">
                    <LiveStudentsWidget coachId={coachId} />
                </div>
            </div>

            {
                showClearModal && (
                    <ConfirmModal
                        isOpen={showClearModal}
                        onClose={() => {
                            setShowClearModal(false);
                            setSubToClear(null);
                        }}
                        onConfirm={handleClearSessions}
                        title="Clear All Sessions"
                        message={`Are you sure you want to clear all remaining sessions for ${subToClear?.students?.full_name || subToClear?.student_name || 'this student'}? This will mark the subscription as completed.`}
                    />
                )
            }

            {
                showClearHistoryModal && (
                    <ConfirmModal
                        isOpen={showClearHistoryModal}
                        onClose={() => setShowClearHistoryModal(false)}
                        onConfirm={handleClearHistory}
                        title="Clear Session History"
                        message="Are you sure you want to clear ALL recorded PT sessions? This action cannot be undone and will affect earnings calculations."
                    />
                )
            }
        </div>
    );
}



function formatTimer(seconds: number) {
    if (isNaN(seconds) || seconds < 0) return '00:00:00';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}
