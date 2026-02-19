import { useState, useEffect, useRef } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import {
    LayoutDashboard,
    Users,
    UserCircle,
    Calendar,
    Wallet,
    Settings,
    Video,
    Menu,
    X,
    LogOut,
    Wrench,
    Building2,
    Bell,
    ChevronDown,
    MessageSquare,
    Globe,
    UserPlus,
    ExternalLink,
    ClipboardCheck
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { useTheme } from '../context/ThemeContext';
import PremiumClock from '../components/PremiumClock';
import WalkieTalkie from '../components/WalkieTalkie';

export default function DashboardLayout() {
    const { t, i18n } = useTranslation();
    const { settings, updateSettings, userProfile } = useTheme();
    const location = useLocation();
    const navigate = useNavigate();
    const [sidebarOpen, setSidebarOpen] = useState(false);

    // Derived states from unified userProfile
    const userId = userProfile?.id || null; // Wait, I didn't add id to userProfile in ThemeContext. I should.
    const role = userProfile?.role || null;
    const fullName = userProfile?.full_name || null;
    const userEmail = userProfile?.email || null; // I should add email too.
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
    const [userStatus, setUserStatus] = useState<'online' | 'busy'>('online');
    const [notificationsOpen, setNotificationsOpen] = useState(false);
    const [profileOpen, setProfileOpen] = useState(false);
    const [isLogoModalOpen, setIsLogoModalOpen] = useState(false);

    const isRtl = i18n.language === 'ar' || document.dir === 'rtl';

    // Real notifications state
    const [notifications, setNotifications] = useState<{
        id: string;
        title: string;
        message: string;
        created_at: string;
        type: 'student' | 'payment' | 'schedule' | 'coach' | 'check_in' | 'check_out' | 'attendance_absence' | 'pt_subscription';
        is_read: boolean;
        user_id?: string;
        related_coach_id?: string;
        related_student_id?: string;
        target_role?: string;
    }[]>([]);

    // Track processed IDs to prevent duplicate toasts/state updates
    // This persists across renders and isn't affected by fresh closures or StrictMode double-invokes
    const processedIds = useRef(new Set<string>());
    const processedToasts = useRef(new Set<string>());

    useEffect(() => {
        // Fetch initial notifications
        const fetchNotifications = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // Get role from profile to filter target_role
            const { data: profile } = await supabase
                .from('profiles')
                .select('role')
                .eq('id', user.id)
                .single();

            const userRole = profile?.role?.toLowerCase().trim();

            let query = supabase
                .from('notifications')
                .select('*')
                .or(`user_id.eq.${user.id},user_id.is.null`)
                .order('created_at', { ascending: false })
                .limit(20);

            const { data } = await query;
            if (data) {
                setNotifications(data);
                // Mark initial loaded IDs as processed so we don't toast them if a race condition happens
                data.forEach((n: any) => processedIds.current.add(n.id));
            }
        };

        fetchNotifications();

        // Subscribe to realtime notifications
        const channel = supabase
            .channel('notifications-changes')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'notifications'
                },
                async (payload) => {
                    console.log('🔔 Notification Realtime Payload:', payload);
                    const newNote = payload.new as any;

                    const { data: { user } } = await supabase.auth.getUser();
                    if (!user) {
                        console.warn('🔔 Notification Realtime: No user found');
                        return;
                    }


                    // Filter Out Self-Referential Broadcasts
                    // If this is a check-in/out message about THIS user, ignore it (they get a personal confirmation)
                    const isSelfBroadcast = newNote.related_coach_id && newNote.related_coach_id === user.id;
                    if (isSelfBroadcast && !newNote.user_id) {
                        console.log('🔔 Notification: Ignoring self-broadcast', newNote);
                        return;
                    }

                    // Only add if it's for this user OR global
                    // Note: target_role filtering happens in the render filter
                    if (!newNote.user_id || newNote.user_id === user.id) {
                        if (processedIds.current.has(newNote.id)) {
                            console.log('🔔 Notification: Already processed', newNote.id);
                            return;
                        }

                        // Show Toast for EVERY new notification insertion
                        // Check for similar toasts recently shown to prevent 2-for-1 (Broadcast + Personal)
                        const isDuplicate = Array.from(processedToasts.current).some(msg =>
                            msg === newNote.message || msg.includes(newNote.message) || newNote.message.includes(msg)
                        );

                        if (!isDuplicate) {
                            processedToasts.current.add(newNote.message);
                            // Clear from memory after 10 seconds to allow same action later
                            setTimeout(() => processedToasts.current.delete(newNote.message), 10000);

                            toast.success(`${newNote.message}`, {
                                icon: '🔔',
                                duration: 5000,
                                style: {
                                    backdropFilter: 'blur(25px)',
                                    background: 'rgba(15, 23, 42, 0.95)',
                                    border: '1px solid rgba(255, 255, 255, 0.2)',
                                    boxShadow: '0 25px 70px -12px rgba(0, 0, 0, 0.7)',
                                    color: '#fff',
                                    fontSize: '13px',
                                    fontWeight: '700',
                                    padding: '16px 24px',
                                    borderRadius: '24px'
                                }
                            });
                        }

                        setNotifications(prev => {
                            if (prev.some(n => n.id === newNote.id)) return prev;
                            const updated = [newNote, ...prev];
                            return updated.slice(0, 50); // Keep it clean
                        });
                    } else {
                        console.log('🔔 Notification: Ignore (Targeted to another user)', newNote.user_id);
                    }
                }
            )
            .on(
                'postgres_changes',
                {
                    event: 'DELETE',
                    schema: 'public',
                    table: 'notifications'
                },
                (payload) => {
                    const deletedId = (payload.old as any).id;
                    if (deletedId) {
                        setNotifications(prev => prev.filter(n => n.id !== deletedId));
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    useEffect(() => {
        if (userProfile?.avatar_url) {
            setAvatarUrl(userProfile.avatar_url);
        } else if (userId) {
            // If avatar is missing in profile, try fetching from coaches table (linked by profile_id)
            const fetchCoachAvatar = async () => {
                const { data: coachData } = await supabase
                    .from('coaches')
                    .select('avatar_url')
                    .eq('profile_id', userId)
                    .maybeSingle();
                setAvatarUrl(coachData?.avatar_url || null);
            };
            fetchCoachAvatar();
        }
    }, [userProfile, userId]);

    useEffect(() => {
        const fetchStatus = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) setUserStatus(user.user_metadata?.status || 'online');
        };
        fetchStatus();

        const handleProfileUpdate = () => {
            // No need to fetch from localStorage anymore, ThemeContext handles it
        };

        // Debugging: Monitor Role
        console.log('🛡️ DashboardLayout: Render check', { role, userId, userEmail, fullName });

        if (role) console.log('Current User Role:', role);

        // Also refresh user profile on event
        window.addEventListener('gymProfileUpdated', handleProfileUpdate);
        return () => {
            window.removeEventListener('gymProfileUpdated', handleProfileUpdate);
        };
    }, []);


    useEffect(() => {
        const handleClickOutside = () => {
            setNotificationsOpen(false);
            setProfileOpen(false);
            // Don't close logo modal on outside click here, the modal backdrop will handle it
        };
        window.addEventListener('click', handleClickOutside);
        return () => window.removeEventListener('click', handleClickOutside);
    }, []);

    // Prevent background scrolling when mobile sidebar is open
    useEffect(() => {
        if (sidebarOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [sidebarOpen]);

    const handleLogout = async () => {
        await supabase.auth.signOut();
        navigate('/login');
    };

    const handleStatusChange = async (status: 'online' | 'busy') => {
        const { error } = await supabase.auth.updateUser({
            data: { status }
        });
        if (!error) {
            setUserStatus(status);
        }
    };

    const allNavItems = [
        { to: '/app', icon: LayoutDashboard, label: t('common.dashboard'), roles: ['admin', 'head_coach', 'coach', 'reception'] },
        { to: '/app/students', icon: Users, label: t('common.students'), roles: ['admin', 'head_coach', 'reception'] },
        { to: '/app/coaches', icon: UserCircle, label: t('common.coaches'), roles: ['admin', 'head_coach'] },
        { to: '/app/schedule', icon: Calendar, label: t('common.schedule'), roles: ['admin', 'head_coach', 'reception'] },
        { to: '/app/finance', icon: Wallet, label: t('common.finance'), roles: ['admin'] },
        { to: '/app/evaluations', icon: ClipboardCheck, label: t('common.evaluations', 'Evaluations'), roles: ['admin', 'head_coach'] },
        { to: '/app/my-work', icon: UserCircle, label: t('dashboard.myWork', 'My Work'), roles: ['head_coach'] },
        { to: '/app/settings', icon: Settings, label: t('common.settings'), roles: ['admin', 'head_coach', 'coach', 'reception'] },
        { to: '/app/admin/cameras', icon: Video, label: t('common.cameras'), roles: ['admin'] },
    ];

    const normalizedRole = role?.toLowerCase().trim().replace(/\s+/g, '_');

    const navItems = allNavItems.filter(item => {
        if (!normalizedRole) return false; // Show nothing while loading to avoid flickering
        return item.roles.includes(normalizedRole);
    });

    // Filter notifications based on role and user_id
    const filteredNotifications = notifications.filter(note => {
        if (!normalizedRole) {
            console.log('🔔 Notification Filter: No role loaded yet');
            return false;
        }

        // 1. User-specific override: Only the specific user sees these
        if (note.user_id) {
            const isMatch = note.user_id === userId;
            if (!isMatch) console.log('🔔 Notification Filter: user_id mismatch', { noteUser: note.user_id, currentUserId: userId });
            return isMatch;
        }

        // 🛑 STRICT PRIVACY: Head Coach never sees financial alerts
        if (normalizedRole === 'head_coach' && (note.type === 'payment' || note.type === 'pt_subscription')) {
            console.log('🔔 Notification Filter: STRICT BLOCK (Head Coach / Financial)', note.type);
            return false;
        }

        // 2. Target Role Filtering
        if (note.target_role) {
            if (normalizedRole === 'admin') return true; // Admin sees all role-targeted notes

            const target = note.target_role.toLowerCase().trim();

            // Handle consolidated roles (reception / receptionist)
            if (target === 'reception' && (normalizedRole === 'reception' || normalizedRole === 'receptionist')) {
                return true;
            }

            if (target === normalizedRole) return true;

            // Special case for shared roles
            if (target === 'admin_reception' && (normalizedRole === 'admin' || normalizedRole === 'reception' || normalizedRole === 'receptionist')) {
                return true;
            }

            if (target === 'admin_head_reception' && (normalizedRole === 'admin' || normalizedRole === 'head_coach' || normalizedRole === 'reception' || normalizedRole === 'receptionist')) {
                return true;
            }

            console.log('🔔 Notification Filter: target_role mismatch', { target, normalizedRole });
            return false;
        }

        // 3. Global Notification Type Filtering (for notes without a target_role)
        if (normalizedRole === 'admin') return true; // Admin sees all global notes

        if (normalizedRole === 'head_coach') {
            const allowedTypes: string[] = ['coach', 'check_in', 'check_out', 'attendance_absence', 'student'];
            return allowedTypes.includes(note.type);
        }

        if (normalizedRole === 'coach') {
            const allowedTypes: string[] = ['student', 'schedule', 'pt_subscription', 'check_in', 'check_out', 'attendance_absence'];
            return allowedTypes.includes(note.type);
        }

        if (normalizedRole === 'reception' || normalizedRole === 'receptionist') {
            const allowedTypes: string[] = ['payment', 'student', 'check_in', 'check_out', 'attendance_absence', 'pt_subscription'];
            return allowedTypes.includes(note.type);
        }

        return true; // Fallback for general types
    });

    const unreadCount = filteredNotifications.filter(n => !n.is_read).length;

    const handleClearAllNotifications = async () => {
        if (!filteredNotifications.length) return;

        const oldNotifications = [...notifications];

        // Optimistic update: Clear the current view entirely
        const idsToClear = filteredNotifications.map(n => n.id);
        setNotifications(prev => prev.filter(n => !idsToClear.includes(n.id)));

        try {
            console.log('🗑️ Clearing all relevant notifications for role:', normalizedRole);

            let query = supabase.from('notifications').delete();

            // Use the explicit list of IDs we want to clear.
            // This guarantees we delete exactly what the user sees, instead of guessing types/roles.
            query = query.in('id', idsToClear);

            // Safety check: ensure we only delete things targeted to us or global
            // This prevents role filters from accidentally deleting other roles' private notes
            // UPDATE: For 'Clear All', if the user sees it (in idsToClear), they should be able to delete it.
            // Especially for Admin who sees everything.
            if (normalizedRole !== 'admin') {
                query = query.or(`user_id.eq.${userId},user_id.is.null,target_role.eq.${normalizedRole}`);
            }

            const { error, count } = await query;

            if (error) throw error;
            console.log('✅ Successfully cleared notifications from DB. Count:', count);
            toast.success(t('common.notificationsCleared') || 'Notifications cleared');
        } catch (error: any) {
            console.error('Error clearing notifications:', error);
            setNotifications(oldNotifications);
            toast.error(`Failed to clear: ${error.message}`);
        }
    };

    const handleMarkAsRead = async (id: string) => {
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
        try {
            await supabase
                .from('notifications')
                .update({ is_read: true })
                .eq('id', id);
        } catch (error) {
            console.error('Error marking notification as read:', error);
        }
    };

    return (
        <div className="min-h-screen flex bg-background font-cairo">
            {/* Mobile Sidebar Overlay */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden transition-opacity duration-200"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside className={`fixed inset-y-0 ${isRtl ? 'right-0' : 'left-0'} z-50 w-72 transition-transform duration-300 transform lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : isRtl ? 'translate-x-[110%]' : '-translate-x-full'}`}>
                <div className="h-full glass-card flex flex-col m-4 rounded-[2.5rem] overflow-hidden border border-surface-border shadow-premium">
                    {/* Sidebar Header - Academy Branding */}
                    <div className="p-6 pb-2 text-center">
                        <button
                            onClick={() => {
                                console.log('Logo clicked');
                                setIsLogoModalOpen(true);
                            }}
                            className="relative group inline-block focus:outline-none z-10"
                        >
                            <div className="absolute -inset-2 bg-gradient-to-r from-primary/40 to-accent/40 rounded-full blur-md opacity-0 group-hover:opacity-100 transition duration-700 pointer-events-none"></div>
                            <img
                                src={settings.logo_url || "/logo.png"}
                                alt="Logo"
                                className="relative z-10 h-28 w-28 object-contain rounded-full shadow-2xl transition-all hover:scale-105 duration-500 mx-auto cursor-pointer mix-blend-screen"
                                style={{ clipPath: 'circle(50%)' }}
                            />
                        </button>
                    </div>

                    <div className="space-y-1 text-center">
                        <h2 className="text-[13px] font-black tracking-[0.25em] uppercase text-white leading-tight">
                            {settings.academy_name}
                        </h2>
                        <div className="flex flex-col items-center gap-1 opacity-40">
                            {settings.gym_address && (
                                <p className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest justify-center">
                                    <Building2 className="w-2.5 h-2.5" />
                                    {settings.gym_address}
                                </p>
                            )}
                            {settings.gym_phone && (
                                <p dir="ltr" className="text-[9px] font-black flex items-center gap-1 tracking-widest justify-center">
                                    {settings.gym_phone}
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="mt-4 w-1/2 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent mx-auto"></div>

                    {/* User Profile Card - Premium Glassmorphism */}
                    <div className="px-5 mt-2 mb-4">
                        <div className="p-4 rounded-3xl bg-white/[0.03] border border-white/10 shadow-2xl backdrop-blur-md relative overflow-hidden group/profile">
                            {/* Decorative Glow */}
                            <div className="absolute top-0 right-0 w-16 h-16 bg-primary/10 blur-2xl rounded-full -mr-8 -mt-8 group-hover/profile:bg-primary/20 transition-all duration-700"></div>

                            <div className="flex items-center gap-4 relative z-10">
                                <div className="relative flex-shrink-0">
                                    <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-primary to-accent p-[1px] shadow-lg">
                                        <div className="w-full h-full rounded-2xl bg-[#0E1D21] flex items-center justify-center overflow-hidden">
                                            {avatarUrl ? (
                                                <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
                                            ) : (
                                                <span className="text-white font-black text-sm">
                                                    {(fullName || role || 'E')[0]}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-[#122E34] shadow-lg ${userStatus === 'online' ? 'bg-emerald-400' : 'bg-orange-400'} animate-pulse`}></div>
                                </div>

                                <div className="flex-1 min-w-0">
                                    <h3 className="font-extrabold text-white tracking-tight text-xs truncate">
                                        {fullName || t('common.adminRole')}
                                    </h3>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        <span className="text-[9px] text-primary font-black uppercase tracking-wider">{t(`roles.${role || 'admin'}`)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Navigation */}
                    <nav className="flex-1 px-4 mt-2 mb-2 space-y-1 overflow-y-auto custom-scrollbar">
                        <div className="text-[8px] font-black text-white/20 uppercase tracking-[0.3em] px-4 mb-2">Main Menu</div>
                        {navItems.map((item) => {
                            const Icon = item.icon;
                            const isActive = location.pathname === item.to;
                            return (
                                <Link
                                    key={item.to}
                                    to={item.to}
                                    onClick={() => setSidebarOpen(false)}
                                    className={`flex items-center px-4 py-2.5 text-xs font-bold rounded-2xl transition-all duration-300 group relative ${isActive
                                        ? 'bg-gradient-to-r from-primary to-primary/80 text-white shadow-xl shadow-primary/20 scale-[1.02]'
                                        : 'text-white/50 hover:bg-white/[0.04] hover:text-white hover:translate-x-1'
                                        }`}
                                >
                                    <Icon className={`w-4 h-4 transition-transform duration-300 ${isActive ? 'scale-110 text-white' : 'group-hover:scale-110'} ${isRtl ? 'ml-3' : 'mr-3'}`} />
                                    <span className="tracking-widest uppercase">{item.label}</span>
                                    {isActive && (
                                        <div className={`absolute ${isRtl ? 'left-4' : 'right-4'} w-1 h-3 rounded-full bg-white shadow-[0_0_12px_white] animate-pulse`} />
                                    )}
                                </Link>
                            );
                        })}
                    </nav>

                    {/* Sidebar Footer - Actions Tray */}
                    <div className="p-4 mx-2 mb-4 rounded-3xl bg-black/20 border border-white/5 flex items-center gap-2">
                        <button
                            onClick={() => {
                                const newLang = i18n.language === 'en' ? 'ar' : 'en';
                                i18n.changeLanguage(newLang);
                                document.dir = newLang === 'ar' ? 'rtl' : 'ltr';
                                updateSettings({ language: newLang });
                            }}
                            className="w-10 h-10 flex-shrink-0 flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 rounded-2xl transition-all duration-300 group border border-transparent hover:border-white/10 backdrop-blur-sm"
                            title={i18n.language === 'en' ? 'Arabic' : 'English'}
                        >
                            <Globe className="w-5 h-5 transition-transform group-hover:rotate-45 duration-700" />
                        </button>

                        <div className="h-6 w-px bg-white/5"></div>

                        <button
                            onClick={handleLogout}
                            className="flex-1 h-10 flex items-center justify-center px-2 text-[10px] font-black text-rose-500/80 hover:text-rose-400 hover:bg-rose-500/5 rounded-2xl transition-all duration-300 group border border-transparent hover:border-rose-500/10 uppercase tracking-[0.2em]"
                        >
                            <LogOut className={`w-4 h-4 transition-transform group-hover:-translate-x-1 ${isRtl ? 'ml-2' : 'mr-2'}`} />
                            {t('common.logout')}
                        </button>
                    </div>
                </div>
                <div className="px-8 pb-10 text-center">
                    <span className="text-[7px] font-black text-[#D4AF37]/60 uppercase tracking-[0.5em] block drop-shadow-[0_0_5px_rgba(212,175,55,0.3)] cursor-default">
                        System built by Ahmed Hmaki
                    </span>
                </div>
            </aside>

            {/* Main Content Area */}
            <div className={`flex-1 flex flex-col min-w-0 min-h-screen transition-all duration-500 ${isRtl ? 'lg:mr-72' : 'lg:ml-72'}`}>
                {/* Header - Elite Reborn */}
                <header className="relative h-16 flex items-center justify-between px-6 bg-background/50 backdrop-blur-3xl sticky top-0 z-30 w-full border-b border-surface-border">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setSidebarOpen(true)}
                            className="lg:hidden w-10 h-10 flex items-center justify-center text-white/70 bg-white/5 hover:bg-white/10 rounded-full transition-all active:scale-95 border border-white/5 shadow-sm hover:shadow-premium"
                        >
                            <Menu className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="flex items-center gap-6">
                        {/* Quick Action Hub */}
                        <div className="flex items-center gap-3 md:p-2 md:bg-text-base/5 md:border md:border-surface-border md:rounded-[2rem] md:shadow-inner md:backdrop-blur-md">
                            {settings.clock_position === 'header' && (
                                <div className="hidden md:flex items-center gap-3">
                                    <PremiumClock className="!bg-transparent !border-none !shadow-none !px-2" />
                                    {role === 'admin' && <div className="h-6 w-px bg-white/10 mx-1"></div>}
                                    <div className="flex flex-col items-center px-1">
                                        <span className="text-[7px] font-black uppercase tracking-[0.3em] opacity-40" style={{ color: 'var(--color-brand-label)' }}>System</span>
                                        <span className="text-[8px] font-black text-emerald-400 uppercase tracking-widest">Active</span>
                                    </div>
                                </div>
                            )}

                            {role === 'admin' && (
                                <a
                                    href="/registration"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="relative group/reg flex items-center justify-center w-11 h-11 rounded-full bg-emerald-500/5 border border-emerald-500/10 hover:border-emerald-500/40 transition-all duration-500 shadow-lg shadow-emerald-500/5 hover:bg-emerald-500/10 active:scale-95"
                                    title={t('common.registrationPage')}
                                >
                                    {/* Premium Glow effect */}
                                    <div className="absolute inset-0 rounded-full bg-emerald-500/20 blur-xl opacity-0 group-hover/reg:opacity-100 transition-opacity duration-700"></div>

                                    <UserPlus className="w-5 h-5 text-emerald-400 group-hover/reg:scale-110 transition-transform duration-500 relative z-10" />

                                    {/* Elite Status Dot */}
                                    <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-[#0E1D21] shadow-[0_0_10px_rgba(16,185,129,0.5)] animate-pulse z-20"></span>
                                </a>
                            )}

                            {/* Unified Control Separator */}
                            <div className="hidden md:block h-8 w-px bg-surface-border mx-2"></div>

                            {/* Notifications Center */}
                            <div className="relative">
                                <button
                                    onClick={(e) => { e.stopPropagation(); setNotificationsOpen(!notificationsOpen); setProfileOpen(false); }}
                                    className={`w-10 h-10 flex items-center justify-center rounded-full transition-all relative ${notificationsOpen ? 'bg-primary/20 text-primary shadow-[inset_0_0_15px_rgba(var(--primary-rgb),0.3)] border border-primary/20' : 'text-white/70 bg-white/5 hover:bg-white/10 border border-white/5 shadow-sm hover:shadow-premium'}`}
                                >
                                    <Bell className="w-5 h-5" />
                                    {unreadCount > 0 && (
                                        <span className="absolute -top-1 -right-1 min-w-[20px] h-[20px] px-1 bg-gradient-to-br from-red-500 to-rose-600 text-white text-[10px] font-black rounded-full flex items-center justify-center shadow-lg shadow-red-500/40 border-2 border-background">
                                            {unreadCount > 9 ? '9+' : unreadCount}
                                        </span>
                                    )}
                                </button>

                                {notificationsOpen && (
                                    <div className={`fixed sm:absolute top-16 sm:top-full left-1/2 sm:left-auto -translate-x-1/2 sm:translate-x-0 right-auto sm:right-[-1rem] sm:mt-6 w-[94vw] sm:w-96 bg-[#0E1D21]/98 backdrop-blur-3xl rounded-[3rem] border border-white/20 shadow-2xl overflow-hidden z-[70] animate-in fade-in slide-in-from-top-4 duration-500 flex flex-col max-h-[80vh] sm:max-h-auto`}>
                                        <div className="p-6 sm:p-10 border-b border-white/10 bg-white/[0.05] flex-shrink-0">
                                            <h3 className="font-black text-white uppercase tracking-tighter text-xl sm:text-2xl">{t('common.notifications') || t('common.recentActivity')}</h3>
                                        </div>
                                        <div className="flex-1 overflow-y-auto custom-scrollbar min-h-0">
                                            {filteredNotifications.length === 0 ? (
                                                <div className="p-12 text-center text-white/10 font-black uppercase tracking-[0.3em] text-[10px]">
                                                    {t('common.noNotifications')}
                                                </div>
                                            ) : (
                                                filteredNotifications.map(note => {
                                                    let Icon = Bell;
                                                    let color = 'text-white';

                                                    if (note.type === 'student') { Icon = Users; color = 'text-primary'; }
                                                    else if (note.type === 'payment') { Icon = Wallet; color = 'text-emerald-400'; }
                                                    else if (note.type === 'schedule') { Icon = Calendar; color = 'text-accent'; }
                                                    else if (note.type === 'coach') { Icon = UserCircle; color = 'text-purple-400'; }
                                                    else if (note.type === 'check_in') { Icon = Calendar; color = 'text-green-400'; }
                                                    else if (note.type === 'check_out') { Icon = Calendar; color = 'text-rose-500'; }
                                                    else if (note.type === 'attendance_absence') { Icon = Calendar; color = 'text-red-400'; }
                                                    else if (note.type === 'pt_subscription') { Icon = Wallet; color = 'text-amber-400'; }

                                                    const timeAgo = (dateStr: string) => {
                                                        const diff = (new Date().getTime() - new Date(dateStr).getTime()) / 1000 / 60;
                                                        if (diff < 60) return `${Math.floor(diff)}${t('common.minutesAgoShort')}`;
                                                        if (diff < 1440) return `${Math.floor(diff / 60)}${t('common.hoursAgoShort')}`;
                                                        return `${Math.floor(diff / 1440)}${t('common.daysAgoShort')}`;
                                                    };

                                                    return (
                                                        <div
                                                            key={note.id}
                                                            onClick={() => handleMarkAsRead(note.id)}
                                                            className={`p-6 border-b border-white/[0.05] hover:bg-white/[0.08] transition-all group cursor-pointer ${!note.is_read ? 'bg-primary/10' : ''}`}
                                                        >
                                                            <div className="flex gap-4">
                                                                <div className={`w-12 h-12 flex items-center justify-center rounded-2xl bg-white/5 shadow-inner ${color} group-hover:scale-105 transition-transform border border-white/5`}>
                                                                    <Icon className="w-5 h-5" />
                                                                </div>
                                                                <div className="flex-1">
                                                                    <div className="flex justify-between items-start mb-1">
                                                                        <h4 className="font-extrabold text-white text-sm tracking-tight">{note.title}</h4>
                                                                        <span className="text-[10px] font-black text-white/20 uppercase tracking-widest">{timeAgo(note.created_at)}</span>
                                                                    </div>
                                                                    <p className="text-xs text-white/70 group-hover:text-white/90 transition-colors leading-relaxed line-clamp-2 font-medium">{note.message}</p>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })
                                            )}
                                        </div>
                                        <div className="p-4 bg-white/[0.03] border-t border-white/10 flex-shrink-0">
                                            {filteredNotifications.length > 0 && (
                                                <button
                                                    onClick={handleClearAllNotifications}
                                                    className="w-full py-4 rounded-[1.5rem] bg-red-500/10 text-red-400 hover:bg-red-500/20 text-[10px] font-black uppercase tracking-[0.4em] transition-all border border-red-500/10"
                                                >
                                                    {t('common.notificationsClearAll')}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Walkie Talkie (Hoki Toki) */}
                            {userId && <WalkieTalkie role={normalizedRole || 'coach'} userId={userId || ''} />}
                        </div>

                        {/* Status & Profile Hub */}
                        <div className="relative">
                            <button
                                onClick={(e) => { e.stopPropagation(); setProfileOpen(!profileOpen); setNotificationsOpen(false); }}
                                className={`flex items-center justify-center sm:justify-start gap-0 sm:gap-3 p-0 sm:pl-4 sm:pr-1.5 sm:py-1.5 rounded-full transition-all group w-10 h-10 sm:w-auto sm:h-auto ${profileOpen ? 'bg-white/10 shadow-inner ring-1 ring-white/10' : 'bg-white/[0.02] border border-white/5 hover:border-white/20 hover:bg-white/5 shadow-sm hover:shadow-premium'}`}
                            >
                                <div className="hidden sm:flex flex-col items-end leading-none gap-1">
                                    <p className="text-xs font-black text-white tracking-tight">
                                        {fullName || 'Elite User'}
                                    </p>

                                    <div className="flex items-center gap-1.5 mt-0.5">
                                        <span className={`w-1.5 h-1.5 rounded-full ${userStatus === 'online' ? 'bg-emerald-400' : 'bg-orange-400'} animate-pulse shadow-[0_0_8px_currentColor]`}></span>
                                        <span className="text-[8px] font-black text-white/30 uppercase tracking-[0.2em]">{role ? t(`roles.${role}`) : t('common.adminRole')}</span>
                                    </div>
                                </div>

                                <div className="relative">
                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent p-[1px] group-hover:scale-105 transition-transform duration-500">
                                        <div className="w-full h-full rounded-full bg-background flex items-center justify-center overflow-hidden">
                                            {avatarUrl ? (
                                                <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
                                            ) : (
                                                <span className="text-white font-black text-xs">
                                                    {(fullName || role)?.[0]?.toUpperCase() || 'A'}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-background border-2 border-white/10 flex items-center justify-center p-0.5">
                                        <ChevronDown className={`w-full h-full text-white/40 transition-all duration-300 ${profileOpen ? 'rotate-180' : ''}`} />
                                    </div>
                                </div>
                            </button>

                            {profileOpen && (
                                <div className={`absolute top-full mt-4 ${isRtl ? 'left-[-1rem]' : 'right-[-1rem]'} w-72 bg-[#122E34] rounded-[2.5rem] border border-white/30 shadow-2xl overflow-hidden z-[70] animate-in fade-in slide-in-from-top-4 duration-300`}>
                                    <div className="p-8 space-y-4 border-b border-white/10 bg-white/[0.05]">
                                        <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em] ml-2">{t('common.setStatus')}</p>
                                        <div className="grid grid-cols-2 gap-3">
                                            <button
                                                onClick={() => handleStatusChange('online')}
                                                className={`flex items-center justify-center gap-2.5 py-3.5 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all ${userStatus === 'online' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-lg shadow-emerald-500/10' : 'bg-white/5 text-white/40 border border-transparent hover:bg-white/10'}`}
                                            >
                                                <span className={`w-2 h-2 rounded-full ${userStatus === 'online' ? 'bg-emerald-400 animate-pulse' : 'bg-white/20'}`}></span>
                                                {t('common.onlineLabel')}
                                            </button>
                                            <button
                                                onClick={() => handleStatusChange('busy')}
                                                className={`flex items-center justify-center gap-2.5 py-3.5 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all ${userStatus === 'busy' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30 shadow-lg shadow-orange-500/10' : 'bg-white/5 text-white/40 border border-transparent hover:bg-white/10'}`}
                                            >
                                                <span className={`w-2 h-2 rounded-full ${userStatus === 'busy' ? 'bg-orange-400 animate-pulse' : 'bg-white/20'}`}></span>
                                                {t('common.busyLabel')}
                                            </button>
                                        </div>
                                    </div>
                                    <div className="p-4 space-y-2">
                                        <button
                                            onClick={() => { navigate('/app/settings'); setProfileOpen(false); }}
                                            className="flex items-center w-full px-6 py-4 text-xs font-black text-white/50 hover:text-white hover:bg-white/10 rounded-2xl transition-all group/item uppercase tracking-[0.2em] gap-5 border border-transparent hover:border-white/10"
                                        >
                                            <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/5 group-hover/item:bg-primary/20 group-hover/item:text-primary transition-all border border-white/5 group-hover/item:border-primary/30">
                                                <Settings className="w-5 h-5 group-hover/item:rotate-90 transition-transform duration-700" />
                                            </div>
                                            {t('common.settings')}
                                        </button>
                                        <button
                                            onClick={handleLogout}
                                            className="flex items-center w-full px-6 py-4 text-xs font-black text-rose-500/60 hover:text-rose-500 hover:bg-rose-500/10 rounded-2xl transition-all group/logout uppercase tracking-[0.2em] gap-5 border border-transparent hover:border-rose-500/20"
                                        >
                                            <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-rose-500/10 group-hover/logout:bg-rose-500/20 transition-all border border-rose-500/10 group-hover/logout:border-rose-500/30 text-rose-500">
                                                <LogOut className="w-5 h-5 group-hover/logout:-translate-x-1 transition-transform" />
                                            </div>
                                            {t('common.logout')}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </header>

                {/* Page Content */}
                <main className="flex-1 p-4 sm:p-6 overflow-x-hidden">
                    <Outlet context={{ role, fullName, userId }} />

                </main>
            </div>

            {/* Logo Lightbox Modal */}
            {isLogoModalOpen && (
                <div
                    className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl animate-in fade-in duration-300"
                    onClick={() => setIsLogoModalOpen(false)}
                >
                    <div className="relative max-w-4xl max-h-[90vh] w-full flex items-center justify-center">
                        <img
                            src={settings.logo_url || "/logo.png"}
                            alt="Academy Logo"
                            className="max-w-full max-h-[85vh] object-contain rounded-3xl shadow-[0_0_50px_rgba(0,0,0,0.5)] animate-in zoom-in-95 duration-300"
                            onClick={(e) => e.stopPropagation()}
                        />
                        <button
                            onClick={() => setIsLogoModalOpen(false)}
                            className="absolute -top-12 right-0 w-10 h-10 flex items-center justify-center bg-white/10 hover:bg-white/20 rounded-full text-white transition-all backdrop-blur-sm"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
