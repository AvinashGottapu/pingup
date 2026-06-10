import React, { useState, useRef, useEffect } from "react";
import {
  BadgeCheck,
  Heart,
  MessageCircle,
  Share2,
  ThumbsUp,
  ThumbsDown,
  Trash2,
  MoreVertical,
  Edit2,
  Sparkles,
  X,
} from "lucide-react";
import moment from "moment";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { useAuth } from "@clerk/clerk-react";
import { toast } from "react-hot-toast";
import axios from "axios";
import api from "../api/axios";
import PingBuddyModal from "./PingBuddyModal";

const PostCard = ({ post, onDeletePost, onUpdatePost }) => {
  const navigate = useNavigate();

  const [likes, setLikes] = useState(post.likes_count || []);
  const [comments, setComments] = useState(post.comments || []);
  const [totalComments, setTotalComments] = useState(
    post.total_comments || post.comments?.length || 0
  );

  const [nextCursor, setNextCursor] = useState(post.nextCommentCursor || null);
  const [hasMore, setHasMore] = useState(post.hasMoreComments || false);

  const [commentInput, setCommentInput] = useState("");
  const [showComments, setShowComments] = useState(false);
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [loadingMoreComments, setLoadingMoreComments] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [playLikeAnimation, setPlayLikeAnimation] = useState(false);

  // Post action menu, editing, and AI explain states
  const [showMenu, setShowMenu] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(post.content || "");
  const [isUpdatingPost, setIsUpdatingPost] = useState(false);
  const [aiExplanation, setAiExplanation] = useState("");
  const [explainingPost, setExplainingPost] = useState(false);
  const [commentExplanations, setCommentExplanations] = useState({});
  const [explainingComments, setExplainingComments] = useState({});

  // Language input states for AI Explainer
  const [showPostLangInput, setShowPostLangInput] = useState(false);
  const [postLang, setPostLang] = useState("");
  const [showCommentLangInput, setShowCommentLangInput] = useState({});
  const [commentLangs, setCommentLangs] = useState({});

  // PingBuddy modal states
  const [showBuddyModal, setShowBuddyModal] = useState(false);
  const [buddyPrompt, setBuddyPrompt] = useState("");

  const currentUser = useSelector((state) => state.user.value);
  const { getToken } = useAuth();

  const textareaRef = useRef(null);
  const commentsBoxRef = useRef(null);

  useEffect(() => {
    setLikes(post.likes_count || []);
    setComments(post.comments || []);
    setTotalComments(post.total_comments || post.comments?.length || 0);
    setNextCursor(post.nextCommentCursor || null);
    setHasMore(post.hasMoreComments || false);
  }, [post]);

  const menuRef = useRef(null);
  const isPostOwner = post.user?._id === currentUser?._id;

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowMenu(false);
      }
    };
    if (showMenu) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showMenu]);

  const handleDeletePost = async () => {
    if (!window.confirm("Are you sure you want to delete this post?")) return;

    try {
      const token = await getToken();
      const { data } = await api.post(
        "/api/post/delete",
        { postId: post._id },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (data.success) {
        toast.success("Post deleted successfully");
        if (onDeletePost) {
          onDeletePost(post._id);
        }
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      toast.error(error.message || "Failed to delete post");
    }
  };

  const handleEditSubmit = async () => {
    if (editContent.includes('@buddy')) {
      const regex = /@buddy\s*(.*)/i;
      const match = editContent.match(regex);
      const prompt = match && match[1] ? match[1].trim() : editContent.replace(/@buddy/g, '').trim();
      setBuddyPrompt(prompt);
      setShowBuddyModal(true);
      return;
    }

    if (!editContent.trim()) {
      toast.error("Post content cannot be empty.");
      return;
    }

    try {
      setIsUpdatingPost(true);
      const token = await getToken();
      const { data } = await api.post(
        "/api/post/edit",
        { postId: post._id, content: editContent.trim() },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (data.success) {
        toast.success("Post updated successfully");
        setIsEditing(false);
        if (onUpdatePost) {
          onUpdatePost(data.post);
        }
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      toast.error(error.message || "Failed to update post");
    } finally {
      setIsUpdatingPost(false);
    }
  };

  const handleAIExplain = async (lang) => {
    if (!post.content) return;

    const AI_URL = import.meta.env.VITE_AI_API_URL;

    try {
      setExplainingPost(true);
      setAiExplanation(""); // Clear previous explanation

      const { data } = await axios.post(`${AI_URL}/api/explain`, {
        text: post.content.trim(),
        language: lang ? lang.trim() : null,
      });

      if (data.response) {
        setAiExplanation(data.response);
      } else {
        toast.error("Failed to generate AI explanation");
      }
    } catch (error) {
      toast.error(
        error.response?.data?.detail?.message ||
        error.message ||
        "Could not connect to AI services."
      );
    } finally {
      setExplainingPost(false);
    }
  };

  const handleCommentExplain = async (commentId, commentText, lang) => {
    if (!commentText) return;

    const AI_URL = import.meta.env.VITE_AI_API_URL;

    try {
      setExplainingComments((prev) => ({ ...prev, [commentId]: true }));
      setCommentExplanations((prev) => ({ ...prev, [commentId]: "" }));

      const { data } = await axios.post(`${AI_URL}/api/explain`, {
        text: commentText.trim(),
        language: lang ? lang.trim() : null,
      });

      if (data.response) {
        setCommentExplanations((prev) => ({
          ...prev,
          [commentId]: data.response,
        }));
      } else {
        toast.error("Failed to generate AI explanation");
      }
    } catch (error) {
      toast.error(
        error.response?.data?.detail?.message ||
        error.message ||
        "Could not connect to AI services."
      );
    } finally {
      setExplainingComments((prev) => ({ ...prev, [commentId]: false }));
    }
  };

  const postWithHashtags = post.content?.replace(
    /(#\w+)/g,
    '<span class="text-indigo-500 dark:text-purple-400 font-extrabold tracking-wide hover:underline cursor-pointer"> $1 </span>'
  );

  const resetTextarea = () => {
    setCommentInput("");
    setIsFocused(false);

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleLike = async () => {
    try {
      const { data } = await api.post(
        "/api/post/like",
        { postId: post._id },
        {
          headers: {
            Authorization: `Bearer ${await getToken()}`,
          },
        }
      );

      if (data.success) {
        if (!likes.includes(currentUser?._id)) {
          setPlayLikeAnimation(true);
          setTimeout(() => setPlayLikeAnimation(false), 300);
        }
        toast.success(data.message);

        setLikes((prev) => {
          if (prev.includes(currentUser._id)) {
            return prev.filter((id) => id !== currentUser._id);
          }
          return [...prev, currentUser._id];
        });
      } else {
        toast(data.message);
      }
    } catch (error) {
      toast.error(error.message);
    }
  };

  const handleCommentSubmit = async () => {
    if (!commentInput.trim()) {
      toast.error("Write something to post a comment.");
      return;
    }

    const AI_URL = import.meta.env.VITE_AI_API_URL;

    try {
      setCommentSubmitting(true);

      const toxicityRes = await axios.post(`${AI_URL}/api/check-toxicity`, {
        comment: commentInput.trim(),
      });

      if (toxicityRes.data.toxicity) {
        toast.error("Toxic comments are not allowed.");
        return;
      }

      const { data } = await api.post(
        "/api/post/comment",
        {
          postId: post._id,
          content: commentInput.trim(),
        },
        {
          headers: {
            Authorization: `Bearer ${await getToken()}`,
          },
        }
      );

      if (data.success) {
        setComments((prev) => [data.comment, ...prev]);
        setTotalComments((prev) => prev + 1);
        resetTextarea();
        setShowComments(true);
        toast.success("Comment added");
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      toast.error(error.message);
    } finally {
      setCommentSubmitting(false);
    }
  };

  const handleCommentLike = async (commentId) => {
    try {
      const { data } = await api.post(
        "/api/post/comment/like",
        {
          postId: post._id,
          commentId,
        },
        {
          headers: {
            Authorization: `Bearer ${await getToken()}`,
          },
        }
      );

      if (data.success) {
        setComments((prev) =>
          prev.map((comment) =>
            comment._id === commentId
              ? {
                  ...comment,
                  likes_count: data.likes_count,
                  dislikes_count: data.dislikes_count,
                }
              : comment
          )
        );
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      toast.error(error.message);
    }
  };

  const handleCommentDislike = async (commentId) => {
    try {
      const { data } = await api.post(
        "/api/post/comment/dislike",
        {
          postId: post._id,
          commentId,
        },
        {
          headers: {
            Authorization: `Bearer ${await getToken()}`,
          },
        }
      );

      if (data.success) {
        setComments((prev) =>
          prev.map((comment) =>
            comment._id === commentId
              ? {
                  ...comment,
                  likes_count: data.likes_count,
                  dislikes_count: data.dislikes_count,
                }
              : comment
          )
        );
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      toast.error(error.message);
    }
  };

  const handleCommentDelete = async (commentId) => {
    if (!window.confirm("Delete this comment?")) return;

    try {
      const { data } = await api.post(
        "/api/post/comment/delete",
        {
          postId: post._id,
          commentId,
        },
        {
          headers: {
            Authorization: `Bearer ${await getToken()}`,
          },
        }
      );

      if (data.success) {
        setComments((prev) =>
          prev.filter((comment) => comment._id !== commentId)
        );
        setTotalComments((prev) => prev - 1);
        toast.success(data.message);
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      toast.error(error.message);
    }
  };

  const loadMoreComments = async () => {
    if (!nextCursor || loadingMoreComments || !hasMore) return;

    try {
      setLoadingMoreComments(true);

      const token = await getToken();

      const { data } = await api.get(`/api/post/${post._id}/comments`, {
        params: {
          cursor: nextCursor,
          limit: 10,
        },
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (data.success) {
        setComments((prev) => [...prev, ...data.comments]);
        setNextCursor(data.nextCursor || null);
        setHasMore(data.hasMore || false);
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoadingMoreComments(false);
    }
  };

  const handleCommentsScroll = () => {
    const box = commentsBoxRef.current;

    if (!box || loadingMoreComments || !hasMore || !nextCursor) return;

    const nearBottom =
      box.scrollTop + box.clientHeight >= box.scrollHeight - 50;

    if (nearBottom) {
      loadMoreComments();
    }
  };

  const isLiked = likes.includes(currentUser?._id);

  return (
    <div className="glass-panel rounded-3xl p-5 space-y-4 w-full max-w-2xl shadow-xl transition-transform duration-300">
      
      {/* 1. Header user info */}
      <div className="flex items-center justify-between">
        <div
          onClick={() => navigate("/profile/" + post.user?._id)}
          className="flex items-center gap-3 cursor-pointer"
        >
          <img
            src={post.user?.profile_picture || 'https://images.clerk.dev/static/profile.png'}
            alt=""
            className="w-10 h-10 rounded-full shadow border border-slate-100 dark:border-zinc-800 object-cover"
          />

          <div className="flex flex-col text-left">
            <div className="flex items-center space-x-1">
              <span className="font-extrabold text-xs text-slate-800 dark:text-zinc-200">
                {post.user?.full_name}
              </span>
              {post.user?.is_verified && (
                <BadgeCheck className="w-3.5 h-3.5 text-indigo-500 dark:text-purple-400 fill-indigo-500/10" />
              )}
            </div>

            <div className="text-gray-500 dark:text-zinc-500 text-[10px] font-bold">
              @{post.user?.username} &middot; {moment(post.createdAt).fromNow()}
            </div>
          </div>
        </div>

        {/* Action Menu (3-dots) */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setShowMenu((prev) => !prev)}
            className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800 text-gray-500 hover:text-gray-805 dark:text-zinc-400 dark:hover:text-zinc-205 transition-colors cursor-pointer"
          >
            <MoreVertical className="w-5 h-5" />
          </button>

          {showMenu && (
            <div className="absolute right-0 mt-1.5 w-48 bg-white dark:bg-zinc-900 border border-slate-200/60 dark:border-zinc-800 rounded-2xl shadow-xl py-1.5 z-30 animate-message-in">
              {post.content && (
                <button
                  onClick={() => {
                    setShowMenu(false);
                    setAiExplanation(""); // Clear previous explanation
                    setShowPostLangInput(true);
                    setPostLang(""); // Clear lang input
                  }}
                  disabled={explainingPost}
                  className="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/20 text-left disabled:opacity-50"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>{explainingPost ? "Explaining..." : "AI Explain"}</span>
                </button>
              )}
              
              {isPostOwner && (
                <>
                  {post.content && <div className="h-px bg-slate-100 dark:bg-zinc-800 my-1" />}
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      setIsEditing(true);
                      setEditContent(post.content || "");
                    }}
                    className="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-bold text-slate-700 dark:text-zinc-350 hover:bg-slate-50 dark:hover:bg-zinc-800/50 text-left"
                  >
                    <Edit2 className="w-4 h-4 text-slate-500" />
                    <span>Edit Post</span>
                  </button>
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      handleDeletePost();
                    }}
                    className="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 text-left"
                  >
                    <Trash2 className="w-4 h-4 text-rose-500" />
                    <span>Delete Post</span>
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 2. Content */}
      {isEditing ? (
        <div className="space-y-2 text-left">
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            rows={3}
            className="w-full p-3 bg-slate-50 dark:bg-zinc-950 border border-slate-200/50 dark:border-zinc-850 focus:border-indigo-500 dark:focus:border-purple-400 rounded-2xl text-xs sm:text-sm text-slate-800 dark:text-zinc-200 placeholder:text-gray-400 outline-none transition-colors resize-none"
            placeholder="Edit your post..."
          />
          <div className="flex items-center justify-between gap-2">
            {editContent.includes('@buddy') ? (
              <button
                type="button"
                onClick={() => {
                  const regex = /@buddy\s*(.*)/i;
                  const match = editContent.match(regex);
                  const prompt = match && match[1] ? match[1].trim() : editContent.replace(/@buddy/g, '').trim();
                  setBuddyPrompt(prompt);
                  setShowBuddyModal(true);
                }}
                className="flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-indigo-500 via-purple-650 to-pink-500 text-white rounded-xl text-[9px] font-extrabold uppercase tracking-wider transition-all cursor-pointer shadow hover:scale-[1.01] active:scale-98 animate-pulse border-0"
              >
                <Sparkles className="w-3.5 h-3.5 text-white" />
                <span>Ask Buddy AI</span>
              </button>
            ) : <div />}

            <div className="flex gap-2">
              <button
                onClick={() => setIsEditing(false)}
                className="px-3.5 py-1.5 rounded-xl text-[10px] font-bold text-gray-500 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleEditSubmit}
                disabled={isUpdatingPost || !editContent.trim()}
                className="px-4 py-1.5 rounded-xl text-[10px] font-black bg-indigo-600 dark:bg-purple-400 text-white dark:text-zinc-950 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer shadow shadow-indigo-500/10"
              >
                {isUpdatingPost ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      ) : (
        post.content && (
          <div
            className="text-slate-700 dark:text-zinc-300 text-xs sm:text-sm whitespace-pre-line leading-relaxed text-left px-1 font-medium"
            dangerouslySetInnerHTML={{ __html: postWithHashtags }}
          />
        )
      )}

      {/* AI Explanation Language Input */}
      {showPostLangInput && (
        <div className="p-4 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/30 text-left animate-message-in space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400 font-extrabold text-[10px] uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5 animate-pulse" />
              <span>AI Explainer Language</span>
            </div>
            <button 
              onClick={() => setShowPostLangInput(false)} 
              className="text-gray-400 hover:text-gray-650 dark:hover:text-zinc-300 p-0.5 rounded-lg hover:bg-indigo-100/50 dark:hover:bg-indigo-950/50 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          
          <div className="flex gap-2 items-center">
            <input
              type="text"
              value={postLang}
              onChange={(e) => setPostLang(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  setShowPostLangInput(false);
                  handleAIExplain(postLang);
                }
              }}
              placeholder="Enter target language (e.g. Hindi, Spanish, French, Telugu) or leave blank for English..."
              className="flex-1 px-3 py-1.5 bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-850 rounded-xl text-xs text-slate-800 dark:text-zinc-200 outline-none focus:border-indigo-500 dark:focus:border-purple-400 transition-colors"
              autoFocus
            />
            <button
              onClick={() => {
                setShowPostLangInput(false);
                handleAIExplain(postLang);
              }}
              className="px-4 py-1.5 bg-indigo-600 dark:bg-purple-400 hover:bg-indigo-750 text-white dark:text-zinc-950 text-[10px] font-black rounded-xl transition-all cursor-pointer shadow shadow-indigo-500/10"
            >
              Explain
            </button>
          </div>
        </div>
      )}

      {/* AI Explanation Box */}
      {explainingPost && (
        <div className="flex items-center gap-2 p-3.5 rounded-2xl bg-indigo-50/30 dark:bg-indigo-950/10 border border-indigo-100/50 dark:border-indigo-900/20 text-left animate-pulse">
          <Sparkles className="w-4 h-4 text-indigo-500 dark:text-purple-400 animate-spin" />
          <span className="text-xs text-indigo-600 dark:text-indigo-400 font-bold">AI Explaining Post...</span>
        </div>
      )}

      {aiExplanation && (
        <div className="relative p-4 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/30 text-left animate-message-in">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400 font-extrabold text-[10px] uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5 animate-pulse" />
              <span>AI Explanation</span>
            </div>
            <button 
              onClick={() => setAiExplanation("")} 
              className="text-gray-400 hover:text-gray-650 dark:hover:text-zinc-300 p-0.5 rounded-lg hover:bg-indigo-100/50 dark:hover:bg-indigo-950/50 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className="text-xs text-slate-700 dark:text-zinc-350 leading-relaxed font-medium">
            {aiExplanation}
          </p>
        </div>
      )}

      {/* 3. Photos attachments */}
      {post.image_urls?.length > 0 && (
        <div className="grid grid-cols-2 gap-2 mt-1">
          {post.image_urls.map((img, index) => (
            <div key={index} className={`overflow-hidden rounded-2xl border border-slate-100 dark:border-zinc-900 shadow-sm ${
              post.image_urls.length === 1 ? "col-span-2" : ""
            }`}>
              <img
                src={img}
                alt=""
                className={`w-full ${
                  post.image_urls.length === 1 
                    ? "h-auto max-h-[550px] object-contain bg-zinc-100 dark:bg-zinc-950" 
                    : "h-48 object-cover"
                } hover:scale-[1.01] transition-transform duration-300 cursor-pointer`}
              />
            </div>
          ))}
        </div>
      )}

      {/* 4. Action bar */}
      <div className="flex items-center gap-5 text-gray-500 dark:text-zinc-450 text-xs pt-3 border-t border-slate-200/50 dark:border-zinc-900/40">
        {/* Like Button */}
        <button
          onClick={handleLike}
          className={`flex items-center gap-1.5 transition-transform duration-200 hover:scale-110 focus:outline-none cursor-pointer ${
            isLiked ? 'text-rose-500 font-extrabold' : 'hover:text-rose-400'
          }`}
        >
          <Heart
            className={`w-5 h-5 transition-all ${
              isLiked
                ? "text-rose-500 fill-rose-500 animate-heart-pop"
                : "text-gray-400 dark:text-zinc-550"
            } ${playLikeAnimation ? 'scale-120' : ''}`}
          />
          <span>
            {likes.length}
          </span>
        </button>

        {/* Comment Button */}
        <button
          className="flex items-center gap-1.5 hover:text-indigo-500 dark:hover:text-purple-400 transition-colors cursor-pointer"
          onClick={() => setShowComments((prev) => !prev)}
        >
          <MessageCircle className="w-5 h-5 text-gray-400 dark:text-zinc-550" />
          <span className="font-semibold">{totalComments}</span>
        </button>

        {/* Share Button */}
        <button className="flex items-center gap-1.5 hover:text-indigo-500 dark:hover:text-purple-400 transition-colors ml-auto cursor-pointer">
          <Share2 className="w-4.5 h-4.5 text-gray-400 dark:text-zinc-550" />
          <span className="font-semibold">Share</span>
        </button>
      </div>

      {/* 5. Comments Section */}
      {showComments && (
        <div className="pt-3 border-t border-slate-200/50 dark:border-zinc-900/40 space-y-4">
          
          {/* Submit comment */}
          <div className="flex gap-3 items-start">
            <img
              src={currentUser?.profile_picture || 'https://images.clerk.dev/static/profile.png'}
              alt=""
              className="w-8 h-8 rounded-full object-cover flex-shrink-0 mt-1 border border-slate-100 dark:border-zinc-800 shadow"
            />

            <div className="flex-1 text-left">
              <textarea
                ref={textareaRef}
                value={commentInput}
                onFocus={() => setIsFocused(true)}
                onChange={(e) => {
                  setCommentInput(e.target.value);
                  e.target.style.height = "auto";
                  e.target.style.height = e.target.scrollHeight + "px";
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                     e.preventDefault();
                     handleCommentSubmit();
                  }

                  if (e.key === "Escape") {
                    resetTextarea();
                  }
                }}
                placeholder="Add a comment..."
                rows={1}
                className="w-full resize-none bg-zinc-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-850 focus:border-indigo-500 dark:focus:border-purple-400 rounded-xl px-3 py-1.5 text-xs text-slate-800 dark:text-zinc-200 placeholder:text-gray-400 dark:placeholder:text-zinc-650 outline-none transition-colors"
                style={{
                  minHeight: "32px",
                  maxHeight: "120px",
                  overflow: "hidden",
                }}
              />

              {isFocused && (
                <div className="flex justify-end gap-2 mt-2">
                  <button
                    onClick={resetTextarea}
                    className="px-3 py-1 rounded-xl text-[10px] font-bold text-gray-500 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-900 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>

                  <button
                    onClick={handleCommentSubmit}
                    disabled={commentSubmitting || !commentInput.trim()}
                    className="px-4 py-1.5 rounded-xl text-[10px] font-black bg-indigo-600 dark:bg-purple-400 text-white dark:text-zinc-950 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer shadow shadow-indigo-500/10"
                  >
                    {commentSubmitting ? "Posting..." : "Comment"}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Comments list */}
          {comments.length === 0 ? (
            <p className="text-xs text-gray-400 dark:text-zinc-600 py-1 text-left font-semibold">
              No comments yet. Be the first to comment.
            </p>
          ) : (
            <div
              ref={commentsBoxRef}
              onScroll={handleCommentsScroll}
              style={{
                maxHeight: "400px",
                overflowY: "auto",
                scrollbarWidth: "none",
                msOverflowStyle: "none",
              }}
              className="space-y-4 pr-1 [&::-webkit-scrollbar]:hidden"
            >
              {comments.map((comment) => (
                <div key={comment._id} className="flex gap-2.5 items-start text-left animate-message-in">
                  <img
                    src={comment.user?.profile_picture || 'https://images.clerk.dev/static/profile.png'}
                    alt=""
                    className="w-7 h-7 rounded-full object-cover flex-shrink-0 cursor-pointer mt-0.5"
                    onClick={() => navigate("/profile/" + comment.user?._id)}
                  />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className="text-xs font-bold text-slate-800 dark:text-zinc-200 cursor-pointer hover:underline"
                        onClick={() =>
                          navigate("/profile/" + comment.user?._id)
                        }
                      >
                        {comment.user?.full_name}
                      </span>

                      <span className="text-[10px] text-gray-400 dark:text-zinc-600 font-bold">
                        {moment(comment.createdAt).fromNow()}
                      </span>
                    </div>

                    <p className="text-xs text-slate-700 dark:text-zinc-350 mt-0.5 break-words leading-relaxed font-medium">
                      {comment.content}
                    </p>

                    {/* Comment Language Selection Input */}
                    {showCommentLangInput[comment._id] && (
                      <div className="relative mt-1.5 p-2.5 rounded-xl bg-indigo-50/40 dark:bg-indigo-950/15 border border-indigo-100/50 dark:border-indigo-900/30 text-left animate-message-in space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] text-indigo-600 dark:text-indigo-400 font-extrabold uppercase tracking-wider">Target Language</span>
                          <button
                            onClick={() => {
                              setShowCommentLangInput((prev) => ({
                                ...prev,
                                [comment._id]: false,
                              }));
                            }}
                            className="text-gray-400 hover:text-gray-650"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                        <div className="flex gap-1.5 items-center">
                          <input
                            type="text"
                            value={commentLangs[comment._id] || ""}
                            onChange={(e) => {
                              const val = e.target.value;
                              setCommentLangs((prev) => ({
                                ...prev,
                                [comment._id]: val,
                              }));
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                setShowCommentLangInput((prev) => ({
                                  ...prev,
                                  [comment._id]: false,
                                }));
                                handleCommentExplain(comment._id, comment.content, commentLangs[comment._id]);
                              }
                            }}
                            placeholder="Enter language (or leave blank)..."
                            className="flex-1 px-2 py-1 bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-850 rounded-lg text-[10px] text-slate-800 dark:text-zinc-200 outline-none focus:border-indigo-500 dark:focus:border-purple-400 transition-colors"
                            autoFocus
                          />
                          <button
                            onClick={() => {
                              setShowCommentLangInput((prev) => ({
                                ...prev,
                                [comment._id]: false,
                              }));
                              handleCommentExplain(comment._id, comment.content, commentLangs[comment._id]);
                            }}
                            className="px-3 py-1 bg-indigo-600 dark:bg-purple-400 text-white dark:text-zinc-950 text-[9px] font-black rounded-lg transition-all cursor-pointer shadow shadow-indigo-500/10"
                          >
                            Explain
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Comment Jargon/Slang Explanation */}
                    {explainingComments[comment._id] && (
                      <div className="mt-1 p-2 rounded-xl bg-indigo-50/30 dark:bg-indigo-950/10 border border-indigo-100/40 dark:border-indigo-900/20 text-left animate-pulse">
                        <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold">AI Explaining...</span>
                      </div>
                    )}

                    {commentExplanations[comment._id] && (
                      <div className="relative mt-1.5 p-2.5 rounded-xl bg-indigo-50/40 dark:bg-indigo-950/15 border border-indigo-100/50 dark:border-indigo-900/30 text-left animate-message-in">
                        <button
                          onClick={() => {
                            setCommentExplanations((prev) => {
                              const copy = { ...prev };
                              delete copy[comment._id];
                              return copy;
                            });
                          }}
                          className="absolute top-1.5 right-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-zinc-300 transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                        <p className="text-[11px] text-slate-655 dark:text-zinc-400 leading-normal pr-5 font-medium">
                          {commentExplanations[comment._id]}
                        </p>
                      </div>
                    )}

                    <div className="flex items-center gap-3.5 mt-1.5 text-gray-400 dark:text-zinc-600">
                      {/* Comment Like */}
                      <button
                        className={`flex items-center gap-1 hover:text-indigo-600 dark:hover:text-purple-400 transition-colors cursor-pointer ${
                          comment.likes_count?.includes(currentUser?._id)
                            ? "text-indigo-600 dark:text-purple-400 font-extrabold"
                            : ""
                        }`}
                        onClick={() => handleCommentLike(comment._id)}
                      >
                        <ThumbsUp className="w-3 h-3" />
                        <span className="text-[10px]">
                          {comment.likes_count?.length || 0}
                        </span>
                      </button>

                      {/* Comment Dislike */}
                      <button
                        className={`flex items-center gap-1 hover:text-rose-600 dark:hover:text-rose-400 transition-colors cursor-pointer ${
                          comment.dislikes_count?.includes(currentUser?._id)
                            ? "text-rose-600 font-extrabold"
                            : ""
                        }`}
                        onClick={() => handleCommentDislike(comment._id)}
                      >
                        <ThumbsDown className="w-3 h-3" />
                        <span className="text-[10px]">
                          {comment.dislikes_count?.length || 0}
                        </span>
                      </button>

                      {/* Comment Explain */}
                      <button
                        className="flex items-center gap-1 hover:text-indigo-600 dark:hover:text-purple-400 transition-colors cursor-pointer text-[10px] font-bold"
                        onClick={() => {
                          setCommentExplanations((prev) => {
                            const copy = { ...prev };
                            delete copy[comment._id];
                            return copy;
                          });
                          setShowCommentLangInput((prev) => ({
                            ...prev,
                            [comment._id]: true,
                          }));
                          setCommentLangs((prev) => ({
                            ...prev,
                            [comment._id]: "",
                          }));
                        }}
                        disabled={explainingComments[comment._id]}
                      >
                        <Sparkles className="w-3 h-3" />
                        <span>Explain</span>
                      </button>

                      {/* Comment Delete */}
                      {comment.user?._id === currentUser?._id && (
                        <button
                          className="flex items-center gap-1 text-[10px] font-black text-rose-400 hover:text-rose-500 transition-colors cursor-pointer"
                          onClick={() => handleCommentDelete(comment._id)}
                        >
                          <Trash2 className="w-3 h-3" />
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {loadingMoreComments && (
                <p className="text-center text-[10px] text-gray-400 dark:text-zinc-600 font-bold py-2">
                  Loading more comments...
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {showBuddyModal && (
        <PingBuddyModal
          initialPrompt={buddyPrompt}
          onClose={() => setShowBuddyModal(false)}
          onInsert={(text) => {
            const cleanContent = editContent.replace(/@buddy.*/i, '').trim();
            setEditContent(cleanContent ? cleanContent + "\n\n" + text : text);
            setShowBuddyModal(false);
          }}
        />
      )}
    </div>
  );
};

export default PostCard;