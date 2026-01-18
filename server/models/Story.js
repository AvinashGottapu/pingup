import mongoose from 'mongoose' 

const storyItemSchema = new mongoose.Schema({
    content : { type : String }, 
    media_url : {type : String}, // Fixed typo from 'media_urls' to 'media_url' to match usage
    media_type : { type : String, enum : ['text','image','video'] },
    view_count : [{type : String, ref:'User'}],
    background_color : { type : String },
    createdAt: { type: Date, default: Date.now } // Individual story timestamp
})

const storySchema = new mongoose.Schema ({ 
    user : { type : String, ref : 'User', required : true, unique: true }, // One document per user
    stories : [storyItemSchema]
}, {timestamps : true, minimize:false })

const Story = mongoose.model('Story',storySchema)

export default Story