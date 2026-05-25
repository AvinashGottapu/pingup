import fs from "fs";
import mongoose from "mongoose";
import imagekit from "../configs/imageKit.js";
import {
  deletePattern,
  getCachedJson,
  getCounter,
  setCachedJson,
  setCounter,
} from "../configs/redis.js";
import Post from "../models/Post.js";
import Comment from "../models/Comment.js";
import User from "../models/User.js";

const FEED_LIMIT = 10;
const COMMENTS_LIMIT = 10;
const FEED_CACHE_TTL = 30;
const COMMENT_COUNT_TTL = 60 * 60 * 24;

const parseCursor = (cursor) => {
  if (!cursor) return null;

  const [createdAt, id] = cursor.split("|");

  if (!createdAt || !id) return null;

  return {
    createdAt: new Date(createdAt),
    id,
  };
};

const buildCursorFilter = (cursor) => {
  const parsedCursor = parseCursor(cursor);

  if (!parsedCursor) {
    return {};
  }

  const cursorDate = parsedCursor.createdAt;
  const cursorId = parsedCursor.id;

  return {
    $or: [
      { createdAt: { $lt: cursorDate } },
      {
        createdAt: cursorDate,
        _id: { $lt: new mongoose.Types.ObjectId(cursorId) },
      },
    ],
  };
};

const parseCommentCursor = (cursor) => {
  if (!cursor) return null;

  const [createdAt, id] = cursor.split("|");

  if (!createdAt || !id) return null;

  return {
    createdAt: new Date(createdAt),
    id,
  };
};

const getPaginatedComments = async (postId, cursor, limit) => {
  const parsedCursor = parseCommentCursor(cursor);

  const cursorFilter = {};

  if (parsedCursor) {
    cursorFilter.$or = [
      { createdAt: { $lt: parsedCursor.createdAt } },
      {
        createdAt: parsedCursor.createdAt,
        _id: { $lt: new mongoose.Types.ObjectId(parsedCursor.id) },
      },
    ];
  }

  const comments = await Comment.find({ post_id: postId, ...cursorFilter })
    .populate("user", "full_name username profile_picture")
    .sort({ createdAt: -1, _id: -1 })
    .limit(limit + 1)
    .exec();

  const hasMore = comments.length > limit; // That extra +1 is only for checking hasMore.
  const paginatedComments = hasMore ? comments.slice(0, limit) : comments;

  const nextCursor =
    hasMore && paginatedComments.length > 0
      ? `${new Date(
          paginatedComments[paginatedComments.length - 1].createdAt
        ).toISOString()}|${paginatedComments[
          paginatedComments.length - 1
        ]._id.toString()}`
      : null;

  return {
    comments: paginatedComments,
    hasMore,
    nextCursor,
  };
};

// Add Post
export const addPost = async (req, res) => {
  try {
    const { userId } = req.auth();
    const { content, post_type } = req.body;

    const images = req.files;
    let image_urls = [];

    if (images.length) {
      image_urls = await Promise.all(
        images.map(async (image) => {
          const fileBuffer = fs.readFileSync(image.path);

          const response = await imagekit.upload({
            file: fileBuffer,
            fileName: image.originalname,
            folder: "posts",
          });

          const url = imagekit.url({
            path: response.filePath,
            transformation: [
              { quality: "auto" },
              { format: "webp" },
              { width: "1280" },
            ],
          });

          return url;
        })
      );
    }

    await Post.create({
      user: userId,
      content,
      image_urls,
      post_type,
    });

    await deletePattern('feed:*');

    res.json({
      success: true,
      message: "Post Created Successfully",
    });
  } catch (error) {
    console.log(error);
    res.json({
      success: false,
      message: error.message,
    });
  }
};

// Get Posts
export const getFeedPosts = async (req, res) => {
  try {
    const { userId } = req.auth();

    const user = await User.findById(userId);

    const cursor = req.query.cursor;
    const limit = Math.min(Number(req.query.limit) || FEED_LIMIT, FEED_LIMIT);

    const userIds = [userId, ...user.connections, ...user.following];
    const feedCacheKey = `feed:${userId}:${cursor || 'start'}:${limit}`;
    const cachedFeed = await getCachedJson(feedCacheKey);

    if (cachedFeed) {
      return res.json(cachedFeed);
    }

    const cursorFilter = buildCursorFilter(cursor);

    const query = {
      user: { $in: userIds },
      ...(Object.keys(cursorFilter).length ? cursorFilter : {}),
    };

    const posts = await Post.find(query)
      .populate("user")
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit + 1);

    const hasMore = posts.length > limit;
    const paginatedPosts = hasMore ? posts.slice(0, limit) : posts;

    const formattedPosts = await Promise.all(
      paginatedPosts.map(async (post) => {
        const postObj = post.toObject();
        const commentCountKey = `counter:post:comments:${post._id.toString()}`;
        const cachedCommentCount = await getCounter(commentCountKey);

        const {
          comments: paginatedComments,
          hasMore: hasMoreComments,
          nextCursor: nextCommentCursor,
        } = await getPaginatedComments(post._id, null, COMMENTS_LIMIT);

        return {
          ...postObj,
          comments: paginatedComments,
          total_comments: cachedCommentCount ?? postObj.total_comments ?? 0,
          nextCommentCursor,
          hasMoreComments,
        };
      })
    );

    const nextCursor =
      hasMore && paginatedPosts.length > 0
        ? `${paginatedPosts[paginatedPosts.length - 1].createdAt.toISOString()}|${paginatedPosts[paginatedPosts.length - 1]._id.toString()}`
        : null;

    const response = {
      success: true,
      posts: formattedPosts,
      nextCursor,
      hasMore,
    };

    await setCachedJson(feedCacheKey, response, FEED_CACHE_TTL);

    res.json(response);
  } catch (error) {
    console.log(error);
    res.json({
      success: false,
      message: error.message,
    });
  }
};

export const likePost = async (req, res) => {
  try {
    const { userId } = req.auth();
    const { postId } = req.body;

    const post = await Post.findById(postId);

    if (post.likes_count.includes(userId)) {
      post.likes_count = post.likes_count.filter((user) => user !== userId);

      await post.save();
      await deletePattern('feed:*');

      res.json({
        success: true,
        message: "Post unliked",
      });
    } else {
      post.likes_count.push(userId);

      await post.save();
      await deletePattern('feed:*');

      res.json({
        success: true,
        message: "Post liked",
      });
    }
  } catch (error) {
    console.log(error);
    res.json({
      success: false,
      message: error.message,
    });
  }
};

export const addComment = async (req, res) => {
  try {
    const { userId } = req.auth();
    const { postId, content } = req.body;

    if (!content || !content.trim()) {
      return res.json({
        success: false,
        message: "Comment cannot be empty.",
      });
    }

    const post = await Post.findById(postId);

    if (!post) {
      return res.json({
        success: false,
        message: "Post not found.",
      });
    }

    const newComment = await Comment.create({
      post_id: postId,
      user: userId,
      content: content.trim(),
      likes_count: [],
      dislikes_count: [],
    });

    const commentCountKey = `counter:post:comments:${postId}`;
    const totalComments =
      (await getCounter(commentCountKey)) ?? post.total_comments ?? 0;

    const nextCommentCount = totalComments + 1;
    await setCounter(commentCountKey, nextCommentCount, COMMENT_COUNT_TTL);

    post.total_comments = nextCommentCount;
    await post.save();
    await deletePattern('feed:*');

    await newComment.populate({
      path: "user",
      select: "full_name username profile_picture",
    });

    res.json({
      success: true,
      comment: newComment,
    });
  } catch (error) {
    console.log(error);
    res.json({
      success: false,
      message: error.message,
    });
  }
};

export const likeComment = async (req, res) => {
  try {
    const { userId } = req.auth();
    const { postId, commentId } = req.body;

    const comment = await Comment.findById(commentId);

    if (!comment) {
      return res.json({
        success: false,
        message: "Comment not found.",
      });
    }

    if (!comment.post_id.equals(postId)) {
      return res.json({
        success: false,
        message: "Comment does not belong to this post.",
      });
    }

    if (comment.likes_count.includes(userId)) {
      comment.likes_count = comment.likes_count.filter((id) => id !== userId);
    } else {
      comment.likes_count.push(userId);
      comment.dislikes_count = comment.dislikes_count.filter(
        (id) => id !== userId
      );
    }

    await comment.save();

    res.json({
      success: true,
      message: "Comment like updated",
      likes_count: comment.likes_count,
      dislikes_count: comment.dislikes_count,
    });
  } catch (error) {
    console.log(error);
    res.json({
      success: false,
      message: error.message,
    });
  }
};

export const dislikeComment = async (req, res) => {
  try {
    const { userId } = req.auth();
    const { postId, commentId } = req.body;

    const comment = await Comment.findById(commentId);

    if (!comment) {
      return res.json({
        success: false,
        message: "Comment not found.",
      });
    }

    if (!comment.post_id.equals(postId)) {
      return res.json({
        success: false,
        message: "Comment does not belong to this post.",
      });
    }

    if (comment.dislikes_count.includes(userId)) {
      comment.dislikes_count = comment.dislikes_count.filter(
        (id) => id !== userId
      );
    } else {
      comment.dislikes_count.push(userId);
      comment.likes_count = comment.likes_count.filter((id) => id !== userId);
    }

    await comment.save();

    res.json({
      success: true,
      message: "Comment dislike updated",
      dislikes_count: comment.dislikes_count,
      likes_count: comment.likes_count,
    });
  } catch (error) {
    console.log(error);
    res.json({
      success: false,
      message: error.message,
    });
  }
};

export const deleteComment = async (req, res) => {
  try {
    const { userId } = req.auth();
    const { postId, commentId } = req.body;

    const comment = await Comment.findById(commentId);

    if (!comment) {
      return res.json({
        success: false,
        message: "Comment not found.",
      });
    }

    if (!comment.post_id.equals(postId)) {
      return res.json({
        success: false,
        message: "Comment does not belong to this post.",
      });
    }

    if (comment.user.toString() !== userId) {
      return res.json({
        success: false,
        message: "You can only delete your own comments.",
      });
    }

    await Comment.deleteOne({ _id: commentId });

    const post = await Post.findById(postId);
    const commentCountKey = `counter:post:comments:${postId}`;
    const currentCommentCount =
      (await getCounter(commentCountKey)) ?? post.total_comments ?? 0;
    const nextCommentCount = Math.max(0, currentCommentCount - 1);

    await setCounter(commentCountKey, nextCommentCount, COMMENT_COUNT_TTL);
    post.total_comments = nextCommentCount;
    await post.save();
    await deletePattern('feed:*');

    res.json({
      success: true,
      message: "Comment deleted.",
      commentId,
    });
  } catch (error) {
    console.log(error);
    res.json({
      success: false,
      message: error.message,
    });
  }
};

export const getPostComments = async (req, res) => {
  try {
    const { postId } = req.params;

    const cursor = req.query.cursor;
    const limit = Math.min(Number(req.query.limit) || COMMENTS_LIMIT, COMMENTS_LIMIT);

    const post = await Post.findById(postId);

    if (!post) {
      return res.json({
        success: false,
        message: "Post not found.",
      });
    }

    const { comments, nextCursor, hasMore } = await getPaginatedComments(
      postId,
      cursor,
      limit
    );

    res.json({
      success: true,
      comments,
      nextCursor,
      hasMore,
    });
  } catch (error) {
    console.log(error);

    res.json({
      success: false,
      message: error.message,
    });
  }
};