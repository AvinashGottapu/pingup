import React, { useState, useRef, useEffect } from "react";
import {
  BadgeCheck,
  Heart,
  MessageCircle,
  Share2,
  ThumbsUp,
  ThumbsDown,
  Trash2,
} from "lucide-react";
import moment from "moment";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { useAuth } from "@clerk/clerk-react";
import { toast } from "react-hot-toast";
import axios from "axios";
import api from "../api/axios";

const PostCard = ({ post }) => {
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

  const postWithHashtags = post.content?.replace(
    /(#\w+)/g,
    '<span class="text-indigo-500 font-medium"> $1 </span>'
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
    <div className="bg-white dark:bg-slate-900 rounded-xl shadow p-4 space-y-4 w-full max-w-2xl border dark:border-slate-800">
      <div
        onClick={() => navigate("/profile/" + post.user._id)}
        className="flex items-center gap-3 cursor-pointer"
      >
        <img
          src={post.user?.profile_picture}
          alt=""
          className="w-10 h-10 rounded-full shadow object-cover"
        />

        <div className="flex flex-col">
          <div className="flex items-center space-x-1">
            <span className="font-medium dark:text-gray-200">
              {post.user?.full_name}
            </span>
            <BadgeCheck className="w-4 h-4 text-blue-500" />
          </div>
        </div>
      </div>

      {post.content && (
        <div
          className="text-gray-800 dark:text-gray-300 text-sm whitespace-pre-line leading-relaxed"
          dangerouslySetInnerHTML={{ __html: postWithHashtags }}
        />
      )}

      {post.image_urls?.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {post.image_urls.map((img, index) => (
            <img
              src={img}
              key={index}
              alt=""
              className={`w-full h-48 object-cover rounded-lg ${
                post.image_urls.length === 1 ? "col-span-2 h-auto" : ""
              }`}
            />
          ))}
        </div>
      )}

      <div className="flex items-center gap-4 text-gray-500 dark:text-gray-400 text-sm pt-2 border-t border-gray-200 dark:border-slate-700">
        <button
          onClick={handleLike}
          className="flex items-center gap-1.5 transition-colors"
        >
          <Heart
            className={`w-4 h-4 cursor-pointer transition-colors ${
              isLiked
                ? "text-red-500 fill-red-500"
                : "text-gray-500 dark:text-gray-400 hover:text-red-400"
            }`}
          />
          <span className={isLiked ? "text-red-500" : ""}>
            {likes.length}
          </span>
        </button>

        <button
          className="flex items-center gap-1.5 hover:text-indigo-500 transition-colors"
          onClick={() => setShowComments((prev) => !prev)}
        >
          <MessageCircle className="w-4 h-4" />
          <span>{totalComments}</span>
        </button>

        <button className="flex items-center gap-1.5 hover:text-indigo-500 transition-colors">
          <Share2 className="w-4 h-4" />
          <span>7</span>
        </button>
      </div>

      {showComments && (
        <div className="pt-3 border-t border-gray-200 dark:border-slate-700 space-y-4">
          <div className="flex gap-3 items-start">
            <img
              src={currentUser?.profile_picture}
              alt=""
              className="w-9 h-9 rounded-full object-cover flex-shrink-0 mt-1"
            />

            <div className="flex-1">
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
                className="w-full resize-none bg-transparent border-b border-gray-300 dark:border-slate-600 focus:border-indigo-500 dark:focus:border-indigo-400 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 py-1.5 outline-none transition-colors"
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
                    className="px-4 py-1.5 rounded-full text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    Cancel
                  </button>

                  <button
                    onClick={handleCommentSubmit}
                    disabled={commentSubmitting || !commentInput.trim()}
                    className="px-4 py-1.5 rounded-full text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                  >
                    {commentSubmitting ? "Posting..." : "Comment"}
                  </button>
                </div>
              )}
            </div>
          </div>

          {comments.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-gray-500 py-1">
              No comments yet. Be the first to comment.
            </p>
          ) : (
            <div
              ref={commentsBoxRef}
              onScroll={handleCommentsScroll}
              style={{
                maxHeight: "450px",
                overflowY: "auto",
                scrollbarWidth: "none",
                msOverflowStyle: "none",
              }}
              className="space-y-5 pr-1 [&::-webkit-scrollbar]:hidden"
            >
              {comments.map((comment) => (
                <div key={comment._id} className="flex gap-3 items-start">
                  <img
                    src={comment.user?.profile_picture}
                    alt=""
                    className="w-9 h-9 rounded-full object-cover flex-shrink-0 cursor-pointer mt-0.5"
                    onClick={() => navigate("/profile/" + comment.user?._id)}
                  />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className="text-sm font-semibold text-gray-900 dark:text-gray-100 cursor-pointer hover:underline"
                        onClick={() =>
                          navigate("/profile/" + comment.user?._id)
                        }
                      >
                        {comment.user?.full_name}
                      </span>

                      <span className="text-xs text-gray-400 dark:text-gray-500">
                        {moment(comment.createdAt).fromNow()}
                      </span>
                    </div>

                    <p className="text-sm text-gray-800 dark:text-gray-200 mt-0.5 break-words leading-relaxed">
                      {comment.content}
                    </p>

                    <div className="flex items-center gap-3 mt-1.5 text-gray-400 dark:text-gray-500">
                      <button
                        className={`flex items-center gap-1 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors ${
                          comment.likes_count?.includes(currentUser?._id)
                            ? "text-indigo-600"
                            : ""
                        }`}
                        onClick={() => handleCommentLike(comment._id)}
                      >
                        <ThumbsUp className="w-3.5 h-3.5" />
                        <span className="text-xs">
                          {comment.likes_count?.length || 0}
                        </span>
                      </button>

                      <button
                        className={`flex items-center gap-1 hover:text-rose-600 dark:hover:text-rose-400 transition-colors ${
                          comment.dislikes_count?.includes(currentUser?._id)
                            ? "text-rose-600"
                            : ""
                        }`}
                        onClick={() => handleCommentDislike(comment._id)}
                      >
                        <ThumbsDown className="w-3.5 h-3.5" />
                        <span className="text-xs">
                          {comment.dislikes_count?.length || 0}
                        </span>
                      </button>

                      {comment.user?._id === currentUser?._id && (
                        <button
                          className="flex items-center gap-1 text-xs font-medium text-red-500 hover:text-red-600 transition-colors"
                          onClick={() => handleCommentDelete(comment._id)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {loadingMoreComments && (
                <p className="text-center text-xs text-gray-400 py-2">
                  Loading more comments...
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PostCard;  