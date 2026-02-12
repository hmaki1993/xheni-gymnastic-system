import { useState, useRef, useEffect } from 'react';
import { Mic, Radio, Volume2, VolumeX, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

export default function WalkieTalkie({ role, userId }: { role: string; userId: string }) {
    const [isRecording, setIsRecording] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [isIncoming, setIsIncoming] = useState(false);
    const mediaRecorder = useRef<MediaRecorder | null>(null);
    const audioChunks = useRef<Blob[]>([]);
    const audioContext = useRef<AudioContext | null>(null);
    const holdTimer = useRef<any>(null);
    const mouseDownTime = useRef<number>(0);
    const isHolding = useRef(false);

    // Recording Start Beep
    const playBeep = (type: 'start' | 'end') => {
        if (!audioContext.current) audioContext.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        const osc = audioContext.current.createOscillator();
        const gain = audioContext.current.createGain();
        osc.connect(gain);
        gain.connect(audioContext.current.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(type === 'start' ? 880 : 440, audioContext.current.currentTime);
        gain.gain.setValueAtTime(0.1, audioContext.current.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioContext.current.currentTime + 0.1);
        osc.start();
        osc.stop(audioContext.current.currentTime + 0.1);
    };

    const startRecording = async () => {
        if (role !== 'admin') return;
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder.current = new MediaRecorder(stream, { mimeType: 'audio/webm' });
            audioChunks.current = [];

            mediaRecorder.current.ondataavailable = (e: BlobEvent) => {
                if (e.data.size > 0) audioChunks.current.push(e.data);
            };

            mediaRecorder.current.onstop = async () => {
                const audioBlob = new Blob(audioChunks.current, { type: 'audio/webm' });
                await uploadBroadcast(audioBlob);
            };

            playBeep('start');
            mediaRecorder.current.start();
            setIsRecording(true);
        } catch (err) {
            console.error('Recording error:', err);
            toast.error('Microphone access denied');
        }
    };

    const stopRecording = () => {
        setIsRecording(false); // Force state reset immediately for UI responsiveness
        if (mediaRecorder.current && mediaRecorder.current.state === 'recording') {
            try {
                mediaRecorder.current.stop();
                mediaRecorder.current.stream.getTracks().forEach((track: MediaStreamTrack) => track.stop());
                playBeep('end');
            } catch (err) {
                console.error('Error stopping recorder:', err);
            }
        }
    };

    const handlePressStart = (e: React.MouseEvent | React.TouchEvent) => {
        if (role !== 'admin') return;

        // Prevent synthetic mouse events on touch devices
        if (e.type === 'touchstart') {
            e.preventDefault();
        }

        mouseDownTime.current = Date.now();
        isHolding.current = true;

        if (holdTimer.current) clearTimeout(holdTimer.current);

        holdTimer.current = setTimeout(() => {
            if (isHolding.current && !isRecording) {
                startRecording();
            }
        }, 250);
    };

    const handlePressEnd = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isHolding.current) return;
        isHolding.current = false;

        const pressDuration = Date.now() - mouseDownTime.current;

        if (holdTimer.current) {
            clearTimeout(holdTimer.current);
            holdTimer.current = null;
        }

        if (isRecording) {
            // If we were in PTT mode (long press), stop now
            if (pressDuration >= 250) {
                stopRecording();
            }
        } else if (pressDuration < 250) {
            // If it was a short tap and we weren't recording, start toggle mode
            startRecording();
        }
    };

    const handleToggle = (e: React.MouseEvent | React.TouchEvent) => {
        // This is only for the "Stop" action in toggle mode 
        // OR if the user just taps the button.
        if (role !== 'admin') return;

        // If we are already recording and it's a tap, stop it
        if (isRecording && (Date.now() - mouseDownTime.current < 250)) {
            stopRecording();
        }
    };

    const uploadBroadcast = async (blob: Blob) => {
        setIsUploading(true);
        const fileName = `${userId}_${Date.now()}.webm`;

        try {
            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('walkie-talkie')
                .upload(fileName, blob);

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('walkie-talkie')
                .getPublicUrl(fileName);

            const { error: dbError } = await supabase
                .from('voice_broadcasts')
                .insert({
                    sender_id: userId,
                    audio_url: publicUrl,
                    expires_at: new Date(Date.now() + 60000).toISOString() // Expire in 1 min
                });

            if (dbError) throw dbError;
            toast.success('Broadcast sent!');
        } catch (err: any) {
            console.error('Broadcast error:', err);
            toast.error('Failed to send broadcast');
        } finally {
            setIsUploading(false);
        }
    };

    // Global Listener for Coaches
    useEffect(() => {
        const channel = supabase
            .channel('voice-broadcasts-realtime')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'voice_broadcasts' },
                async (payload) => {
                    const newBroadcast = payload.new as any;
                    console.log('📡 WalkieTalkie: Received broadcast:', newBroadcast);

                    if (newBroadcast.sender_id !== userId && !isMuted) {
                        setIsIncoming(true);

                        // Play Beep first
                        playBeep('start');

                        const audio = new Audio(newBroadcast.audio_url);
                        audio.crossOrigin = "anonymous";

                        audio.play().catch(e => {
                            console.error('🚫 WalkieTalkie: Auto-play blocked:', e);
                            toast((t) => (
                                <span className="flex items-center gap-2">
                                    🎙️ Walkie Talkie
                                    <button
                                        onClick={() => {
                                            audio.play();
                                            toast.dismiss(t.id);
                                        }}
                                        className="bg-primary text-black px-3 py-1.5 rounded-full text-[11px] font-black uppercase tracking-wider shadow-[0_0_15px_rgba(16,185,129,0.4)] hover:scale-105 active:scale-95 transition-all"
                                    >
                                        Listen
                                    </button>
                                </span>
                            ), { duration: 10000, className: 'premium-toast-vibrant' });
                        });

                        audio.onended = () => {
                            setIsIncoming(false);
                            playBeep('end');
                        };
                    }
                }
            )
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [isMuted, userId]);

    return (
        <div className="flex items-center gap-2">
            {/* Broadcast Button - ADMIN ONLY */}
            {role === 'admin' && (
                <button
                    onMouseDown={handlePressStart}
                    onMouseUp={handlePressEnd}
                    onMouseLeave={handlePressEnd}
                    onTouchStart={handlePressStart}
                    onTouchEnd={(e) => {
                        e.preventDefault();
                        handlePressEnd(e);
                        handleToggle(e as any);
                    }}
                    onClick={(e) => {
                        if ((Date.now() - mouseDownTime.current) < 50) return;
                        handleToggle(e);
                    }}
                    className={`relative w-10 h-10 flex items-center justify-center rounded-full transition-all duration-300 border ${isRecording
                        ? 'bg-red-500/20 border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.4)] scale-110'
                        : 'bg-white/5 border-white/10 hover:border-primary/50 text-white/70 hover:bg-white/10'
                        }`}
                    title={isRecording ? "Click to Stop" : "Broadcasting Mic (Hold to Talk)"}
                >
                    {isUploading ? (
                        <Loader2 className="w-5 h-5 animate-spin text-primary" />
                    ) : isRecording ? (
                        <Radio className="w-5 h-5 text-red-500 animate-pulse" />
                    ) : (
                        <Mic className="w-4 h-4" />
                    )}
                </button>
            )}

            {/* Speaker Button - ALL AUTHORIZED ROLES */}
            <button
                onClick={() => {
                    setIsMuted(!isMuted);
                    if (audioContext.current?.state === 'suspended') {
                        audioContext.current.resume();
                    }
                }}
                className={`relative w-10 h-10 flex items-center justify-center rounded-full border transition-all ${isMuted
                    ? 'bg-rose-500/10 border-rose-500/20 text-rose-500'
                    : isIncoming
                        ? 'bg-primary/10 border-primary/50 text-primary animate-bounce shadow-[0_0_15px_rgba(var(--primary-rgb),0.3)]'
                        : 'bg-white/5 border-white/10 text-white/40 hover:text-white hover:bg-white/10'
                    }`}
                title={isIncoming ? "Admin is Speaking... (Click to Stop)" : "Hoki Toki Speaker (Mute/Unmute)"}
            >
                {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                {isIncoming && !isMuted && (
                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-primary rounded-full animate-ping"></span>
                )}
            </button>
        </div>
    );
}
