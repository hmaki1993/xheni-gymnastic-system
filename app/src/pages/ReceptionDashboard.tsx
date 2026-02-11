import { useState, useEffect, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, subMonths, addMonths, isToday } from 'date-fns';
import {
    Users,
    UserPlus,
    Calendar,
    Clock,
    CheckCircle,
    XCircle,
    Dumbbell,
    CheckSquare,
    XSquare,
    MessageSquare,
    Save,
    X,
    ChevronLeft,
    ChevronRight,
    Search,
    RotateCcw,
    ArrowUpRight,
    Wallet
} from 'lucide-react';
import { useCurrency } from '../context/CurrencyContext';
import { supabase } from '../lib/supabase';
import AddStudentForm from '../components/AddStudentForm';
import AddPTSubscriptionForm from '../components/AddPTSubscriptionForm';
import PremiumClock from '../components/PremiumClock';
import { useTheme } from '../context/ThemeContext';
import toast from 'react-hot-toast';

export default function ReceptionDashboard() {
    const { t, i18n } = useTranslation();
    const { settings, userProfile } = useTheme();
    const navigate = useNavigate();
    const { role: contextRole } = useOutletContext<{ role: string }>() || { role: null };
    const { currency } = useCurrency();
    const [salary, setSalary] = useState(0);
    const [totalEarnings, setTotalEarnings] = useState(0);
    const [loadingEarnings, setLoadingEarnings] = useState(true);

    // Modals State
    const [showAddStudent, setShowAddStudent] = useState(false);
    const [showAddPT, setShowAddPT] = useState(false);



    // Class Attendance State
    const [todaysClasses, setTodaysClasses] = useState<any[]>([]);
    const [loadingClasses, setLoadingClasses] = useState(true);
    const [recentCheckIns, setRecentCheckIns] = useState<any[]>([]);

    // Coach Attendance State
    const [coachesList, setCoachesList] = useState<any[]>([]);
    const [loadingCoaches, setLoadingCoaches] = useState(true);
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    // PT Attendance State
    const [ptList, setPtList] = useState<any[]>([]);
    const [loadingPt, setLoadingPt] = useState(true);



    // Self Check-In State
    const [myCoachId, setMyCoachId] = useState<string | null>(null);
    const [isCheckedIn, setIsCheckedIn] = useState(false);
    const [checkInTime, setCheckInTime] = useState<string | null>(null);
    const [elapsedTime, setElapsedTime] = useState(0);

    // Search State for Filtering
    const [searchGymnast, setSearchGymnast] = useState('');
    const [searchStaff, setSearchStaff] = useState('');
    const [searchPT, setSearchPT] = useState('');

    // --- Memoized Filtered Lists for Performance ---
    const filteredGymnasts = useMemo(() => {
        if (!searchGymnast.trim()) return todaysClasses;
        const query = searchGymnast.toLowerCase().trim();
        return todaysClasses.filter(s =>
            s.full_name?.toLowerCase().includes(query) ||
            s.coaches?.full_name?.toLowerCase().includes(query)
        );
    }, [todaysClasses, searchGymnast]);

    const filteredCoaches = useMemo(() => {
        if (!searchStaff.trim()) return coachesList;
        const query = searchStaff.toLowerCase().trim();
        return coachesList.filter(c =>
            c.full_name?.toLowerCase().includes(query) ||
            c.email?.toLowerCase().includes(query)
        );
    }, [coachesList, searchStaff]);

    const filteredPT = useMemo(() => {
        if (!searchPT.trim()) return ptList;
        const query = searchPT.toLowerCase().trim();
        return ptList.filter(s =>
            s.full_name?.toLowerCase().includes(query) ||
            s.coach_name?.toLowerCase().includes(query)
        );
    }, [ptList, searchPT]);

    // Refs for stale closures
    const myCoachIdRef = useRef<string | null>(null);
    const isCheckedInRef = useRef(false);

    useEffect(() => {
        myCoachIdRef.current = myCoachId;
    }, [myCoachId]);

    useEffect(() => {
        isCheckedInRef.current = isCheckedIn;
    }, [isCheckedIn]);

    // DEBUG STATES
    const [debugError, setDebugError] = useState<string>('');
    const [debugAuth, setDebugAuth] = useState<string>('Checking...');

    useEffect(() => {
        // Check Auth and Initialize Self
        const initializeSelf = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                setDebugAuth('Logged In: ' + user.id.slice(0, 5));

                // 1. Try to find a coach record for this user
                // 1. Try to find a coach/staff record for this user
                // Check Coaches Table
                const { data: coachData } = await supabase
                    .from('coaches')
                    .select('id, salary')
                    .eq('profile_id', user.id)
                    .maybeSingle();

                if (coachData) {
                    setSalary(Number(coachData.salary) || 0);
                    setMyCoachId(coachData.id);
                } else {
                    // Check Staff Table
                    const { data: staffData } = await supabase
                        .from('staff')
                        .select('id, salary')
                        .eq('profile_id', user.id)
                        .maybeSingle();

                    if (staffData) {
                        setSalary(Number(staffData.salary) || 0);
                    }
                }
                setLoadingEarnings(false);

                // logic continues

                if (coachData) {
                    setMyCoachId(coachData.id);
                    // 2. Check today's attendance
                    const todayStr = format(new Date(), 'yyyy-MM-dd');
                    const { data: attendanceRecords } = await supabase
                        .from('coach_attendance')
                        .select('*')
                        .eq('coach_id', coachData.id)
                        .eq('date', todayStr);

                    // Find active record (no check_out_time)
                    const activeRecord = attendanceRecords?.find(a => !a.check_out_time);
                    // Or get latest if no active
                    const latestRecord = attendanceRecords?.length
                        ? attendanceRecords.sort((a, b) => new Date(b.created_at || b.check_in_time).getTime() - new Date(a.created_at || a.check_in_time).getTime())[0]
                        : null;

                    const recordToUse = activeRecord || latestRecord;

                    if (recordToUse) {
                        const start = new Date(recordToUse.check_in_time);
                        if (!recordToUse.check_out_time && recordToUse.check_in_time) {
                            setIsCheckedIn(true);
                            setCheckInTime(format(start, 'HH:mm:ss'));
                            setElapsedTime(Math.floor((new Date().getTime() - start.getTime()) / 1000));

                            // Restore timer from local storage if needed or just sync with server time
                            localStorage.setItem(`receptionCheckInStart_${todayStr}`, JSON.stringify({
                                timestamp: start.getTime(),
                                recordId: recordToUse.id
                            }));
                        } else if (recordToUse.check_out_time) {
                            setIsCheckedIn(false); // Completed
                        }
                    }
                }
            } else {
                setDebugAuth('No User');
            }
        };

        initializeSelf();

        // No longer need internal timer for ReceptionDashboard as PremiumClock handles display
        // and fetchRecentCheckIns etc are triggered below.
        fetchRecentCheckIns();
        fetchCoachesStatus();
        fetchPtStatus(); // Fetch PTs

        // Realtime Subscription for Student Attendance
        const studentAttendanceSub = supabase
            .channel('public:student_attendance')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'student_attendance' }, () => {
                fetchRecentCheckIns();
                fetchTodaysClasses(); // Auto refresh class list on changes
            })
            .subscribe();

        // Realtime Subscription for Coach Attendance
        const coachAttendanceSub = supabase
            .channel('public:coach_attendance')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'coach_attendance' }, () => {
                fetchCoachesStatus();
            })
            .subscribe();

        // Realtime Subscription for PT Sessions
        const ptSessionsSub = supabase
            .channel('public:pt_sessions')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'pt_sessions' }, () => {
                fetchPtStatus();
            })
            .subscribe();

        // Realtime Subscription for PT Subscriptions
        const ptSubscriptionsSub = supabase
            .channel('public:pt_subscriptions')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'pt_subscriptions' }, () => {
                fetchPtStatus();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(studentAttendanceSub);
            supabase.removeChannel(coachAttendanceSub);
            supabase.removeChannel(ptSessionsSub);
            supabase.removeChannel(ptSubscriptionsSub);
        };
    }, []);

    // --- Class Attendance Logic ---
    const fetchTodaysClasses = async () => {
        try {
            if (todaysClasses.length === 0) setLoadingClasses(true);
            const todayIdx = new Date().getDay(); // 0 = Sunday, 6 = Saturday
            const dayMap = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
            const todayDay = dayMap[todayIdx];
            const dateStr = format(new Date(), 'yyyy-MM-dd');

            console.log('Fetching classes for:', todayDay);

            // 1. Fetch Students scheduled for today
            const { data: students, error: studentsError } = await supabase
                .from('students')
                .select('id, full_name, training_schedule, training_days, training_type, coaches(full_name)')
                .contains('training_days', [todayDay]);

            if (studentsError) {
                console.error('Error fetching students:', studentsError);
                return;
            }

            // 2. Fetch Attendance for today
            const { data: attendance, error: attendanceError } = await supabase
                .from('student_attendance')
                .select('*')
                .eq('date', dateStr);

            if (attendanceError) {
                console.error('Error fetching attendance:', attendanceError);
            }

            // 3. Merge and Filter (Exclude PT-only students from the Gymnast List)
            const merged = (students || [])
                .filter(student => {
                    const type = student.training_type?.toLowerCase() || '';
                    return !type.includes('pt') && !type.includes('personal training');
                })
                .map(student => {
                    const record = attendance?.find(a => a.student_id === student.id);
                    const todaySchedule = student.training_schedule?.find((s: any) => s.day === todayDay);

                    let status = 'pending';
                    if (record) {
                        if (record.status === 'absent') status = 'absent';
                        else if (record.check_out_time) status = 'completed';
                        else status = 'present';
                    }

                    return {
                        ...student,
                        scheduledStart: todaySchedule?.start || '',
                        scheduledEnd: todaySchedule?.end || '',
                        attendanceId: record?.id,
                        status: status,
                        note: record?.note || '',
                        checkInTime: record?.check_in_time,
                        checkOutTime: record?.check_out_time
                    };
                }).sort((a, b) => {
                    if (a.scheduledStart !== b.scheduledStart) return a.scheduledStart.localeCompare(b.scheduledStart);
                    return a.full_name.localeCompare(b.full_name);
                });

            console.log('Classes Merged:', merged);
            setTodaysClasses(merged);
        } catch (error) {
            console.error('Error fetching classes:', error);
        } finally {
            setLoadingClasses(false);
        }
    };

    useEffect(() => {
        fetchTodaysClasses();
        const interval = setInterval(fetchTodaysClasses, 60000);
        return () => clearInterval(interval);
    }, [refreshTrigger]);

    // Timer Logic for Self Check-In
    useEffect(() => {
        let interval: any;
        if (isCheckedIn) {
            interval = setInterval(() => {
                const today = format(new Date(), 'yyyy-MM-dd');
                const startTime = localStorage.getItem(`receptionCheckInStart_${today}`);
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

    // --- Data Fetching ---
    const fetchRecentCheckIns = async () => {
        try {
            const today = format(new Date(), 'yyyy-MM-dd');
            const { data } = await supabase
                .from('student_attendance')
                .select('*, students!inner(full_name)')
                .eq('date', today)
                .order('check_in_time', { ascending: false })
                .limit(20);

            setRecentCheckIns(data || []);
        } catch (error) {
            console.error('Error fetching recent check-ins:', error);
        }
    };

    const fetchCoachesStatus = async () => {
        try {
            if (coachesList.length === 0) setLoadingCoaches(true);
            const today = format(new Date(), 'yyyy-MM-dd');

            // 1. Get all coaches
            const { data: coaches, error: coachesError } = await supabase
                .from('coaches')
                .select('id, full_name, avatar_url, role')
                .order('full_name');

            if (coachesError) throw coachesError;
            if (!coaches) return;

            // 2. Get today's attendance
            const { data: attendance, error: attendanceError } = await supabase
                .from('coach_attendance')
                .select('*')
                .eq('date', today);

            if (attendanceError) throw attendanceError;

            // 3. Merge data
            // Use refs to avoid stale closures
            const currentMyCoachId = myCoachIdRef.current;
            const currentIsCheckedIn = isCheckedInRef.current;

            const merged = (coaches || [])
                .filter(coach => {
                    // Filter out non-coaching roles for Head Coach
                    if (contextRole === 'head_coach') {
                        const coachRole = coach.role?.toLowerCase().trim();
                        return coachRole !== 'reception' && coachRole !== 'receptionist' && coachRole !== 'cleaner';
                    }
                    return true;
                })
                .map(coach => {
                    const record = attendance?.find(a => a.coach_id === coach.id);

                    let status = 'pending';
                    let checkIn = record?.check_in_time;
                    const checkOut = record?.check_out_time;

                    if (record) {
                        if (record.status === 'absent') status = 'absent';
                        else if (record.check_out_time) status = 'completed';
                        else status = 'present';
                    }

                    // FORCE LOCAL STATE for current user to prevent flickering
                    if (coach.id === currentMyCoachId && currentIsCheckedIn) {
                        status = 'present';
                        if (!checkIn) checkIn = new Date().toISOString(); // Fallback if record not found yet
                    }

                    return {
                        ...coach,
                        status: status,
                        note: record?.note || '',
                        checkInTime: checkIn,
                        checkOutTime: checkOut,
                        attendanceId: record?.id
                    };
                });

            setCoachesList(merged);
        } catch (error) {
            console.error('Error fetching coaches status:', error);
            // Don't toast here to avoid spamming the user if it loops
        } finally {
            setLoadingCoaches(false);
        }
    };


    // --- Actions ---
    const fetchPtStatus = async () => {
        try {
            if (ptList.length === 0) setLoadingPt(true);
            const today = format(new Date(), 'yyyy-MM-dd');

            // 1. Get Subscriptions (Include expired to keep them visible if they attended today)
            const { data: subs, error: subsError } = await supabase
                .from('pt_subscriptions')
                .select('*, students(full_name), coaches(full_name)');

            if (subsError) throw subsError;
            if (!subs) return;

            // 2. Get Today's PT Sessions
            const { data: sessions, error: sessionsError } = await supabase
                .from('pt_sessions')
                .select('*')
                .eq('date', today);

            if (sessionsError) throw sessionsError;

            // 3. Merge & Filter
            // We only show students who have sessions remaining OR who have already attended today
            const merged = subs.filter(sub => {
                const studentData = Array.isArray(sub.students) ? sub.students[0] : sub.students;
                const currentName = studentData?.full_name || sub.student_name;
                const hasSessionToday = sessions?.some(s => s.student_name === currentName && s.coach_id === sub.coach_id);
                return sub.sessions_remaining > 0 || hasSessionToday;
            }).map(sub => {
                const studentData = Array.isArray(sub.students) ? sub.students[0] : sub.students;
                const currentName = studentData?.full_name || sub.student_name;
                const sessionRecord = sessions?.find(s => s.student_name === currentName && s.coach_id === sub.coach_id);

                let status = 'pending';
                if (sessionRecord) {
                    status = 'present';
                }

                return {
                    ...sub,
                    displayName: currentName,
                    status,
                    sessionId: sessionRecord?.id,
                    checkInTime: sessionRecord?.created_at,
                    note: '',
                    coachName: sub.coaches?.full_name
                };
            }).sort((a, b) => {
                if (a.status === 'present' && b.status !== 'present') return -1;
                if (a.status !== 'present' && b.status === 'present') return 1;
                return (a.displayName || '').localeCompare(b.displayName || '');
            });

            setPtList(merged);
        } catch (error) {
            console.error('Error fetching PT status:', error);
        } finally {
            setLoadingPt(false);
        }
    };

    const handlePtStatusUpdate = async (subscriptionId: string, currentSessionsRemaining: number, newStatus: 'present' | 'absent' | 'completed' | 'pending') => {
        try {
            const today = format(new Date(), 'yyyy-MM-dd');

            // Find subscription to verify
            const { data: sub } = await supabase
                .from('pt_subscriptions')
                .select('sessions_remaining, coach_id, student_name, students(full_name)')
                .eq('id', subscriptionId)
                .single();

            if (!sub) return toast.error('Subscription not found');

            // Logic for Check In (Present)
            if (newStatus === 'present') {
                if (sub.sessions_remaining <= 0) {
                    return toast.error('No sessions remaining!');
                }

                const studentData = Array.isArray(sub.students) ? sub.students[0] : sub.students;
                const displayName = studentData?.full_name || sub.student_name;

                // 1. Create PT Session Record
                const { error: sessionError } = await supabase
                    .from('pt_sessions')
                    .insert({
                        coach_id: sub.coach_id,
                        subscription_id: subscriptionId,
                        date: today,
                        sessions_count: 1,
                        student_name: displayName
                    });

                if (sessionError) throw sessionError;

                // 2. Deduct Session
                const { error: subError } = await supabase
                    .from('pt_subscriptions')
                    .update({
                        sessions_remaining: sub.sessions_remaining - 1,
                        status: sub.sessions_remaining - 1 === 0 ? 'expired' : 'active'
                    })
                    .eq('id', subscriptionId);

                if (subError) throw subError;
                toast.success('PT Session Recorded');
            } else if (newStatus === 'pending') {
                // --- RESET LOGIC ---
                const studentData = Array.isArray(sub.students) ? sub.students[0] : sub.students;
                const displayName = studentData?.full_name || sub.student_name;

                // 1. Delete today's session
                const { error: deleteError } = await supabase
                    .from('pt_sessions')
                    .delete()
                    .eq('coach_id', sub.coach_id)
                    .eq('date', today)
                    .eq('student_name', displayName);

                if (deleteError) throw deleteError;

                // 2. Increment Session Back
                const { error: subError } = await supabase
                    .from('pt_subscriptions')
                    .update({
                        sessions_remaining: sub.sessions_remaining + 1,
                        status: 'active'
                    })
                    .eq('id', subscriptionId);

                if (subError) throw subError;
                toast.success('Attendance Reset & Session Refunded');
            }

            fetchPtStatus();
            // Refresh dashboard stats or other queries if needed
        } catch (error) {
            console.error('PT Status Switch Error:', error);
            toast.error(t('common.error'));
        }
    };

    // --- Actions ---
    const handleStatusUpdate = async (studentId: string, newStatus: 'present' | 'absent' | 'completed') => {
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
                // Only set check_in_time if not already set or switching from absent
                if (!existing || !existing.check_in_time) {
                    payload.check_in_time = new Date().toISOString();
                }
                // Reset check_out_time if we mark as present (re-opening session)
                payload.check_out_time = null;
            } else if (newStatus === 'completed') {
                payload.check_out_time = new Date().toISOString();
            } else {
                // Absent
                payload.check_in_time = null;
                payload.check_out_time = null;
            }

            if (existing) {
                const { error } = await supabase
                    .from('student_attendance')
                    .update(payload)
                    .eq('id', existing.id);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('student_attendance')
                    .insert(payload);
                if (error) throw error;
            }

            toast.success(newStatus === 'present' ? 'Marked as Present' : newStatus === 'completed' ? 'Session Completed' : 'Marked as Absent');

            // Notification: Student Attendance (Admin + Head Coach + Reception)
            if (newStatus === 'present' || newStatus === 'completed') {
                const studentName = todaysClasses.find(s => s.id === studentId)?.full_name || 'Student';
                const action = newStatus === 'present' ? 'Checked In' : 'Checked Out';

                await supabase.from('notifications').insert({
                    type: 'attendance',
                    title: `Student ${action}`,
                    message: `${studentName} has ${action.toLowerCase()}.`,
                    target_role: 'admin_head_reception',
                    is_read: false
                });
            }

            fetchRecentCheckIns();
            fetchTodaysClasses();
        } catch (error) {
            console.error('Status update error:', error);
            toast.error(t('common.error') || 'An error occurred');
        }
    };





    const handleStaffStatusUpdate = async (coachId: string, newStatus: 'present' | 'absent') => {
        try {
            const today = format(new Date(), 'yyyy-MM-dd');

            // Check existing
            const { data: existing } = await supabase
                .from('coach_attendance')
                .select('*')
                .eq('coach_id', coachId)
                .eq('date', today)
                .maybeSingle();

            // If we are resetting an 'absent' coach
            if (newStatus === 'present' && existing?.status === 'absent') {
                const { error } = await supabase
                    .from('coach_attendance')
                    .delete()
                    .eq('id', existing.id);
                if (error) throw error;
                toast.success('Status reset to pending');
            } else if (newStatus === 'absent') {
                const payload = {
                    coach_id: coachId,
                    date: today,
                    status: 'absent',
                    check_in_time: null,
                    check_out_time: null
                };

                if (existing) {
                    const { error } = await supabase
                        .from('coach_attendance')
                        .update(payload)
                        .eq('id', existing.id);
                    if (error) throw error;
                } else {
                    const { error } = await supabase
                        .from('coach_attendance')
                        .insert(payload);
                    if (error) throw error;
                }
                toast.success('Marked as Absent');
            }

            // Notification: Staff Attendance (Admin + Head Coach + Reception)
            if (newStatus === 'present' || newStatus === 'absent') {
                const coachName = coachesList.find(c => c.id === coachId)?.full_name || 'Staff Member';
                const action = newStatus === 'present' ? 'Checked In' : 'Marked Absent';

                await supabase.from('notifications').insert({
                    type: 'attendance',
                    title: `Staff ${action}`,
                    message: `${coachName} has been ${action.toLowerCase()}.`,
                    target_role: 'admin_head_reception',
                    is_read: false
                });
            }

            fetchCoachesStatus();
        } catch (error) {
            console.error('Staff status error:', error);
            toast.error(t('common.error') || 'An error occurred');
        }
    };



    // --- Self Check-In Handlers ---
    const handleSelfCheckIn = async () => {
        if (!myCoachId) return toast.error('You are not linked to a staff profile');
        const now = new Date();
        const todayStr = format(now, 'yyyy-MM-dd');

        try {
            const { data, error } = await supabase
                .from('coach_attendance')
                .upsert({
                    coach_id: myCoachId,
                    date: todayStr,
                    check_in_time: now.toISOString(),
                    check_out_time: null, // CRITICAL: Explicitly clear checkout time if re-checking in
                    status: 'present'
                }, { onConflict: 'coach_id,date' })
                .select().single();

            if (error) {
                console.error('Self check-in Supabase error:', error);
                throw error;
            }

            setIsCheckedIn(true);
            setCheckInTime(format(now, 'HH:mm:ss'));
            localStorage.setItem(`receptionCheckInStart_${todayStr}`, JSON.stringify({ timestamp: now.getTime(), recordId: data.id }));

            // Optimistic Update
            console.log('Optimistic Update Triggered for:', myCoachId);
            setCoachesList(prev => prev.map(c => {
                if (c.id === myCoachId) {
                    console.log('Found coach in list, updating status to present');
                    return { ...c, status: 'present', checkInTime: now.toISOString() };
                }
                return c;
            }));

            toast.success('You are Checked In!');

            // Notification: Self Check-In (Admin + Head Coach + Reception)
            await supabase.from('notifications').insert({
                type: 'attendance',
                title: 'Staff Checked In',
                message: `A staff member has checked in.`, // Ideally we'd have the name, but myCoachId is just ID.
                target_role: 'admin_head_reception',
                is_read: false
            });

            // Re-fetch after a short delay to ensure DB propagation
            setTimeout(() => {
                console.log('Delayed fetch triggered');
                fetchCoachesStatus();
            }, 1000);
        } catch (error: any) {
            console.error('Full Self check-in error:', error);
            toast.error(error.message || 'Check-in failed');
        }
    };

    const handleSelfCheckOut = async () => {
        if (!myCoachId) return;
        const now = new Date();
        const today = format(now, 'yyyy-MM-dd');
        const savedStart = localStorage.getItem(`receptionCheckInStart_${today}`);

        try {
            if (savedStart) {
                const { recordId } = JSON.parse(savedStart);
                await supabase.from('coach_attendance')
                    .update({ check_out_time: now.toISOString(), status: 'completed' }) // Or keep as present? completed implies done for day
                    .eq('id', recordId);
            } else {
                // Fallback if local storage missing, try to find active record
                const { data: record } = await supabase.from('coach_attendance')
                    .select('id')
                    .eq('coach_id', myCoachId)
                    .eq('date', today)
                    .is('check_out_time', null)
                    .maybeSingle();

                if (record) {
                    await supabase.from('coach_attendance')
                        .update({ check_out_time: now.toISOString(), status: 'completed' })
                        .eq('id', record.id);
                }
            }

            setIsCheckedIn(false);
            setCheckInTime(null);
            setElapsedTime(0);
            localStorage.removeItem(`receptionCheckInStart_${today}`);

            // Optimistic Update
            console.log('Optimistic Update Triggered (Check-out) for:', myCoachId);
            setCoachesList(prev => prev.map(c => {
                if (c.id === myCoachId) {
                    return { ...c, status: 'completed', checkOutTime: now.toISOString() };
                }
                return c;
            }));

            toast.success('You are Checked Out!');

            // Notification: Self Check-Out (Admin + Head Coach + Reception)
            await supabase.from('notifications').insert({
                type: 'attendance',
                title: 'Staff Checked Out',
                message: `A staff member has checked out.`,
                target_role: 'admin_head_reception',
                is_read: false
            });
            setTimeout(() => {
                fetchCoachesStatus();
            }, 1000);
        } catch (error: any) {
            console.error('Full Self check-out error:', error);
            toast.error('Check-out failed');
        }
    };

    const formatTimer = (seconds: number) => {
        if (isNaN(seconds) || seconds < 0) return '00:00:00';
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Premium Header Architecture */}
            <div className="relative overflow-hidden group">
                {/* Background Accent Glow - Hidden on mobile for performance */}
                <div className="absolute -top-24 -left-24 w-64 h-64 bg-primary/10 blur-[80px] rounded-full pointer-events-none group-hover:bg-primary/20 transition-all duration-1000 hidden md:block"></div>

                <div className="glass-card rounded-[2rem] border border-white/10 p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
                    <div className="space-y-4 flex-1">
                        <div>
                            <div className="flex items-center gap-3 mb-1.5">
                                <div className="w-1.5 h-6 bg-primary rounded-full shadow-[0_0_15px_rgba(var(--primary-rgb),0.5)]"></div>
                                <h1 className="text-2xl sm:text-3xl font-black premium-gradient-text uppercase tracking-tighter leading-none">
                                    {t('dashboard.welcome') || 'WELCOME BACK'}, {userProfile?.full_name || contextRole?.replace('_', ' ') || 'Staff Member'}
                                </h1>
                            </div>
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                                <p className="text-white/40 text-[9px] sm:text-[10px] font-black uppercase tracking-[0.3em] flex items-center gap-1.5">
                                    <Calendar className="w-3 h-3 text-primary" />
                                    {format(new Date(), 'EEEE, dd MMMM yyyy')}
                                </p>
                                {settings.clock_position === 'dashboard' && (
                                    <PremiumClock className="!bg-white/[0.03] !border-white/10 !rounded-full !shadow-lg backdrop-blur-xl ml-2" />
                                )}
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-6 pt-2 border-t border-white/5">
                            <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center font-black text-primary text-lg shadow-inner">
                                    {contextRole?.[0]?.toUpperCase() || 'S'}
                                </div>
                                <div>
                                    <p className="text-[8px] font-black text-white/20 uppercase tracking-widest leading-none mb-0.5">{t('common.role') || 'Role'}</p>
                                    <p className="text-xs font-black text-white uppercase tracking-tight leading-none">{contextRole?.replace('_', ' ') || 'Staff Member'}</p>
                                </div>
                            </div>

                            {(contextRole === 'admin' || contextRole === 'reception') && (
                                <a
                                    href="/registration"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="group/btn flex items-center gap-2.5 px-4 py-2 rounded-xl bg-emerald-500/5 hover:bg-emerald-500/10 border border-emerald-500/10 hover:border-emerald-500/30 transition-all duration-300 shadow-xl shadow-emerald-500/5"
                                >
                                    <div className="w-6 h-6 rounded-md bg-emerald-500/20 flex items-center justify-center group-hover/btn:scale-110 transition-transform">
                                        <UserPlus className="w-3 h-3 text-emerald-400" />
                                    </div>
                                    <div className="text-left">
                                        <p className="text-[8px] font-black text-emerald-400/50 uppercase tracking-widest leading-none mb-0.5">{t('common.registrationPage') || 'Registration'}</p>
                                        <p className="text-[10px] font-black text-white uppercase tracking-tight flex items-center gap-0.5 leading-none">
                                            Open Portal <ArrowUpRight className="w-2.5 h-2.5 opacity-40 group-hover/btn:opacity-100 transition-all" />
                                        </p>
                                    </div>
                                </a>
                            )}
                        </div>
                    </div>

                    {/* Ultra-Chic Duty Control Center */}
                    {myCoachId && (
                        <div className="relative group/duty lg:ml-auto">
                            <div className={`relative flex items-center gap-2.5 p-1.5 pr-3 rounded-2xl border transition-all duration-500 shadow-lg
                                ${isCheckedIn
                                    ? 'bg-emerald-500/5 border-emerald-500/10'
                                    : 'bg-white/[0.02] border-white/5'}`}>

                                <button
                                    onClick={isCheckedIn ? handleSelfCheckOut : handleSelfCheckIn}
                                    className={`relative w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-500 hover:scale-105 active:scale-95
                                        ${isCheckedIn
                                            ? 'bg-rose-500 text-white shadow-md shadow-rose-500/20'
                                            : 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20'}`}
                                >
                                    {isCheckedIn ? <XCircle className="w-4.5 h-4.5" /> : <Clock className="w-4.5 h-4.5" />}
                                </button>

                                <div className="space-y-0 min-w-[70px]">
                                    <span className="text-[6px] font-black text-white/20 uppercase tracking-[0.2em] block leading-none mb-0.5">Status</span>
                                    {isCheckedIn ? (
                                        <div className="space-y-0">
                                            <div className="text-base font-black text-white font-mono tracking-tighter tabular-nums leading-none">
                                                {formatTimer(elapsedTime)}
                                            </div>
                                            <div className="text-emerald-400/60 text-[6px] font-black uppercase tracking-widest leading-none mt-0.5">
                                                ACTIVE
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="space-y-0">
                                            <div className="text-xs font-black text-white/20 uppercase tracking-tighter leading-none">Offline</div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Personal Earnings Widget */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="glass-card p-6 rounded-2xl border border-white/10 shadow-premium relative overflow-hidden group">
                    <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-amber-500/5 rounded-full blur-3xl transition-all duration-700"></div>
                    <div className="flex items-center justify-between mb-3 relative z-10">
                        <div>
                            <h2 className="text-base font-black text-white uppercase tracking-tight">Personal Earnings</h2>
                            <p className="text-[8px] font-black text-white/40 uppercase tracking-[0.2em] mt-0.5">Salary {contextRole !== 'reception' && '+ PT Month'}</p>
                        </div>
                        <div className="p-2.5 bg-amber-500/20 rounded-xl text-amber-500">
                            <Wallet className="w-4 h-4" />
                        </div>
                    </div>
                    <div className="flex-1 flex flex-col justify-center items-center py-2 relative z-10">
                        {loadingEarnings ? (
                            <div className="w-6 h-6 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
                        ) : (
                            <>
                                <div className="flex items-baseline gap-1.5">
                                    <h3 className="text-3xl font-black text-amber-500 tracking-tighter">{(salary + totalEarnings).toLocaleString()}</h3>
                                    <span className="text-[10px] font-black text-white/20 uppercase tracking-widest">{currency.code || 'KWD'}</span>
                                </div>
                                {contextRole !== 'reception' && (
                                    <div className="flex gap-4 mt-3">
                                        <div className="text-center">
                                            <p className="text-[7px] font-black text-white/30 uppercase tracking-widest mb-0.5">Base</p>
                                            <p className="text-[10px] font-bold text-white/60">{salary.toLocaleString()} {currency.code || 'KWD'}</p>
                                        </div>
                                        <div className="w-px h-5 bg-white/10"></div>
                                        <div className="text-center">
                                            <p className="text-[7px] font-black text-white/30 uppercase tracking-widest mb-0.5">PT</p>
                                            <p className="text-[10px] font-bold text-white/60">{totalEarnings.toLocaleString()} {currency.code || 'KWD'}</p>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Quick Actions */}
            {/* Quick Actions */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <button
                    onClick={() => setShowAddStudent(true)}
                    className="glass-card p-5 rounded-2xl border border-white/10 hover:border-primary/50 group transition-all text-left relative overflow-hidden"
                >
                    <div className="absolute right-0 top-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                        <UserPlus className="w-16 h-16 text-primary" />
                    </div>
                    <div className="relative z-10 flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-primary/20 text-primary flex items-center justify-center group-hover:scale-110 transition-transform">
                            <UserPlus className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-sm font-black text-white uppercase tracking-tight mb-0.5">
                                {t('students.addStudent') || 'Add Student'}
                            </h3>
                            <p className="text-[10px] text-white/50 font-bold uppercase tracking-wider">
                                Register new gymnast
                            </p>
                        </div>
                    </div>
                </button>

                <button
                    onClick={() => setShowAddPT(true)}
                    className="glass-card p-5 rounded-2xl border border-white/10 hover:border-accent/50 group transition-all text-left relative overflow-hidden"
                >
                    <div className="absolute right-0 top-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                        <Dumbbell className="w-16 h-16 text-accent" />
                    </div>
                    <div className="relative z-10 flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-accent/20 text-accent flex items-center justify-center group-hover:scale-110 transition-transform">
                            <Dumbbell className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-sm font-black text-white uppercase tracking-tight mb-0.5">
                                {t('students.addSubscription') || 'Add Subscription'}
                            </h3>
                            <p className="text-[10px] text-white/50 font-bold uppercase tracking-wider">
                                New Private Training
                            </p>
                        </div>
                    </div>
                </button>

                <button
                    onClick={() => navigate('/schedule')}
                    className="glass-card p-5 rounded-2xl border border-white/10 hover:border-purple-500/50 group transition-all text-left relative overflow-hidden"
                >
                    <div className="absolute right-0 top-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                        <Calendar className="w-16 h-16 text-purple-500" />
                    </div>
                    <div className="relative z-10 flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <Calendar className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-sm font-black text-white uppercase tracking-tight mb-0.5">
                                {t('common.schedule') || 'View Schedule'}
                            </h3>
                            <p className="text-[10px] text-white/50 font-bold uppercase tracking-wider">
                                Check classes timing
                            </p>
                        </div>
                    </div>
                </button>
            </div>

            {/* Dashboard Summary Widgets */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                {/* Student Attendance Widget */}
                <div
                    onClick={() => navigate('/attendance/students')}
                    className="glass-card p-6 rounded-2xl border border-white/10 hover:border-primary/50 cursor-pointer group relative overflow-hidden transition-all duration-300"
                >
                    <div className="absolute right-0 top-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                        <Users className="w-24 h-24 text-primary" />
                    </div>
                    <div className="relative z-10 flex flex-col justify-between h-full space-y-4">
                        <div className="flex items-start justify-between">
                            <div className="w-12 h-12 rounded-xl bg-primary/20 text-primary flex items-center justify-center group-hover:scale-110 transition-transform">
                                <Users className="w-6 h-6" />
                            </div>
                            <div className="px-3 py-1 bg-white/5 rounded-lg border border-white/5">
                                <span className="text-xs font-bold text-white/60">
                                    {todaysClasses.length} Scheduled
                                </span>
                            </div>
                        </div>
                        <div>
                            <h2 className="text-3xl font-black text-white tracking-tighter">
                                {todaysClasses.filter(c => c.status === 'present' || c.status === 'completed').length}
                                <span className="text-lg text-white/30 ml-2 font-bold uppercase">/ {todaysClasses.length}</span>
                            </h2>
                            <p className="text-xs font-bold text-primary uppercase tracking-wider mt-1">Gymnast Attendance</p>
                        </div>
                        <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
                            <div
                                className="h-full bg-primary transition-all duration-500"
                                style={{ width: `${todaysClasses.length > 0 ? (todaysClasses.filter(c => c.status === 'present' || c.status === 'completed').length / todaysClasses.length) * 100 : 0}%` }}
                            />
                        </div>
                    </div>
                </div>

                {/* Staff Attendance Widget */}
                <div
                    onClick={() => navigate('/attendance/staff')}
                    className="glass-card p-6 rounded-2xl border border-white/10 hover:border-emerald-500/50 cursor-pointer group relative overflow-hidden transition-all duration-300"
                >
                    <div className="absolute right-0 top-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                        <Users className="w-24 h-24 text-emerald-500" />
                    </div>
                    <div className="relative z-10 flex flex-col justify-between h-full space-y-4">
                        <div className="flex items-start justify-between">
                            <div className="w-12 h-12 rounded-xl bg-emerald-500/20 text-emerald-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                                <Users className="w-6 h-6" />
                            </div>
                            <div className="px-3 py-1 bg-white/5 rounded-lg border border-white/5">
                                <span className="text-xs font-bold text-white/60">
                                    {filteredCoaches.length} Staff
                                </span>
                            </div>
                        </div>
                        <div>
                            <h2 className="text-3xl font-black text-white tracking-tighter">
                                {filteredCoaches.filter(c => c.status === 'present').length}
                                <span className="text-lg text-white/30 ml-2 font-bold uppercase">Active</span>
                            </h2>
                            <p className="text-xs font-bold text-emerald-500 uppercase tracking-wider mt-1">Staff Attendance</p>
                        </div>
                        <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
                            <div
                                className="h-full bg-emerald-500 transition-all duration-500"
                                style={{ width: `${filteredCoaches.length > 0 ? (filteredCoaches.filter(c => c.status === 'present').length / filteredCoaches.length) * 100 : 0}%` }}
                            />
                        </div>
                    </div>
                </div>

                {/* PT Attendance Widget */}
                <div
                    onClick={() => navigate('/attendance/pt')}
                    className="glass-card p-6 rounded-2xl border border-white/10 hover:border-accent/50 cursor-pointer group relative overflow-hidden transition-all duration-300"
                >
                    <div className="absolute right-0 top-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                        <Dumbbell className="w-24 h-24 text-accent" />
                    </div>
                    <div className="relative z-10 flex flex-col justify-between h-full space-y-4">
                        <div className="flex items-start justify-between">
                            <div className="w-12 h-12 rounded-xl bg-accent/20 text-accent flex items-center justify-center group-hover:scale-110 transition-transform">
                                <Dumbbell className="w-6 h-6" />
                            </div>
                            <div className="px-3 py-1 bg-white/5 rounded-lg border border-white/5">
                                <span className="text-xs font-bold text-white/60">
                                    {filteredPT.length} Subs
                                </span>
                            </div>
                        </div>
                        <div>
                            <h2 className="text-3xl font-black text-white tracking-tighter">
                                {filteredPT.filter(s => s.status === 'present').length}
                                <span className="text-lg text-white/30 ml-2 font-bold uppercase">Active</span>
                            </h2>
                            <p className="text-xs font-bold text-accent uppercase tracking-wider mt-1">PT Sessions</p>
                        </div>
                        <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
                            <div
                                className="h-full bg-accent transition-all duration-500"
                                style={{ width: `${filteredPT.length > 0 ? (filteredPT.filter(s => s.status === 'present').length / filteredPT.length) * 100 : 0}%` }}
                            />
                        </div>
                    </div>
                </div>

            </div>
            {/* Modals */}
            {showAddStudent && (
                <AddStudentForm
                    onClose={() => setShowAddStudent(false)}
                    onSuccess={() => {
                        setShowAddStudent(false);
                        setRefreshTrigger(prev => prev + 1);
                        toast.success(t('reception.studentAdded') || 'Student added successfully');
                    }}
                />
            )}

            {showAddPT && (
                <AddPTSubscriptionForm
                    onClose={() => setShowAddPT(false)}
                    onSuccess={() => {
                        setShowAddPT(false);
                        toast.success(t('reception.subscriptionAdded'));
                    }}
                />
            )}


        </div>
    );
}



