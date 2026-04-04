import express from 'express'
import { getChatMessages, sendMessage, sseController, initiateCall, rejectCall,deleteMessage } from '../controllers/messageController.js';
import { upload } from '../configs/multer.js';
import protect from '../middlewares/auth.js';

const messageRouter = express.Router();

messageRouter.get('/:userId', sseController)
messageRouter.post('/send', upload.single('image'), protect, sendMessage)
messageRouter.post('/get', protect, getChatMessages)
messageRouter.post('/call', protect, initiateCall);
messageRouter.post('/reject', protect, rejectCall);
messageRouter.post('/delete', protect, deleteMessage);

export default messageRouter;