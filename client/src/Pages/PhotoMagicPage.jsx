import React, { useState, useRef, useEffect } from "react";
import {
  Sparkles,
  Image,
  Hash,
  Quote,
  MessageSquare,
  ChevronDown,
  Upload,
  Copy,
  Check,
  X,
} from "lucide-react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

const PhotoMagicPage = () => {
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState("");
  const [copied, setCopied] = useState(false);
  const [showViewDropdown, setShowViewDropdown] = useState(false);
  const fileInputRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handleClickOutside = () => setShowViewDropdown(false);
    if (showViewDropdown) {
      document.addEventListener("click", handleClickOutside);
    }
    return () => document.removeEventListener("click", handleClickOutside);
  }, [showViewDropdown]);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
      setResult("");
    }
  };

  const handleGenerate = async (type) => {
    if (!imageFile) return;

    setIsGenerating(true);
    setResult("");

    const formData = new FormData();
    formData.append("type", type);
    formData.append("image", imageFile);

    try {
      const { data } = await axios.post(
        "http://localhost:8000/api/photo-magic",
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );

      setResult(data.response);
    } catch (error) {
      console.error(error);
      setResult(
        "Sorry, failed to generate content. Make sure the backend is running and the API key is valid."
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col h-[100dvh] bg-white dark:bg-[#0b0f1a] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-white/5 bg-white/80 dark:bg-[#0b0f1a]/80 backdrop-blur-md sticky top-0 z-30 shrink-0">
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full blur opacity-40 animate-pulse"></div>
            <div className="relative p-2.5 rounded-full bg-slate-900 text-white shadow-xl">
              <Image className="w-5 h-5 text-indigo-400" />
            </div>
          </div>

          <div>
            <div
              className="relative"
              onClick={(e) => {
                e.stopPropagation();
                setShowViewDropdown(!showViewDropdown);
              }}
            >
              <div className="flex items-center gap-2 cursor-pointer group">
                <h1 className="text-sm font-bold tracking-tight text-gray-900 dark:text-white flex items-center gap-2 group-hover:text-indigo-500 dark:group-hover:text-indigo-400 transition-colors select-none">
                  PHOTO MAGIC
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-500 border border-indigo-500/20">
                    PRO
                  </span>
                </h1>
                <ChevronDown
                  size={14}
                  className={`text-gray-500 transition-transform ${
                    showViewDropdown ? "rotate-180" : ""
                  }`}
                />
              </div>

              {showViewDropdown && (
                <div className="absolute top-full left-0 mt-3 w-48 bg-white dark:bg-slate-900 border border-gray-100 dark:border-white/10 rounded-xl shadow-xl shadow-indigo-500/10 py-1.5 z-50 overflow-hidden transform origin-top-left transition-all">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate("/ai");
                      setShowViewDropdown(false);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800"
                  >
                    <MessageSquare size={16} />
                    AI Chat
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowViewDropdown(false);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10"
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
      </div>

      {/* Main */}
      <div className="flex-1 overflow-hidden px-4 py-4 md:px-12 md:py-6 flex flex-col items-center justify-center relative min-h-0">
        <div className="max-w-2xl w-full relative h-full flex items-center justify-center">
          {/* Background UI */}
          <div
            className={`w-full transition-all duration-500 space-y-8 ${
              isGenerating || result
                ? "opacity-20 blur-md pointer-events-none scale-[0.98]"
                : "opacity-100 scale-100"
            }`}
          >
            <div className="text-center space-y-2">
              <div className="inline-flex p-3 rounded-full bg-indigo-500/10 text-indigo-500 mb-2 border border-indigo-500/20 shadow-lg shadow-indigo-500/10">
                <Sparkles size={24} />
              </div>

              <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
                Photo Magic
              </h2>

              <p className="text-sm text-gray-500 dark:text-gray-400 max-w-lg mx-auto">
                Upload any photo and instantly generate beautiful captions,
                inspiring quotes, or viral hashtags.
              </p>
            </div>

            <div className="flex flex-col items-center gap-6">
              <div
                className="w-full max-w-sm aspect-square md:aspect-[4/3] rounded-3xl border-2 border-dashed border-gray-300 dark:border-white/10 hover:border-indigo-400 dark:hover:border-indigo-500 transition-colors bg-gray-50 dark:bg-slate-800/50 flex flex-col items-center justify-center cursor-pointer overflow-hidden relative group"
                onClick={() => fileInputRef.current?.click()}
              >
                {imagePreview ? (
                  <>
                    <img
                      src={imagePreview}
                      alt="Preview"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <div className="bg-white/20 backdrop-blur-md px-4 py-2 rounded-full text-white text-sm font-medium flex items-center gap-2">
                        <Upload size={16} /> Change Photo
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center gap-3 text-gray-400 dark:text-gray-500 p-6 text-center">
                    <div className="p-4 rounded-full bg-gray-100 dark:bg-slate-800 text-gray-400 dark:text-gray-400">
                      <Image size={32} />
                    </div>
                    <div>
                      <p className="font-medium text-gray-700 dark:text-gray-300">
                        Click to upload photo
                      </p>
                      <p className="text-[11px] mt-1">
                        PNG, JPG, JPEG up to 10MB
                      </p>
                    </div>
                  </div>
                )}

                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  accept="image/*"
                  onChange={handleImageChange}
                />
              </div>

              <div className="flex flex-wrap items-center justify-center gap-3 w-full">
                <button
                  onClick={() => handleGenerate("captions")}
                  disabled={!imageFile || isGenerating}
                  className="flex-1 flex items-center justify-center gap-2 px-6 py-3.5 bg-gradient-to-br from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-2xl shadow-lg shadow-indigo-500/25 transition-all active:scale-95 font-medium"
                >
                  <MessageSquare size={18} />
                  Captions
                </button>

                <button
                  onClick={() => handleGenerate("quotes")}
                  disabled={!imageFile || isGenerating}
                  className="flex-1 flex items-center justify-center gap-2 px-6 py-3.5 bg-gradient-to-br from-purple-500 to-fuchsia-600 hover:from-purple-600 hover:to-fuchsia-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-2xl shadow-lg shadow-purple-500/25 transition-all active:scale-95 font-medium"
                >
                  <Quote size={18} />
                  Quotes
                </button>

                <button
                  onClick={() => handleGenerate("hashtags")}
                  disabled={!imageFile || isGenerating}
                  className="flex-1 flex items-center justify-center gap-2 px-6 py-3.5 bg-gradient-to-br from-pink-500 to-rose-600 hover:from-pink-600 hover:to-rose-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-2xl shadow-lg shadow-pink-500/25 transition-all active:scale-95 font-medium"
                >
                  <Hash size={18} />
                  Hashtags
                </button>
              </div>
            </div>
          </div>

          {/* Result Overlay */}
          {(isGenerating || result) && (
            <div className="absolute inset-0 z-20 flex items-center justify-center w-full px-1 md:px-0 animate-in fade-in zoom-in-95 duration-500">
              <div className="relative flex flex-col w-full max-w-2xl max-h-[78vh] backdrop-blur-2xl bg-white/70 dark:bg-[#0b0f1a]/80 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.5)] border border-white/40 dark:border-white/10 rounded-[2rem] p-6 md:p-8">
                <button
                  onClick={() => {
                    setIsGenerating(false);
                    setResult("");
                  }}
                  className="absolute -top-4 -right-2 md:-right-4 p-2.5 rounded-full bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300 transition-colors z-30 shadow-lg border border-white/20 dark:border-white/10"
                  title="Close and go back"
                >
                  <X size={20} />
                </button>

                {isGenerating ? (
                  <div className="flex-1 flex flex-col items-center justify-center py-10 gap-6 min-h-[40vh]">
                    <div className="relative">
                      <div className="absolute -inset-4 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full blur-lg opacity-40 animate-pulse"></div>
                      <div className="relative p-4 rounded-full bg-slate-900 shadow-xl text-white">
                        <Sparkles
                          className="w-8 h-8 text-indigo-400 animate-spin"
                          style={{ animationDuration: "3s" }}
                        />
                      </div>
                    </div>

                    <div className="text-center">
                      <p className="text-[15px] font-bold tracking-tight text-gray-900 dark:text-white">
                        Weaving Magic...
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Analyzing your image perfectly
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="w-full flex-1 flex flex-col min-h-0 pt-2">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-sm font-bold tracking-widest text-indigo-600 dark:text-indigo-400 uppercase flex items-center gap-2">
                        <Sparkles size={16} /> Result
                      </h3>

                      <button
                        onClick={handleCopy}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-500/10 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 rounded-xl text-xs font-bold transition-colors"
                      >
                        {copied ? (
                          <Check size={14} className="text-emerald-500" />
                        ) : (
                          <Copy size={14} />
                        )}
                        {copied ? "COPIED!" : "COPY"}
                      </button>
                    </div>

                    <div
                      className="flex-1 overflow-y-auto max-h-[45vh] bg-white/50 dark:bg-black/20 p-6 rounded-3xl border border-white/50 dark:border-white/5 shadow-inner whitespace-pre-wrap text-[16px] leading-relaxed text-gray-800 dark:text-gray-200 custom-scrollbar"
                      style={{ wordBreak: "break-word", overflowWrap: "break-word" }}
                    >
                      {result}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <style jsx>{`
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
    </div>
  );
};

export default PhotoMagicPage;