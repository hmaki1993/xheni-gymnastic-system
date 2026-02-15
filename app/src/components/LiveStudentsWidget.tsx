import { useState, useEffect } from 'react';
import { Users, Activity, Clock } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { format, parseISO } from 'date-fns';
import { useTranslation } from 'react-i18next';

interface Student {
    id: string;
    full_name: string;
    coach_id?: string;
    training_groups?: { name: string };
}

interface Group {
    id: string;
    name: string;
    schedule_key: string;
    coaches?: { id: string, full_name: string };
    students: Student[];
}

interface AttendanceRecord {
    student_id: string;
    check_in_time: string;
    students?: {
        full_name: string;
        coach_id: string;
        training_groups: { name: string }[];
    };
}

export default function LiveStudentsWidget({ coachId }: { coachId?: string | null }) {
    const { t } = useTranslation();
    const [currentTime, setCurrentTime] = useState(new Date());
    const [activeGroups, setActiveGroups] = useState<Group[]>([]);
    const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchData = async () => {
        if (coachId === null) return; // Wait for coach ID if we're in coach mode

        const today = format(new Date(), 'yyyy-MM-dd');

        // 1. Fetch current check-ins (filtered strictly by coach if needed)
        let attendanceQuery = supabase
            .from('student_attendance')
            .select(`
                student_id, 
                check_in_time,
                students!inner (
                    full_name,
                    coach_id,
                    training_groups ( name )
                )
            `)
            .eq('date', today)
            .is('check_out_time', null);

        if (coachId) {
            attendanceQuery = attendanceQuery.eq('students.coach_id', coachId);
        }

        const { data: attendanceData } = await attendanceQuery;
        setAttendance((attendanceData as any[]) || []);

        // 2. Fetch groups with students
        let groupsQuery = supabase
            .from('training_groups')
            .select(`
                *,
                coaches(id, full_name, role),
                students!inner(id, full_name, coach_id)
            `);

        if (coachId) {
            groupsQuery = groupsQuery.eq('coach_id', coachId);
        }

        const { data: groupsData } = await groupsQuery;

        if (groupsData) {
            const currentDay = format(currentTime, 'eeee').toLowerCase(); // e.g. 'monday'
            const timeStr = format(currentTime, 'HH:mm');

            const active = (groupsData as any[]).filter((group) => {
                // Filter out non-coaching roles
                const coachRole = group.coaches?.role?.toLowerCase().trim();
                if (coachRole === 'reception' || coachRole === 'receptionist' || coachRole === 'cleaner') return false;

                if (!group.schedule_key) return false;
                const sessions = group.schedule_key.split('|');
                return sessions.some((s: string) => {
                    const parts = s.split(':');
                    if (parts.length < 3) return false;

                    // Robust day matching (supports 'mon', 'monday', etc)
                    const dayTag = parts[0].toLowerCase();
                    if (!currentDay.startsWith(dayTag) && !dayTag.startsWith(currentDay.substring(0, 3))) return false;

                    const startTime = `${parts[1]}:${parts[2]}`;
                    // Default to 1 hour if no end time in key
                    let endTime = parts.length >= 5 ? `${parts[3]}:${parts[4]}` : `${(parseInt(parts[1]) + 1).toString().padStart(2, '0')}:${parts[2]}`;

                    return timeStr >= startTime && timeStr <= endTime;
                });
            });

            setActiveGroups(active);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchData();

        const channel = supabase.channel('live_floor_updates')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'student_attendance' }, () => fetchData())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'training_groups' }, () => fetchData())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'students' }, () => fetchData())
            .subscribe();

        const timer = setInterval(() => setCurrentTime(new Date()), 60000);

        return () => {
            supabase.removeChannel(channel);
            clearInterval(timer);
        };
    }, [coachId]);

    // Re-check schedule when minute changes
    useEffect(() => {
        fetchData();
    }, [currentTime.getMinutes()]);

    const otherCheckedIn = attendance.filter(record =>
        !activeGroups.some(group => group.students.some(s => s.id === record.student_id))
    );

    const presentInActiveGroupsCount = activeGroups.reduce((acc, g) =>
        acc + g.students.filter(s => attendance.some(a => a.student_id === s.id)).length, 0
    );

    return (
        <div className="glass-card p-8 rounded-[2.5rem] border border-white/10 shadow-premium relative overflow-hidden flex flex-col h-full bg-[#122E34]/30 backdrop-blur-3xl">
            <div className="flex items-center justify-between mb-8 relative z-10">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center text-emerald-500 relative shrink-0 border border-emerald-500/20 shadow-[0_0_20px_rgba(16,185,129,0.1)]">
                        <Activity className="w-6 h-6 relative z-10" />
                        <div className="absolute inset-0 bg-emerald-500/20 blur-2xl rounded-full animate-pulse"></div>
                    </div>
                    <div className="min-w-0">
                        <h2 className="text-2xl font-black text-white uppercase tracking-tighter flex items-center gap-2 leading-none">
                            {t('dashboard.liveFloor', 'Live Floor')}
                            <span className="flex h-2 w-2 relative shrink-0">
                                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75 ${activeGroups.length === 0 ? 'hidden' : ''}`}></span>
                                <span className={`relative inline-flex rounded-full h-2 w-2 ${activeGroups.length === 0 ? 'bg-white/20' : 'bg-emerald-500'}`}></span>
                            </span>
                        </h2>
                        <p className="text-[11px] font-black text-white/40 uppercase tracking-[0.2em] mt-1.5 truncate">
                            {presentInActiveGroupsCount} {t('dashboard.gymnastsOnFloor', 'Gymnasts')}
                        </p>
                    </div>
                </div>

            </div>

            {/* List of Active Groups */}
            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-6 pr-2 relative z-10 min-h-[300px]">
                {loading ? (
                    <div className="flex flex-col items-center justify-center h-full gap-4 opacity-50">
                        <div className="w-10 h-10 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin"></div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-white/40">Syncing Live Floor...</span>
                    </div>
                ) : activeGroups.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center py-20 grayscale opacity-40">
                        <div className="w-20 h-20 bg-white/5 rounded-3xl flex items-center justify-center mb-6 border border-white/10">
                            <Users className="w-10 h-10 text-white" />
                        </div>
                        <p className="text-white font-black uppercase tracking-widest text-xs">{t('dashboard.noSessionsNow', 'No active sessions now')}</p>
                    </div>
                ) : (
                    <>
                        {/* Active Sessions */}
                        {activeGroups.map((group) => (
                            <div key={group.id} className="group/card relative">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-1.5 h-6 bg-emerald-500 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.5)]"></div>
                                        <div>
                                            <h3 className="font-black text-white uppercase tracking-tight text-sm">
                                                {group.name}
                                            </h3>
                                            <p className="text-[9px] font-black text-white/30 uppercase tracking-widest">
                                                Coach {group.coaches?.full_name?.split(' ')[0] || 'Unknown'}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end gap-1">
                                        <span className="text-[9px] font-mono font-bold text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                                            {t('dashboard.activeNow', 'Active Now')}
                                        </span>
                                        <span className="text-[8px] font-black text-white/20 uppercase tracking-tighter">
                                            {group.students.filter(s => attendance.some(a => a.student_id === s.id)).length}/{group.students.length} Present
                                        </span>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 gap-2 pl-4 border-l border-white/5 ml-0.5">
                                    {group.students?.sort((a, b) => {
                                        const aP = attendance.some(att => att.student_id === a.id);
                                        const bP = attendance.some(att => att.student_id === b.id);
                                        return (aP === bP) ? 0 : aP ? -1 : 1;
                                    }).map((student) => {
                                        const record = attendance.find(a => a.student_id === student.id);
                                        const isPresent = !!record;

                                        return (
                                            <div key={student.id} className={`flex items-center justify-between p-3 rounded-2xl transition-all duration-300 border ${isPresent ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-white/[0.02] border-white/5 opacity-60'}`}>
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs ${isPresent ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/5 text-white/20'}`}>
                                                        {student.full_name?.charAt(0) || '?'}
                                                    </div>
                                                    <div>
                                                        <p className={`text-xs font-bold leading-none ${isPresent ? 'text-white' : 'text-white/40'}`}>
                                                            {student.full_name}
                                                        </p>
                                                        {isPresent && record && (
                                                            <p className="text-[8px] font-mono font-bold text-emerald-400/60 mt-1 uppercase">
                                                                In at {record.check_in_time ? format(parseISO(record.check_in_time), 'hh:mm a') : '--:--'}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                                {isPresent ? (
                                                    <div className="flex h-2 w-2">
                                                        <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-emerald-400 opacity-75"></span>
                                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                                    </div>
                                                ) : (
                                                    <span className="text-[8px] font-black text-white/20 uppercase tracking-widest">{t('students.expected', 'Expected')}</span>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </>
                )}
            </div>

            {/* Decorative Background Effects */}
            <div className={`absolute -bottom-24 -left-24 w-80 h-80 rounded-full blur-[100px] pointer-events-none transition-opacity duration-1000 bg-emerald-500/5 opacity-50`}></div>
            <div className={`absolute -top-24 -right-24 w-80 h-80 rounded-full blur-[100px] pointer-events-none transition-opacity duration-1000 bg-emerald-400/5 opacity-30`}></div>
        </div >
    );
}

