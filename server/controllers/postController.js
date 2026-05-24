import fs from "fs";
import mongoose from "mongoose";
import imagekit from "../configs/imageKit.js";
import Post from "../models/Post.js";
import User from "../models/User.js";

const FEED_LIMIT = 10;
const COMMENTS_LIMIT = 10;

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

    const cursorFilter = buildCursorFilter(cursor);

    const query = {
      user: { $in: userIds },
      ...(Object.keys(cursorFilter).length ? cursorFilter : {}),
    };

    const posts = await Post.find(query)
      .populate("user")
      .populate("comments.user", "full_name username profile_picture")
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit + 1);

    const hasMore = posts.length > limit;
    const paginatedPosts = hasMore ? posts.slice(0, limit) : posts;

    const formattedPosts = paginatedPosts.map((post) => {
      const postObj = post.toObject();

      const allSortedComments = [...postObj.comments].sort((a, b) => {
        const dateDiff = new Date(b.createdAt) - new Date(a.createdAt);

        if (dateDiff !== 0) return dateDiff;

        return b._id.toString().localeCompare(a._id.toString());
      });

      const slicedComments = allSortedComments.slice(0, COMMENTS_LIMIT);

      const hasMoreComments = allSortedComments.length > COMMENTS_LIMIT;

      const nextCommentCursor =
        hasMoreComments && slicedComments.length > 0
          ? `${new Date(
              slicedComments[slicedComments.length - 1].createdAt
            ).toISOString()}|${slicedComments[
              slicedComments.length - 1
            ]._id.toString()}`
          : null;

      return {
        ...postObj,
        comments: slicedComments,
        total_comments: postObj.total_comments || allSortedComments.length,
        nextCommentCursor,
        hasMoreComments,
      };
    });

    const nextCursor =
      hasMore && paginatedPosts.length > 0
        ? `${paginatedPosts[
            paginatedPosts.length - 1
          ].createdAt.toISOString()}|${paginatedPosts[
            paginatedPosts.length - 1
          ]._id.toString()}`
        : null;

    res.json({
      success: true,
      posts: formattedPosts,
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

export const likePost = async (req, res) => {
  try {
    const { userId } = req.auth();
    const { postId } = req.body;

    const post = await Post.findById(postId);

    if (post.likes_count.includes(userId)) {
      post.likes_count = post.likes_count.filter((user) => user != userId);

      await post.save();

      res.json({
        success: true,
        message: "Post unliked",
      });
    } else {
      post.likes_count.push(userId);

      await post.save();

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

    post.comments.push({
      user: userId,
      content: content.trim(),
      likes_count: [],
      dislikes_count: [],
    });

    post.total_comments = post.comments.length;

    await post.save();

    await post.populate({
      path: "comments.user",
      select: "full_name username profile_picture",
    });

    const addedComment = post.comments[post.comments.length - 1];

    res.json({
      success: true,
      comment: addedComment,
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

    const post = await Post.findById(postId);

    if (!post) {
      return res.json({
        success: false,
        message: "Post not found.",
      });
    }

    const comment = post.comments.id(commentId);

    if (!comment) {
      return res.json({
        success: false,
        message: "Comment not found.",
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

    await post.save();

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

    const post = await Post.findById(postId);

    if (!post) {
      return res.json({
        success: false,
        message: "Post not found.",
      });
    }

    const comment = post.comments.id(commentId);

    if (!comment) {
      return res.json({
        success: false,
        message: "Comment not found.",
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

    await post.save();

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

    const post = await Post.findById(postId);

    if (!post) {
      return res.json({
        success: false,
        message: "Post not found.",
      });
    }

    const comment = post.comments.id(commentId);

    if (!comment) {
      return res.json({
        success: false,
        message: "Comment not found.",
      });
    }

    if (comment.user.toString() !== userId) {
      return res.json({
        success: false,
        message: "You can only delete your own comments.",
      });
    }

    post.comments = post.comments.filter(
      (commentItem) => commentItem._id.toString() !== commentId
    );

    post.total_comments = post.comments.length;

    await post.save();

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

    const post = await Post.findById(postId).populate(
      "comments.user",
      "full_name username profile_picture"
    );

    if (!post) {
      return res.json({
        success: false,
        message: "Post not found.",
      });
    }

    const parsedCursor = parseCommentCursor(cursor);

    const allComments = [...post.comments].sort((a, b) => {
      const dateDiff = new Date(b.createdAt) - new Date(a.createdAt);

      if (dateDiff !== 0) return dateDiff;

      return b._id.toString().localeCompare(a._id.toString());
    });

    const filteredComments = allComments.filter((comment) => {
      if (!parsedCursor) return true;

      const commentDate = new Date(comment.createdAt);
      const cursorDate = parsedCursor.createdAt;
      const cursorId = parsedCursor.id;

      if (commentDate < cursorDate) return true;

      if (
        commentDate.getTime() === cursorDate.getTime() &&
        comment._id.toString() < cursorId
      ) {
        return true;
      }

      return false;
    });

    const hasMore = filteredComments.length > limit;

    const paginatedComments = hasMore
      ? filteredComments.slice(0, limit)
      : filteredComments;

    const nextCursor =
      hasMore && paginatedComments.length > 0
        ? `${new Date(
            paginatedComments[paginatedComments.length - 1].createdAt
          ).toISOString()}|${paginatedComments[
            paginatedComments.length - 1
          ]._id.toString()}`
        : null;

    res.json({
      success: true,
      comments: paginatedComments,
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