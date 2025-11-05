import { Inngest } from "inngest";
import User from "../models/User";

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
         
        await User.findByIdAndUpdate(id,updateUserData)
   
    }
)


// Inngest function to Delete user data to database. 
const syncUserDeletion = inngest.createFunction(
    { id : 'delete-user-from-clerk' },  // UNIQUE IDENTIFIER FOR THIS FUNCTION...
    { event : 'clerk/user.deleted'  },  // WHEN THIS USER CREATED THE FUNCTION CALLS AUTOMATICALLY..
    async ({event}) => { 
        const { id } = event.data
        let username = email_addresses[0].email_address.split('@')[0] 

        const user = await User.findByIdAndDelete(id) 
    }
)


// Create an empty array where we'll export future Inngest functions
export const functions = [ 
    syncUserCreation,
    syncUserUpdation,
    syncUserDeletion
 ];