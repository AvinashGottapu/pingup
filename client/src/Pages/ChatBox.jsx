import React, { useEffect, useRef, useState } from "react";
import { ImageIcon, SendHorizonal, Phone, X, Mic } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import { useParams } from "react-router-dom";
import { useAuth } from "@clerk/clerk-react";
import * as SpeechSDK from "microsoft-cognitiveservices-speech-sdk";
import api from "../api/axios";
import toast from "react-hot-toast";
import { addMessages, fetchMessages, resetMessages, deleteMessage } from "../features/messages/messagesSlice.js";
import { createSocket } from "../api/socket";

const WaveformBar = ({ isListening }) => {
  const canvasRef = useRef(null);
  const animFrameRef = useRef(null);
  const analyserRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    if (!isListening) {
      cancelAnimationFrame(animFrameRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }

      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      return;
    }

    navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
      streamRef.current = stream;
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 128;
      source.connect(analyser);
      analyserRef.current = analyser;

      const canvas = canvasRef.current;
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
          const gradient = ctx.createLinearGradient(0, centerY - barHeight / 2, 0, centerY + barHeight / 2);
          gradient.addColorStop(0, "#818cf8");
          gradient.addColorStop(1, "#a855f7");

          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.roundRect(x, centerY - barHeight / 2, barWidth, barHeight, 2);
          ctx.fill();
        }
      };

      draw();
    }).catch(() => {});

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
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

const ChatBox = () => {
  const { messages } = useSelector((state) => state.messages);
  const currentUser = useSelector((state) => state.user.value);
  const connections = useSelector((state) => state.connections.connections);

  const [activeMsgId, setActiveMsgId] = useState(null);
  const [isListening, setIsListening] = useState(false);
  const [text, setText] = useState("");
  const [image, setImage] = useState(null);
  const [user, setUser] = useState(null);
  const [useAzure, setUseAzure] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [nextCursor, setNextCursor] = useState(null);
  const [hasMore, setHasMore] = useState(true);

  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const topSentinelRef = useRef(null);
  const textareaRef = useRef(null);
  const recognitionRef = useRef(null);
  const azureRecognizerRef = useRef(null);
  const baseTextRef = useRef("");
  const azureInternalRef = useRef("");
  const skipAutoScrollRef = useRef(false);

  const { userId } = useParams();
  const { getToken } = useAuth();
  const dispatch = useDispatch();
  const navigate = useNavigate();

  useEffect(() => {
    const speechKey = import.meta.env.VITE_AZURE_SPEECH_KEY;
    const region = import.meta.env.VITE_AZURE_REGION;

    if (speechKey && region) {
      setUseAzure(true);
    } else {
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SR) setUseAzure(true);
    }
  }, []);

  useEffect(() => {
    if (!messagesContainerRef.current || !topSentinelRef.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasMore && !isLoadingOlder && !isInitialLoading) {
          loadOlderMessages();
        }
      },
      { root: messagesContainerRef.current, threshold: 0.1 }
    );

    observer.observe(topSentinelRef.current);

    return () => observer.disconnect();
  }, [hasMore, isLoadingOlder, isInitialLoading, nextCursor, userId]);

  const startAzureListening = () => {
    const speechKey = import.meta.env.VITE_AZURE_SPEECH_KEY;
    const region = import.meta.env.VITE_AZURE_REGION;

    if (!speechKey || !region) {
      toast.error("Azure Speech credentials not configured");
      return;
    }

    try {
      baseTextRef.current = text;
      azureInternalRef.current = "";

      const speechConfig = SpeechSDK.SpeechConfig.fromSubscription(speechKey, region);
      speechConfig.speechRecognitionLanguage = "en-IN";
      const audioConfig = SpeechSDK.AudioConfig.fromDefaultMicrophoneInput();
      const recognizer = new SpeechSDK.SpeechRecognizer(speechConfig, audioConfig);

      recognizer.recognizing = (s, e) => {
        if (e.result.reason === SpeechSDK.ResultReason.RecognizingSpeech && e.result.text?.trim()) {
          const parts = [baseTextRef.current?.trim(), azureInternalRef.current?.trim(), e.result.text.trim()].filter(Boolean);
          setText(parts.join(" "));
        }
      };

      recognizer.recognized = (s, e) => {
        if (e.result.reason === SpeechSDK.ResultReason.RecognizedSpeech && e.result.text?.trim()) {
          azureInternalRef.current = [azureInternalRef.current?.trim(), e.result.text.trim()].filter(Boolean).join(" ");
          const parts = [baseTextRef.current?.trim(), azureInternalRef.current].filter(Boolean);
          setText(parts.join(" "));
        }
      };

      recognizer.canceled = (s, e) => {
        if (e.reason === SpeechSDK.CancellationReason.Error) {
          toast.error(`Speech error: ${e.errorDetails}`);
        }
        setIsListening(false);
      };
      recognizer.sessionStopped = () => setIsListening(false);

      azureRecognizerRef.current = recognizer;
      recognizer.startContinuousRecognitionAsync(
        () => setIsListening(true),
        (err) => {
          toast.error(`Failed to start: ${err}`);
          setIsListening(false);
        }
      );
    } catch (err) {
      toast.error(`Azure Speech error: ${err.message}`);
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
        (err) => {
          console.error("Stop error:", err);
          setIsListening(false);
        }
      );
    }
  };

  const startNativeListening = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-IN";
    baseTextRef.current = text;

    recognition.onresult = (event) => {
      const transcript = Array.from(event.results).map((r) => r[0].transcript).join("");
      if (transcript?.trim()) {
        const parts = [baseTextRef.current?.trim(), transcript.trim()].filter(Boolean);
        setText(parts.join(" "));
      }
    };
    recognition.onerror = (e) => {
      if (e.error !== "no-speech") {
        toast.error(`Mic error: ${e.error}`);
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

  const startListening = () => (useAzure ? startAzureListening() : startNativeListening());
  const stopListening = () => (useAzure ? stopAzureListening() : stopNativeListening());

  const cancelListening = () => {
    setText(baseTextRef.current);
    stopListening();
  };

  const confirmListening = () => stopListening();

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
      if (azureRecognizerRef.current) {
        azureRecognizerRef.current.stopContinuousRecognitionAsync();
        azureRecognizerRef.current.close();
      }
    };
  }, []);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [text]);

  const fetchUserMessages = async () => {
    try {
      setIsInitialLoading(true);
      const token = await getToken();
      const result = await dispatch(fetchMessages({ token, userId, mode: "replace" })).unwrap();

      if (!result?.success) {
        throw new Error(result?.message || "Unable to load messages");
      }

      setNextCursor(result.nextCursor || null);
      setHasMore(Boolean(result.hasMore));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setIsInitialLoading(false);
    }
  };

  const loadOlderMessages = async () => {
    if (!hasMore || isLoadingOlder) return;

    try {
      setIsLoadingOlder(true);
      skipAutoScrollRef.current = true;

      const token = await getToken();
      const container = messagesContainerRef.current;
      const prevScrollHeight = container?.scrollHeight ?? 0;
      const prevScrollTop = container?.scrollTop ?? 0;

      const result = await dispatch(fetchMessages({ token, userId, cursor: nextCursor, mode: "prepend" })).unwrap();

      if (!result?.success) {
        throw new Error(result?.message || "Unable to load older messages");
      }

      setNextCursor(result.nextCursor || null);
      setHasMore(Boolean(result.hasMore));

      requestAnimationFrame(() => {
        if (container) {
          const nextScrollHeight = container.scrollHeight;
          container.scrollTop = prevScrollTop + (nextScrollHeight - prevScrollHeight);
        }

        skipAutoScrollRef.current = false;
      });
    } catch (err) {
      toast.error(err.message);
      skipAutoScrollRef.current = false;
    } finally {
      setIsLoadingOlder(false);
    }
  };

  const sendMessage = async () => {
    try {
      const messageText = text.trim();
      if (isListening) stopListening();
      if (!messageText && !image) return;

      const token = await getToken();
      const formData = new FormData();
      formData.append("to_user_id", userId);
      formData.append("text", messageText);
      if (image) formData.append("image", image);

      const { data } = await api.post("/api/message/send", formData, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (data.success) {
        setText("");
        setImage(null);
        dispatch(addMessages(data.message));
      } else {
        throw new Error(data.message);
      }
    } catch (err) {
      toast.error(err.message);
    }
  };

  useEffect(() => {
    fetchUserMessages();
    return () => {
      dispatch(resetMessages());
    };
  }, [userId]);

  useEffect(() => {
    if (connections.length > 0) {
      const found = connections.find((c) => c._id === userId);
      setUser(found);
    }
  }, [connections, userId]);

  useEffect(() => {
    if (skipAutoScrollRef.current) return;

    if (messagesContainerRef.current) {
      requestAnimationFrame(() => {
        messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
      });
    } else {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  return user && (
    <div className="flex flex-col h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <div className="relative z-10 flex items-center gap-3 px-4 py-3 md:px-8 md:gap-4 md:py-4 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-b border-slate-200/50 dark:border-slate-800/50 shadow-lg shadow-slate-200/50 dark:shadow-slate-950/50">
        <div className="relative flex-shrink-0">
          <img src={user.profile_picture} alt={user.full_name} className="size-10 md:size-11 rounded-full ring-2 ring-indigo-500/20 dark:ring-indigo-400/20 object-cover" />
          <div className="absolute bottom-0 right-0 size-2.5 md:size-3 bg-emerald-500 dark:bg-emerald-400 rounded-full border-2 border-white dark:border-slate-900" />
        </div>

        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm md:text-base text-slate-900 dark:text-white truncate">{user.full_name}</p>
          <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 truncate">@{user.username}</p>
        </div>

        <button
          onClick={async () => {
            const roomId = [currentUser._id, user._id].sort().join("-");
            try {
              const token = await getToken();
              const socket = createSocket(token);

              socket.emit('call:invite', {
                to_user_id: user._id,
                roomId,
                callerName: currentUser.full_name,
              }, (response) => {
                if (response?.success) {
                  navigate(`/room/${roomId}`);
                  return;
                }

                toast.error(response?.message || 'User is not available');
              });
            } catch {
              toast.error("Could not notify user of call");
            }
          }}
          className="flex-shrink-0 p-2 md:p-2.5 max-sm:mr-14 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white transition-all duration-200 hover:shadow-lg active:scale-95"
        >
          <Phone className="size-[18px] md:size-[20px]" />
        </button>
      </div>

      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto px-3 md:px-8 py-4 scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-700 scrollbar-track-transparent"
      >
        <div className="space-y-3 max-w-4xl w-full mx-auto pb-2">
          <div ref={topSentinelRef} className="h-1" />

          {isLoadingOlder && (
            <div className="flex justify-center py-2">
              <div className="w-6 h-6 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
            </div>
          )}

          {messages
            .toSorted((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
            .map((message) => {
              const isSentByMe = message.to_user_id === user._id;
              return (
                <div key={message._id} className={`flex ${isSentByMe ? 'justify-end' : 'justify-start'}`}>
                  <div className="flex flex-col gap-0.5 max-w-[75%] md:max-w-[65%]">
                    <div
                      onClick={() => {
                        if (message.from_user_id === currentUser._id) {
                          setActiveMsgId(activeMsgId === message._id ? null : message._id);
                        }
                      }}
                      className={`px-3 py-2 rounded-2xl shadow-md transition-all duration-200
                        ${isSentByMe
                          ? 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white rounded-br-sm hover:shadow-lg hover:shadow-indigo-500/25 cursor-pointer'
                          : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-bl-sm border border-slate-200/50 dark:border-slate-700/50'
                        }`}
                    >
                      {message.message_type === 'image' && (
                        <img src={message.media_url} className="w-full max-w-sm rounded-xl mb-1.5 shadow-sm" alt="Shared" />
                      )}
                      {message.text && (
                        <p className="text-sm leading-snug break-words">{message.text}</p>
                      )}
                    </div>

                    {message.from_user_id === currentUser._id && activeMsgId === message._id && (
                      <button
                        className="text-[11px] font-medium bg-red-500 hover:bg-red-600 text-white px-2.5 py-1 rounded-full self-end mt-1 transition-colors active:scale-95"
                        onClick={async (e) => {
                          e.stopPropagation();
                          try {
                            const token = await getToken();
                            await api.post('/api/message/delete', { messageId: message._id }, { headers: { Authorization: `Bearer ${token}` } });
                            dispatch(deleteMessage(message._id));
                            toast.success("Message deleted");
                            setActiveMsgId(null);
                          } catch {
                            toast.error("Failed to delete message");
                          }
                        }}
                      >
                        Delete
                      </button>
                    )}

                    {!(message.from_user_id === currentUser._id && activeMsgId === message._id) && (
                      <div className={`text-[10px] text-slate-500 dark:text-slate-400 px-1 ${isSentByMe ? 'text-right' : 'text-left'}`}>
                        {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          <div ref={messagesEndRef} />
        </div>
      </div>

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
                <path d="M2 7L5.5 10.5L12 3.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        ) : (
          <div className="flex items-end gap-2 px-4 py-2 bg-white dark:bg-slate-900 w-full max-w-xl mx-auto border border-slate-300 dark:border-slate-700 shadow-xl shadow-slate-200/50 dark:shadow-slate-950/50 rounded-2xl transition-all duration-200 focus-within:border-indigo-500 dark:focus-within:border-indigo-400 focus-within:shadow-2xl focus-within:shadow-indigo-500/20">
            <textarea
              ref={textareaRef}
              rows={1}
              className="flex-1 outline-none text-[13px] text-slate-800 dark:text-white bg-transparent placeholder:text-slate-400 dark:placeholder:text-slate-500 resize-none overflow-hidden leading-snug py-1.5 max-h-28 self-center"
              placeholder="Type a message…"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              onChange={(e) => setText(e.target.value)}
              value={text}
            />

            <label htmlFor="image" className="flex-shrink-0 cursor-pointer mb-0.5">
              {image ? (
                <div className="relative group">
                  <img src={URL.createObjectURL(image)} alt="Preview" className="h-7 w-7 rounded-lg object-cover ring-2 ring-indigo-500 dark:ring-indigo-400" />
                  <div
                    onClick={(e) => {
                      e.preventDefault();
                      setImage(null);
                    }}
                    className="absolute -top-1.5 -right-1.5 bg-red-500 hover:bg-red-600 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X size={10} />
                  </div>
                </div>
              ) : (
                <div className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                  <ImageIcon className="size-4 text-slate-500 dark:text-slate-400" />
                </div>
              )}
              <input type="file" id="image" accept="image/*" hidden onChange={(e) => setImage(e.target.files[0])} />
            </label>

            <button
              type="button"
              onClick={startListening}
              title="Speak a message"
              className="flex-shrink-0 mb-0.5 p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all duration-200 active:scale-95"
            >
              <Mic size={15} />
            </button>

            <button
              onClick={sendMessage}
              disabled={!text && !image}
              className="flex-shrink-0 mb-0.5 bg-gradient-to-br from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 disabled:from-slate-300 disabled:to-slate-400 dark:disabled:from-slate-700 dark:disabled:to-slate-600 disabled:cursor-not-allowed text-white p-2 rounded-full transition-all duration-200 hover:shadow-lg hover:shadow-indigo-500/30 active:scale-95 disabled:active:scale-100"
            >
              <SendHorizonal size={15} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatBox;
