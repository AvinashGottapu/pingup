import mongoose from 'mongoose'

const ConnectDB = async () => { 
    try { 
         mongoose.connection.on('connected', () => console.log('Database connected'))
         await mongoose.connect(process.env.MONGODB_URL, { 
            dbName: 'PingUp-Real-Real'
              }) 
         console.log("Connected DB:", mongoose.connection.name);
    } catch (error) {
         console.log(error.message); 
    }
} 

export default ConnectDB