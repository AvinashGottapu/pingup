import React, { useEffect, useRef, useState } from "react";
import { ImageIcon, SendHorizonal, Phone, X, Mic, CheckCircle2, Sparkles } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import { useAuth } from "@clerk/clerk-react";
import * as SpeechSDK from "microsoft-cognitiveservices-speech-sdk";
import api from "../api/axios";
import toast from "react-hot-toast";
import {
  addMessages,
  fetchMessages,
  resetMessages,
  deleteMessage,
} from "../features/messages/messagesSlice.js";
import { createSocket } from "../api/socket";
import PingBuddyModal from "../components/PingBuddyModal";

const ChatBox = () => {
  const { messages } = useSelector((state) => state.messages);
  const currentUser = useSelector((state) => state.user.value);
  const activeRoomId = useSelector((state) => state.user.activeRoomId);
  const connections = useSelector((state) => state.connections.connections);

  const [activeMsgId, setActiveMsgId] = useState(null);
  const [isListening, setIsListening] = useState(false);
  const [text, setText] = useState("");
  const [image, setImage] = useState(null);

  // PingBuddy modal states
  const [showBuddyModal, setShowBuddyModal] = useState(false);
  const [buddyPrompt, setBuddyPrompt] = useState("");
  const [user, setUser] = useState(null);
  const [useAzure, setUseAzure] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [nextCursor, setNextCursor] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [isPeerTyping, setIsPeerTyping] = useState(false);
  const [peerPresence, setPeerPresence] = useState(null);
  
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const topSentinelRef = useRef(null);
  const textareaRef = useRef(null);
  const recognitionRef = useRef(null);
  const azureRecognizerRef = useRef(null);
  const baseTextRef = useRef("");
  const azureInternalRef = useRef("");
  const skipAutoScrollRef = useRef(false);
  const socketRef = useRef(null);
  const typingTimerRef = useRef(null);
  const typingActiveRef = useRef(false);

  const { userId } = useParams();
  const { getToken } = useAuth();
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const scrollToBottom = (delay = 0) => {
    setTimeout(() => {
      const container = messagesContainerRef.current;
      if (!container) return;
      container.scrollTop = container.scrollHeight;
    }, delay);
  };

  const fetchPeerPresence = async () => {
    try {
      const token = await getToken();
      const { data } = await api.get(`/api/user/presence/${userId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (data?.success && data?.presence) {
        setPeerPresence(data.presence);
      }
    } catch (err) {
      console.warn('Failed to load user presence', err.message || err);
    }
  };

  const fetchUserMessages = async () => {
    try {
      setIsInitialLoading(true);

      const token = await getToken();

      const result = await dispatch(
        fetchMessages({
          token,
          userId,
          mode: "replace",
        })
      ).unwrap();

      if (!result?.success) {
        throw new Error(result?.message || "Unable to load messages");
      }

      setNextCursor(result.nextCursor || null);
      setHasMore(Boolean(result.hasMore));

      scrollToBottom(100);
      scrollToBottom(300);
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

      const result = await dispatch(
        fetchMessages({
          token,
          userId,
          cursor: nextCursor,
          mode: "prepend",
        })
      ).unwrap();

      if (!result?.success) {
        throw new Error(result?.message || "Unable to load older messages");
      }

      setNextCursor(result.nextCursor || null);
      setHasMore(Boolean(result.hasMore));

      requestAnimationFrame(() => {
        if (container) {
          const nextScrollHeight = container.scrollHeight;
          container.scrollTop =
            prevScrollTop + (nextScrollHeight - prevScrollHeight);
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

  useEffect(() => {
    fetchUserMessages();

    return () => {
      dispatch(resetMessages());
    };
  }, [userId]);

  useEffect(() => {
    if (skipAutoScrollRef.current) return;
    if (isInitialLoading) return;

    requestAnimationFrame(() => {
      scrollToBottom(0);
      scrollToBottom(100);
      scrollToBottom(300);
    });
  }, [messages, isInitialLoading, user]);

  useEffect(() => {
    if (!messagesContainerRef.current || !topSentinelRef.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (
          entry.isIntersecting &&
          hasMore &&
          !isLoadingOlder &&
          !isInitialLoading
        ) {
          loadOlderMessages();
        }
      },
      {
        root: messagesContainerRef.current,
        threshold: 0.1,
      }
    );

    observer.observe(topSentinelRef.current);

    return () => observer.disconnect();
  }, [hasMore, isLoadingOlder, isInitialLoading, nextCursor, userId, user]);

  useEffect(() => {
    if (connections.length > 0) {
      const found = connections.find((c) => c._id === userId);
      setUser(found);
      setPeerPresence(
        found?.presence || {
          isOnline: false,
          lastSeen: found?.lastSeen || null,
        }
      );
    }
  }, [connections, userId]);

  useEffect(() => {
    if (!userId) return; 
    fetchPeerPresence();
  }, [userId]);

  useEffect(() => {
    let cancelled = false;

    const setupTypingSocket = async () => {
      const token = await getToken();
      if (cancelled) return;

      socketRef.current = createSocket(token);
      const socket = socketRef.current;

      const handleTypingStart = ({ from_user_id }) => {
        if (from_user_id === userId) {
          setIsPeerTyping(true);
        }
      };

      const handleTypingStop = ({ from_user_id }) => {
        if (from_user_id === userId) {
          setIsPeerTyping(false);
        }
      };

      const handlePresenceUpdate = ({ users = {}, onlineUsers = [] }) => {
        const nextPresence = users?.[userId];
        if (nextPresence) {
          setPeerPresence(nextPresence);
          return;
        }

        setPeerPresence((currentPresence) => ({
          ...currentPresence,
          isOnline: onlineUsers.includes(userId),
        }));
      };

      socket.on("typing:start", handleTypingStart);
      socket.on("typing:stop", handleTypingStop);
      socket.on("presence:update", handlePresenceUpdate);

      // Emit messages:seen to mark conversation read on mount / switch
      socket.emit("messages:seen", { to_user_id: userId });
    };

    setupTypingSocket();

    return () => {
      cancelled = true;
      clearTimeout(typingTimerRef.current);

      if (socketRef.current) {
        socketRef.current.off("typing:start");
        socketRef.current.off("typing:stop");
        socketRef.current.off("presence:update");
      }

      if (typingActiveRef.current) {
        socketRef.current?.emit("typing:stop", {
          to_user_id: userId,
        });
        typingActiveRef.current = false;
      }
    };
  }, [getToken, userId]);

  const emitTypingStatus = (isTyping) => {
    const socket = socketRef.current;

    if (!socket || !socket.connected) return;
    if (typingActiveRef.current === isTyping) return;

    typingActiveRef.current = isTyping;

    socket.emit(isTyping ? "typing:start" : "typing:stop", {
      to_user_id: userId,
    });
  };

  const sendMessage = async () => {
    try {
      const messageText = text.trim();

      if (!messageText && !image) return;

      if (messageText.includes('@buddy')) {
        const regex = /@buddy\s*(.*)/i;
        const match = messageText.match(regex);
        const prompt = match && match[1] ? match[1].trim() : messageText.replace(/@buddy/g, '').trim();
        setBuddyPrompt(prompt);
        setShowBuddyModal(true);
        setText("");
        return;
      }

      emitTypingStatus(false);
      clearTimeout(typingTimerRef.current);

      const token = await getToken();

      const formData = new FormData();
      formData.append("to_user_id", userId);
      formData.append("text", messageText);

      if (image) {
        formData.append("image", image);
      }

      const { data } = await api.post("/api/message/send", formData, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (data.success) {
        setText("");
        setImage(null);
        dispatch(addMessages(data.message));
        scrollToBottom(100);
      } else {
        throw new Error(data.message);
      }
    } catch (err) {
      toast.error(
        err?.response?.data?.retryAfter
          ? `${err.response.data.message} Retry in ${err.response.data.retryAfter}s`
          : err?.response?.data?.message || err.message || "Something went wrong"
      );
    }
  };

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [text]);

  const formatLastSeen = (lastSeen) => {
    if (!lastSeen) return "Offline";

    const diffMs = Date.now() - new Date(lastSeen).getTime();

    if (diffMs < 60 * 1000) return "Last seen just now";

    if (diffMs < 60 * 60 * 1000) {
      const minutes = Math.max(1, Math.round(diffMs / (60 * 1000)));
      return `Last seen ${minutes} min ago`;
    }

    if (diffMs < 24 * 60 * 60 * 1000) {
      const hours = Math.max(1, Math.round(diffMs / (60 * 60 * 1000)));
      return `Last seen ${hours} hr ago`;
    }

    const days = Math.max(1, Math.round(diffMs / (24 * 60 * 60 * 1000)));
    return `Last seen ${days} day${days === 1 ? "" : "s"} ago`;
  };

  return (
    user && (
      <div className="flex flex-col h-[calc(100dvh-7.5rem)] sm:h-screen bg-slate-50 dark:bg-zinc-950 transition-colors duration-300 relative overflow-hidden">
        
        {/* Subtle grid wallpaper backdrop */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.02)_1px,transparent_1px)] dark:bg-[linear-gradient(rgba(255,255,255,0.01)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.01)_1px,transparent_1px)] bg-[size:16px_16px] pointer-events-none opacity-45"></div>
        
        {/* 1. Header Area */}
        <div className="flex items-center justify-between gap-3 px-4 py-3 md:px-6 md:py-4 bg-white/90 dark:bg-zinc-950/85 backdrop-blur-md border-b border-slate-200/60 dark:border-zinc-900/60 shadow-sm z-20">
          <div className="flex items-center gap-3">
            {/* Avatar bubble */}
            <div className="relative flex-shrink-0">
              <div className="w-10 h-10 rounded-full p-0.5 bg-gradient-to-tr from-indigo-500 to-pink-500 shadow">
                <img
                  src={user.profile_picture || 'https://images.clerk.dev/static/profile.png'}
                  alt={user.full_name}
                  className="w-full h-full rounded-full object-cover border-2 border-white dark:border-zinc-950 bg-zinc-900"
                />
              </div>
              <span className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white dark:border-zinc-950 ${
                peerPresence?.isOnline ? 'bg-emerald-500' : 'bg-slate-400'
              }`} />
            </div>

            <div className="flex flex-col text-left min-w-0">
              <p className="font-extrabold text-sm text-slate-800 dark:text-zinc-200 truncate">
                {user.full_name}
              </p>
              
              {!isPeerTyping && (
                <p className="text-[10px] font-bold text-slate-500 dark:text-zinc-550">
                  {peerPresence?.isOnline
                    ? "Online"
                    : formatLastSeen(user.lastSeen)}
                </p>
              )}

              {isPeerTyping && (
                <p className="text-[10px] text-pink-500 dark:text-pink-400 font-black animate-pulse">
                  typing...
                </p>
              )}
            </div>
          </div>

          {/* Calling Action Button */}
          <button
            onClick={async () => {
              if (activeRoomId) {
                toast.error("You are already in an active call!");
                return;
              }
              const roomId = [currentUser._id, user._id].sort().join("-");
              try {
                const token = await getToken();
                const socket = createSocket(token);

                socket.emit(
                  "call:invite",
                  {
                    to_user_id: user._id,
                    roomId,
                    callerName: currentUser.full_name,
                  },
                  (response) => {
                    if (response?.success) {
                      navigate(`/room/${roomId}`);
                      return;
                    }
                    toast.error(response?.message || "User is not available");
                  }
                );
              } catch {
                toast.error("Could not notify user of call");
              }
            }}
            className={`p-2.5 rounded-2xl transition-all border-0 ${
              activeRoomId 
                ? "bg-slate-750 text-slate-500 cursor-not-allowed opacity-50 shadow-none" 
                : "bg-gradient-to-r from-pink-500 to-blue-500 hover:from-pink-600 hover:to-blue-600 text-white hover:scale-105 cursor-pointer shadow-md shadow-pink-500/20"
            }`}
            title={activeRoomId ? "You are already on a call" : "Start Audio/Video Call"}
          >
            <Phone className="w-4.5 h-4.5 stroke-[2.5]" />
          </button>
        </div>

        {/* 2. Messages List timeline */}
        <div
          ref={messagesContainerRef}
          className="flex-1 overflow-y-auto px-4 py-4 md:px-8 space-y-4 no-scrollbar z-10"
        >
          <div className="space-y-3.5 max-w-2xl w-full mx-auto pb-4">
            <div ref={topSentinelRef} className="h-1" />

            {isLoadingOlder && (
              <div className="flex justify-center py-2">
                <div className="w-5 h-5 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
              </div>
            )}

            {messages
              .toSorted(
                (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
              )
              .map((message) => {
                const isSentByMe = message.to_user_id === user._id;

                return (
                  <div
                    key={message._id}
                    className={`flex ${isSentByMe ? "justify-end" : "justify-start"} animate-message-in`}
                  >
                    <div className="flex flex-col gap-0.5 max-w-[78%] sm:max-w-[65%]">
                      
                      {/* Bubble */}
                      <div
                        onClick={() => {
                          if (message.from_user_id === currentUser._id) {
                            setActiveMsgId(
                              activeMsgId === message._id ? null : message._id
                            );
                          }
                        }}
                        className={`px-3.5 py-2.5 rounded-2xl shadow-sm transition-all text-left ${
                          isSentByMe
                            ? "bg-gradient-to-tr from-indigo-500 to-indigo-600 text-white rounded-br-sm shadow-indigo-500/10 cursor-pointer"
                            : "bg-white dark:bg-zinc-900 text-slate-800 dark:text-zinc-200 rounded-bl-sm border border-slate-200/40 dark:border-zinc-900/40"
                        }`}
                      >
                        {message.message_type === "image" && (
                          <div className="overflow-hidden rounded-xl border border-white/10 mb-1.5 shadow-sm">
                            <img
                              src={message.media_url}
                              className="w-full max-w-sm h-48 object-cover cursor-pointer hover:scale-[1.01] transition-transform"
                              alt="Shared Media"
                              onLoad={() => scrollToBottom(50)}
                            />
                          </div>
                        )}

                        {message.text && (
                          <p className="text-xs sm:text-sm leading-relaxed break-words font-medium">
                            {message.text}
                          </p>
                        )}
                      </div>

                      {/* Msg actions */}
                      {message.from_user_id === currentUser._id &&
                        activeMsgId === message._id && (
                          <button
                            className="text-[10px] font-black uppercase tracking-wider bg-rose-500/10 border border-rose-500/25 hover:bg-rose-500 hover:text-white text-rose-500 px-3 py-1 rounded-xl self-end mt-1.5 transition-colors cursor-pointer"
                            onClick={async (e) => {
                              e.stopPropagation();
                              try {
                                const token = await getToken();
                                await api.post(
                                  "/api/message/delete",
                                  { messageId: message._id },
                                  {
                                    headers: {
                                      Authorization: `Bearer ${token}`,
                                    },
                                  }
                                );
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

                      {/* Time and Seen indicator */}
                      {!(
                        message.from_user_id === currentUser._id &&
                        activeMsgId === message._id
                      ) && (
                        <div
                          className={`text-[9px] text-slate-400 dark:text-zinc-650 px-1 font-bold flex items-center gap-1 mt-0.5 ${
                            isSentByMe ? "justify-end" : "justify-start"
                          }`}
                        >
                          <span>
                            {new Date(message.createdAt).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                          {isSentByMe && (
                            <CheckCircle2 className={`w-3 h-3 ${message.seen ? 'text-emerald-500 dark:text-emerald-400' : 'text-slate-400 dark:text-zinc-700'}`} />
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* 3. Text Input area */}
        <div className="px-4 pb-4 pt-1 z-10">
          <div className="glass-panel flex items-end gap-2 px-3.5 py-2 bg-white/95 dark:bg-zinc-900/95 w-full max-w-xl mx-auto border border-slate-200/60 dark:border-zinc-850 shadow-lg rounded-2xl transition-all duration-200 focus-within:border-indigo-500 dark:focus-within:border-purple-400 focus-within:shadow-xl">
            <textarea
              ref={textareaRef}
              rows={1}
              className="flex-1 outline-none text-xs sm:text-sm text-slate-800 dark:text-zinc-200 bg-transparent placeholder:text-slate-400 dark:placeholder:text-zinc-600 resize-none overflow-hidden leading-relaxed py-1.5 max-h-24 self-center"
              placeholder="Type a message..."
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              onChange={(e) => {
                const nextText = e.target.value;
                setText(nextText);

                if (nextText.trim()) {
                  emitTypingStatus(true);
                  clearTimeout(typingTimerRef.current);
                  typingTimerRef.current = setTimeout(() => {
                    emitTypingStatus(false);
                  }, 1800);
                  return;
                }
                emitTypingStatus(false);
                clearTimeout(typingTimerRef.current);
              }}
              value={text}
            />

            {/* Media picker indicator */}
            <label
              htmlFor="image"
              className="flex-shrink-0 cursor-pointer mb-0.5 w-9 h-9 flex items-center justify-center rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-850 transition-colors"
            >
              {image ? (
                <div className="relative group flex items-center justify-center">
                  <img
                    src={URL.createObjectURL(image)}
                    alt="Preview"
                    className="h-7 w-7 rounded-lg object-cover ring-2 ring-indigo-500 dark:ring-purple-400"
                  />
                  <div
                    onClick={(e) => {
                      e.preventDefault();
                      setImage(null);
                    }}
                    className="absolute -top-1.5 -right-1.5 bg-red-500 hover:bg-red-650 text-white rounded-full p-0.5 opacity-90 hover:opacity-100 transition-opacity"
                  >
                    <X size={10} />
                  </div>
                </div>
              ) : (
                <ImageIcon className="w-4.5 h-4.5 text-slate-500 dark:text-zinc-500" />
              )}
              <input
                type="file"
                id="image"
                accept="image/*"
                hidden
                onChange={(e) => setImage(e.target.files[0])}
              />
            </label>

            {/* Ask Buddy Button */}
            {text.includes('@buddy') && (
              <button
                type="button"
                onClick={() => {
                  const regex = /@buddy\s*(.*)/i;
                  const match = text.match(regex);
                  const prompt = match && match[1] ? match[1].trim() : text.replace(/@buddy/g, '').trim();
                  setBuddyPrompt(prompt);
                  setShowBuddyModal(true);
                  setText("");
                }}
                className="flex-shrink-0 mb-0.5 w-9 h-9 flex items-center justify-center bg-gradient-to-tr from-indigo-500 via-purple-650 to-pink-500 text-white rounded-xl transition-all hover:scale-105 active:scale-95 cursor-pointer shadow border-0 animate-pulse"
                title="Ask PingBuddy AI"
              >
                <Sparkles className="w-4.5 h-4.5 text-white" />
              </button>
            )}

            {/* Send Button */}
            <button
              onClick={sendMessage}
              disabled={!text && !image}
              className="flex-shrink-0 mb-0.5 w-9 h-9 flex items-center justify-center bg-gradient-to-tr from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 disabled:from-slate-200 disabled:to-slate-350 dark:disabled:from-zinc-850 dark:disabled:to-zinc-800 disabled:cursor-not-allowed text-white rounded-xl transition-all duration-200 hover:shadow-lg active:scale-95 disabled:scale-100 cursor-pointer"
            >
              <SendHorizonal className="w-4 h-4 -rotate-12" />
            </button>
          </div>
        </div>

        {showBuddyModal && (
          <PingBuddyModal
            initialPrompt={buddyPrompt}
            onClose={() => setShowBuddyModal(false)}
            onInsert={(text) => {
              setText(text);
              setShowBuddyModal(false);
            }}
          />
        )}
      </div>
    )
  );
};

export default ChatBox;