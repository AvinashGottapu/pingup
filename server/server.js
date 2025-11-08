import express from 'express'
import cors from 'cors'
import 'dotenv/config'
import connectDB from './configs/db.js'
import { inngest, functions } from "./inngest/index.js"
import { serve } from 'inngest/express'
import { clerkMiddleware } from '@clerk/express'
import userRouter from './routes/userRoutes.js'

const PORT = process.env.PORT || 4000;

const app = express();

await connectDB();

app.use(express.json());
app.use(cors()); 
app.use(clerkMiddleware());

app.get('/',(req,res) => res.send('Server is running'));
app.use("/api/inngest", serve({ client: inngest, functions }));
app.use('/api/user',userRouter);

app.listen(PORT , () => console.log(`Server is running at http://localhost:${PORT}`));