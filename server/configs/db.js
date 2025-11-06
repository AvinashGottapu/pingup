import mongoose from 'mongoose'

const ConnectDB = async () => { 
    try { 
         mongoose.connection.on('connected', () => console.log('Database connected'))
         await mongoose.connect(`${process.env.MONGODB_URL}/PingUp-Real-Real`, { 
         })
    } catch (error) {
         console.log(error.message)
    }
} 

export default ConnectDB