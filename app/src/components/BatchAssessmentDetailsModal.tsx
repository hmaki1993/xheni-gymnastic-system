import * as htmlToImage from 'html-to-image';
import { jsPDF } from 'jspdf';
import { useState, useEffect, useRef } from 'react';
import { X, Calendar, User, Users, Trophy, Download, FileText, Edit2, Check, RotateCcw, Plus, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { useTheme } from '../context/ThemeContext';

export interface BatchAssessmentDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    batchId: string;
    title: string;
    date: string;
    responsibleCoach?: string;
    assessingCoach?: string;
    onUpdate?: () => void;
}

export default function BatchAssessmentDetailsModal({ isOpen, onClose, batchId, title, date, responsibleCoach, assessingCoach, onUpdate }: BatchAssessmentDetailsModalProps) {
    const [loading, setLoading] = useState(true);
    const [assessments, setAssessments] = useState<any[]>([]);
    const [skillsList, setSkillsList] = useState<string[]>([]);
    const [maxScores, setMaxScores] = useState<Record<string, number>>({});
    const [isEditing, setIsEditing] = useState(false);
    const [tempAssessments, setTempAssessments] = useState<any[]>([]);
    const [saving, setSaving] = useState(false);
    const [availableSkills, setAvailableSkills] = useState<any[]>([]);
    const [showAddSkill, setShowAddSkill] = useState(false);
    const tableRef = useRef<HTMLDivElement>(null);

    const { userProfile } = useTheme();
    const normalizedRole = userProfile?.role?.toLowerCase().trim() || '';
    const canEdit = normalizedRole.includes('admin') || normalizedRole.includes('head') || normalizedRole.includes('master');

    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
            document.documentElement.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
            document.documentElement.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
            document.documentElement.style.overflow = 'unset';
        };
    }, [isOpen]);

    useEffect(() => {
        if (isOpen) {
            fetchBatchDetails();
            fetchAvailableSkills();
        }
    }, [isOpen, title, date]);

    const fetchAvailableSkills = async () => {
        const { data } = await supabase.from('defined_skills').select('*').order('name');
        if (data) setAvailableSkills(data);
    };

    const fetchBatchDetails = async () => {
        setLoading(true);
        console.log('🚀 Fetching batch details for:', { title, date });
        try {
            const { data, error } = await supabase
                .from('skill_assessments')
                .select('*, students(full_name, coaches(full_name))')
                .eq('title', title)
                .eq('date', date);

            console.log('📦 Batch details response:', { data, error, count: data?.length });

            if (error) {
                console.error('❌ Supabase error:', error);
                throw error;
            }

            if (data && data.length > 0) {
                setAssessments(data);
                setTempAssessments(JSON.parse(JSON.stringify(data))); // Deep copy for editing
                const firstRecord = data[0];
                if (firstRecord.skills && Array.isArray(firstRecord.skills)) {
                    const extractedSkills = firstRecord.skills.map((s: any) => s.name);
                    console.log('✅ Extracted skills:', extractedSkills);
                    setSkillsList(extractedSkills);

                    const scoresMap: Record<string, number> = {};
                    firstRecord.skills.forEach((s: any) => {
                        scoresMap[s.name] = s.max_score;
                    });
                    setMaxScores(scoresMap);
                }
            } else {
                console.warn('⚠️ No data found for this batch!');
            }
        } catch (err) {
            console.error('❌ Error in fetchBatchDetails:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleExportCSV = () => {
        if (assessments.length === 0) return;
        const csvRows = [];

        // Add Header Info
        csvRows.push(`Assessment: ${title}`);
        csvRows.push(`Date: ${date}`);
        if (responsibleCoach) csvRows.push(`Responsible Coach: ${responsibleCoach}`);
        if (assessingCoach) csvRows.push(`Assessing Coach: ${assessingCoach}`);
        csvRows.push(''); // Empty line

        const headers = ['Student', ...skillsList, 'Total Score'];
        csvRows.push(headers.join(','));

        assessments.forEach(record => {
            const scoresMap = record.skills.reduce((acc: any, curr: any) => {
                acc[curr.name] = curr.score;
                return acc;
            }, {});

            const coachName = (record.students?.coaches as any)?.full_name || (record.students?.coaches as any)?.[0]?.full_name || '';
            const row = [
                `"${record.students?.full_name || 'Unknown'}${coachName ? ` (${coachName.split(' ')[0]})` : ''}"`,
                ...skillsList.map(skill => scoresMap[skill] || 0),
                record.total_score
            ];
            csvRows.push(row.join(','));
        });

        const csvContent = csvRows.join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `${title.replace(/\s+/g, '_')}_${date}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleScoreChange = (recordId: string, skillName: string, newScore: string) => {
        const score = parseFloat(newScore) || 0;
        const maxScore = maxScores[skillName] || 10;

        if (score > maxScore) {
            toast.error(`Max score for ${skillName} is ${maxScore}`);
            return;
        }

        setTempAssessments(prev => prev.map(rec => {
            if (rec.id === recordId) {
                const updatedSkills = rec.skills.map((s: any) =>
                    s.name === skillName ? { ...s, score } : s
                );
                const totalScore = updatedSkills.reduce((acc: number, curr: any) => acc + (curr.score || 0), 0);
                return { ...rec, skills: updatedSkills, total_score: totalScore };
            }
            return rec;
        }));
    };

    const handleSaveEdits = async () => {
        setSaving(true);
        const toastId = toast.loading('Saving changes...');
        try {
            for (const record of tempAssessments) {
                const { error } = await supabase
                    .from('skill_assessments')
                    .update({
                        skills: record.skills,
                        total_score: record.total_score
                    })
                    .eq('id', record.id);

                if (error) throw error;
            }

            toast.success('Updated', { id: toastId });
            setIsEditing(false);
            if (onUpdate) onUpdate();
            fetchBatchDetails();
        } catch (err) {
            console.error('Save Edits Error:', err);
            toast.error('Failed to save changes', { id: toastId });
        } finally {
            setSaving(false);
        }
    };

    const handleExportPDF = async () => {
        if (!tableRef.current) return;
        const toastId = toast.loading('Generating PDF...');

        try {
            // Create a clone of the table to render full width
            const originalElement = tableRef.current;
            const clone = originalElement.cloneNode(true) as HTMLElement;

            // STRIP LAYOUT CLASSES that might cause collapse outside of flex container
            clone.classList.remove('flex-1', 'flex', 'flex-col', 'overflow-hidden', 'bg-[#0E1D21]');

            // Apply capture-specific styles
            // We use z-index and opacity to hide it while keeping it "on screen" to ensure rendering
            Object.assign(clone.style, {
                position: 'fixed',
                top: '0',
                left: '0',
                width: '1200px', // Fixed desktop width
                minWidth: '1200px',
                height: 'auto',
                minHeight: '100vh', // Ensure at least screen height
                overflow: 'visible',
                zIndex: '-9999',
                opacity: '0', // Hide visually but allow rendering
                background: '#0E1D21', // Force background
                color: 'white',
                pointerEvents: 'none'
            });

            // Handle internal scrollables
            const scrollables = clone.querySelectorAll('.overflow-x-auto, .overflow-auto, .custom-scrollbar');
            scrollables.forEach(el => {
                const element = el as HTMLElement;
                element.style.overflow = 'visible';
                element.style.width = '100%';
                element.style.height = 'auto';
                element.classList.remove('flex-1', 'overflow-auto', 'overflow-x-auto');
            });

            // Handle flex containers inside to ensure they expand
            const flexContainers = clone.querySelectorAll('.flex-1');
            flexContainers.forEach(el => {
                (el as HTMLElement).style.flex = 'none';
                (el as HTMLElement).style.height = 'auto';
            });

            // Append clone to body
            document.body.appendChild(clone);

            // Wait longer for layout, fonts, and images (gymnast avatars)
            await new Promise(resolve => setTimeout(resolve, 800));

            // html-to-image can fail with SecurityError when fetching external fonts due to CORS.
            // We use a broader configuration to handle this gracefully.
            const dataUrl = await htmlToImage.toPng(clone, {
                backgroundColor: '#0E1D21',
                cacheBust: true,
                pixelRatio: 1.5, // Slightly lower for much better performance/size
                quality: 0.9,
                // Skip problematic font fetching that triggers SecurityError (CORS)
                // We'll rely on system fonts or already-loaded fonts in the browser
                fontEmbedCSS: '',
                style: {
                    borderRadius: '0',
                    boxShadow: 'none',
                    opacity: '1'
                }
            }).catch(async (e) => {
                console.warn('First export attempt failed, retrying without fonts...', e);
                return await htmlToImage.toPng(clone, {
                    backgroundColor: '#0E1D21',
                    pixelRatio: 1.2,
                    skipFonts: true // Full bypass if still failing
                });
            });

            // Clean up DOM immediately
            if (document.body.contains(clone)) {
                document.body.removeChild(clone);
            }

            // Generate PDF
            const tempPdf = new jsPDF({ unit: 'px', hotfixes: ['px_scaling'] });
            const imgProps = tempPdf.getImageProperties(dataUrl);

            const pdfWidth = imgProps.width;
            const pdfHeight = imgProps.height;

            const pdf = new jsPDF({
                orientation: pdfWidth > pdfHeight ? 'landscape' : 'portrait',
                unit: 'px',
                format: [pdfWidth, pdfHeight]
            });

            pdf.addImage(dataUrl, 'PNG', 0, 0, pdfWidth, pdfHeight);
            pdf.save(`${title.replace(/\s+/g, '_')}_${date}.pdf`);

            toast.success('Generated', { id: toastId });
        } catch (err: any) {
            console.error('PDF Export Error:', err);
            toast.error('Failed to generate PDF. Retrying with fallback...', { id: toastId });

            // Cleanup if exists
            const existingClone = document.body.querySelector('[style*="z-index: -9999"]');
            if (existingClone) document.body.removeChild(existingClone);
        }
    };

    const handleAddSkill = (skillId: string) => {
        const skill = availableSkills.find(s => s.id === parseInt(skillId));
        if (!skill) return;
        if (skillsList.includes(skill.name)) {
            toast.error('Skill already exists');
            return;
        }

        setSkillsList(prev => [...prev, skill.name]);
        setMaxScores(prev => ({ ...prev, [skill.name]: skill.max_score }));
        setTempAssessments(prev => prev.map(rec => ({
            ...rec,
            skills: [...rec.skills, { name: skill.name, score: 0, max_score: skill.max_score }]
        })));
        setShowAddSkill(false);
    };

    const handleRemoveSkill = (skillName: string) => {
        setSkillsList(prev => prev.filter(s => s !== skillName));
        setTempAssessments(prev => prev.map(rec => {
            const updatedSkills = rec.skills.filter((s: any) => s.name !== skillName);
            const totalScore = updatedSkills.reduce((acc: number, curr: any) => acc + (curr.score || 0), 0);
            return { ...rec, skills: updatedSkills, total_score: totalScore };
        }));
    };
    const avgScore = assessments.length > 0
        ? assessments.reduce((acc, curr) => acc + (curr.total_score || 0), 0) / assessments.length
        : 0;

    const isExcellent = avgScore >= 9;

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={onClose} />
            <div className="relative w-full max-w-6xl bg-[#0E1D21] border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col h-[95vh] sm:h-auto sm:max-h-[90vh] animate-in zoom-in-95 duration-300">

                {/* Main Capture Container for PDF */}
                <div className="flex-1 flex flex-col overflow-hidden bg-[#0E1D21]" ref={tableRef}>

                    {/* Header - Included in PDF */}
                    <div className="p-4 sm:p-6 border-b border-white/10 flex flex-col gap-4 bg-black/20 shrink-0">
                        <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                            <div className="flex justify-between items-start w-full sm:w-auto">
                                <div className="flex-1">
                                    <h2 className="text-lg sm:text-2xl font-black text-white uppercase tracking-tighter flex items-center gap-2 sm:gap-3">
                                        <div className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl bg-primary/10 border border-primary/20 shrink-0">
                                            <Trophy className="w-4 h-4 sm:w-6 sm:h-6 text-primary" />
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="truncate max-w-[150px] sm:max-w-none">{title}</span>
                                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-0.5 sm:mt-1.5">
                                                <span className="flex items-center gap-1 sm:gap-1.5 text-[8px] sm:text-xs font-black uppercase tracking-widest text-white/40">
                                                    <Calendar className="w-2.5 sm:w-3.5 h-2.5 sm:h-3.5" />
                                                    {format(new Date(date), 'MMMM dd, yyyy')}
                                                </span>
                                                <span className="flex items-center gap-1 sm:gap-1.5 text-[8px] sm:text-xs font-black uppercase tracking-widest text-white/40">
                                                    <Users className="w-2.5 sm:w-3.5 h-2.5 sm:h-3.5" />
                                                    {assessments.length}
                                                </span>
                                            </div>
                                        </div>
                                    </h2>
                                </div>
                                <button
                                    onClick={onClose}
                                    className="p-2 hover:bg-white/10 rounded-xl transition-colors sm:hidden"
                                >
                                    <X className="w-5 h-5 text-white/60" />
                                </button>
                            </div>

                            <div className="flex items-center gap-4 w-full sm:w-auto">
                                <div className={`flex-1 sm:flex-none p-3 sm:p-4 rounded-2xl sm:rounded-[1.5rem] border-2 transition-all duration-700 flex flex-col items-center justify-center min-w-[100px] sm:min-w-[130px] ${isExcellent ? 'bg-emerald-500/10 border-emerald-500 shadow-[0_0_30px_rgba(16,185,129,0.15)] animate-pulse' : 'bg-white/5 border-white/10'}`}>
                                    <span className="text-[7px] sm:text-[8px] font-black uppercase tracking-[0.3em] text-white/40 mb-0.5 whitespace-nowrap">Performance</span>
                                    <span className={`text-xl sm:text-2xl font-black tracking-tighter ${isExcellent ? 'text-emerald-400' : 'text-primary'}`}>
                                        {avgScore.toFixed(1)}
                                    </span>
                                    <span className="text-[6px] sm:text-[7px] font-bold text-white/20 uppercase tracking-widest mt-0.5 whitespace-nowrap">Average Score</span>
                                </div>

                                <button
                                    onClick={onClose}
                                    className="p-3 hover:bg-white/10 rounded-xl transition-colors hidden sm:block data-[html2canvas-ignore]:hidden"
                                    data-html2canvas-ignore="true"
                                >
                                    <X className="w-6 h-6 text-white/60" />
                                </button>
                            </div>
                        </div>

                        {/* Coaches Bar */}
                        <div className="flex flex-col sm:flex-row gap-2.5 pt-3 border-t border-white/5">
                            {responsibleCoach && (
                                <div className="flex items-center gap-2.5 px-4 py-2 rounded-xl bg-primary/10 border border-primary/20 w-full sm:w-auto">
                                    <div className="w-7 h-7 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
                                        <Trophy className="w-4 h-4 text-primary" />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[6.5px] font-black text-primary/60 uppercase tracking-widest leading-none">Master Respons.</span>
                                        <span className="text-sm sm:text-base font-black text-white uppercase tracking-tight">{responsibleCoach}</span>
                                    </div>
                                </div>
                            )}
                            {assessingCoach && (
                                <div className="flex items-center gap-2.5 px-4 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 w-full sm:w-auto">
                                    <div className="w-7 h-7 rounded-lg bg-amber-500/20 flex items-center justify-center shrink-0">
                                        <User className="w-4 h-4 text-amber-500" />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[6.5px] font-black text-amber-500/60 uppercase tracking-widest leading-none">Assessing Coach</span>
                                        <span className="text-sm sm:text-base font-black text-white uppercase tracking-tight">{assessingCoach}</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Grid Content */}
                    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                        {loading ? (
                            <div className="flex-1 flex items-center justify-center">
                                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                            </div>
                        ) : (
                            <div className="flex-1 overflow-auto custom-scrollbar bg-[#0E1D21] py-2 sm:py-6 px-0 sm:px-6" id="assessment-scroll-viewport">
                                <div className="border-y sm:border border-white/5 sm:rounded-2xl bg-white/[0.02] overflow-visible">
                                    <table className="w-full text-left border-separate border-spacing-0">
                                        <thead className="text-white/50 text-[8px] sm:text-[9px] uppercase font-black tracking-widest sticky top-0 z-[60]">
                                            <tr>
                                                <th className="p-2 sm:p-3 border-b border-white/10 min-w-[120px] sm:min-w-[140px] sticky left-0 top-0 bg-[#0c181c] z-[70]">
                                                    <div className="flex items-center gap-2">
                                                        <Users className="w-2.5 sm:w-3 h-2.5 sm:h-3 text-primary/40" />
                                                        Gymnast
                                                    </div>
                                                </th>
                                                {skillsList.map((skill, i) => (
                                                    <th key={i} className="p-3 sm:p-6 border-b border-white/10 text-center min-w-[100px] sm:min-w-[180px] sticky top-0 bg-[#0c181c] z-[60]">
                                                        <div className="relative flex flex-col items-center justify-center pt-2">
                                                            <div className="text-white text-[9px] sm:text-xs font-black uppercase tracking-widest leading-none mb-1 sm:mb-1.5 whitespace-nowrap">{skill}</div>
                                                            <div className="text-white/20 text-[7px] sm:text-[8px] font-bold uppercase tracking-widest bg-white/5 px-1 sm:px-1.5 py-0.5 rounded-md">max: {maxScores[skill]}</div>

                                                            {isEditing && (
                                                                <button
                                                                    onClick={() => handleRemoveSkill(skill)}
                                                                    title="Remove Skill"
                                                                    className="mt-2 p-1 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-md transition-all border border-red-500/20 active:scale-90 flex items-center justify-center gap-1 group"
                                                                >
                                                                    <X className="w-2.5 h-2.5" />
                                                                    <span className="text-[7px] font-black uppercase tracking-widest hidden group-hover:block">Remove</span>
                                                                </button>
                                                            )}
                                                        </div>
                                                    </th>
                                                ))}
                                                {isEditing && (
                                                    <th className="p-3 border-b border-white/10 text-center min-w-[120px] sticky top-0 bg-[#0c181c] z-[60]">
                                                        <div className="flex flex-col items-center justify-center pt-2">
                                                            {showAddSkill ? (
                                                                <select
                                                                    onChange={(e) => handleAddSkill(e.target.value)}
                                                                    onBlur={() => setShowAddSkill(false)}
                                                                    autoFocus
                                                                    className="w-full bg-white/10 border border-white/20 rounded-lg px-2 py-1 text-[10px] text-white focus:outline-none"
                                                                >
                                                                    <option value=""></option>
                                                                    {availableSkills.map(s => (
                                                                        <option key={s.id} value={s.id}>{s.name}</option>
                                                                    ))}
                                                                </select>
                                                            ) : (
                                                                <button
                                                                    onClick={() => setShowAddSkill(true)}
                                                                    className="flex items-center gap-1 px-3 py-1.5 bg-emerald-500/20 text-emerald-400 rounded-lg text-[8px] font-black uppercase tracking-widest border border-emerald-500/30 hover:bg-emerald-500/30 transition-all active:scale-95"
                                                                >
                                                                    <Plus className="w-3 h-3" />
                                                                    Add
                                                                </button>
                                                            )}
                                                        </div>
                                                    </th>
                                                )}
                                                <th className="p-3 sm:p-6 border-b border-white/10 text-center min-w-[80px] sm:min-w-[120px] text-primary sticky top-0 bg-[#0c181c] z-[60]">
                                                    <div className="block text-center">
                                                        <div className="text-primary text-[10px] sm:text-sm font-black uppercase tracking-widest leading-none whitespace-nowrap mb-1">Total</div>
                                                        <div className="text-primary/30 text-[7px] sm:text-[9px] font-bold uppercase tracking-tighter leading-none">Points</div>
                                                    </div>
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/5">
                                            {(isEditing ? tempAssessments : assessments).map(record => {
                                                const recordScoresMap = record.skills.reduce((acc: any, curr: any) => {
                                                    acc[curr.name] = curr.score;
                                                    return acc;
                                                }, {});
                                                const isAbsent = record.status === 'absent';

                                                return (
                                                    <tr key={record.id} className={`hover:bg-white/[0.02] transition-colors border-b border-white/5 ${isAbsent ? 'opacity-50 grayscale' : ''}`}>
                                                        <td className="p-2 sm:p-3 sticky left-0 bg-[#0c181c] z-30 border-r border-white/5">
                                                            <div className="flex items-center gap-2 sm:gap-3">
                                                                <div className={`w-6 h-6 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-gradient-to-br transition-all ${isAbsent ? 'from-red-500/20 to-red-900/20 border-red-500/30' : 'from-primary/10 to-primary/5 border-primary/20'} border flex items-center justify-center shrink-0`}>
                                                                    <User className="w-3 h-3 sm:w-4 sm:h-4 text-primary" />
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <div className="text-[11px] sm:text-base font-black text-white truncate leading-tight sm:leading-none">
                                                                        {record.students?.full_name}
                                                                    </div>
                                                                    {record.students?.coaches && (
                                                                        <div className="flex items-center gap-1">
                                                                            <span className="text-[7px] sm:text-[9px] text-primary/60 font-black uppercase tracking-widest bg-primary/5 px-1 py-0.5 rounded mt-0.5 sm:mt-1">
                                                                                @{((record.students.coaches as any)?.full_name?.split(' ')[0] || (record.students.coaches as any)?.[0]?.full_name?.split(' ')[0])}
                                                                            </span>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </td>
                                                        {skillsList.map((skill, i) => (
                                                            <td key={i} className={`p-2 sm:p-4 text-center border-r border-white-[0.02] ${i % 2 === 0 ? 'bg-white/[0.01]' : ''}`}>
                                                                {isEditing ? (
                                                                    <div className="flex items-center justify-center">
                                                                        <input
                                                                            type="number"
                                                                            disabled={isAbsent}
                                                                            value={recordScoresMap[skill] ?? ''}
                                                                            onChange={(e) => handleScoreChange(record.id, skill, e.target.value)}
                                                                            className="w-12 h-8 bg-white/5 border border-white/10 rounded-lg px-1 text-sm sm:text-lg font-black text-white text-center focus:border-primary/50 focus:bg-primary/5 focus:outline-none transition-all disabled:opacity-20 disabled:cursor-not-allowed"
                                                                            min="0"
                                                                            max={maxScores[skill]}
                                                                            placeholder={isAbsent ? '-' : ''}
                                                                        />
                                                                    </div>
                                                                ) : (
                                                                    <span className={`text-sm sm:text-xl font-black tracking-tighter ${isAbsent ? 'text-white/10' : (recordScoresMap[skill] >= maxScores[skill] ? 'text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.3)]' : 'text-white/90')}`}>
                                                                        {isAbsent ? '-' : (recordScoresMap[skill] !== undefined ? recordScoresMap[skill] : '-')}
                                                                    </span>
                                                                )}
                                                            </td>
                                                        ))}
                                                        {isEditing && (
                                                            <td className="p-3 text-center border-l border-white/5">
                                                                <span className="text-white/20 text-[9px] italic">Ready</span>
                                                            </td>
                                                        )}
                                                        <td className="p-2 sm:p-3 text-center">
                                                            <span className={`font-black text-lg sm:text-2xl tracking-tighter ${isAbsent ? 'text-white/30' : 'text-primary drop-shadow-[0_0_10px_rgba(255,255,255,0.1)]'}`}>
                                                                {isAbsent ? '0' : record.total_score}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer - Outside PDF Capture */}
                <div className="p-4 sm:p-6 border-t border-white/10 bg-black/20 flex flex-col sm:flex-row justify-between items-center gap-4 shrink-0">
                    <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
                        {canEdit && !isEditing ? (
                            <button
                                onClick={() => setIsEditing(true)}
                                className="w-full sm:w-auto px-5 py-2.5 rounded-2xl bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 transition-all font-black uppercase tracking-[0.2em] text-[10px] flex items-center justify-center gap-2 border-2 border-amber-500/20 shadow-lg shadow-amber-500/10"
                            >
                                <Edit2 className="w-4 h-4" />
                                Modify Scores
                            </button>
                        ) : isEditing ? (
                            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                                <button
                                    onClick={handleSaveEdits}
                                    disabled={saving}
                                    className="w-full sm:w-auto px-5 py-2.5 rounded-2xl bg-emerald-500 text-white hover:bg-emerald-600 transition-all font-black uppercase tracking-[0.2em] text-[10px] flex items-center justify-center gap-2 shadow-[0_15px_30px_rgba(16,185,129,0.3)] border-2 border-white/10"
                                >
                                    <Check className="w-4 h-4" />
                                    {saving ? 'Syncing...' : 'Confirm Changes'}
                                </button>
                                <button
                                    onClick={() => {
                                        setIsEditing(false);
                                        setTempAssessments(JSON.parse(JSON.stringify(assessments)));
                                    }}
                                    className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-white/5 text-white/40 hover:text-white transition-colors font-black uppercase tracking-widest text-[9px] flex items-center justify-center gap-2"
                                >
                                    <RotateCcw className="w-3.5 h-3.5" />
                                    Discard
                                </button>
                            </div>
                        ) : null}
                        {isEditing && (
                            <p className="hidden sm:block text-[10px] text-white/40 font-bold uppercase tracking-wider ml-4 animate-pulse">
                                Editing Skills & Scores...
                            </p>
                        )}
                    </div>

                    <div className="flex gap-3 w-full sm:w-auto">
                        {!isEditing && (
                            <>
                                <button
                                    onClick={handleExportPDF}
                                    className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 transition-colors font-black uppercase tracking-widest text-[9px] flex items-center justify-center gap-2"
                                >
                                    <FileText className="w-3.5 h-3.5" />
                                    Download PDF
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
