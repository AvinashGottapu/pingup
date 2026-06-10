import express from 'express'
import { upload } from "../configs/multer.js"
import protect  from "../middlewares/auth.js"
import { addPost, getFeedPosts, likePost, addComment, likeComment, dislikeComment, deleteComment, getPostComments, deletePost, editPost } from "../controllers/postController.js"

const postRouter = express.Router()

postRouter.post('/add',upload.array('images',4),protect,addPost)
postRouter.get('/feed',protect,getFeedPosts)
postRouter.get('/:postId/comments',protect,getPostComments)
postRouter.post('/like',protect,likePost)
postRouter.post('/comment',protect,addComment)
postRouter.post('/comment/like',protect,likeComment)
postRouter.post('/comment/dislike',protect,dislikeComment)
postRouter.post('/comment/delete',protect,deleteComment)
postRouter.post('/delete',protect,deletePost)
postRouter.post('/edit',protect,editPost)

export default postRouter