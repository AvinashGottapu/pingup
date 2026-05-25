import React, { useState, useEffect, useRef } from "react";
import {
  SendHorizontal,
  Bot,
  Sparkles,
  User,
  Terminal,
  ShieldCheck,
  Mic,
  X,
  Image,
  Hash,
  Quote,
  MessageSquare,
  ChevronDown,
  Upload,
  Copy,
  Check,
} from "lucide-react";
import * as SpeechSDK from "microsoft-cognitiveservices-speech-sdk";
import axios from "axios";
import { useNavigate } from "react-router-dom";

// ── Waveform Visualizer ──────────────────────────────────────────────────────
const WaveformBar = ({ isListening }) => {
  const canvasRef = useRef(null);
  const animFrameRef = useRef(null);
  const analyserRef = useRef(null);
  const streamRef = useRef(null);
  const audioContextRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const clearCanvas = () => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    };

    if (!isListening) {
      cancelAnimationFrame(animFrameRef.current);

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }

      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }

      clearCanvas();
      return;
    }

    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        streamRef.current = stream;

        const audioCtx = new (
          window.AudioContext || window.webkitAudioContext
        )();
        audioContextRef.current = audioCtx;

        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 128;
        analyser.smoothingTimeConstant = 0.85;
        source.connect(analyser);
        analyserRef.current = analyser;

        const ctx = canvas.getContext("2d");
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        const draw = () => {
          animFrameRef.current = requestAnimationFrame(draw);
          analyser.getByteFrequencyData(dataArray);

          ctx.clearRect(0, 0, canvas.width, canvas.height);

          const barCount = 40;
          const barWidth = 3;
          const gap = (canvas.width - barCount * barWidth) / (barCount + 1);
          const centerY = canvas.height / 2;

          for (let i = 0; i < barCount; i++) {
            const dataIndex = Math.floor((i / barCount) * bufferLength);
            const value = dataArray[dataIndex] / 255;
            const barHeight = Math.max(3, value * canvas.height * 0.85);

            const x = gap + i * (barWidth + gap);
            const gradient = ctx.createLinearGradient(
              0,
              centerY - barHeight / 2,
              0,
              centerY + barHeight / 2,
            );
            gradient.addColorStop(0, "#818cf8");
            gradient.addColorStop(1, "#a855f7");

            ctx.fillStyle = gradient;
            ctx.beginPath();
            if (ctx.roundRect) {
              ctx.roundRect(x, centerY - barHeight / 2, barWidth, barHeight, 2);
            } else {
              ctx.rect(x, centerY - barHeight / 2, barWidth, barHeight);
            }
            ctx.fill();
          }
        };

        draw();
      })
      .catch((err) => {
        console.error("Mic access denied:", err);
      });

    return () => {
      cancelAnimationFrame(animFrameRef.current);

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }

      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
    };
  }, [isListening]);

  return (
    <canvas
      ref={canvasRef}
      width={260}
      height={36}
      className="flex-1"
      style={{ display: "block" }}
    />
  );
};

// ── Main AI Page ─────────────────────────────────────────────────────────────
const AIPage = () => {
  const navigate = useNavigate();
  const [showViewDropdown, setShowViewDropdown] = useState(false);

  useEffect(() => {
    const handleClickOutside = () => setShowViewDropdown(false);
    if(showViewDropdown) {
      document.addEventListener('click', handleClickOutside);
    }
    return () => document.removeEventListener('click', handleClickOutside);
  }, [showViewDropdown]);

  const [messages, setMessages] = useState([
    {
      id: 1,
      role: "bot",
      text: "Hello! I'm Ping Up AI. I've been upgraded with a new interface. How can I help you build something amazing today?",
      time: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      }),
    },
  ]);

  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [useAzure, setUseAzure] = useState(false);

  const scrollRef = useRef(null);
  const textareaRef = useRef(null);
  const recognitionRef = useRef(null);
  const azureRecognizerRef = useRef(null);
  const baseTextRef = useRef("");
  const azureInternalRef = useRef("");
  const pendingReplyTimeoutRef = useRef(null);

  // Auto scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  // Detect speech API
  useEffect(() => {
    const speechKey = import.meta.env.VITE_AZURE_SPEECH_KEY;
    const region = import.meta.env.VITE_AZURE_REGION;

    if (speechKey && region) {
      setUseAzure(true);
    } else {
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      setUseAzure(!SR);
    }
  }, []);

  // Auto resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(
        textareaRef.current.scrollHeight,
        112,
      )}px`;
    }
  }, [inputValue]);

  const getCurrentTime = () =>
    new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });

  const isWaitingForResponse = isTyping;
const sendMessage = async () => {
  const text = inputValue.trim();

   const AI_URL = import.meta.env.VITE_AI_API_URL;

  // block sending while previous response is pending
  if (isWaitingForResponse) return;

  if (isListening) stopListening();
  if (!text) return;

  const userMsg = {
    id: Date.now(),
    role: "user",
    text,
    time: getCurrentTime(),
  };

  setMessages((prev) => [...prev, userMsg]);
  setInputValue("");
  setIsTyping(true);

  try {
    const currentMessages = [...messages, userMsg].filter(
      (m) => m.id !== 1 // Filter out bot greeting from history
    );

    const { data } = await axios.post(`${AI_URL}/api/chat`,
      {
        messages: currentMessages.map((m) => ({
          role: m.role,
          text: m.text,
        })),
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    setMessages((prev) => [
      ...prev,
      {
        id: Date.now() + 1,
        role: "bot",
        text: data.response,
        time: getCurrentTime(),
      },
    ]);
  } catch (error) {
    console.error(error);
    setMessages((prev) => [
      ...prev,
      {
        id: Date.now() + 1,
        role: "bot",
        text: "I'm sorry, I couldn't connect to my backend servers right now. Please make sure the backend is running.",
        time: getCurrentTime(),
      },
    ]);
  } finally {
    setIsTyping(false);
  }
};

  // ── Azure Speech ───────────────────────────────────────────────────────────
  const startAzureListening = () => {
    if (isWaitingForResponse) return;

    const speechKey = import.meta.env.VITE_AZURE_SPEECH_KEY;
    const region = import.meta.env.VITE_AZURE_REGION;

    if (!speechKey || !region) {
      alert("Azure Speech credentials not configured");
      return;
    }

    try {
      baseTextRef.current = inputValue;
      azureInternalRef.current = "";

      const speechConfig = SpeechSDK.SpeechConfig.fromSubscription(
        speechKey,
        region,
      );
      speechConfig.speechRecognitionLanguage = "en-IN";

      const audioConfig = SpeechSDK.AudioConfig.fromDefaultMicrophoneInput();
      const recognizer = new SpeechSDK.SpeechRecognizer(
        speechConfig,
        audioConfig,
      );

      recognizer.recognizing = (s, e) => {
        if (
          e.result.reason === SpeechSDK.ResultReason.RecognizingSpeech &&
          e.result.text?.trim()
        ) {
          const parts = [
            baseTextRef.current?.trim(),
            azureInternalRef.current?.trim(),
            e.result.text.trim(),
          ].filter(Boolean);

          setInputValue(parts.join(" "));
        }
      };

      recognizer.recognized = (s, e) => {
        if (
          e.result.reason === SpeechSDK.ResultReason.RecognizedSpeech &&
          e.result.text?.trim()
        ) {
          azureInternalRef.current = [
            azureInternalRef.current?.trim(),
            e.result.text.trim(),
          ]
            .filter(Boolean)
            .join(" ");

          const parts = [
            baseTextRef.current?.trim(),
            azureInternalRef.current,
          ].filter(Boolean);

          setInputValue(parts.join(" "));
        }
      };

      recognizer.canceled = () => {
        setIsListening(false);
      };

      recognizer.sessionStopped = () => {
        setIsListening(false);
      };

      azureRecognizerRef.current = recognizer;

      recognizer.startContinuousRecognitionAsync(
        () => setIsListening(true),
        () => setIsListening(false),
      );
    } catch (err) {
      console.error("Azure Speech error:", err.message);
      setIsListening(false);
    }
  };

  const stopAzureListening = () => {
    if (azureRecognizerRef.current) {
      azureRecognizerRef.current.stopContinuousRecognitionAsync(
        () => {
          azureRecognizerRef.current.close();
          azureRecognizerRef.current = null;
          setIsListening(false);
        },
        () => {
          setIsListening(false);
        },
      );
    }
  };

  // ── Native Speech ──────────────────────────────────────────────────────────
  const startNativeListening = () => {
    if (isWaitingForResponse) return;

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SR) {
      alert("Speech Recognition is not supported in this browser.");
      return;
    }

    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-IN";

    baseTextRef.current = inputValue;

    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((r) => r[0].transcript)
        .join("");

      if (transcript?.trim()) {
        const parts = [baseTextRef.current?.trim(), transcript.trim()].filter(
          Boolean,
        );
        setInputValue(parts.join(" "));
      }
    };

    recognition.onerror = (e) => {
      if (e.error !== "no-speech") {
        console.error("Mic error:", e.error);
      }
    };

    recognition.onend = () => setIsListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  };

  const stopNativeListening = () => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setIsListening(false);
  };

  const startListening = () =>
    useAzure ? startAzureListening() : startNativeListening();

  const stopListening = () =>
    useAzure ? stopAzureListening() : stopNativeListening();

  const cancelListening = () => {
    setInputValue(baseTextRef.current);
    stopListening();
  };

  const confirmListening = () => {
    stopListening();
    setTimeout(() => {
      textareaRef.current?.focus();
    }, 50);
  };

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();

      if (azureRecognizerRef.current) {
        azureRecognizerRef.current.stopContinuousRecognitionAsync();
        azureRecognizerRef.current.close();
      }

      if (pendingReplyTimeoutRef.current) {
        clearTimeout(pendingReplyTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="flex flex-col h-[100dvh] bg-white dark:bg-[#0b0f1a] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-white/5 bg-white/80 dark:bg-[#0b0f1a]/80 backdrop-blur-md sticky top-0 z-20">
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full blur opacity-40 animate-pulse"></div>
            <div className="relative p-2.5 rounded-full bg-slate-900 text-white shadow-xl">
              <Sparkles className="w-5 h-5 text-indigo-400" />
            </div>
          </div>

          <div>
            <div className="relative" onClick={(e) => { e.stopPropagation(); setShowViewDropdown(!showViewDropdown); }}>
              <div className="flex items-center gap-2 cursor-pointer group">
                  <h1 className="text-sm font-bold tracking-tight text-gray-900 dark:text-white flex items-center gap-2 group-hover:text-indigo-500 dark:group-hover:text-indigo-400 transition-colors select-none">
                    PING UP AI
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-500 border border-indigo-500/20">
                      PRO
                    </span>
                  </h1>
                  <ChevronDown size={14} className={`text-gray-500 transition-transform ${showViewDropdown ? "rotate-180" : ""}`} />
              </div>
              
              {/* Dropdown Menu */}
              {showViewDropdown && (
                <div className="absolute top-full left-0 mt-3 w-48 bg-white dark:bg-slate-900 border border-gray-100 dark:border-white/10 rounded-xl shadow-xl shadow-indigo-500/10 py-1.5 z-50 overflow-hidden transform origin-top-left transition-all">
                  <button
                    onClick={(e) => { e.stopPropagation(); setShowViewDropdown(false); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10"
                  >
                    <MessageSquare size={16} />
                    AI Chat
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); navigate("/photo-magic"); setShowViewDropdown(false); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800"
                  >
                    <Image size={16} />
                    Photo Magic
                  </button>
                </div>
              )}
            </div>

            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 font-medium uppercase tracking-widest">
                Systems Operational
              </p>
            </div>
          </div>
        </div>

        <div className="hidden md:flex items-center gap-3">
          <div className="flex -space-x-2">
            <div className="w-8 h-8 rounded-full border-2 border-white dark:border-slate-900 bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
              <Terminal size={14} className="text-indigo-500" />
            </div>
            <div className="w-8 h-8 rounded-full border-2 border-white dark:border-slate-900 bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
              <ShieldCheck size={14} className="text-purple-500" />
            </div>
          </div>
        </div>
      </div>

      {/* Chat Area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 md:px-12 py-8 space-y-8 scroll-smooth custom-scrollbar"
      >
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`flex items-start gap-3 w-full ${
                msg.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              {msg.role === "bot" && (
                <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-md mt-1">
                  <Bot size={18} />
                </div>
              )}

              <div
                className={`flex flex-col ${
                  msg.role === "user" ? "items-end" : "items-start"
                } max-w-[56%] sm:max-w-[52%] lg:max-w-[48%]`}
              >
                <div
                  className={`px-4 py-3 rounded-2xl shadow-md whitespace-pre-wrap ${
                    msg.role === "user"
                      ? "bg-indigo-600 text-white rounded-tr-none shadow-lg shadow-indigo-500/20"
                      : "bg-gray-100 dark:bg-slate-800/50 text-gray-800 dark:text-gray-200 rounded-tl-none border border-gray-200/50 dark:border-white/5"
                  }`}
                  style={{
                    wordBreak: "break-word",
                    overflowWrap: "break-word",
                  }}
                >
                  <p className="text-[15px] leading-relaxed">{msg.text}</p>
                </div>

                <span className="text-[10px] mt-2 font-medium text-gray-400 dark:text-gray-600 px-1 uppercase tracking-tighter whitespace-nowrap">
                  {msg.role === "bot" ? "PINGUP" : "YOU"} • {msg.time}
                </span>
              </div>

              {msg.role === "user" && (
                <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center shadow-md mt-1">
                  <User size={18} />
                </div>
              )}
            </div>
          </div>
        ))}

        {isTyping && (
          <div className="flex justify-start">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white mt-1">
                <Bot size={18} />
              </div>
              <div className="bg-gray-100 dark:bg-slate-800/50 px-4 py-3 rounded-2xl rounded-tl-none flex gap-1 border border-gray-200/50 dark:border-white/5">
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></span>
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0.4s]"></span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="px-3 pb-5 pt-2 bg-gradient-to-t from-white/50 to-transparent dark:from-slate-950/50">
        {isListening ? (
          <div className="flex items-center gap-3 px-4 py-2.5 bg-white dark:bg-slate-900 w-full max-w-xl mx-auto border border-indigo-400 dark:border-indigo-600 shadow-xl shadow-indigo-500/20 rounded-2xl transition-all duration-300">
            <span className="relative flex-shrink-0">
              <span className="absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-60 animate-ping" />
              <span className="relative flex items-center justify-center size-7 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600">
                <Mic size={13} className="text-white" />
              </span>
            </span>

            <WaveformBar isListening={isListening} />

            <button
              onClick={cancelListening}
              title="Cancel"
              className="flex-shrink-0 flex items-center justify-center size-8 rounded-full border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-all active:scale-95"
            >
              <X size={15} />
            </button>

            <button
              onClick={confirmListening}
              title="Confirm"
              className="flex-shrink-0 flex items-center justify-center size-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white shadow-md shadow-indigo-500/30 transition-all active:scale-95"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path
                  d="M2 7L5.5 10.5L12 3.5"
                  stroke="white"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
        ) : (
          <div
            className={`flex items-end gap-2 px-4 py-2 bg-white dark:bg-slate-900 w-full max-w-xl mx-auto border shadow-xl rounded-2xl transition-all duration-200 ${
              isWaitingForResponse
                ? "border-slate-300 dark:border-slate-700 opacity-80"
                : "border-slate-300 dark:border-slate-700 focus-within:border-indigo-500 dark:focus-within:border-indigo-400 focus-within:shadow-2xl focus-within:shadow-indigo-500/20"
            }`}
          >
            <textarea
              ref={textareaRef}
              rows={1}
              disabled={isWaitingForResponse}
              className="flex-1 outline-none text-[13px] text-slate-800 dark:text-white bg-transparent placeholder:text-slate-400 dark:placeholder:text-slate-500 resize-none overflow-hidden leading-snug py-1.5 max-h-28 self-center disabled:cursor-not-allowed disabled:opacity-60"
              placeholder={
                isWaitingForResponse
                  ? "Wait for the previous response..."
                  : "Type a message..."
              }
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (!isWaitingForResponse) {
                    sendMessage();
                  }
                }
              }}
              onChange={(e) => setInputValue(e.target.value)}
              value={inputValue}
            />

            <button
              type="button"
              onClick={startListening}
              disabled={isWaitingForResponse}
              title="Speak a message"
              className="flex-shrink-0 mb-0.5 p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all duration-200 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
            >
              <Mic size={15} />
            </button>

            <button
              onClick={sendMessage}
              disabled={!inputValue.trim() || isWaitingForResponse}
              className="flex-shrink-0 mb-0.5 bg-gradient-to-br from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 disabled:from-slate-300 disabled:to-slate-400 dark:disabled:from-slate-700 dark:disabled:to-slate-600 disabled:cursor-not-allowed text-white p-2 rounded-full transition-all duration-200 hover:shadow-lg hover:shadow-indigo-500/30 active:scale-95 disabled:active:scale-100"
            >
              <SendHorizontal size={15} />
            </button>
          </div>
        )}

        <p className="text-center mt-4 text-[10px] text-gray-400 dark:text-gray-600 font-bold tracking-widest uppercase">
          Quantum Engine v2.0 • End-to-End Encrypted
        </p>
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 5px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #334155;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #475569;
        }
      `}</style>
    </div>
  );
};

export default AIPage;
