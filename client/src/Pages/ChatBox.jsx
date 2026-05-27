import React, { useEffect, useRef, useState } from "react";
import { ImageIcon, SendHorizonal, Phone, X, Mic } from "lucide-react";
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
  }, [messages, isInitialLoading]);

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
  }, [hasMore, isLoadingOlder, isInitialLoading, nextCursor, userId]);

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
      <div className="flex flex-col h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
        <div className="relative z-10 flex items-center gap-3 px-4 py-3 md:px-8 md:gap-4 md:py-4 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-b border-slate-200/50 dark:border-slate-800/50 shadow-lg shadow-slate-200/50 dark:shadow-slate-950/50">
          <div className="relative flex-shrink-0">
            <img
              src={user.profile_picture}
              alt={user.full_name}
              className="size-10 md:size-11 rounded-full ring-2 ring-indigo-500/20 dark:ring-indigo-400/20 object-cover"
            />
          </div>

          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm md:text-base text-slate-900 dark:text-white truncate">
              {user.full_name}
            </p>

            {!isPeerTyping && (
              <p
                className={`text-[11px] flex items-center gap-1 ${
                  peerPresence?.isOnline
                    ? "text-emerald-500 dark:text-emerald-300"
                    : "text-slate-500 dark:text-slate-300"
                }`}
              >
                <span
                  className={`size-2 rounded-full ${
                    peerPresence?.isOnline
                      ? "bg-emerald-500 animate-pulse"
                      : "bg-slate-400"
                  }`}
                />
                {peerPresence?.isOnline
                  ? "Online"
                  : formatLastSeen(peerPresence?.lastSeen)}
              </p>
            )}

            {isPeerTyping && (
              <p className="text-[11px] text-indigo-500 dark:text-indigo-300">
                typing...
              </p>
            )}
          </div>

          <button
            onClick={async () => {
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
              .toSorted(
                (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
              )
              .map((message) => {
                const isSentByMe = message.to_user_id === user._id;

                return (
                  <div
                    key={message._id}
                    className={`flex ${
                      isSentByMe ? "justify-end" : "justify-start"
                    }`}
                  >
                    <div className="flex flex-col gap-0.5 max-w-[75%] md:max-w-[65%]">
                      <div
                        onClick={() => {
                          if (message.from_user_id === currentUser._id) {
                            setActiveMsgId(
                              activeMsgId === message._id ? null : message._id
                            );
                          }
                        }}
                        className={`px-3 py-2 rounded-2xl shadow-md transition-all duration-200 ${
                          isSentByMe
                            ? "bg-gradient-to-br from-indigo-500 to-purple-600 text-white rounded-br-sm hover:shadow-lg hover:shadow-indigo-500/25 cursor-pointer"
                            : "bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-bl-sm border border-slate-200/50 dark:border-slate-700/50"
                        }`}
                      >
                        {message.message_type === "image" && (
                          <img
                            src={message.media_url}
                            className="w-full max-w-sm rounded-xl mb-1.5 shadow-sm"
                            alt="Shared"
                            onLoad={() => scrollToBottom(50)}
                          />
                        )}

                        {message.text && (
                          <p className="text-sm leading-snug break-words">
                            {message.text}
                          </p>
                        )}
                      </div>

                      {message.from_user_id === currentUser._id &&
                        activeMsgId === message._id && (
                          <button
                            className="text-[11px] font-medium bg-red-500 hover:bg-red-600 text-white px-2.5 py-1 rounded-full self-end mt-1 transition-colors active:scale-95"
                            onClick={async (e) => {
                              e.stopPropagation();

                              try {
                                const token = await getToken();

                                await api.post(
                                  "/api/message/delete",
                                  {
                                    messageId: message._id,
                                  },
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

                      {!(
                        message.from_user_id === currentUser._id &&
                        activeMsgId === message._id
                      ) && (
                        <div
                          className={`text-[10px] text-slate-500 dark:text-slate-400 px-1 ${
                            isSentByMe ? "text-right" : "text-left"
                          }`}
                        >
                          {new Date(message.createdAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
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
          <div className="flex items-end gap-2 px-4 py-2 bg-white dark:bg-slate-900 w-full max-w-xl mx-auto border border-slate-300 dark:border-slate-700 shadow-xl shadow-slate-200/50 dark:shadow-slate-950/50 rounded-2xl transition-all duration-200 focus-within:border-indigo-500 dark:focus-within:border-indigo-400 focus-within:shadow-2xl focus-within:shadow-indigo-500/20">
            <textarea
              ref={textareaRef}
              rows={1}
              className="flex-1 outline-none text-[13px] text-slate-800 dark:text-white bg-transparent placeholder:text-slate-400 dark:placeholder:text-slate-500 resize-none overflow-hidden leading-snug py-1.5 max-h-28 self-center"
              placeholder="Type a message"
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

            <label htmlFor="image" className="flex-shrink-0 cursor-pointer mb-0.5">
              {image ? (
                <div className="relative group">
                  <img
                    src={URL.createObjectURL(image)}
                    alt="Preview"
                    className="h-7 w-7 rounded-lg object-cover ring-2 ring-indigo-500 dark:ring-indigo-400"
                  />

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

              <input
                type="file"
                id="image"
                accept="image/*"
                hidden
                onChange={(e) => setImage(e.target.files[0])}
              />
            </label>

            <button
              onClick={sendMessage}
              disabled={!text && !image}
              className="flex-shrink-0 mb-0.5 bg-gradient-to-br from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 disabled:from-slate-300 disabled:to-slate-400 dark:disabled:from-slate-700 dark:disabled:to-slate-600 disabled:cursor-not-allowed text-white p-2 rounded-full transition-all duration-200 hover:shadow-lg hover:shadow-indigo-500/30 active:scale-95 disabled:active:scale-100"
            >
              <SendHorizonal size={15} />
            </button>
          </div>
        </div>
      </div>
    )
  );
};

export default ChatBox;