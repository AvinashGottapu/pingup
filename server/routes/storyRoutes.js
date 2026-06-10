import express from "express"
import { upload } from "../configs/multer.js"
import  protect  from "../middlewares/auth.js"
import { addUserStory, getStories, deleteStory, viewStoryItem } from "../controllers/storyController.js"

const storyRouter = express.Router()

storyRouter.post('/create',upload.single('media'),protect,addUserStory)
storyRouter.get('/get',protect,getStories)
storyRouter.post('/view/:storyId',protect,viewStoryItem)
storyRouter.delete('/:storyId',protect, deleteStory);


export default storyRouter