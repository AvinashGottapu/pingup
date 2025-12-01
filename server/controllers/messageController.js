import fs from "fs"
import imagekit from "../configs/imageKit";
import Message from "../models/Message";

// Create an empty object to store Server sent Event connections..
const connections = { }; 

// Controller function for the SSE endpoint..
export const sseController = (req,res) => { 
    const { userId } = req.params
    console.log('New client connected : ',userId) 

    // Set SSE headers..
    res.setHeader('Content-Type','text/event-stream')
    res.setHeader('Cache-Control','no-cache')
    res.setHeader('Connection','keep-alive')
    res.setHeader('Access-Control-Allow-Origin','*')

    // Add the Clients response object to the connections object...
    connections[userId] = res

    // Send an intial event to the client...
    res.write('log: Connected to SSE stream\n\n')

    // Handle Client disconnection.. 
    req.on('close', () => { 
        // Remove the client's response object from the connections array..
        delete connections[userId];
        console.log('Client disconnected')
     })
}

// Send Message..
export const sendMessage = async (req,res) => { 
    try { 
        const { userId } = req.auth() 
        const { to_user_id, text } = req.body
        const image = req.file

        let media_url = ''
        let message_type = image ? 'image' : 'text' 

        if(message_type==='image') {  
            const fileBuffer = fs.readFileSync(image.path) 
            const response = imagekit.upload({ 
                file : fileBuffer,
                fileName : image.originalName,
            });
             
            media_url = imagekit.url({ 
                path : await response.filePath,
                transformation : [ 
                    { quality : 'auto' },
                    { format : 'webp' },
                    { width : '1280' }
                ]
            })
        } 

        const message = await Message.create({ 
             from_user_id : userId,
             to_user_id,
             text,
             message_type,
             media_url
        }) 

        res.json({ success : true,messasge }) 

        // Send message to to_user_id using SSE.. 
        const messageWithUserData = await Message.findById(message._id).populate('from_user_id')

        if(connections[to_user_id]) { 
            connections[to_user_id].write(`data : ${JSON.stringify(messageWithUserData)}\n\n`)
        }
        
    } catch (error) {
        console.log(error);
        res.json({success : false, messasge : error.messasge})
    }
}


// Get Chat Messages 
export const getChatMessages = async (req,res) => { 
     try {   // Show the full conversation with Someone...
        const { userId } = req.auth()
        const { to_user_id } = req.body; 

        const messages = await Message.find({ 
            $or : [ // Logical OR operator return the documents id atleast one of the below condition is true..
                { from_user_id : userId, to_user_id },
                { from_user_id : to_user_id, to_user_id : userId }
            ]
        }).sort({ createdAt : -1 }); 

        // Mark seen messages...
        await Message.updateMany({ from_user_id : to_user_id, to_user_id : userId }, { seen : true } ); 

        res.json({ success : true, messages }); 
        
     } catch (error) {
            console.log(error);
        res.json({success : false, messasge : error.messasge})
     }
}

export const getUserRecentMessages = async (req,res) => { 
     try { // Show all messages I received from any person
         
        const { userId } = req.auth()
        const messages = (await Message.find({ to_user_id : userId }.populate('from_user_id to_user_id'))).sort({createdAt : -1})

        res.json({ success : true, messages })
        
     } catch (error) {
        res.json({ success : false, message : error.message });
     }
}