import mongoose from 'mongoose'

const commentSchema = new mongoose.Schema({
    post_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', required: true },
    user: { type: String, ref: 'User', required: true },
    content: { type: String, required: true },
    likes_count: [{ type: String, ref: 'User' }],
    dislikes_count: [{ type: String, ref: 'User' }],
}, { timestamps: true });

// Indexes for fast paginated comment lookups
commentSchema.index({ post_id: 1, createdAt: -1, _id: -1 });
commentSchema.index({ user: 1, createdAt: -1 });

const Comment = mongoose.model('Comment', commentSchema)

export default Comment
