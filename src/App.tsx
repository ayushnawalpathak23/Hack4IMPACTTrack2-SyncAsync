import React, { useState, useEffect, useRef } from "react";
import {
  Upload, FileText, Loader2, Brain, Info,
  History, User, Trash2, ChevronRight, LogOut,
  AlertCircle, X, Edit2, Check, MessageSquare, Send, Volume2, Languages,
  Mic, MicOff, VolumeX, Sparkles, Activity, Shield, ChevronDown
} from "lucide-react";
import { motion, AnimatePresence, useMotionValue, useSpring } from "motion/react";
import ReactMarkdown from "react-markdown";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import fullLogoImage from "./assets/full-logo.jpeg";
import halfLogoImage from "./assets/half-logo.jpeg";

GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ─── CSS Injection ────────────────────────────────────────────────────────────
const GLOBAL_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;1,9..40,300&display=swap');

  :root {
    --void: #060810;
    --abyss: #0b0f1a;
    --deep: #111827;
    --surface: #161d2e;
    --raise: #1e2740;
    --border: rgba(99,120,200,0.12);
    --border-bright: rgba(99,120,200,0.25);
    --jade: #00d48a;
    --jade-dim: #00b574;
    --jade-glow: rgba(0,212,138,0.15);
    --jade-pulse: rgba(0,212,138,0.08);
    --amber: #f59e0b;
    --rose: #f43f5e;
    --sky: #38bdf8;
    --text-primary: #f0f4ff;
    --text-secondary: #8b9cc8;
    --text-muted: #4a5580;
    --font-display: 'Syne', sans-serif;
    --font-body: 'DM Sans', sans-serif;
  }

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  html { font-family: var(--font-body); background: var(--void); color: var(--text-primary); scroll-behavior: smooth; }

  ::-webkit-scrollbar { width: 4px; }
  ::-webkit-scrollbar-track { background: var(--abyss); }
  ::-webkit-scrollbar-thumb { background: var(--raise); border-radius: 99px; }
  ::-webkit-scrollbar-thumb:hover { background: var(--border-bright); }

  ::selection { background: var(--jade-glow); color: var(--jade); }

  @keyframes pulse-ring {
    0% { transform: scale(1); opacity: 0.6; }
    100% { transform: scale(1.6); opacity: 0; }
  }
  @keyframes shimmer {
    0% { background-position: -200% center; }
    100% { background-position: 200% center; }
  }
  @keyframes float {
    0%, 100% { transform: translateY(0px); }
    50% { transform: translateY(-6px); }
  }
  @keyframes grain {
    0%, 100% { transform: translate(0,0); }
    10% { transform: translate(-1%,-1%); }
    20% { transform: translate(1%,-1%); }
    30% { transform: translate(-1%,1%); }
    40% { transform: translate(1%,1%); }
    50% { transform: translate(-1%,0); }
    60% { transform: translate(1%,0); }
    70% { transform: translate(0,-1%); }
    80% { transform: translate(0,1%); }
    90% { transform: translate(-1%,-1%); }
  }
  @keyframes scan-line {
    0% { transform: translateY(-100%); }
    100% { transform: translateY(100vh); }
  }
  @keyframes blink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0; }
  }
  @keyframes aurora {
    0% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
    100% { background-position: 0% 50%; }
  }

  .font-display { font-family: var(--font-display); }
  .text-jade { color: var(--jade); }
  .text-muted { color: var(--text-muted); }
  .text-secondary { color: var(--text-secondary); }

  .glass {
    background: rgba(22, 29, 46, 0.7);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border: 1px solid var(--border);
  }

  .glass-bright {
    background: rgba(30, 39, 64, 0.8);
    backdrop-filter: blur(24px);
    border: 1px solid var(--border-bright);
  }

  .jade-glow-box {
    box-shadow: 0 0 0 1px rgba(0,212,138,0.2), 0 0 30px rgba(0,212,138,0.08), 0 8px 32px rgba(0,0,0,0.4);
  }

  .pulse-dot::before {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: 50%;
    background: var(--jade);
    animation: pulse-ring 2s ease-out infinite;
  }

  .shimmer-text {
    background: linear-gradient(90deg, var(--text-secondary) 0%, var(--jade) 40%, var(--sky) 60%, var(--text-secondary) 100%);
    background-size: 200% auto;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    animation: shimmer 4s linear infinite;
  }

  .severity-normal {
    background: rgba(0, 212, 138, 0.08);
    border: 1px solid rgba(0, 212, 138, 0.2);
    color: #4ade80;
  }
  .severity-caution {
    background: rgba(245, 158, 11, 0.08);
    border: 1px solid rgba(245, 158, 11, 0.2);
    color: var(--amber);
  }
  .severity-critical {
    background: rgba(244, 63, 94, 0.08);
    border: 1px solid rgba(244, 63, 94, 0.2);
    color: var(--rose);
  }

  .btn-primary {
    background: linear-gradient(135deg, var(--jade) 0%, #00a06a 100%);
    color: var(--void);
    font-weight: 700;
    font-family: var(--font-display);
    letter-spacing: 0.02em;
    border: none;
    cursor: pointer;
    position: relative;
    overflow: hidden;
    transition: all 0.2s ease;
  }
  .btn-primary::before {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(135deg, rgba(255,255,255,0.15) 0%, transparent 60%);
    opacity: 0;
    transition: opacity 0.2s;
  }
  .btn-primary:hover::before { opacity: 1; }
  .btn-primary:hover { transform: translateY(-1px); box-shadow: 0 8px 24px rgba(0,212,138,0.3); }
  .btn-primary:active { transform: translateY(0); }
  .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; transform: none; box-shadow: none; }

  .input-field {
    background: var(--surface);
    border: 1px solid var(--border);
    color: var(--text-primary);
    font-family: var(--font-body);
    transition: all 0.2s ease;
    outline: none;
  }
  .input-field::placeholder { color: var(--text-muted); }
  .input-field:focus {
    border-color: rgba(0,212,138,0.4);
    box-shadow: 0 0 0 3px var(--jade-pulse);
  }

  .chat-user { background: linear-gradient(135deg, #00d48a 0%, #00a06a 100%); color: var(--void); }
  .chat-ai {
    background: var(--surface);
    border: 1px solid var(--border);
    color: var(--text-primary);
  }

  .history-item {
    background: var(--surface);
    border: 1px solid var(--border);
    transition: all 0.2s ease;
    cursor: pointer;
  }
  .history-item:hover {
    border-color: rgba(0,212,138,0.25);
    background: var(--raise);
    transform: translateX(4px);
  }

  .noise-overlay::after {
    content: '';
    position: fixed;
    inset: -50%;
    width: 200%;
    height: 200%;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E");
    opacity: 0.03;
    pointer-events: none;
    z-index: 9999;
    animation: grain 0.5s steps(1) infinite;
  }

  .bg-grid {
    background-image: 
      linear-gradient(rgba(99,120,200,0.04) 1px, transparent 1px),
      linear-gradient(90deg, rgba(99,120,200,0.04) 1px, transparent 1px);
    background-size: 40px 40px;
  }

  .concern-row {
    transition: all 0.2s ease;
  }
  .concern-row:hover {
    transform: translateX(4px);
  }

  .prose-dark { color: var(--text-secondary); }
  .prose-dark p { margin-bottom: 0.5em; }
  .prose-dark strong { color: var(--text-primary); font-weight: 600; }
  .prose-dark ul { padding-left: 1.2em; }
  .prose-dark li { margin-bottom: 0.3em; }

  select option { background: var(--deep); color: var(--text-primary); }

  .tab-active {
    color: var(--jade);
    border-bottom: 2px solid var(--jade);
  }
`;

// ─── Error Boundary ──────────────────────────────────────────────────────────
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error: any }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: any) { return { hasError: true, error }; }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--void)' }}>
          <div className="glass-bright p-10 rounded-3xl max-w-md w-full text-center space-y-6">
            <div className="w-16 h-16 rounded-full mx-auto flex items-center justify-center" style={{ background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.3)' }}>
              <AlertCircle style={{ color: 'var(--rose)' }} className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-display" style={{ fontFamily: 'var(--font-display)' }}>System Error</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>An unexpected error occurred. Please reload to continue.</p>
            <button onClick={() => window.location.reload()} className="btn-primary w-full py-3 rounded-2xl text-sm">Reload</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// ─── Types ───────────────────────────────────────────────────────────────────
interface SimplifiedData {
  summary: string;
  concerns: { item: string; severity: "Normal" | "Caution" | "Critical" }[];
  meaning: string;
}
interface Report {
  id: string; userId: string; originalText: string; simplifiedData: SimplifiedData;
  createdAt: any; title: string; fileUrl?: string;
}
interface ChatMessage { id: string; role: "user" | "model"; text: string; createdAt: any; }
interface SessionUser { id: string; username: string; }

// ─── Logo Variants ───────────────────────────────────────────────────────────
function HalfLogo({ size = 32 }: { size?: number }) {
  return (
    <motion.div style={{ width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <img src={halfLogoImage} alt="MediCode half logo" style={{ width: size, height: size, objectFit: 'contain' }} />
    </motion.div>
  );
}

function FullLogo({ iconSize = 32, textSize = "1.2rem" }: { iconSize?: number; textSize?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <img src={fullLogoImage} alt="MediCode logo" style={{ width: iconSize, height: iconSize, objectFit: 'contain' }} />
      <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: textSize, letterSpacing: '-0.02em' }}>
        Medi<span style={{ color: 'var(--jade)' }}>Code</span>
      </span>
    </div>
  );
}

// ─── Floating Orbs Background ─────────────────────────────────────────────────
function BackgroundOrbs() {
  return (
    <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
      <motion.div
        style={{
          position: 'absolute', borderRadius: '50%',
          width: 600, height: 600, top: -200, right: -150,
          background: 'radial-gradient(circle, rgba(0,212,138,0.06) 0%, transparent 70%)',
          filter: 'blur(40px)',
        }}
        animate={{ scale: [1, 1.15, 1], x: [0, 30, 0], y: [0, -20, 0] }}
        transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        style={{
          position: 'absolute', borderRadius: '50%',
          width: 500, height: 500, bottom: 0, left: -100,
          background: 'radial-gradient(circle, rgba(56,189,248,0.05) 0%, transparent 70%)',
          filter: 'blur(40px)',
        }}
        animate={{ scale: [1, 1.2, 1], x: [0, -20, 0], y: [0, 30, 0] }}
        transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut', delay: 3 }}
      />
      <motion.div
        style={{
          position: 'absolute', borderRadius: '50%',
          width: 300, height: 300, top: '40%', left: '40%',
          background: 'radial-gradient(circle, rgba(99,120,200,0.04) 0%, transparent 70%)',
          filter: 'blur(30px)',
        }}
        animate={{ scale: [1, 1.3, 1] }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut', delay: 6 }}
      />
    </div>
  );
}

// ─── Stat Badge ───────────────────────────────────────────────────────────────
function StatBadge({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <motion.div
      className="glass"
      style={{ borderRadius: 16, padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 12 }}
      whileHover={{ y: -2 }}
    >
      <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--jade-glow)', border: '1px solid rgba(0,212,138,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon style={{ width: 16, height: 16, color: 'var(--jade)' }} />
      </div>
      <div>
        <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', fontFamily: 'var(--font-display)' }}>{label}</div>
        <div style={{ fontSize: '0.9rem', fontWeight: 700, fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}>{value}</div>
      </div>
    </motion.div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
function MedicalSimplifier() {
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [authForm, setAuthForm] = useState({ username: "", password: "" });
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [reportText, setReportText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);
  const [currentReport, setCurrentReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<Report[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [editingTitleId, setEditingTitleId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [targetLang, setTargetLang] = useState("en");
  const [translating, setTranslating] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [speechRecognitionSupported, setSpeechRecognitionSupported] = useState(false);
  const [useServerSttFallback, setUseServerSttFallback] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(false);
  const [activeResultTab, setActiveResultTab] = useState<'summary' | 'concerns' | 'meaning'>('summary');
  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recordedChunksRef = useRef<BlobPart[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const networkRetryCountRef = useRef(0);
  const networkRetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dictationBaseInputRef = useRef("");
  const finalTranscriptRef = useRef("");
  const shouldKeepListeningRef = useRef(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatMessages]);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      setSpeechRecognitionSupported(true);
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = "en-US";
      recognitionRef.current.onresult = (event: any) => {
        let hasFinalResult = false;
        let interimTranscript = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = String(event.results[i]?.[0]?.transcript || "").trim();
          if (!transcript) continue;
          if (event.results[i].isFinal) {
            hasFinalResult = true;
            finalTranscriptRef.current = `${finalTranscriptRef.current} ${transcript}`.trim();
          } else {
            interimTranscript = `${interimTranscript} ${transcript}`.trim();
          }
        }

        const nextInput = [
          dictationBaseInputRef.current,
          finalTranscriptRef.current,
          interimTranscript,
        ].filter(Boolean).join(" ").trim();

        setChatInput(nextInput);

        if (hasFinalResult) {
          shouldKeepListeningRef.current = false;
          recognitionRef.current?.stop();
          setIsListening(false);
        }
      };
      recognitionRef.current.onerror = (event: any) => {
        if (event.error === "network" && networkRetryCountRef.current < 1) {
          networkRetryCountRef.current++;
          setIsListening(false);
          networkRetryTimerRef.current = setTimeout(() => {
            try {
              if (!shouldKeepListeningRef.current) return;
              setIsListening(true);
              recognitionRef.current?.start();
            } catch {
              setIsListening(false);
            }
          }, 200);
          return;
        }
        if (event.error === "network") { setUseServerSttFallback(true); }
        shouldKeepListeningRef.current = false;
        setIsListening(false);
      };
      recognitionRef.current.onend = () => {
        shouldKeepListeningRef.current = false;
        setIsListening(false);
      };
    }
    return () => { if (networkRetryTimerRef.current) clearTimeout(networkRetryTimerRef.current); mediaStreamRef.current?.getTracks().forEach(t => t.stop()); };
  }, [useServerSttFallback]);

  const transcribeAudioBlob = async (audioBlob: Blob) => {
    const formData = new FormData();
    formData.append("audio", audioBlob, "speech.webm");
    const response = await fetch("/api/stt", { method: "POST", body: formData });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.error || "Speech-to-text failed");
    const text = String(data?.text || "").trim();
    if (!text) throw new Error("No speech detected.");
    setChatInput(text);
  };

  const startFallbackRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      recordedChunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (e) => { if (e.data?.size > 0) recordedChunksRef.current.push(e.data); };
      recorder.onstop = async () => {
        setIsListening(false);
        try { await transcribeAudioBlob(new Blob(recordedChunksRef.current, { type: "audio/webm" })); setError(null); }
        catch (err) { setError(err instanceof Error ? err.message : "Transcription failed."); }
        finally {
          mediaStreamRef.current?.getTracks().forEach(t => t.stop());
          mediaStreamRef.current = null; mediaRecorderRef.current = null; recordedChunksRef.current = [];
        }
      };
      setIsListening(true);
      recorder.start();
    } catch { setIsListening(false); setError("Microphone access denied."); }
  };

  const stopFallbackRecording = () => {
    if (mediaRecorderRef.current?.state !== "inactive") mediaRecorderRef.current?.stop();
    else setIsListening(false);
  };

  const toggleListening = () => {
    if (!isListening) {
      dictationBaseInputRef.current = chatInput.trim();
      finalTranscriptRef.current = "";
    }

    const useFallback = useServerSttFallback || !speechRecognitionSupported || !recognitionRef.current;
    if (useFallback) {
      if (!navigator.mediaDevices?.getUserMedia) { setError("Speech input not supported in this browser."); return; }
      shouldKeepListeningRef.current = !isListening;
      isListening ? stopFallbackRecording() : startFallbackRecording();
      return;
    }
    if (isListening) {
      shouldKeepListeningRef.current = false;
      recognitionRef.current?.stop();
      return;
    }
    shouldKeepListeningRef.current = true;
    setIsListening(true);
    try {
      networkRetryCountRef.current = 0;
      recognitionRef.current?.start();
    } catch {
      setIsListening(false);
    }
  };

  const stopSpeaking = () => {
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    if (audioUrlRef.current) { URL.revokeObjectURL(audioUrlRef.current); audioUrlRef.current = null; }
    setSpeaking(false);
  };

  const loadSessionUser = async () => {
    try {
      const r = await fetch("/api/auth/me");
      if (!r.ok) { setSessionUser(null); return; }
      const d = await r.json();
      setSessionUser(d?.user ?? null);
    } catch { setSessionUser(null); }
  };

  useEffect(() => {
    let mounted = true;
    (async () => { await loadSessionUser(); if (mounted) setSessionLoading(false); })();
    return () => { mounted = false; };
  }, []);

  const loadHistory = async () => {
    if (!sessionUser) { setHistory([]); return; }
    try {
      const r = await fetch("/api/reports");
      if (!r.ok) { setHistory([]); return; }
      const d = await r.json();
      setHistory(Array.isArray(d?.reports) ? d.reports : []);
    } catch { }
  };

  useEffect(() => { loadHistory(); }, [sessionUser]);

  useEffect(() => {
    if (!file) { setFilePreviewUrl(null); return; }
    const url = URL.createObjectURL(file);
    setFilePreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const loadMessages = async (reportId: string) => {
    try {
      const r = await fetch(`/api/reports/${reportId}/messages`);
      if (!r.ok) { setChatMessages([]); return; }
      const d = await r.json();
      setChatMessages(Array.isArray(d?.messages) ? d.messages : []);
    } catch { setChatMessages([]); }
  };

  useEffect(() => {
    if (!currentReport) { setChatMessages([]); return; }
    loadMessages(currentReport.id);
  }, [currentReport]);

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authForm.username.trim() || !authForm.password.trim()) { setAuthError("Username and password required."); return; }
    setAuthSubmitting(true); setAuthError(null);
    try {
      const endpoint = authMode === "login" ? "/api/auth/login" : "/api/auth/signup";
      const r = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: authForm.username.trim(), password: authForm.password }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error || "Authentication failed");
      setAuthForm({ username: "", password: "" });
      setSessionUser(d.user);
    } catch (err) { setAuthError(err instanceof Error ? err.message : "Authentication failed"); }
    finally { setAuthSubmitting(false); }
  };

  const handleLogout = async () => {
    try { await fetch("/api/auth/logout", { method: "POST" }); } catch { }
    setSessionUser(null); setCurrentReport(null); setChatMessages([]); setShowHistory(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      const f = e.target.files[0];
      if (!["image/jpeg", "image/jpg", "image/png", "application/pdf"].includes(f.type)) {
        setError("Only JPEG, PNG, and PDF files are supported."); setFile(null); return;
      }
      setError(null); setFile(f);
    }
  };

  const fileToDataUrl = (inputFile: File): Promise<string> =>
    new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = rej; r.readAsDataURL(inputFile); });

  const pdfToPageImages = async (pdfFile: File, maxPages = 2): Promise<string[]> => {
    const buffer = await pdfFile.arrayBuffer();
    const pdf = await getDocument({ data: buffer }).promise;
    const pagesToRender = Math.min(pdf.numPages, maxPages);
    const images: string[] = [];
    for (let p = 1; p <= pagesToRender; p++) {
      const page = await pdf.getPage(p);
      const viewport = page.getViewport({ scale: 1.1 });
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) continue;
      canvas.width = viewport.width; canvas.height = viewport.height;
      await page.render({ canvasContext: ctx, viewport, canvas }).promise;
      images.push(canvas.toDataURL("image/jpeg", 0.7));
    }
    return images;
  };

  const LANGUAGE_MAP: Record<string, string> = { hi: "Hindi", or: "Odia", mr: "Marathi", te: "Telugu", bn: "Bengali", ta: "Tamil", kn: "Kannada", gu: "Gujarati", ml: "Malayalam", pa: "Punjabi" };
  const TTS_LANG_MAP: Record<string, string> = { en: "en-US", hi: "hi-IN", or: "or-IN", mr: "mr-IN", te: "te-IN", bn: "bn-IN", ta: "ta-IN", kn: "kn-IN", gu: "gu-IN", ml: "ml-IN", pa: "pa-IN" };

  const getPreferredVoice = (locale: string): SpeechSynthesisVoice | null => {
    if (!("speechSynthesis" in window)) return null;
    const voices = window.speechSynthesis.getVoices();
    if (!voices.length) return null;
    return voices.find(v => v.lang.toLowerCase() === locale.toLowerCase()) || voices.find(v => v.lang.toLowerCase().startsWith(locale.split("-")[0].toLowerCase())) || null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportText && !file) { setError("Please provide report content or upload a file."); return; }
    if (!sessionUser) { setError("Please login to continue."); return; }
    setLoading(true); setError(null); setCurrentReport(null);
    try {
      let fileUrl = ""; let imageDataUrls: string[] = [];
      if (file) {
        const formData = new FormData();
        formData.append("file", file);
        const uploadRes = await fetch("/api/upload", { method: "POST", body: formData });
        const uploadData = await uploadRes.json();
        if (uploadData.url) fileUrl = uploadData.url;
        else throw new Error("File upload failed");
        if (file.type === "application/pdf") imageDataUrls = await pdfToPageImages(file);
        else if (file.type.startsWith("image/")) imageDataUrls = [await fileToDataUrl(file)];
      }
      const simplifyRes = await fetch("/api/ai/simplify", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportText, fileUrl, fileName: file?.name, imageDataUrls })
      });
      const simplifyData = await simplifyRes.json().catch(() => ({}));
      if (!simplifyRes.ok || !simplifyData?.simplifiedData) {
        if (simplifyRes.status === 413) throw new Error("File too large. Try a smaller file.");
        throw new Error(simplifyData?.error || `Simplification failed (${simplifyRes.status})`);
      }
      const simplifiedData = simplifyData.simplifiedData as SimplifiedData;
      const reportTitle = reportText.slice(0, 50) + (reportText.length > 50 ? "..." : "") || (file ? file.name : "Uploaded Report");
      const createRes = await fetch("/api/reports", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: reportTitle, originalText: reportText || (file ? `File: ${file.name}` : "Uploaded file"), simplifiedData, fileUrl })
      });
      const createdData = await createRes.json();
      if (!createRes.ok || !createdData?.report) throw new Error(createdData?.error || "Failed to save report");
      setCurrentReport(createdData.report as Report);
      setActiveResultTab('summary');
      await loadHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred. Please try again.");
    } finally { setLoading(false); }
  };

  const deleteReport = async (id: string) => {
    try { await fetch(`/api/reports/${id}`, { method: "DELETE" }); if (currentReport?.id === id) setCurrentReport(null); await loadHistory(); } catch { }
  };

  const updateReportTitle = async (id: string) => {
    if (!newTitle.trim()) return;
    try {
      const r = await fetch(`/api/reports/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: newTitle }) });
      if (!r.ok) throw new Error((await r.json())?.error || "Failed to update title");
      setEditingTitleId(null);
      await loadHistory();
      if (currentReport?.id === id) setCurrentReport({ ...currentReport, title: newTitle });
    } catch { }
  };

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !currentReport || !sessionUser) return;
    const messageText = chatInput;
    const currentHistory = [...chatMessages];
    setChatInput(""); setChatLoading(true);
    try {
      const saveUserRes = await fetch(`/api/reports/${currentReport.id}/messages`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role: "user", text: messageText }) });
      if (!saveUserRes.ok) {
        const saveUserData = await saveUserRes.json().catch(() => null);
        throw new Error(saveUserData?.error || "Failed to save your message");
      }
      setChatMessages(prev => [...prev, { id: `temp-user-${Date.now()}`, role: "user", text: messageText, createdAt: new Date().toISOString() }]);
      const chatRes = await fetch("/api/ai/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messageText, currentReport, currentHistory }) });
      const chatData = await chatRes.json().catch(() => null);
      if (!chatRes.ok || !chatData?.text) throw new Error(chatData?.error || "AI chat failed");
      const aiText = String(chatData.text);
      const saveModelRes = await fetch(`/api/reports/${currentReport.id}/messages`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role: "model", text: aiText }) });
      if (!saveModelRes.ok) {
        const saveModelData = await saveModelRes.json().catch(() => null);
        throw new Error(saveModelData?.error || "AI response generated, but saving it failed");
      }
      await loadMessages(currentReport.id);
      if (autoSpeak) speakText(aiText);
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI chat failed. Please try again.");
    }
    finally { setChatLoading(false); }
  };

  const handleTranslate = async (lang: string) => {
    if (!currentReport || translating) return;
    setTargetLang(lang);
    if (lang === "en") {
      const original = history.find(h => h.id === currentReport.id);
      if (original) setCurrentReport({ ...currentReport, simplifiedData: original.simplifiedData });
      return;
    }
    setTranslating(true); setError(null);
    try {
      const r = await fetch("/api/translate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: JSON.stringify(currentReport.simplifiedData), targetLanguage: LANGUAGE_MAP[lang] || lang }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error || "Translation failed");
      if (d.translatedText) {
        try {
          const cleaned = d.translatedText.replace(/```json\n?|\n?```/g, '').trim();
          setCurrentReport({ ...currentReport, simplifiedData: JSON.parse(cleaned) as SimplifiedData });
        } catch { setError("Translation parsing failed. Please retry."); }
      }
    } catch (err) { setError(err instanceof Error ? err.message : "Translation failed"); }
    finally { setTranslating(false); }
  };

  const speakText = async (text: string) => {
    if (!text?.trim()) return;
    if (speaking) stopSpeaking();
    setSpeaking(true);
    try {
      const r = await fetch("/api/tts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, targetLang }) });
      const d = await r.json();
      if (d.audioData) {
        const bytes = new Uint8Array(atob(d.audioData).split('').map(c => c.charCodeAt(0)));
        const url = URL.createObjectURL(new Blob([bytes], { type: 'audio/mpeg' }));
        const audio = new Audio(url);
        audioRef.current = audio; audioUrlRef.current = url;
        audio.onended = () => { setSpeaking(false); URL.revokeObjectURL(url); audioRef.current = null; audioUrlRef.current = null; };
        audio.onerror = () => { setSpeaking(false); URL.revokeObjectURL(url); audioRef.current = null; audioUrlRef.current = null; };
        await audio.play(); return;
      }
      throw new Error("No audio data");
    } catch {
      if ("speechSynthesis" in window) {
        const utterance = new SpeechSynthesisUtterance(text);
        const locale = TTS_LANG_MAP[targetLang] || "en-US";
        utterance.lang = locale;
        const voice = getPreferredVoice(locale);
        if (voice) utterance.voice = voice;
        utterance.rate = ["bn", "or", "mr"].includes(targetLang) ? 0.8 : 1;
        utterance.onend = () => setSpeaking(false);
        utterance.onerror = () => { setSpeaking(false); };
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utterance);
        return;
      }
      setSpeaking(false);
    }
  };

  if (sessionLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--void)' }}>
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
          <Activity style={{ width: 32, height: 32, color: 'var(--jade)' }} />
        </motion.div>
      </div>
    );
  }

  const severityColor = (s: string) => {
    if (s === 'Normal') return 'severity-normal';
    if (s === 'Caution') return 'severity-caution';
    return 'severity-critical';
  };

  const criticalCount = currentReport?.simplifiedData.concerns.filter(c => c.severity === 'Critical').length || 0;
  const cautionCount = currentReport?.simplifiedData.concerns.filter(c => c.severity === 'Caution').length || 0;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: GLOBAL_STYLES }} />
      <div className="noise-overlay" style={{ fontFamily: 'var(--font-body)' }}>
        <BackgroundOrbs />
        <div className="bg-grid" style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }} />

        {/* ─── Header ─────────────────────────────────────────────────────── */}
        <motion.header
          initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
          style={{ position: 'sticky', top: 0, zIndex: 50, borderBottom: '1px solid var(--border)', background: 'rgba(6,8,16,0.85)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)' }}
        >
          <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <img src={fullLogoImage} alt="MediCode" style={{ height: 48, width: 'auto', objectFit: 'contain' }} />
              <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.2rem', letterSpacing: '-0.02em', margin: 0 }}>
                Medi<span style={{ color: 'var(--jade)' }}>Code</span>
              </h1>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              {sessionUser && (
                <>
                  <motion.button
                    whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                    onClick={() => setShowHistory(!showHistory)}
                    style={{ position: 'relative', padding: 8, background: 'transparent', border: '1px solid var(--border)', borderRadius: 10, cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', fontFamily: 'var(--font-display)' }}
                  >
                    <History style={{ width: 15, height: 15 }} />
                    History
                    {history.length > 0 && (
                      <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }}
                        style={{ position: 'absolute', top: -4, right: -4, width: 16, height: 16, background: 'var(--jade)', borderRadius: '50%', fontSize: '0.6rem', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--void)', fontWeight: 800 }}
                      >{history.length}</motion.span>
                    )}
                  </motion.button>
                  <div style={{ width: 1, height: 24, background: 'var(--border)' }} />
                </>
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg, var(--jade) 0%, #0099ff 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <User style={{ width: 14, height: 14, color: 'var(--void)' }} />
                </div>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                  {sessionUser ? sessionUser.username : "Guest"}
                </span>
              </div>

              {sessionUser && (
                <motion.button
                  whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                  onClick={handleLogout}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 10, cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.8rem', fontFamily: 'var(--font-display)', transition: 'all 0.2s' }}
                >
                  <LogOut style={{ width: 14, height: 14 }} />
                  Sign out
                </motion.button>
              )}
            </div>
          </div>
        </motion.header>

        {/* ─── Main ───────────────────────────────────────────────────────── */}
        <main style={{ maxWidth: 1200, margin: '0 auto', padding: '48px 24px 80px', position: 'relative', zIndex: 1 }}>
          <AnimatePresence mode="wait">
            {!sessionUser ? (
              /* ─── Auth Panel ─────────────────────────────────────────── */
              <motion.div key="auth" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
                style={{ maxWidth: 440, margin: '60px auto 0', position: 'relative' }}
              >
                {/* Glow ring behind card */}
                <div style={{ position: 'absolute', inset: -2, background: 'linear-gradient(135deg, rgba(0,212,138,0.3), rgba(56,189,248,0.1), transparent)', borderRadius: 28, filter: 'blur(20px)', zIndex: -1 }} />

                <div className="glass-bright" style={{ borderRadius: 24, padding: 40 }}>
                  <div style={{ textAlign: 'center', marginBottom: 32 }}>
                    <motion.div animate={{ y: [0, -4, 0] }} transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }} style={{ display: 'inline-block', marginBottom: 16 }}>
                      <HalfLogo size={56} />
                    </motion.div>
                    <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.75rem', letterSpacing: '-0.03em', marginBottom: 8 }}>
                      {authMode === "login" ? "Welcome back" : "Get started"}
                    </h2>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                      {authMode === "login" ? "Sign in to your account" : "Create a free account today"}
                    </p>
                  </div>

                  <form onSubmit={handleAuthSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {['username', 'password'].map((field) => (
                      <motion.div key={field} whileFocus={{ scale: 1.01 }}>
                        <input
                          type={field === 'password' ? 'password' : 'text'}
                          value={authForm[field as keyof typeof authForm]}
                          onChange={(e) => setAuthForm(prev => ({ ...prev, [field]: e.target.value }))}
                          placeholder={field.charAt(0).toUpperCase() + field.slice(1)}
                          className="input-field"
                          style={{ width: '100%', padding: '14px 18px', borderRadius: 14, fontSize: '0.9rem' }}
                        />
                      </motion.div>
                    ))}

                    <AnimatePresence>
                      {authError && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                          style={{ padding: '12px 16px', background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.25)', borderRadius: 12, color: 'var(--rose)', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 8 }}
                        >
                          <AlertCircle style={{ width: 14, height: 14, flexShrink: 0 }} />
                          {authError}
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <motion.button type="submit" disabled={authSubmitting} className="btn-primary"
                      style={{ padding: '14px', borderRadius: 14, fontSize: '0.9rem', marginTop: 4 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      {authSubmitting ? (
                        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                          <motion.div animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}>
                            <Loader2 style={{ width: 16, height: 16 }} />
                          </motion.div>
                          Authenticating...
                        </span>
                      ) : authMode === "login" ? "Sign In" : "Create Account"}
                    </motion.button>
                  </form>

                  <button
                    onClick={() => { setAuthMode(m => m === "login" ? "signup" : "login"); setAuthError(null); }}
                    style={{ width: '100%', marginTop: 20, background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.8rem', transition: 'color 0.2s' }}
                    onMouseOver={e => (e.currentTarget.style.color = 'var(--jade)')}
                    onMouseOut={e => (e.currentTarget.style.color = 'var(--text-muted)')}
                  >
                    {authMode === "login" ? "Don't have an account? Sign up →" : "Already have an account? Sign in →"}
                  </button>
                </div>
              </motion.div>
            ) : (
              /* ─── Dashboard ──────────────────────────────────────────── */
              <motion.div key="dashboard" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                {/* Hero tagline */}
                <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }}
                  style={{ marginBottom: 48, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 24 }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                      <div style={{ position: 'relative', display: 'inline-flex' }}>
                        <div className="pulse-dot" style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--jade)', position: 'relative' }} />
                      </div>
                      <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--jade)', fontFamily: 'var(--font-display)', fontWeight: 700 }}>AI-Powered Analysis</span>
                    </div>
                    <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 'clamp(1.75rem, 4vw, 2.8rem)', lineHeight: 1.1, letterSpacing: '-0.04em', marginBottom: 12 }}>
                      Understand your<br />
                      <span className="shimmer-text">medical reports</span>
                    </h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', maxWidth: 460, lineHeight: 1.6 }}>
                      Upload any medical document and receive a clear, plain-language explanation — in your language.
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    <StatBadge icon={Shield} label="Privacy First" value="End-to-end" />
                    <StatBadge icon={Sparkles} label="Languages" value="11+" />
                  </div>
                </motion.div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 32, alignItems: 'start' }}>
                  {/* ── Left: Input Panel ────────────────────────────── */}
                  <motion.div initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.2 }}
                    style={{ gridColumn: 'span 5' }}
                  >
                    <div className="glass-bright" style={{ borderRadius: 24, overflow: 'hidden' }}>
                      <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 32, height: 32, borderRadius: 10, background: 'var(--jade-glow)', border: '1px solid rgba(0,212,138,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <FileText style={{ width: 15, height: 15, color: 'var(--jade)' }} />
                        </div>
                        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.9rem' }}>Input Report</span>
                      </div>

                      <form onSubmit={handleSubmit} style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', fontFamily: 'var(--font-display)', fontWeight: 700, marginBottom: 10 }}>
                            Paste Report Text
                          </label>
                          <textarea
                            value={reportText}
                            onChange={e => setReportText(e.target.value)}
                            placeholder="Paste complex medical text here..."
                            className="input-field"
                            style={{ width: '100%', height: 160, padding: '14px 16px', borderRadius: 14, fontSize: '0.85rem', resize: 'none', lineHeight: 1.6 }}
                          />
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', fontFamily: 'var(--font-display)', fontWeight: 700, marginBottom: 10 }}>
                            Upload Document
                          </label>
                          <div style={{ position: 'relative' }}>
                            <input type="file" onChange={handleFileChange} accept=".jpeg,.jpg,.png,.pdf,image/jpeg,image/jpg,image/png,application/pdf"
                              style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', zIndex: 10, width: '100%', height: '100%' }}
                            />
                            <motion.div
                              whileHover={{ borderColor: 'rgba(0,212,138,0.3)' }}
                              style={{
                                border: `2px dashed ${file ? 'rgba(0,212,138,0.4)' : 'var(--border)'}`,
                                borderRadius: 14, padding: '24px 20px',
                                background: file ? 'rgba(0,212,138,0.04)' : 'transparent',
                                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, transition: 'all 0.2s'
                              }}
                            >
                              <motion.div animate={{ y: file ? 0 : [0, -3, 0] }} transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}>
                                <Upload style={{ width: 24, height: 24, color: file ? 'var(--jade)' : 'var(--text-muted)' }} />
                              </motion.div>
                              <span style={{ fontSize: '0.82rem', color: file ? 'var(--jade)' : 'var(--text-muted)', textAlign: 'center' }}>
                                {file ? file.name : "Drop file or click to browse"}
                              </span>
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>JPEG · PNG · PDF</span>
                            </motion.div>
                          </div>

                          <AnimatePresence>
                            {file && filePreviewUrl && (
                              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                                style={{ marginTop: 12, borderRadius: 14, overflow: 'hidden', border: '1px solid var(--border)' }}
                              >
                                {file.type === "application/pdf"
                                  ? <iframe src={filePreviewUrl} title="PDF Preview" style={{ width: '100%', height: 160, border: 'none' }} />
                                  : <img src={filePreviewUrl} alt="Preview" style={{ width: '100%', maxHeight: 160, objectFit: 'contain', background: 'var(--surface)', display: 'block' }} />
                                }
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>

                        <AnimatePresence>
                          {error && (
                            <motion.div initial={{ opacity: 0, y: -8, height: 0 }} animate={{ opacity: 1, y: 0, height: 'auto' }} exit={{ opacity: 0, y: -8, height: 0 }}
                              style={{ padding: '12px 16px', background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.2)', borderRadius: 12, color: 'var(--rose)', fontSize: '0.8rem', display: 'flex', alignItems: 'flex-start', gap: 8 }}
                            >
                              <AlertCircle style={{ width: 14, height: 14, flexShrink: 0, marginTop: 1 }} />
                              {error}
                            </motion.div>
                          )}
                        </AnimatePresence>

                        <motion.button type="submit" disabled={loading} className="btn-primary"
                          style={{ padding: '14px', borderRadius: 14, fontSize: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}
                          whileHover={!loading ? { scale: 1.01 } : {}} whileTap={!loading ? { scale: 0.99 } : {}}
                        >
                          {loading ? (
                            <>
                              <motion.div animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}>
                                <Loader2 style={{ width: 18, height: 18 }} />
                              </motion.div>
                              Analyzing report...
                            </>
                          ) : (
                            <>
                              <Sparkles style={{ width: 18, height: 18 }} />
                              Simplify Report
                            </>
                          )}
                        </motion.button>
                      </form>
                    </div>
                  </motion.div>

                  {/* ── Right: Results ────────────────────────────────── */}
                  <div style={{ gridColumn: 'span 7', position: 'relative' }}>
                    <AnimatePresence mode="wait">
                      {showHistory ? (
                        /* History Panel */
                        <motion.div key="history" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                          className="glass-bright" style={{ borderRadius: 24, overflow: 'hidden', minHeight: 520 }}
                        >
                          <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <History style={{ width: 18, height: 18, color: 'var(--jade)' }} />
                              <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.9rem' }}>Report History</span>
                              <span style={{ background: 'var(--jade-glow)', border: '1px solid rgba(0,212,138,0.2)', color: 'var(--jade)', fontSize: '0.7rem', padding: '2px 8px', borderRadius: 99, fontFamily: 'var(--font-display)', fontWeight: 700 }}>
                                {history.length}
                              </span>
                            </div>
                            <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => setShowHistory(false)}
                              style={{ padding: 6, background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}
                            >
                              <X style={{ width: 14, height: 14 }} />
                            </motion.button>
                          </div>

                          <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 480, overflowY: 'auto' }}>
                            {history.length === 0 ? (
                              <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
                                <History style={{ width: 40, height: 40, margin: '0 auto 12px', opacity: 0.2 }} />
                                <p style={{ fontSize: '0.875rem' }}>No reports yet</p>
                              </div>
                            ) : history.map((item, i) => (
                              <motion.div key={item.id} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
                                className="history-item" style={{ borderRadius: 14, padding: '14px 16px', position: 'relative' }}
                                onClick={() => { setCurrentReport(item); setShowHistory(false); setActiveResultTab('summary'); }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    {editingTitleId === item.id ? (
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }} onClick={e => e.stopPropagation()}>
                                        <input value={newTitle} onChange={e => setNewTitle(e.target.value)}
                                          className="input-field" style={{ flex: 1, padding: '4px 10px', borderRadius: 8, fontSize: '0.82rem' }} autoFocus
                                        />
                                        <button onClick={() => updateReportTitle(item.id)} style={{ color: 'var(--jade)', background: 'none', border: 'none', cursor: 'pointer' }}><Check style={{ width: 14, height: 14 }} /></button>
                                        <button onClick={() => setEditingTitleId(null)} style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}><X style={{ width: 14, height: 14 }} /></button>
                                      </div>
                                    ) : (
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <span style={{ fontWeight: 600, fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</span>
                                        <button onClick={e => { e.stopPropagation(); setEditingTitleId(item.id); setNewTitle(item.title); }}
                                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2, opacity: 0.5 }}
                                        ><Edit2 style={{ width: 11, height: 11 }} /></button>
                                      </div>
                                    )}
                                    <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 3 }}>
                                      {item.createdAt?.toDate ? item.createdAt.toDate().toLocaleDateString() : 'Just now'}
                                    </p>
                                  </div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <button onClick={e => { e.stopPropagation(); deleteReport(item.id); }}
                                      style={{ padding: 6, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', transition: 'color 0.2s' }}
                                      onMouseOver={e => (e.currentTarget.style.color = 'var(--rose)')}
                                      onMouseOut={e => (e.currentTarget.style.color = 'var(--text-muted)')}
                                    ><Trash2 style={{ width: 13, height: 13 }} /></button>
                                    <ChevronRight style={{ width: 14, height: 14, color: 'var(--text-muted)' }} />
                                  </div>
                                </div>
                              </motion.div>
                            ))}
                          </div>
                        </motion.div>
                      ) : currentReport ? (
                        /* Results Panel */
                        <motion.div key="results" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                          style={{ display: 'flex', flexDirection: 'column', gap: 20 }}
                        >
                          {/* Results Card */}
                          <div className="glass-bright jade-glow-box" style={{ borderRadius: 24, overflow: 'hidden' }}>
                            {/* Header bar */}
                            <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(0,212,138,0.03)' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <div style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--jade-glow)', border: '1px solid rgba(0,212,138,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  <Brain style={{ width: 16, height: 16, color: 'var(--jade)' }} />
                                </div>
                                <div>
                                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.88rem' }}>{currentReport.title}</div>
                                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 1, display: 'flex', gap: 8 }}>
                                    {criticalCount > 0 && <span style={{ color: 'var(--rose)' }}>● {criticalCount} critical</span>}
                                    {cautionCount > 0 && <span style={{ color: 'var(--amber)' }}>● {cautionCount} caution</span>}
                                    {criticalCount === 0 && cautionCount === 0 && <span style={{ color: 'var(--jade)' }}>● All clear</span>}
                                  </div>
                                </div>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                {/* Language */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '6px 10px' }}>
                                  <Languages style={{ width: 13, height: 13, color: 'var(--text-muted)' }} />
                                  <select value={targetLang} onChange={e => handleTranslate(e.target.value)} disabled={translating}
                                    style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', fontSize: '0.75rem', cursor: 'pointer', outline: 'none', fontFamily: 'var(--font-display)' }}
                                  >
                                    <option value="en">English</option>
                                    <option value="hi">हिन्दी</option>
                                    <option value="or">ଓଡ଼ିଆ</option>
                                    <option value="mr">मराठी</option>
                                    <option value="te">తెలుగు</option>
                                    <option value="bn">বাংলা</option>
                                    <option value="ta">தமிழ்</option>
                                    <option value="kn">ಕನ್ನಡ</option>
                                    <option value="gu">ગુજરાતી</option>
                                    <option value="ml">മലയാളം</option>
                                    <option value="pa">ਪੰਜਾਬੀ</option>
                                  </select>
                                  {translating && <motion.div animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}><Loader2 style={{ width: 12, height: 12, color: 'var(--jade)' }} /></motion.div>}
                                </div>
                                <motion.button whileHover={{ scale: 1.05 }} onClick={() => setCurrentReport(null)}
                                  style={{ padding: '6px 12px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 10, cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.75rem', fontFamily: 'var(--font-display)' }}
                                >Clear</motion.button>
                              </div>
                            </div>

                            {/* Tabs */}
                            <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border)', padding: '0 24px' }}>
                              {([['summary', 'Summary', FileText], ['concerns', 'Concerns', AlertCircle], ['meaning', 'Meaning', Info]] as const).map(([tab, label, Icon]) => (
                                <button key={tab} onClick={() => setActiveResultTab(tab)}
                                  style={{
                                    padding: '12px 18px', background: 'none', border: 'none', cursor: 'pointer',
                                    fontSize: '0.78rem', fontFamily: 'var(--font-display)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6,
                                    color: activeResultTab === tab ? 'var(--jade)' : 'var(--text-muted)',
                                    borderBottom: activeResultTab === tab ? '2px solid var(--jade)' : '2px solid transparent',
                                    transition: 'all 0.2s', marginBottom: -1
                                  }}
                                >
                                  <Icon style={{ width: 13, height: 13 }} />
                                  {label}
                                  {tab === 'concerns' && (
                                    <span style={{ marginLeft: 2, minWidth: 16, height: 16, borderRadius: 99, background: criticalCount > 0 ? 'rgba(244,63,94,0.15)' : cautionCount > 0 ? 'rgba(245,158,11,0.15)' : 'var(--jade-glow)', color: criticalCount > 0 ? 'var(--rose)' : cautionCount > 0 ? 'var(--amber)' : 'var(--jade)', fontSize: '0.65rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px' }}>
                                      {currentReport.simplifiedData.concerns.length}
                                    </span>
                                  )}
                                </button>
                              ))}
                            </div>

                            <div style={{ padding: '24px' }}>
                              <AnimatePresence mode="wait">
                                {activeResultTab === 'summary' && (
                                  <motion.div key="sum" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                                    <p style={{ color: 'var(--text-secondary)', lineHeight: 1.75, fontSize: '0.9rem' }}>
                                      {currentReport.simplifiedData.summary}
                                    </p>
                                    <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
                                      <motion.button whileHover={{ scale: 1.02 }} onClick={() => speakText(currentReport.simplifiedData.summary)} disabled={speaking}
                                        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', background: 'var(--jade-glow)', border: '1px solid rgba(0,212,138,0.2)', borderRadius: 10, cursor: 'pointer', color: 'var(--jade)', fontSize: '0.78rem', fontFamily: 'var(--font-display)', fontWeight: 600 }}
                                      >
                                        {speaking ? <motion.div animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}><Loader2 style={{ width: 14, height: 14 }} /></motion.div> : <Volume2 style={{ width: 14, height: 14 }} />}
                                        {speaking ? 'Playing...' : 'Listen'}
                                      </motion.button>
                                    </div>
                                  </motion.div>
                                )}
                                {activeResultTab === 'concerns' && (
                                  <motion.div key="con" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                                    style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
                                  >
                                    {currentReport.simplifiedData.concerns.map((concern, idx) => (
                                      <motion.div key={idx} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.05 }}
                                        className={cn('concern-row', severityColor(concern.severity))}
                                        style={{ padding: '12px 16px', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}
                                      >
                                        <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>{concern.item}</span>
                                        <span style={{ fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', padding: '3px 8px', borderRadius: 99, background: 'rgba(0,0,0,0.2)', whiteSpace: 'nowrap' }}>
                                          {concern.severity}
                                        </span>
                                      </motion.div>
                                    ))}
                                  </motion.div>
                                )}
                                {activeResultTab === 'meaning' && (
                                  <motion.div key="mea" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                                    <div className="prose-dark" style={{ fontSize: '0.88rem', lineHeight: 1.8 }}>
                                      <ReactMarkdown>{currentReport.simplifiedData.meaning}</ReactMarkdown>
                                    </div>
                                    <motion.button whileHover={{ scale: 1.02 }} onClick={() => speakText(currentReport.simplifiedData.meaning)} disabled={speaking}
                                      style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.2)', borderRadius: 10, cursor: 'pointer', color: 'var(--sky)', fontSize: '0.78rem', fontFamily: 'var(--font-display)', fontWeight: 600 }}
                                    >
                                      {speaking ? <motion.div animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}><Loader2 style={{ width: 14, height: 14 }} /></motion.div> : <Volume2 style={{ width: 14, height: 14 }} />}
                                      Listen
                                    </motion.button>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          </div>

                          {/* Chat Interface */}
                          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
                            className="glass-bright" style={{ borderRadius: 24, overflow: 'hidden', display: 'flex', flexDirection: 'column', height: 420 }}
                          >
                            <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  <MessageSquare style={{ width: 15, height: 15, color: 'var(--sky)' }} />
                                </div>
                                <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.88rem' }}>AI Assistant</span>
                              </div>
                              <motion.button whileHover={{ scale: 1.05 }} onClick={() => setAutoSpeak(v => !v)}
                                style={{ padding: '6px 12px', background: autoSpeak ? 'var(--jade-glow)' : 'transparent', border: `1px solid ${autoSpeak ? 'rgba(0,212,138,0.3)' : 'var(--border)'}`, borderRadius: 10, cursor: 'pointer', color: autoSpeak ? 'var(--jade)' : 'var(--text-muted)', fontSize: '0.72rem', fontFamily: 'var(--font-display)', display: 'flex', alignItems: 'center', gap: 6 }}
                              >
                                {autoSpeak ? <Volume2 style={{ width: 13, height: 13 }} /> : <VolumeX style={{ width: 13, height: 13 }} />}
                                {autoSpeak ? 'Auto-speak on' : 'Auto-speak off'}
                              </motion.button>
                            </div>

                            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12, background: 'var(--abyss)' }}>
                              {chatMessages.length === 0 && (
                                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { delay: 0.3 } }}
                                  style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, color: 'var(--text-muted)', textAlign: 'center', padding: '0 20px' }}
                                >
                                  <Sparkles style={{ width: 28, height: 28, opacity: 0.3 }} />
                                  <p style={{ fontSize: '0.82rem', lineHeight: 1.5 }}>Ask any question about your report.<br />I'm here to help you understand it.</p>
                                </motion.div>
                              )}
                              {chatMessages.map((msg, i) => (
                                <motion.div key={msg.id} initial={{ opacity: 0, y: 10, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
                                  style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}
                                >
                                  <div
                                    className={msg.role === 'user' ? 'chat-user' : 'chat-ai'}
                                    style={{ maxWidth: '78%', padding: '10px 14px', borderRadius: msg.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px', fontSize: '0.85rem', lineHeight: 1.55, position: 'relative' }}
                                  >
                                    <div className="prose-dark" style={{ color: msg.role === 'user' ? 'var(--void)' : 'inherit' }}>
                                      <ReactMarkdown>{msg.text}</ReactMarkdown>
                                    </div>
                                    {msg.role === 'model' && (
                                      <motion.button whileHover={{ scale: 1.1 }} onClick={() => speakText(msg.text)}
                                        style={{ position: 'absolute', top: 6, right: -30, padding: 4, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', opacity: 0.7 }}
                                      ><Volume2 style={{ width: 12, height: 12 }} /></motion.button>
                                    )}
                                  </div>
                                </motion.div>
                              ))}
                              {chatLoading && (
                                <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                                  <div className="chat-ai" style={{ padding: '10px 16px', borderRadius: '18px 18px 18px 4px', display: 'flex', gap: 4, alignItems: 'center' }}>
                                    {[0, 1, 2].map(i => (
                                      <motion.div key={i} animate={{ y: [0, -4, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
                                        style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--jade)' }}
                                      />
                                    ))}
                                  </div>
                                </div>
                              )}
                              <div ref={chatEndRef} />
                            </div>

                            <form onSubmit={handleChatSubmit} style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', background: 'var(--surface)', display: 'flex', gap: 8 }}>
                              <motion.button type="button" whileTap={{ scale: 0.9 }} onClick={toggleListening}
                                style={{ width: 38, height: 38, flexShrink: 0, borderRadius: 12, border: `1px solid ${isListening ? 'rgba(244,63,94,0.3)' : 'var(--border)'}`, background: isListening ? 'rgba(244,63,94,0.08)' : 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: isListening ? 'var(--rose)' : 'var(--text-muted)' }}
                                animate={isListening ? { boxShadow: ['0 0 0 0 rgba(244,63,94,0.3)', '0 0 0 8px rgba(244,63,94,0)', '0 0 0 0 rgba(244,63,94,0)'] } : {}}
                                transition={isListening ? { duration: 1.2, repeat: Infinity } : {}}
                              >
                                {isListening ? <Mic style={{ width: 15, height: 15 }} /> : <MicOff style={{ width: 15, height: 15 }} />}
                              </motion.button>
                              <input value={chatInput} onChange={e => setChatInput(e.target.value)}
                                placeholder={isListening ? "Listening..." : "Ask about your report..."}
                                className="input-field"
                                style={{ flex: 1, padding: '9px 14px', borderRadius: 12, fontSize: '0.85rem' }}
                              />
                              <motion.button type="submit" disabled={!chatInput.trim() || chatLoading}
                                whileHover={chatInput.trim() && !chatLoading ? { scale: 1.05 } : {}}
                                whileTap={chatInput.trim() && !chatLoading ? { scale: 0.95 } : {}}
                                style={{ width: 38, height: 38, flexShrink: 0, borderRadius: 12, background: chatInput.trim() && !chatLoading ? 'var(--jade)' : 'var(--surface)', border: '1px solid var(--border)', cursor: chatInput.trim() && !chatLoading ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', color: chatInput.trim() && !chatLoading ? 'var(--void)' : 'var(--text-muted)', transition: 'all 0.2s' }}
                              >
                                <Send style={{ width: 15, height: 15 }} />
                              </motion.button>
                            </form>
                          </motion.div>
                        </motion.div>
                      ) : (
                        /* Empty State */
                        <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                          className="glass" style={{ borderRadius: 24, minHeight: 520, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, textAlign: 'center', padding: 48 }}
                        >
                          <motion.div animate={{ y: [0, -10, 0] }} transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}>
                            <div style={{ width: 80, height: 80, borderRadius: 24, background: 'var(--surface)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                              <Brain style={{ width: 36, height: 36, color: 'var(--text-muted)' }} />
                              <motion.div
                                style={{ position: 'absolute', inset: -4, borderRadius: 28, border: '1px solid rgba(0,212,138,0.1)' }}
                                animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0, 0.3] }}
                                transition={{ duration: 3, repeat: Infinity }}
                              />
                            </div>
                          </motion.div>
                          <div>
                            <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.1rem', marginBottom: 8 }}>Ready to analyze</h3>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', maxWidth: 280, lineHeight: 1.6 }}>
                              Submit a report on the left to see your simplified, plain-language explanation here.
                            </p>
                          </div>
                          <div style={{ display: 'flex', gap: 8 }}>
                            {['Summary', 'Concerns', 'Meaning', 'Chat'].map((label, i) => (
                              <motion.div key={label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 + i * 0.07 }}
                                style={{ padding: '5px 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 99, fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-display)' }}
                              >{label}</motion.div>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        {/* ─── Footer ─────────────────────────────────────────────────────── */}
        <footer style={{ borderTop: '1px solid var(--border)', padding: '40px 24px', background: 'rgba(6,8,16,0.6)', backdropFilter: 'blur(12px)', position: 'relative', zIndex: 1 }}>
          <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <FullLogo iconSize={30} textSize="1rem" />
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', maxWidth: 460, textAlign: 'center', lineHeight: 1.6 }}>
              This tool is for informational purposes only and does not constitute medical advice. Always consult a qualified healthcare professional.
            </p>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.68rem', opacity: 0.5 }}>© 2026 MediCode. All rights reserved.</p>
          </div>
        </footer>
      </div>
    </>
  );
}

export default function App() {
  return <ErrorBoundary><MedicalSimplifier /></ErrorBoundary>;
}