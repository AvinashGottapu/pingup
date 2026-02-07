import fs from "fs"
import imagekit from "../configs/imageKit.js";
import Message from "../models/Message.js";

let connections = {}

export const sseController = (req, res) => {
    const { userId } = req.params;
    console.log('New client connected:', userId);

    // Required headers
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("Access-Control-Allow-Origin", "*");

    // Flush headers (important!)
    if (res.flushHeaders) res.flushHeaders();

    // Add connection for the user
    connections[userId] = res;

    // Send initial SSE event properly formatted
    res.write(`event: log\n`);
    res.write(`data: "Connected to SSE stream"\n\n`);

    // Remove connection on disconnect
    req.on("close", () => {
        delete connections[userId];
        console.log("Client disconnected:", userId);
    });
};


// Send Message..
export const sendMessage = async (req, res) => {
    try {
        const { userId } = req.auth()
        const { to_user_id, text } = req.body
        const image = req.file

        let media_url = ''
        let message_type = image ? 'image' : 'text'

        if (message_type === 'image') {
            const fileBuffer = fs.readFileSync(image.path)
            const response = await imagekit.upload({
                file: fileBuffer,
                fileName: image.originalname,
            });

            media_url = imagekit.url({
                path: await response.filePath,
                transformation: [
                    { quality: 'auto' },
                    { format: 'webp' },
                    { width: '1280' }
                ]
            })
        }

        const message = await Message.create({
            from_user_id: userId,
            to_user_id,
            text,
            message_type,
            media_url
        })

        res.json({ success: true, message })

        // Send message to to_user_id using SSE.. 
        const messageWithUserData = await Message.findById(message._id).populate('from_user_id')

        if (connections[to_user_id]) {
            connections[to_user_id].write(`data: ${JSON.stringify(messageWithUserData)}\n\n`)
        }

    } catch (error) {
        console.log(error);
        res.json({ success: false, messasge: error.message })
    }
}


// Get Chat Messages 
export const getChatMessages = async (req, res) => {
    try {   // Show the full conversation with Someone...
        const { userId } = req.auth()
        const { to_user_id } = req.body;

        const messages = await Message.find({
            $or: [ // Logical OR operator return the documents id atleast one of the below condition is true..
                { from_user_id: userId, to_user_id },
                { from_user_id: to_user_id, to_user_id: userId }
            ]
        }).sort({ createdAt: -1 });

        // Mark seen messages...
        await Message.updateMany({ from_user_id: to_user_id, to_user_id: userId }, { seen: true });

        res.json({ success: true, messages });

    } catch (error) {
        console.log(error);
        res.json({ success: false, messasge: error.messasge })
    }
}

export const getUserRecentMessages = async (req, res) => {
    try { // Show all messages I received from any person

        const { userId } = req.auth()
        const messages = await Message.find({ to_user_id: userId }).populate('from_user_id to_user_id').sort({ createdAt: -1 })

        res.json({ success: true, messages })

    } catch (error) {
        res.json({ success: false, message: error.message });
    }
}

export const initiateCall = async (req, res) => {
    try {
        const { userId } = req.auth();
        const { to_user_id, roomId, callerName } = req.body;

        if (connections[to_user_id]) {
            connections[to_user_id].write(`data: ${JSON.stringify({
                type: 'call',
                roomId,
                callerName,
                from_user_id: userId
            })}\n\n`);
            res.json({ success: true, message: "Call initiated" });
        } else {
            // User is offline or not connected to SSE
            res.json({ success: false, message: "User is not available" });
        }


    } catch (error) {
        console.log(error);
        res.json({ success: false, message: error.message });
    }
}

export const rejectCall = async (req, res) => {
    try {
        const { userId } = req.auth();
        const { to_user_id } = req.body;

        if (connections[to_user_id]) {
            connections[to_user_id].write(`data: ${JSON.stringify({
                type: 'call_rejected',
                from_user_id: userId
            })}\n\n`);
            res.json({ success: true, message: "Call rejected" });
        } else {
            res.json({ success: false, message: "User is not available" });
        }

    } catch (error) {
        console.log(error);
        res.json({ success: false, message: error.message });
    }
}