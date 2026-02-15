import { useState, useEffect } from 'react';
import { Clock, Calendar, CheckCircle, XCircle, User, Plus, Users, Wallet, ClipboardCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import GroupsList from '../components/GroupsList';
import LiveStudentsWidget from '../components/LiveStudentsWidget';
import GroupFormModal from '../components/GroupFormModal'; // Need this to create groups
import AddStudentForm from '../components/AddStudentForm'; // Need this to add students
import { useCurrency } from '../context/CurrencyContext';
import PremiumClock from '../components/PremiumClock';
import { useTheme } from '../context/ThemeContext';
import ConfirmModal from '../components/ConfirmModal';
import { RotateCcw, Trash2, TrendingUp, ChevronRight, Globe } from 'lucide-react';

export default function HeadCoachDashboard() {
    const { t, i18n } = useTranslation();
    const { settings } = useTheme();
    const { currency } = useCurrency();
    const { role, fullName } = useOutletContext<{ role: string, fullName: string }>() || { role: null, fullName: null };
    const navigate = useNavigate();

    // Check-in State
    const [isCheckedIn, setIsCheckedIn] = useState(false);
    const [checkInTime, setCheckInTime] = useState<string | null>(null);
    const [currentTime] = useState(new Date());
    const [dailyTotalSeconds, setDailyTotalSeconds] = useState(0);
    const [elapsedTime, setElapsedTime] = useState(0);
    const [coachId, setCoachId] = useState<string | null>(null);
    const [savedSessions, setSavedSessions] = useState<any[]>([]);

    // Modals
    const [showGroupModal, setShowGroupModal] = useState(false);
    const [showStudentModal, setShowStudentModal] = useState(false);


    // setInterval removed as PremiumClock handles it.
    // currentTime is kept static for the date display.

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
            const todayStr = format(new Date(), 'yyyy-MM-dd');
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    // Fetch Coach Data
                    const { data: coachData } = await supabase
                        .from('coaches')
                        .select('id, pt_rate, salary')
                        .eq('profile_id', user.id)
                        .single();

                    if (coachData) {
                        setCoachId(coachData.id);

                        // Sync Attendance: Priority to OPEN sessions
                        let { data: attendance } = await supabase
                            .from('coach_attendance')
                            .select('*')
                            .eq('coach_id', coachData.id)
                            .is('check_out_time', null)
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
                    }
                }
            } catch (err) {
                console.error('Initialization failed:', err);
            }
        };

        initializeDashboard();
    }, []);

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

    // --- Personal Dashboard Logic ---

    const fetchPersonalTodaySessions = async (id: string) => {
        try {
            // STRICTLY filter for THIS coach (Head Coach's personal sessions)
            const { data } = await supabase
                .from('pt_sessions')
                .select('*')
                .eq('coach_id', id)
                .order('created_at', { ascending: false })
                .limit(100);
            setSavedSessions(data || []);
        } catch (error) {
            console.error('Error fetching sessions:', error);
        }
    };




    return (
        <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Premium Welcome Header */}
            <div className="relative group p-8 rounded-[3rem] bg-white/[0.02] border border-white/5 backdrop-blur-md overflow-hidden mb-12 transition-all hover:border-white/10 shadow-2xl">
                <div className="absolute top-0 right-0 w-64 h-64 bg-accent/10 blur-[100px] rounded-full -mr-32 -mt-32"></div>

                <div className="flex flex-col sm:flex-row items-center justify-between gap-6 relative z-10 animate-in fade-in slide-in-from-left duration-700">
                    <div className="flex flex-col items-start gap-1">
                        <div className="flex flex-wrap items-center gap-3">
                            <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.4em]">{format(new Date(), 'EEEE, dd MMMM yyyy')}</p>
                            <span className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-500 text-[8px] font-black uppercase tracking-[0.2em] border border-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.1)]">
                                LEADER
                            </span>
                        </div>
                        <h1 className="text-3xl sm:text-4xl font-black text-white uppercase tracking-tighter flex items-center gap-4">
                            <span className="text-white/40 font-medium lowercase italic">{t('dashboard.welcome')},</span>
                            <span className="premium-gradient-text">{fullName || t('roles.head_coach')}</span>
                        </h1>
                    </div>

                    {/* Compact Date & Clock Widget */}
                    <div className="flex items-center gap-4">
                        {settings.clock_position === 'dashboard' && (
                            <PremiumClock className="!bg-white/[0.03] !border-white/10 !rounded-full !shadow-lg backdrop-blur-xl" />
                        )}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                {/* Attendance Card */}
                <div className="glass-card p-10 rounded-[2.5rem] border border-white/10 shadow-premium relative overflow-hidden group col-span-1 md:col-span-2 bg-white/[0.02]">
                    <div className="absolute -top-24 -right-24 w-64 h-64 bg-primary/5 rounded-full blur-3xl transition-all duration-700"></div>
                    <div className="flex items-center justify-between mb-8 relative z-10">
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] mt-2 flex items-center gap-2">
                                <span className={`w-1.5 h-1.5 rounded-full transition-all duration-500 ${isCheckedIn ? 'bg-emerald-400 shadow-[0_0_12px_2px_rgba(52,211,153,0.8)] animate-pulse' : 'bg-rose-500 shadow-[0_0_12px_rgba(244,63,94,0.5)]'}`}></span>
                                <span className={isCheckedIn ? 'text-emerald-400 drop-shadow-[0_0_10px_rgba(52,211,153,0.5)]' : 'text-rose-500 drop-shadow-[0_0_10px_rgba(244,63,94,0.3)]'}>
                                    {isCheckedIn ? t('coaches.workingNow') : t('coaches.away')}
                                </span>
                            </p>
                        </div>
                        <div className="p-4 bg-primary/20 rounded-2xl text-primary border border-primary/20">
                            <Clock className="w-6 h-6" />
                        </div>
                    </div>
                    <div className="flex flex-col items-center gap-8 relative z-10">
                        {isCheckedIn ? (
                            <div className="text-3xl sm:text-4xl md:text-5xl font-black text-white tracking-widest font-mono animate-in zoom-in-95 duration-500">
                                {formatTimer(elapsedTime)}
                            </div>
                        ) : dailyTotalSeconds > 0 ? (
                            <div className="flex flex-col items-center gap-2 animate-in fade-in slide-in-from-top-4 duration-700">
                                <div className="text-3xl sm:text-4xl md:text-5xl font-black text-emerald-400 tracking-widest font-mono drop-shadow-[0_0_20px_rgba(52,211,153,0.3)]">
                                    {formatTimer(dailyTotalSeconds)}
                                </div>
                                <div className="flex items-center gap-2 px-4 py-1.5 bg-emerald-500/10 rounded-full border border-emerald-500/20">
                                    <span className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.2em]">Summary</span>
                                </div>
                            </div>
                        ) : (
                            <div className="text-3xl sm:text-4xl md:text-5xl font-black text-white/10 tracking-widest font-mono">00:00:00</div>
                        )}
                        <button
                            onClick={isCheckedIn ? handleCheckOut : handleCheckIn}
                            className={`group/btn w-full py-6 rounded-[2rem] font-black uppercase tracking-widest text-sm flex items-center justify-center gap-4 transition-all hover:scale-[1.02] active:scale-98 shadow-premium ${isCheckedIn ? 'bg-rose-500/10 border border-rose-500/20 text-rose-500 hover:bg-rose-500 hover:text-white' : 'bg-primary text-white hover:bg-primary/90'}`}
                        >
                            {isCheckedIn ? <XCircle className="w-6 h-6" /> : <CheckCircle className="w-6 h-6" />}
                            {isCheckedIn ? t('coach.checkOut') : t('coach.checkIn')}
                        </button>
                    </div>
                </div>

                {/* Quick Actions */}
                <div className="glass-card p-10 rounded-[2.5rem] border border-white/10 shadow-premium relative overflow-hidden group col-span-1 md:col-span-2 bg-white/[0.02]">
                    <div className="flex items-center justify-between mb-8 relative z-10">
                        <div>
                            <h2 className="text-xl font-black text-white uppercase tracking-tight">Quick Actions</h2>
                            <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.4em] mt-2">Elite Management</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 relative z-10">
                        <button
                            onClick={() => setShowStudentModal(true)}
                            className="p-8 rounded-[2rem] bg-accent/5 hover:bg-accent/20 border border-accent/10 hover:border-accent/40 transition-all flex flex-col items-center justify-center gap-4 group/action"
                        >
                            <div className="w-12 h-12 rounded-2xl bg-accent/20 flex items-center justify-center text-accent group-hover/action:scale-110 transition-transform shadow-lg shadow-accent/20">
                                <Plus className="w-6 h-6" />
                            </div>
                            <span className="text-[10px] font-black text-white uppercase tracking-widest text-center">Add Student</span>
                        </button>
                        <button
                            onClick={() => navigate('/app/evaluations')}
                            className="p-8 rounded-[2rem] bg-primary/5 hover:bg-primary/20 border border-primary/10 hover:border-primary/40 transition-all flex flex-col items-center justify-center gap-4 group/action"
                        >
                            <div className="w-12 h-12 rounded-2xl bg-primary/20 flex items-center justify-center text-primary group-hover/action:scale-110 transition-transform shadow-lg shadow-primary/20">
                                <ClipboardCheck className="w-6 h-6" />
                            </div>
                            <span className="text-[10px] font-black text-white uppercase tracking-widest text-center">Evaluation Hub</span>
                        </button>
                        <button
                            onClick={() => setShowGroupModal(true)}
                            className="p-8 rounded-[2rem] bg-indigo-500/5 hover:bg-indigo-500/20 border border-indigo-500/10 hover:border-indigo-500/40 transition-all flex flex-col items-center justify-center gap-4 group/action"
                        >
                            <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 flex items-center justify-center text-indigo-400 group-hover/action:scale-110 transition-transform shadow-lg shadow-indigo-500/20">
                                <Users className="w-6 h-6" />
                            </div>
                            <span className="text-[10px] font-black text-white uppercase tracking-widest text-center">Create Group</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Live Floor View (Admin Mode) */}
            <div className="rounded-[3rem] overflow-hidden border border-white/5 shadow-premium">
                <LiveStudentsWidget />
            </div>

            {/* All Groups Management */}
            <div className="glass-card p-12 rounded-[3.5rem] border border-white/10 shadow-premium bg-white/[0.01]">
                <h2 className="text-2xl font-black text-white uppercase tracking-tight mb-8 flex items-center gap-4">
                    <div className="p-3 bg-accent/20 rounded-2xl text-accent border border-accent/20 shadow-lg shadow-accent/5"><Users className="w-6 h-6" /></div>
                    Academy Structure
                </h2>
                <GroupsList showAll={true} />
            </div>


            {/* Modals */}

            {/* Modals */}
            {
                showGroupModal && (
                    <GroupFormModal
                        onClose={() => setShowGroupModal(false)}
                        onSuccess={() => {
                            setShowGroupModal(false);
                            // Trigger group list refresh ideally, but GroupsList has realtime
                            toast.success('Group created successfully');
                        }}
                    />
                )
            }

            {
                showStudentModal && (
                    <AddStudentForm
                        onClose={() => setShowStudentModal(false)}
                        onSuccess={() => {
                            setShowStudentModal(false);
                            toast.success('Student added successfully');
                        }}
                    />
                )
            }
        </div >
    );
}

function formatTimer(seconds: number) {
    if (isNaN(seconds) || seconds < 0) return '00:00:00';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}
