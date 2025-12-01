import { Inngest } from "inngest";
import User from "../models/User.js";
import Connection from "../models/Connections.js"
import { sendEmail } from "../configs/nodeMailer.js"
import Story from "../models/Story.js";
import Message from "../models/Message.js";


// Create a client to send and receive events
export const inngest = new Inngest({ id: "pingup-app" }); 

// Inngest function to save user data to database. 
const syncUserCreation = inngest.createFunction(
    { id : 'sync-user-from-clerk' },  // UNIQUE IDENTIFIER FOR THIS FUNCTION...
    { event : 'clerk/user.created'  },  // WHEN THIS USER CREATED THE FUNCTION CALLS AUTOMATICALLY..
    async ({event}) => { 
        const { id,first_name,last_name,email_addresses,image_url } = event.data
        let username = email_addresses[0].email_address.split('@')[0] 

        const user = await User.findOne({username}) 
        if(user) { 
            username = username + Math.floor(Math.random * 10000)
        } 
        const userData = { 
            _id : id,
            email : email_addresses[0].email_address,
            full_name : first_name + " " + last_name,
            profile_picture : image_url,
            username 
        } 
        await User.create(userData);
    }
)

// Inngest function to update the user data in database.
const syncUserUpdation = inngest.createFunction(
    { id : 'update-user-from-clerk' },  // UNIQUE IDENTIFIER FOR THIS FUNCTION...
    { event : 'clerk/user.updated'  },  // WHEN THIS USER CREATED THE FUNCTION CALLS AUTOMATICALLY..
    async ({event}) => { 
        const { id,first_name,last_name,email_addresses,image_url } = event.data
        
        const updatedUserData = { 
            email : email_addresses[0].email_address,
            full_name : first_name + " " + last_name,
            profile_picture : image_url
        } 
         
        await User.findByIdAndUpdate(id,updatedUserData)
   
    }
)


// Inngest function to Delete user data from database. 
const syncUserDeletion = inngest.createFunction(
    { id : 'delete-user-from-clerk' },  // UNIQUE IDENTIFIER FOR THIS FUNCTION...
    { event : 'clerk/user.deleted'  },  // WHEN THIS USER CREATED THE FUNCTION CALLS AUTOMATICALLY..
    async ({event}) => { 
        const { id } = event.data
        let username = email_addresses[0].email_address.split('@')[0] 

        const user = await User.findByIdAndDelete(id) 
    }
)

// Inngest Function to send Reminder when a new connection request is added..
const sendNewConnectionRequestRemainder = inngest.createFunction(
    { id : "send-new-connection-request-remainder" },
    { event : "app/connection-request" }, 

    async ({event,step}) => { 
        const { connectionId } = event.data;

        await step.run('send-connection-request-mail', async () => { 
            const connection = await Connection.findById(connectionId).populate('from_user_id to_user_id'); 
            const subject = `👋 New Connection Request`
            const body = `
                <div style="font-family: Arial, sans-serif; padding: 20px;">
                <h2>Hi ${connection.to_user_id.full_name},</h2> <p> You have a new connection request from 
                <strong>${connection.from_user_id.full_name}</strong> - @${connection.from_user_id.username} </p>
                <p> Click <a href="${process.env.FRONTEND_URL}/connections" style="color: #10b981; text-decoration: none;"> here </a> to accept or reject the request. </p>
                <br/>
                <p> Thanks,<br/> <strong>PingUp - Stay Connected</strong>  </p>
                </div> `

            await sendEmail({ 
              to : connection.to_user_id.email,
              subject,
              body
          })
        })  
         
         const in24hours = new Date(Date.now() + 24*60*60*1000)
         await step.sleepUntil("wait-for-24hours",in24hours)
         await step.run('send-connection-request-remainder', async () => { 
             const connection = await Connection.findById(connectionId).populate('from_user_id to_user_id');
             
             if(connection.status=='accepted') return { message : "Already accepted" }

               const subject = `👋 New Connection Request`
            const body = `
                <div style="font-family: Arial, sans-serif; padding: 20px;">
                <h2>Hi ${connection.to_user_id.full_name},</h2> <p> You have a new connection request from 
                <strong>${connection.from_user_id.full_name}</strong> - @${connection.from_user_id.username} </p>
                <p> Click <a href="${process.env.FRONTEND_URL}/connections" style="color: #10b981; text-decoration: none;"> here </a> to accept or reject the request. </p>
                <br/>
                <p> Thanks,<br/> <strong>PingUp - Stay Connected</strong>  </p>
                </div> `

            await sendEmail({ 
              to : connection.to_user_id.email,
              subject,
              body
          })    
            return { message : "Remainder sent." }
              
         })
    }
)

// Inngest function to delete story after 24hours....
const deleteStory = inngest.createFunction( 
    { id : 'story-delete' },
    { event : 'app/story.delete' },
    async ({event,step}) => { 
        const { storyId } = event.data;
        const in24hours = new Date(Date.now() + 24*60*60*1000)
        
        await step.sleepUntil('wait-for-24hours',in24hours)
        await step.run('delete-story',async () => { 
            await Story.findByIdAndDelete(storyId)
            return { message : "Story deleted.." }
        })
    }
)

const sendNotificationOfUnseenMessages = inngest.createFunction(
    {  id : "send-unseen-messages-notification" },
    { cron : "TZ=America/New_York 0 9 * * *" },  // Automatically This Fun is called at Every day at 9 AM..

    async({step}) => { 
        const messages = await Message.find({ seen : false }).populate('to_user_id')
        const unseenCount = { };

        messages.map(message => { 
            unseenCount[message.to_user_id._id] = unseenCount[message.to_user_id._id] ? unseenCount[message.to_user_id._id] + 1 : 1
         }) 

         for(const userId in unseenCount) { 
            const user = await User.findById(userId)
            const subject = `🔔 You have ${unseenCount[userId]} unseen messages` // NO : OF UNSEEN MESSAGES..
            const body = ` 
                  <div style="font-family: Arial, sans-serif; padding: 20px;"> 
                  <h2>Hi ${user.full_name},</h2> 
                  <p> You have <strong>${unseenCount[userId]} unseen messages..</strong> </p> 
                  <p> Click <a href="${process.env.FRONTEND_URL}/messages" style="color: #10b981; text-decoration: none;"> here </a> to check your messages. </p> <br/>
                  <p> Thanks,<br/> <strong>PingUp - Stay Connected</strong>  </p>
                  </div> `; 

                  await sendEmail({ 
                    to : user.email,
                    subject,
                    body
                  })    
         }
            return { message : "Notifications sent." }
    })




// Create an empty array where we'll export future Inngest functions
export const functions = [ 
    syncUserCreation,
    syncUserUpdation,
    syncUserDeletion,
    sendNewConnectionRequestRemainder,
    deleteStory,
    sendNotificationOfUnseenMessages
 ];