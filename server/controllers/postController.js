import fs from "fs"
import imagekit from "../configs/imageKit.js"
import Post from '../models/Post.js'
import User from "../models/User.js"

// Add Post
export const addPost = async (req, res) => {
    try {
        const { userId } = req.auth();
        const { content, post_type } = req.body;

        const images = req.files;
        let image_urls = []

        if (images.length) {
            image_urls = await Promise.all(
                images.map(async (image) => {
                    const fileBuffer = fs.readFileSync(image.path)
                    const response = await imagekit.upload({
                        file: fileBuffer,
                        fileName: image.originalname,
                        folder : "posts"
                    })
                    const url = imagekit.url({
                        path: response.filePath,
                        transformation: [
                            { quality: 'auto' },
                            { format: 'webp' },
                            { width: '1280' }
                        ]
                    })
                        return url;
                })
            )
        } 
          await Post.create({ 
              user : userId,
              content,
              image_urls,
              post_type
          }) 
          res.json({ success : true,message : "Post Created Successfully" });

    } catch (error) {
              console.log(error);
              res.json({success : false, message : error.message}); 
    }
}

// Get Posts 
export const getFeedPosts = async (req,res) => { 
     try { 
           const { userId } = req.auth();
           const user = await User.findById(userId)

           // User connections and followings.. 
           const userIds = [userId, ...user.connections, ...user.following]
           const posts = await Post.find({user : {$in : userIds}})
             .populate('user')
             .populate('comments.user')
             .sort({createdAt : -1}); 

           posts.forEach(post => {
             post.comments = post.comments.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
           });
           
           res.json({ success : true, posts});  

     } catch (error) {
              console.log(error);
              res.json({success : false, message : error.message}); 
     }
}

export const likePost = async (req,res) => { 
     try { 
           const { userId } = req.auth();
           const { postId } = req.body; 
           
           const post = await Post.findById(postId); 

           if(post.likes_count.includes(userId)) { 
               post.likes_count = post.likes_count.filter( (user) => user != userId)
               await post.save();
               res.json({ success : true, message : "Post unliked"})
           } 
           else { 
              post.likes_count.push(userId)
              await post.save()
              res.json({success : true, message : "Post liked"})
           }

     } catch (error) {
           console.log(error);
           res.json({ success: false, message: error.message });
     }
}

export const addComment = async (req, res) => {
    try {
        const { userId } = req.auth();
        const { postId, content } = req.body;

        if (!content || !content.trim()) {
            return res.json({ success: false, message: 'Comment cannot be empty.' });
        }

        const post = await Post.findById(postId);
        if (!post) {
            return res.json({ success: false, message: 'Post not found.' });
        }

        post.comments.push({ user: userId, content: content.trim(), likes_count: [], dislikes_count: [] });
        await post.save();

        await post.populate({ path: 'comments.user', select: 'full_name username profile_picture' });
        const addedComment = post.comments[post.comments.length - 1];

        res.json({ success: true, comment: addedComment });
    } catch (error) {
        console.log(error);
        res.json({ success: false, message: error.message });
    }
}

export const likeComment = async (req, res) => {
    try {
        const { userId } = req.auth();
        const { postId, commentId } = req.body;

        const post = await Post.findById(postId);
        if (!post) {
            return res.json({ success: false, message: 'Post not found.' });
        }

        const comment = post.comments.id(commentId);
        if (!comment) {
            return res.json({ success: false, message: 'Comment not found.' });
        }

        if(comment.likes_count.includes(userId)) {
            comment.likes_count = comment.likes_count.filter((id) => id !== userId);
        } else {
            comment.likes_count.push(userId);
            comment.dislikes_count = comment.dislikes_count.filter((id) => id !== userId);
        }

        await post.save();
        res.json({ success: true, message: 'Comment like updated', likes_count: comment.likes_count, dislikes_count: comment.dislikes_count });
    } catch (error) {
        console.log(error);
        res.json({ success: false, message: error.message });
    }
}

export const dislikeComment = async (req, res) => {
    try {
        const { userId } = req.auth();
        const { postId, commentId } = req.body;

        const post = await Post.findById(postId);
        if (!post) {
            return res.json({ success: false, message: 'Post not found.' });
        }

        const comment = post.comments.id(commentId);
        if (!comment) {
            return res.json({ success: false, message: 'Comment not found.' });
        }

        if (comment.dislikes_count.includes(userId)) {
            comment.dislikes_count = comment.dislikes_count.filter((id) => id !== userId);
        } else {
            comment.dislikes_count.push(userId);
            comment.likes_count = comment.likes_count.filter((id) => id !== userId);
        }

        await post.save();
        res.json({ success: true, message: 'Comment dislike updated', dislikes_count: comment.dislikes_count, likes_count: comment.likes_count });
    } catch (error) {
        console.log(error);
        res.json({ success: false, message: error.message });
    }
}

export const deleteComment = async (req, res) => {
    try {
        const { userId } = req.auth();
        const { postId, commentId } = req.body;

        const post = await Post.findById(postId);
        if (!post) {
            return res.json({ success: false, message: 'Post not found.' });
        }

        const comment = post.comments.id(commentId);
        if (!comment) {
            return res.json({ success: false, message: 'Comment not found.' });
        }

        if (comment.user.toString() !== userId) {
            return res.json({ success: false, message: 'You can only delete your own comments.' });
        }

        post.comments = post.comments.filter(c => c._id.toString() !== commentId);
        await post.save();
        res.json({ success: true, message: 'Comment deleted.', commentId });
    } catch (error) {
        console.log(error);
        res.json({ success: false, message: error.message });
    }
}
