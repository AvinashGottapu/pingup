import { profile } from 'console'
import mongoose from 'mongoose'

const userSchema = new mongoose.Schema({ 
    _id : {type : string, required : true},
    email : { type : string , required : true },
    full_name : {type : string, required : true},
    username : {type : string, unique : true},
    bio : { type : string , default : 'Hey there! I am using PingUp.' },
    profile_picture : { type : string , default : ''},
    cover_photo : { type : string , default : ''}, 
     location : { type : string , default : ''}, 
     followers : [{ type : string , ref : 'user' }], 
       following : [{ type : string , ref : 'user' }], 
      connections : [{ type : string , ref : 'user' }], 
     
},{timestamps : true,minimize:false })

const User = mongoose.model('user',userSchema);

export default User