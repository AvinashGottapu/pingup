import React, { useState, useEffect, useRef } from "react";
import { SendHorizontal, Sparkles, X, Copy, Check, CornerDownLeft } from "lucide-react";
import axios from "axios";
import toast from "react-hot-toast";

const PingBuddyModal = ({ initialPrompt, onClose, onInsert }) => {
  const [messages, setMessages] = useState([
    {
      id: 1,
      role: "bot",
      text: "Hey! I'm PingBuddy. I can write posts, write messages, translate text, or edit content. Ask me anything!",
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [copiedId, setCopiedId] = useState(null);

  const scrollRef = useRef(null);
  const initialTriggerRef = useRef(false);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const getCurrentTime = () =>
    new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const sendMessage = async (overrideText = null) => {
    const text = overrideText !== null ? overrideText.trim() : inputValue.trim();
    if (!text || isTyping) return;

    const userMsg = {
      id: Date.now(),
      role: "user",
      text,
      time: getCurrentTime(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputValue("");
    setIsTyping(true);

    const AI_URL = import.meta.env.VITE_AI_API_URL;

    try {
      const currentMessages = [...messages, userMsg].filter((m) => m.id !== 1);

      const { data } = await axios.post(
        `${AI_URL}/api/chat`,
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
          text: "I'm sorry, I couldn't connect to my AI server. Please make sure the backend is running.",
          time: getCurrentTime(),
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  useEffect(() => {
    if (initialPrompt && !initialTriggerRef.current) {
      initialTriggerRef.current = true;
      sendMessage(initialPrompt);
    }
  }, [initialPrompt]);

  const handleCopy = (id, text) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success("Copied to clipboard!");
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-4 z-[9999] animate-fade-in text-left">
      <div 
        className="bg-white dark:bg-zinc-900 border border-slate-200/50 dark:border-zinc-800 rounded-3xl w-full max-w-lg shadow-2xl flex flex-col h-[520px] max-h-[85vh] animate-scale-up overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/50 backdrop-blur-md">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 text-white shadow-md">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-slate-800 dark:text-zinc-100">
                PingBuddy AI Copilot
              </h3>
              <p className="text-[10px] text-emerald-500 font-bold uppercase tracking-wider flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Active Assistant
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-400 hover:text-slate-650 dark:hover:text-zinc-300 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Conversation List */}
        <div 
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-5 space-y-4 pr-3.5 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent"
        >
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`flex flex-col gap-1 max-w-[85%] ${msg.role === "user" ? "items-end" : "items-start"}`}>
                <div 
                  className={`px-3.5 py-2.5 rounded-2xl text-xs sm:text-sm shadow-sm transition-all whitespace-pre-wrap ${
                    msg.role === "user"
                      ? "bg-gradient-to-tr from-indigo-500 to-indigo-650 text-white rounded-br-none"
                      : "bg-slate-50 dark:bg-zinc-850 text-slate-850 dark:text-zinc-200 rounded-bl-none border border-slate-100 dark:border-zinc-800"
                  }`}
                >
                  {msg.text}
                </div>

                {/* Quick actions for Bot messages */}
                {msg.role === "bot" && msg.id !== 1 && (
                  <div className="flex items-center gap-2 mt-1">
                    <button
                      onClick={() => handleCopy(msg.id, msg.text)}
                      className="flex items-center gap-1 text-[10px] font-bold text-zinc-500 dark:text-zinc-400 hover:text-indigo-600 transition-colors p-1 rounded hover:bg-slate-100 dark:hover:bg-zinc-800"
                    >
                      {copiedId === msg.id ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-500" />
                          <span className="text-emerald-500">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>

                    {onInsert && (
                      <button
                        onClick={() => onInsert(msg.text)}
                        className="flex items-center gap-1 text-[10px] font-extrabold text-indigo-600 dark:text-purple-400 hover:text-indigo-750 transition-colors p-1 rounded hover:bg-slate-100 dark:hover:bg-zinc-800"
                        title="Insert this response back into the text field"
                      >
                        <CornerDownLeft className="w-3 h-3" />
                        <span>Insert Content</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}

          {isTyping && (
            <div className="flex justify-start">
              <div className="bg-slate-50 dark:bg-zinc-850 px-3.5 py-2.5 rounded-2xl rounded-bl-none border border-slate-100 dark:border-zinc-800 flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-zinc-400 dark:bg-zinc-650 rounded-full animate-bounce"></span>
                <span className="w-1.5 h-1.5 bg-zinc-400 dark:bg-zinc-650 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                <span className="w-1.5 h-1.5 bg-zinc-400 dark:bg-zinc-650 rounded-full animate-bounce [animation-delay:0.4s]"></span>
              </div>
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="p-4 border-t border-slate-100 dark:border-zinc-800 bg-white dark:bg-zinc-900">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-850 rounded-2xl focus-within:border-indigo-500 dark:focus-within:border-purple-400 transition-colors">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  sendMessage();
                }
              }}
              placeholder="Ask follow-up, request changes..."
              className="flex-1 bg-transparent border-0 outline-none text-xs sm:text-sm text-slate-800 dark:text-zinc-200 placeholder-zinc-450"
            />
            <button
              onClick={() => sendMessage()}
              disabled={!inputValue.trim() || isTyping}
              className="p-2 bg-gradient-to-tr from-indigo-500 to-indigo-650 hover:from-indigo-600 hover:to-indigo-750 disabled:from-zinc-200 disabled:to-zinc-300 dark:disabled:from-zinc-850 dark:disabled:to-zinc-800 text-white rounded-xl transition-all active:scale-95 disabled:scale-100 cursor-pointer shadow shadow-indigo-500/10"
            >
              <SendHorizontal className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PingBuddyModal;
