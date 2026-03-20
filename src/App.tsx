import React, { useState, useEffect, useRef } from "react";
import { 
  Upload, FileText, Loader2, HeartPulse, Brain, Info, 
  History, User, Trash2, ChevronRight, LogOut,
  AlertCircle, X, Edit2, Check, MessageSquare, Send, Volume2, Languages,
  Mic, MicOff, VolumeX
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import ReactMarkdown from "react-markdown";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";

GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Error Boundary ---
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: any }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      let message = "Something went wrong.";
      try {
        const parsed = JSON.parse(this.state.error.message);
        if (parsed.error) message = `Database Error: ${parsed.error}`;
      } catch (e) {
        message = this.state.error.message || message;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
          <div className="bg-white p-8 rounded-2xl shadow-xl border border-red-100 max-w-md w-full text-center space-y-4">
            <div className="bg-red-100 p-3 rounded-full w-fit mx-auto">
              <AlertCircle className="text-red-600 w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">Application Error</h2>
            <p className="text-slate-500 text-sm">{message}</p>
            <button 
              onClick={() => window.location.reload()}
              className="w-full bg-slate-900 text-white py-2 rounded-lg font-medium hover:bg-slate-800 transition-colors"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// --- Types ---
interface SimplifiedData {
  summary: string;
  concerns: { item: string; severity: "Normal" | "Caution" | "Critical" }[];
  meaning: string;
}

interface Report {
  id: string;
  userId: string;
  originalText: string;
  simplifiedData: SimplifiedData;
  createdAt: any;
  title: string;
  fileUrl?: string;
}

interface ChatMessage {
  id: string;
  role: "user" | "model";
  text: string;
  createdAt: any;
}

interface SessionUser {
  id: string;
  username: string;
}

// --- Main App Component ---
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
  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recordedChunksRef = useRef<BlobPart[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const networkRetryCountRef = useRef(0);
  const networkRetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Initialize Speech Recognition
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      setSpeechRecognitionSupported(true);
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = "en-US";
      
      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setChatInput(transcript);
        networkRetryCountRef.current = 0;
        if (networkRetryTimerRef.current) {
          clearTimeout(networkRetryTimerRef.current);
          networkRetryTimerRef.current = null;
        }
        setIsListening(false);
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error("Speech recognition error:", event.error);
        if (event.error === "audio-capture") {
          setError("Microphone access failed. Please ensure you have granted permission and your microphone is connected.");
        } else if (event.error === "not-allowed") {
          setError("Microphone permission denied. Please enable it in your browser settings.");
        } else if (event.error === "network") {
          if (networkRetryCountRef.current < 1) {
            networkRetryCountRef.current += 1;
            setError("Speech recognition network issue detected. Retrying once...");
            setIsListening(false);
            networkRetryTimerRef.current = setTimeout(() => {
              try {
                setIsListening(true);
                recognitionRef.current?.start();
              } catch {
                setIsListening(false);
              }
            }, 1200);
            return;
          }
          setUseServerSttFallback(true);
          setError("Speech recognition network error. Switched to fallback voice capture mode.");
        } else {
          setError(`Speech recognition error: ${event.error}`);
        }
        setIsListening(false);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    } else {
      setSpeechRecognitionSupported(false);
    }

    return () => {
      if (networkRetryTimerRef.current) {
        clearTimeout(networkRetryTimerRef.current);
        networkRetryTimerRef.current = null;
      }
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const transcribeAudioBlob = async (audioBlob: Blob) => {
    const formData = new FormData();
    formData.append("audio", audioBlob, "speech.webm");

    const response = await fetch("/api/stt", {
      method: "POST",
      body: formData,
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data?.error || "Speech-to-text failed");
    }

    const text = String(data?.text || "").trim();
    if (!text) {
      throw new Error("No speech detected. Please speak closer to the microphone and try again.");
    }

    setChatInput(text);
  };

  const startFallbackRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      recordedChunksRef.current = [];

      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        setIsListening(false);
        try {
          const audioBlob = new Blob(recordedChunksRef.current, { type: "audio/webm" });
          await transcribeAudioBlob(audioBlob);
          setError(null);
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Speech transcription failed.";
          setError(msg);
        } finally {
          mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
          mediaStreamRef.current = null;
          mediaRecorderRef.current = null;
          recordedChunksRef.current = [];
        }
      };

      setIsListening(true);
      recorder.start();
    } catch (err) {
      setIsListening(false);
      setError("Unable to access microphone for fallback recording. Check browser mic permissions.");
    }
  };

  const stopFallbackRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    } else {
      setIsListening(false);
    }
  };

  const toggleListening = () => {
    const shouldUseFallback = useServerSttFallback || !speechRecognitionSupported || !recognitionRef.current;
    if (shouldUseFallback) {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("Speech input is not supported in this browser. Please use Chrome/Edge and allow mic access.");
        return;
      }

      if (isListening) {
        stopFallbackRecording();
      } else {
        startFallbackRecording();
      }
      return;
    }

    if (isListening) {
      if (networkRetryTimerRef.current) {
        clearTimeout(networkRetryTimerRef.current);
        networkRetryTimerRef.current = null;
      }
      networkRetryCountRef.current = 0;
      recognitionRef.current?.stop();
    } else {
      setIsListening(true);
      try {
        recognitionRef.current?.start();
      } catch (err) {
        setIsListening(false);
        setError("Could not start speech recognition. Please retry and ensure mic permission is allowed.");
      }
    }
  };

  const stopSpeaking = () => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }

    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }

    setSpeaking(false);
  };

  const toggleAutoSpeak = () => {
    setAutoSpeak((prev) => {
      const next = !prev;
      if (!next) {
        stopSpeaking();
      }
      return next;
    });
  };

  const loadSessionUser = async () => {
    try {
      const response = await fetch("/api/auth/me");
      if (!response.ok) {
        setSessionUser(null);
        return;
      }

      const data = await response.json();
      setSessionUser(data?.user ?? null);
    } catch (err) {
      console.error("Session fetch error:", err);
      setSessionUser(null);
    }
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      await loadSessionUser();
      if (mounted) {
        setSessionLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const loadHistory = async () => {
    if (!sessionUser) {
      setHistory([]);
      return;
    }

    try {
      const response = await fetch("/api/reports");
      if (!response.ok) {
        setHistory([]);
        return;
      }

      const data = await response.json();
      setHistory(Array.isArray(data?.reports) ? data.reports : []);
    } catch (err) {
      console.error("Failed to load report history:", err);
    }
  };

  useEffect(() => {
    loadHistory();
  }, [sessionUser]);

  useEffect(() => {
    if (!file) {
      setFilePreviewUrl(null);
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setFilePreviewUrl(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [file]);

  const loadMessages = async (reportId: string) => {
    try {
      const response = await fetch(`/api/reports/${reportId}/messages`);
      if (!response.ok) {
        setChatMessages([]);
        return;
      }

      const data = await response.json();
      setChatMessages(Array.isArray(data?.messages) ? data.messages : []);
    } catch (err) {
      console.error("Failed to load messages:", err);
      setChatMessages([]);
    }
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authForm.username.trim() || !authForm.password.trim()) {
      setAuthError("Username and password are required.");
      return;
    }

    setAuthSubmitting(true);
    setAuthError(null);
    try {
      const endpoint = authMode === "login" ? "/api/auth/login" : "/api/auth/signup";
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: authForm.username.trim(),
          password: authForm.password,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Authentication failed");
      }

      setAuthForm({ username: "", password: "" });
      setSessionUser(data.user);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Authentication failed";
      setAuthError(msg);
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      setSessionUser(null);
      setCurrentReport(null);
      setChatMessages([]);
      setShowHistory(false);
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  // Chat Loader
  useEffect(() => {
    if (!currentReport) {
      setChatMessages([]);
      return;
    }
    loadMessages(currentReport.id);
  }, [currentReport]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      const allowedMimeTypes = ["image/jpeg", "image/jpg", "image/png", "application/pdf"];

      if (!allowedMimeTypes.includes(selectedFile.type)) {
        setError("Only JPEG, JPG, PNG, and PDF files are supported.");
        setFile(null);
        return;
      }

      setError(null);
      setFile(selectedFile);
    }
  };

  const fileToDataUrl = (inputFile: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(inputFile);
    });
  };

  const pdfToPageImages = async (pdfFile: File, maxPages = 2): Promise<string[]> => {
    const buffer = await pdfFile.arrayBuffer();
    const pdf = await getDocument({ data: buffer }).promise;
    const pagesToRender = Math.min(pdf.numPages, maxPages);
    const images: string[] = [];

    for (let pageNumber = 1; pageNumber <= pagesToRender; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1.1 });
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      if (!context) continue;

      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await page.render({ canvasContext: context, viewport, canvas }).promise;
      images.push(canvas.toDataURL("image/jpeg", 0.7));
    }

    return images;
  };

  const LANGUAGE_MAP: Record<string, string> = {
    hi: "Hindi",
    or: "Odia",
    mr: "Marathi",
    te: "Telugu",
    bn: "Bengali",
    ta: "Tamil",
    kn: "Kannada",
    gu: "Gujarati",
    ml: "Malayalam",
    pa: "Punjabi",
  };

  const TTS_LANG_MAP: Record<string, string> = {
    en: "en-US",
    hi: "hi-IN",
    or: "or-IN",
    mr: "mr-IN",
    te: "te-IN",
    bn: "bn-IN",
    ta: "ta-IN",
    kn: "kn-IN",
    gu: "gu-IN",
    ml: "ml-IN",
    pa: "pa-IN",
  };

  const getPreferredVoice = (locale: string): SpeechSynthesisVoice | null => {
    if (!("speechSynthesis" in window)) return null;
    const voices = window.speechSynthesis.getVoices();
    if (!voices.length) return null;

    const exact = voices.find((voice) => voice.lang.toLowerCase() === locale.toLowerCase());
    if (exact) return exact;

    const prefix = locale.split("-")[0].toLowerCase();
    const byPrefix = voices.find((voice) => voice.lang.toLowerCase().startsWith(prefix));
    return byPrefix || null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportText && !file) {
      setError("Please provide a report content or upload a file.");
      return;
    }

    if (!sessionUser) {
      setError("Please login to continue.");
      return;
    }

    setLoading(true);
    setError(null);
    setCurrentReport(null);

    try {
      let fileUrl = "";
      let imageDataUrls: string[] = [];
      if (file) {
        const formData = new FormData();
        formData.append("file", file);
        const uploadRes = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });
        const uploadData = await uploadRes.json();
        if (uploadData.url) {
          fileUrl = uploadData.url;
        } else {
          throw new Error("File upload failed");
        }

        if (file.type === "application/pdf") {
          imageDataUrls = await pdfToPageImages(file);
        } else if (file.type.startsWith("image/")) {
          imageDataUrls = [await fileToDataUrl(file)];
        }
      }

      const simplifyRes = await fetch("/api/ai/simplify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportText,
          fileUrl,
          fileName: file?.name,
          imageDataUrls,
        }),
      });

      const simplifyData = await simplifyRes.json().catch(() => ({}));
      if (!simplifyRes.ok || !simplifyData?.simplifiedData) {
        if (simplifyRes.status === 413) {
          throw new Error("Uploaded file is too large to process. Try a smaller file or fewer pages.");
        }
        throw new Error(simplifyData?.error || `AI simplification failed (status ${simplifyRes.status})`);
      }

      const simplifiedData = simplifyData.simplifiedData as SimplifiedData;
      const reportTitle = reportText.slice(0, 50) + (reportText.length > 50 ? "..." : "") || (file ? file.name : "Uploaded Report");
      
      const createRes = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: reportTitle,
          originalText: reportText || (file ? `File: ${file.name}` : "Uploaded file content"),
          simplifiedData,
          fileUrl,
        }),
      });

      const createdData = await createRes.json();
      if (!createRes.ok || !createdData?.report) {
        throw new Error(createdData?.error || "Failed to save report");
      }

      setCurrentReport(createdData.report as Report);
      await loadHistory();

    } catch (err) {
      const message = err instanceof Error ? err.message : "An error occurred while simplifying the report. Please try again.";
      setError(message);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const deleteReport = async (id: string) => {
    try {
      await fetch(`/api/reports/${id}`, { method: "DELETE" });
      if (currentReport?.id === id) setCurrentReport(null);
      await loadHistory();
    } catch (err) {
      console.error("Delete report failed:", err);
    }
  };

  const updateReportTitle = async (id: string) => {
    if (!newTitle.trim()) return;
    try {
      const response = await fetch(`/api/reports/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data?.error || "Failed to update title");
      }

      setEditingTitleId(null);
      await loadHistory();
      if (currentReport?.id === id) {
        setCurrentReport({ ...currentReport, title: newTitle });
      }
    } catch (err) {
      console.error("Update report title failed:", err);
    }
  };

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !currentReport) return;
    if (!sessionUser) {
      setError("Please login to continue.");
      return;
    }

    const messageText = chatInput;
    const currentHistory = [...chatMessages]; // Capture history before adding new message
    setChatInput("");
    setChatLoading(true);

    try {
      // 1. Save user message
      await fetch(`/api/reports/${currentReport.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "user", text: messageText }),
      });

      setChatMessages((prev) => [
        ...prev,
        {
          id: `temp-user-${Date.now()}`,
          role: "user",
          text: messageText,
          createdAt: new Date().toISOString(),
        },
      ]);

      // 2. Get AI response
      const chatRes = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messageText,
          currentReport,
          currentHistory,
        }),
      });

      const chatData = await chatRes.json();
      if (!chatRes.ok || !chatData?.text) {
        throw new Error(chatData?.error || "AI chat failed");
      }
      const aiText = String(chatData.text);

      // 3. Save AI message
      await fetch(`/api/reports/${currentReport.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "model", text: aiText }),
      });

      await loadMessages(currentReport.id);

      // 4. Auto-speak if enabled
      if (autoSpeak) {
        speakText(aiText);
      }

    } catch (err) {
      setError("AI chat failed. Please verify GROQ_API_KEY and try again.");
      console.error("Chat error:", err);
    } finally {
      setChatLoading(false);
    }
  };

  const handleTranslate = async (lang: string) => {
    if (!currentReport || translating) return;
    setTargetLang(lang);
    
    if (lang === "en") {
      // Restore original English data from history
      const original = history.find(h => h.id === currentReport.id);
      if (original) {
        setCurrentReport({
          ...currentReport,
          simplifiedData: original.simplifiedData
        });
      }
      return;
    }

    setTranslating(true);
    setError(null);
    try {
      const response = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: JSON.stringify(currentReport.simplifiedData),
          targetLanguage: LANGUAGE_MAP[lang] || lang
        })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Translation failed");
      }
      if (data.translatedText) {
        try {
          // Clean up potential markdown code blocks from AI response
          const cleanedText = data.translatedText.replace(/```json\n?|\n?```/g, '').trim();
          const translatedData = JSON.parse(cleanedText) as SimplifiedData;
          setCurrentReport({
            ...currentReport,
            simplifiedData: translatedData
          });
        } catch (e) {
          console.error("Failed to parse translated JSON:", e);
          setError("Translation response could not be parsed. Please retry.");
        }
      }
    } catch (err) {
      console.error("Translation error:", err);
      const msg = err instanceof Error ? err.message : "Translation failed";
      setError(msg);
    } finally {
      setTranslating(false);
    }
  };

  const speakText = async (text: string) => {
    if (!text?.trim()) return;
    if (speaking) {
      stopSpeaking();
    }

    setSpeaking(true);
    try {
      const response = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, targetLang })
      });
      const data = await response.json();
      if (data.audioData) {
        // Convert base64 to ArrayBuffer
        const binaryString = atob(data.audioData);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        
        // Create a Blob and URL
        const blob = new Blob([bytes], { type: 'audio/mpeg' });
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audioRef.current = audio;
        audioUrlRef.current = url;
        
        audio.onended = () => {
          setSpeaking(false);
          if (audioUrlRef.current) {
            URL.revokeObjectURL(audioUrlRef.current);
            audioUrlRef.current = null;
          }
          audioRef.current = null;
        };
        audio.onerror = (e) => {
          console.error("Audio playback error:", e);
          setSpeaking(false);
          if (audioUrlRef.current) {
            URL.revokeObjectURL(audioUrlRef.current);
            audioUrlRef.current = null;
          }
          audioRef.current = null;
        };
        
        await audio.play();
      } else {
        throw new Error("No audio data returned from server TTS");
      }
    } catch (err) {
      console.error("Server TTS error, trying browser fallback:", err);

      if ("speechSynthesis" in window) {
        const utterance = new SpeechSynthesisUtterance(text);
        const locale = TTS_LANG_MAP[targetLang] || "en-US";
        utterance.lang = locale;
        const selectedVoice = getPreferredVoice(locale);
        if (selectedVoice) {
          utterance.voice = selectedVoice;
        }
        utterance.rate = 1;
        utterance.onend = () => setSpeaking(false);
        utterance.onerror = () => {
          setSpeaking(false);
          setError("Text-to-speech failed. Server and browser voices were unavailable.");
        };
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utterance);
        return;
      }

      setSpeaking(false);
      setError("Text-to-speech failed. No voice engine available.");
    }
  };

  const handleListen = () => speakText(currentReport?.simplifiedData.summary || "");
  const handleListenMeaning = () => speakText(currentReport?.simplifiedData.meaning || "");

  if (sessionLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-emerald-500 p-2 rounded-lg">
              <HeartPulse className="text-white w-6 h-6" />
            </div>
            <h1 className="text-xl font-semibold tracking-tight">MediCode</h1>
          </div>
          
          <div className="flex items-center gap-3">
            {sessionUser && (
              <>
                <button 
                  onClick={() => setShowHistory(!showHistory)}
                  className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors relative"
                >
                  <History className="w-5 h-5" />
                  {history.length > 0 && (
                    <span className="absolute top-1 right-1 w-2 h-2 bg-emerald-500 rounded-full border-2 border-white" />
                  )}
                </button>
                <div className="h-8 w-px bg-slate-200" />
              </>
            )}
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-xs overflow-hidden">
                <User className="w-4 h-4" />
              </div>
              <span className="text-sm font-medium text-slate-500">{sessionUser ? sessionUser.username : "Not logged in"}</span>
            </div>
            {sessionUser && (
              <button
                onClick={handleLogout}
                className="flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Logout
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-12">
        {!sessionUser ? (
          <div className="max-w-md mx-auto bg-white border border-slate-200 rounded-2xl shadow-xl p-8 space-y-6">
            <div className="space-y-2 text-center">
              <h2 className="text-2xl font-bold text-slate-900">{authMode === "login" ? "Login" : "Create Account"}</h2>
              <p className="text-sm text-slate-500">
                Use local authentication powered by Passport.
              </p>
            </div>

            <form onSubmit={handleAuthSubmit} className="space-y-4">
              <input
                type="text"
                value={authForm.username}
                onChange={(e) => setAuthForm((prev) => ({ ...prev, username: e.target.value }))}
                placeholder="Username"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
              />
              <input
                type="password"
                value={authForm.password}
                onChange={(e) => setAuthForm((prev) => ({ ...prev, password: e.target.value }))}
                placeholder="Password"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
              />

              {authError && (
                <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm">
                  {authError}
                </div>
              )}

              <button
                type="submit"
                disabled={authSubmitting}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 rounded-xl transition-colors disabled:opacity-60"
              >
                {authSubmitting ? "Please wait..." : authMode === "login" ? "Login" : "Sign Up"}
              </button>
            </form>

            <button
              onClick={() => {
                setAuthMode(authMode === "login" ? "signup" : "login");
                setAuthError(null);
              }}
              className="w-full text-sm text-slate-600 hover:text-slate-900 transition-colors"
            >
              {authMode === "login" ? "Need an account? Sign up" : "Already have an account? Login"}
            </button>
          </div>
        ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
            {/* Left Column: Input Form */}
            <div className="lg:col-span-5 space-y-8">
              <div className="space-y-2">
                <h2 className="text-3xl font-bold tracking-tight text-slate-900">Simplify Report</h2>
                <p className="text-slate-500 leading-relaxed">
                  Paste your report text or upload a document.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Paste Report Text
                  </label>
                  <textarea
                    value={reportText}
                    onChange={(e) => setReportText(e.target.value)}
                    placeholder="Paste the complex medical text here..."
                    className="w-full h-48 p-4 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all resize-none shadow-sm"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    <Upload className="w-4 h-4" />
                    Upload Document (Optional)
                  </label>
                  <div className="relative group">
                    <input
                      type="file"
                      onChange={handleFileChange}
                      accept=".jpeg,.jpg,.png,.pdf,image/jpeg,image/jpg,image/png,application/pdf"
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    />
                    <div className={cn(
                      "border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center gap-2 transition-all",
                      file ? "border-emerald-500 bg-emerald-50" : "border-slate-200 bg-white group-hover:border-emerald-400 group-hover:bg-slate-50"
                    )}>
                      <Upload className={cn("w-8 h-8", file ? "text-emerald-500" : "text-slate-400")} />
                      <span className="text-sm font-medium text-slate-600">
                        {file ? file.name : "Click or drag to upload report image/PDF"}
                      </span>
                    </div>
                  </div>

                  {file && filePreviewUrl && (
                    <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 overflow-hidden">
                      <div className="px-3 py-2 text-xs font-semibold text-slate-600 border-b border-slate-200">
                        File Preview
                      </div>
                      {file.type === "application/pdf" ? (
                        <iframe
                          src={filePreviewUrl}
                          title="PDF Preview"
                          className="w-full h-56"
                        />
                      ) : (
                        <img
                          src={filePreviewUrl}
                          alt="Selected file preview"
                          className="w-full h-56 object-contain bg-white"
                        />
                      )}
                    </div>
                  )}
                </div>

                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm flex items-center gap-2"
                  >
                    <Info className="w-4 h-4 shrink-0" />
                    {error}
                  </motion.div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-4 rounded-xl shadow-lg shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Simplifying...
                    </>
                  ) : (
                    <>
                      <Brain className="w-5 h-5" />
                      Simplify Report
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* Right Column: Output / History */}
            <div className="lg:col-span-7 relative">
              <AnimatePresence mode="wait">
                {showHistory ? (
                  <motion.div
                    key="history"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 20 }}
                    className="bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden min-h-[600px] flex flex-col"
                  >
                    <div className="bg-slate-900 p-6 flex items-center justify-between">
                      <div className="flex items-center gap-3 text-white">
                        <History className="w-5 h-5" />
                        <h3 className="font-semibold">Simplification History</h3>
                      </div>
                      <button onClick={() => setShowHistory(false)} className="text-slate-400 hover:text-white">
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                      {history.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-2 py-12">
                          <History className="w-12 h-12 opacity-20" />
                          <p>No history found</p>
                        </div>
                      ) : (
                        history.map((item) => (
                          <div 
                            key={item.id}
                            className="group p-4 rounded-xl border border-slate-100 hover:border-emerald-200 hover:bg-emerald-50/30 transition-all cursor-pointer relative"
                            onClick={() => {
                              setCurrentReport(item);
                              setShowHistory(false);
                            }}
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="space-y-1 flex-1 min-w-0">
                                {editingTitleId === item.id ? (
                                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                    <input 
                                      value={newTitle}
                                      onChange={(e) => setNewTitle(e.target.value)}
                                      className="flex-1 bg-white border border-slate-200 rounded px-2 py-1 text-sm"
                                      autoFocus
                                    />
                                    <button onClick={() => updateReportTitle(item.id)} className="text-emerald-600">
                                      <Check className="w-4 h-4" />
                                    </button>
                                    <button onClick={() => setEditingTitleId(null)} className="text-slate-400">
                                      <X className="w-4 h-4" />
                                    </button>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-2">
                                    <h4 className="font-semibold text-slate-900 truncate">{item.title}</h4>
                                    <button 
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setEditingTitleId(item.id);
                                        setNewTitle(item.title);
                                      }}
                                      className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-slate-600"
                                    >
                                      <Edit2 className="w-3 h-3" />
                                    </button>
                                  </div>
                                )}
                                <p className="text-xs text-slate-400">
                                  {item.createdAt?.toDate ? item.createdAt.toDate().toLocaleDateString() : 'Just now'}
                                </p>
                              </div>
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteReport(item.id);
                                }}
                                className="p-2 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                              <ChevronRight className="w-4 h-4 text-slate-300 self-center" />
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="output"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-6"
                  >
                    {currentReport ? (
                      <>
                        {/* Results Display */}
                        <div className="bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
                          <div className="bg-emerald-600 p-6 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="bg-white/20 p-2 rounded-lg backdrop-blur-sm">
                                <Brain className="text-white w-5 h-5" />
                              </div>
                              <h3 className="text-white font-semibold">Simplified Explanation</h3>
                            </div>
                            <div className="flex items-center gap-2">
                              {/* Language Selector */}
                              <div className="flex items-center gap-1 bg-white/10 rounded-lg px-2 py-1">
                                <Languages className="w-4 h-4 text-white/70" />
                                <select 
                                  value={targetLang}
                                  onChange={(e) => handleTranslate(e.target.value)}
                                  className="bg-transparent text-white text-xs font-medium outline-none cursor-pointer"
                                  disabled={translating}
                                >
                                  <option value="en" className="text-slate-900">English</option>
                                  <option value="hi" className="text-slate-900">Hindi (हिन्दी)</option>
                                  <option value="or" className="text-slate-900">Odia (ଓଡ଼ିଆ)</option>
                                  <option value="mr" className="text-slate-900">Marathi (मराठी)</option>
                                  <option value="te" className="text-slate-900">Telugu (తెలుగు)</option>
                                  <option value="bn" className="text-slate-900">Bengali (বাংলা)</option>
                                  <option value="ta" className="text-slate-900">Tamil (தமிழ்)</option>
                                  <option value="kn" className="text-slate-900">Kannada (ಕನ್ನಡ)</option>
                                  <option value="gu" className="text-slate-900">Gujarati (ગુજરાતી)</option>
                                  <option value="ml" className="text-slate-900">Malayalam (മലയാളം)</option>
                                  <option value="pa" className="text-slate-900">Punjabi (ਪੰਜਾਬੀ)</option>
                                </select>
                              </div>
                              {translating && (
                                <div className="flex items-center gap-1 text-white/90 text-xs font-semibold bg-white/10 rounded-lg px-2 py-1">
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                  Translating...
                                </div>
                              )}
                              <button
                                onClick={() => setCurrentReport(null)}
                                className="text-white/80 hover:text-white text-sm font-medium transition-colors"
                              >
                                Clear
                              </button>
                            </div>
                          </div>
                          
                          <div className="p-8 space-y-8">
                            {/* Section 1: Report Summary */}
                            <section className="space-y-3">
                              <div className="flex items-center justify-between">
                                <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                                  <FileText className="w-4 h-4" />
                                  Report Summary
                                </h4>
                                {currentReport.fileUrl && (
                                  <a 
                                    href={currentReport.fileUrl} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-xs text-emerald-600 hover:text-emerald-700 font-semibold flex items-center gap-1 transition-colors"
                                  >
                                    <Upload className="w-3 h-3" />
                                    Original File
                                  </a>
                                )}
                              </div>
                              <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                                <p className="text-slate-700 leading-relaxed">
                                  {currentReport.simplifiedData.summary}
                                </p>
                                <button 
                                  onClick={handleListen}
                                  disabled={speaking}
                                  className="mt-4 flex items-center gap-2 text-emerald-600 text-sm font-semibold hover:text-emerald-700 transition-colors disabled:opacity-50"
                                >
                                  {speaking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Volume2 className="w-4 h-4" />}
                                  {speaking ? "Speaking..." : "Listen to Summary"}
                                </button>
                              </div>
                            </section>

                            {/* Section 2: Key Concerns */}
                            <section className="space-y-3">
                              <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                                <AlertCircle className="w-4 h-4" />
                                Key Concerns
                              </h4>
                              <div className="grid grid-cols-1 gap-3">
                                {currentReport.simplifiedData.concerns.map((concern, idx) => (
                                  <div 
                                    key={idx}
                                    className={cn(
                                      "p-4 rounded-xl border flex items-center justify-between gap-4",
                                      concern.severity === "Normal" && "bg-emerald-50 border-emerald-100 text-emerald-800",
                                      concern.severity === "Caution" && "bg-yellow-50 border-yellow-100 text-yellow-800",
                                      concern.severity === "Critical" && "bg-red-50 border-red-100 text-red-800"
                                    )}
                                  >
                                    <span className="font-medium">{concern.item}</span>
                                    <span className={cn(
                                      "text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-full",
                                      concern.severity === "Normal" && "bg-emerald-200/50",
                                      concern.severity === "Caution" && "bg-yellow-200/50",
                                      concern.severity === "Critical" && "bg-red-200/50"
                                    )}>
                                      {concern.severity}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </section>

                            {/* Section 3: What This Means For You */}
                            <section className="space-y-3">
                              <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                                <Info className="w-4 h-4" />
                                What This Means For You
                              </h4>
                              <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100">
                                <div className="prose prose-sm prose-blue max-w-none">
                                  <ReactMarkdown>{currentReport.simplifiedData.meaning}</ReactMarkdown>
                                </div>
                                <button 
                                  onClick={handleListenMeaning}
                                  disabled={speaking}
                                  className="mt-4 flex items-center gap-2 text-blue-700 text-sm font-semibold hover:text-blue-800 transition-colors disabled:opacity-50"
                                >
                                  {speaking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Volume2 className="w-4 h-4" />}
                                  {speaking ? "Speaking..." : "Listen to What This Means For You"}
                                </button>
                              </div>
                            </section>
                          </div>
                        </div>

                        {/* Chat Interface */}
                        <div className="bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden flex flex-col h-[450px]">
                          <div className="bg-slate-900 p-4 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <MessageSquare className="text-white w-5 h-5" />
                              <h3 className="text-white font-semibold text-sm">Talk to AI Assistant</h3>
                            </div>
                            <button 
                              onClick={toggleAutoSpeak}
                              className={cn(
                                "p-2 rounded-lg transition-colors",
                                autoSpeak ? "bg-emerald-500 text-white" : "text-slate-400 hover:text-white"
                              )}
                              title={autoSpeak ? "Voice Response ON (click to mute/stop)" : "Voice Response OFF"}
                            >
                              {autoSpeak ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                            </button>
                          </div>
                          
                          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
                            {chatMessages.length === 0 && (
                              <div className="h-full flex flex-col items-center justify-center text-slate-400 text-center p-8 space-y-2">
                                <MessageSquare className="w-8 h-8 opacity-20" />
                                <p className="text-sm">Have questions about this report? Ask me anything.</p>
                              </div>
                            )}
                            {chatMessages.map((msg) => (
                              <div 
                                key={msg.id}
                                className={cn(
                                  "max-w-[80%] p-3 rounded-2xl text-sm relative group",
                                  msg.role === "user" 
                                    ? "bg-emerald-600 text-white ml-auto rounded-tr-none" 
                                    : "bg-white border border-slate-200 text-slate-700 mr-auto rounded-tl-none"
                                )}
                              >
                                <ReactMarkdown>{msg.text}</ReactMarkdown>
                                {msg.role === "model" && (
                                  <button 
                                    onClick={() => speakText(msg.text)}
                                    className="absolute -right-8 top-1/2 -translate-y-1/2 p-1 text-slate-300 hover:text-emerald-600 opacity-0 group-hover:opacity-100 transition-all"
                                  >
                                    <Volume2 className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            ))}
                            {chatLoading && (
                              <div className="bg-white border border-slate-200 text-slate-700 mr-auto rounded-2xl rounded-tl-none p-3 max-w-[80%]">
                                <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                              </div>
                            )}
                          </div>

                          <form onSubmit={handleChatSubmit} className="p-4 bg-white border-t border-slate-100 flex gap-2">
                            <button 
                              type="button"
                              onClick={toggleListening}
                              disabled={!speechRecognitionSupported && !navigator.mediaDevices?.getUserMedia}
                              className={cn(
                                "p-2 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed",
                                isListening ? "bg-red-100 text-red-600 animate-pulse" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                              )}
                              title={useServerSttFallback ? "Fallback voice capture mode (click to start/stop recording)" : "Speech recognition mode"}
                            >
                              {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                            </button>
                            <input 
                              value={chatInput}
                              onChange={(e) => setChatInput(e.target.value)}
                              placeholder={isListening ? "Listening..." : "Ask a question..."}
                              className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                            />
                            <button 
                              type="submit"
                              disabled={!chatInput.trim() || chatLoading}
                              className="bg-emerald-600 text-white p-2 rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-50"
                            >
                              <Send className="w-4 h-4" />
                            </button>
                          </form>
                        </div>
                      </>
                    ) : (
                      <div className="bg-white rounded-2xl border border-slate-200 shadow-xl h-full min-h-[600px] flex flex-col items-center justify-center text-center p-12 space-y-4">
                        <div className="bg-slate-100 p-6 rounded-full">
                          <Brain className="w-12 h-12 text-slate-300" />
                        </div>
                        <div className="space-y-2">
                          <h3 className="text-lg font-semibold text-slate-900">Ready to simplify</h3>
                          <p className="text-slate-500 max-w-xs">
                            Upload a report to see the simplified version here.
                          </p>
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 py-12 bg-white">
        <div className="max-w-6xl mx-auto px-4 text-center space-y-4">
          <div className="flex items-center justify-center gap-2 text-emerald-600 font-semibold">
            <HeartPulse className="w-5 h-5" />
            MediCode
          </div>
          <p className="text-sm text-slate-400 max-w-md mx-auto">
            Disclaimer: This tool is for informational purposes only and does not provide medical advice. Always consult with a qualified healthcare professional.
          </p>
          <div className="pt-8 text-xs text-slate-300">
            © 2026 MediCode. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <MedicalSimplifier />
    </ErrorBoundary>
  );
}
