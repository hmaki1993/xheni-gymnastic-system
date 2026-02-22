import { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Loader2 } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

export default function ProtectedRoute() {
    const { isLoading: themeLoading } = useTheme();

    // Optimistic check: if no auth token in localStorage, we can skip initial loading spinner
    // and assume unauthenticated for the first render.
    const hasPossibleSession = typeof window !== 'undefined' &&
        Object.keys(localStorage).some(key => key.includes('auth-token'));

    const [loading, setLoading] = useState(hasPossibleSession);
    const [authenticated, setAuthenticated] = useState(false);

    useEffect(() => {
        console.log('ProtectedRoute: Mounting...');
        checkUser();

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setAuthenticated(!!session);
            setLoading(false);
        });

        return () => subscription.unsubscribe();
    }, []);

    const checkUser = async () => {
        console.log('ProtectedRoute: Checking session...');
        try {
            const { data: { session } } = await supabase.auth.getSession();
            console.log('ProtectedRoute: Session check result:', !!session);
            setAuthenticated(!!session);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const isInitialLoading = loading || themeLoading;

    console.log('🛡️ ProtectedRoute: State Update', {
        loading,
        themeLoading,
        isInitialLoading,
        authenticated,
        localStorageKeys: Object.keys(localStorage).filter(k => k.includes('auth-token'))
    });
    if (isInitialLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <Loader2 className="w-10 h-10 text-primary animate-spin" />
            </div>
        );
    }

    if (!authenticated) {
        return <Navigate to="/login" replace />;
    }

    return <Outlet />;
}
