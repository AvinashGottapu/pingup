import imagekit from "../configs/imageKit.js";
import Connection from "../models/Connections.js";
import User from "../models/User.js"
import { clerkClient } from "@clerk/express"
import Post from "../models/Post.js"
import fs from 'fs'
import { inngest } from "../inngest/index.js";
import { deleteFeedCacheForUser, getPresenceMap } from '../utils/redisStore.js'


// Get user data using userId
export const getUserData = async (req, res) => {
   try {
      const { userId } = req.auth();

      let user = await User.findById(userId);

      if (!user) {
         const clerkUser = await clerkClient.users.getUser(userId)
         let username = clerkUser.emailAddresses[0].emailAddress.split('@')[0]

         const existing = await User.findOne({ username })
         if (existing) {
            username = username + Math.floor(Math.random() * 10000)
         }

         user = await User.create({
            _id: userId,
            email: clerkUser.emailAddresses[0].emailAddress,
            full_name: clerkUser.firstName + (clerkUser.lastName ? " " + clerkUser.lastName : ""),
            profile_picture: clerkUser.imageUrl,
            username
         })
      }
      res.json({ success: true, user })

   } catch (error) {
      console.log(error)
      res.json({ success: false, message: error.message })
   }
}

// Update user Data
export const updateUserData = async (req, res) => {
   try {
      const { userId } = req.auth();
      let { username, bio, location, full_name, theme } = req.body;
      // CONST IS NOT USED BECAUSE WE ARE CHANGING THE USERNAME VALUE BELOW..

      const tempUser = await User.findById(userId);

      !username && (username = tempUser.username)

      if (username !== tempUser.username) {
         const user = await User.findOne({ username })
         if (user) {
            // WE WILL NOT CHANGE THE USERNAME IF IT ALREADY EXISTS.
            if (user) {
               username = tempUser.username
            }
         }
      }

      const updatedData = {
         username,
         bio,
         location,
         full_name,
         theme
      }

      const profile = req.files?.profile && req.files?.profile[0]
      const cover = req.files?.cover && req.files?.cover[0]

      if (profile) {
         const buffer = fs.readFileSync(profile.path)  // CONVERT TO RAW BINARY BUFFER
         const response = await imagekit.upload({
            file: buffer,
            fileName: profile.originalname
         })
         const url = imagekit.url({
            path: response.filePath,
            transformation: [
               { quality: 'auto' },
               { format: 'webp' },
               { width: '512' }
            ]
         })
         updatedData.profile_picture = url;
      }

      if (cover) {
         const buffer = fs.readFileSync(cover.path)  // CONVERT TO RAW BINARY BUFFER
         const response = await imagekit.upload({
            file: buffer,
            fileName: cover.originalname
         })
         const url = imagekit.url({
            path: response.filePath,
            transformation: [
               { quality: 'auto' },
               { format: 'webp' },
               { width: '1280' }
            ]
         })
         updatedData.cover_photo = url;
      }
      const user = await User.findByIdAndUpdate(userId, updatedData, { new: true })
      res.json({ success: true, user, message: "Profile Updated Successfully" })


   } catch (error) {
      console.log(error)
      res.json({ success: false, message: error.message })
   }
}

// Find Users using username, email, location, name. 
export const discoverUsers = async (req, res) => {
   try {
      const { userId } = req.auth();
      const { input } = req.body;

      const allUsers = await User.find(
         {
            $or: [
               { username: new RegExp(input, 'i') },
               { email: new RegExp(input, 'i') },
               { full_name: new RegExp(input, 'i') },
               { location: new RegExp(input, 'i') },
            ]
         }
      )
      const filteredUsers = allUsers.filter(user => user._id.toString() != userId);

      res.json({ success: true, users: filteredUsers });

   } catch (error) {
      console.log(error)
      res.json({ success: false, message: error.message })
   }
}

// Follow User 
export const followUser = async (req, res) => {
   try {
      const { userId } = req.auth();
      const { id } = req.body;

      const user = await User.findById(userId)

      if (user.following.includes(id)) {
         return res.json({ success: false, message: "You are already following this user" })
      }
      user.following.push(id);
      await user.save();
      // OR WE CAN DO DIRECTLY await User.findByIdAndUpdate(userId, { $push: { following: id } }); 

      const toUser = await User.findById(id);
      toUser.followers.push(userId);
      await toUser.save();

      await Promise.all([
         deleteFeedCacheForUser(userId),
         deleteFeedCacheForUser(id),
      ])

      res.json({ success: true, message: "Now You are following this user" })

   } catch (error) {
      console.log(error)
      res.json({ success: false, message: error.message })
   }
}

//Unfollow User..

export const unfollowUser = async (req, res) => {
   try {
      const { userId } = req.auth();
      const { id } = req.body;

      const user = await User.findById(userId)

      user.following = user.following.filter(user => user !== id);
      await user.save();

      const toUser = await User.findById(id);
      toUser.followers = toUser.followers.filter(user => user != userId);
      await toUser.save();

      await Promise.all([
         deleteFeedCacheForUser(userId),
         deleteFeedCacheForUser(id),
      ])

      res.json({ success: true, message: "You are no longer following this user" })

   } catch (error) {
      console.log(error)
      res.json({ success: false, message: error.message })
   }
}

// Send Connection Request
export const sendConnectionRequest = async (req, res) => {
   try {
      const { userId } = req.auth()
      const { id } = req.body;

      // Check if user has sent more than 20 connection requests in last 24 hours..
      const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const connectionRequests = await Connection.find({
         from_user_id: userId,
         createdAt: { $gt: last24Hours }
      })

      if (connectionRequests.length >= 20) {
         return res.json({ success: false, message: "You have sent more than 20 connection Requests in the last 24 hours" })
      }
      // Check if users are already connected.. 
      const connection = await Connection.findOne({
         $or: [
            { from_user_id: userId, to_user_id: id },
            { from_user_id: id, to_user_id: userId },
         ]
      })

      if (!connection) {
         const newConnection = await Connection.create({
            from_user_id: userId,
            to_user_id: id
         })
         // TRIGGERING THE INNGEST EVENT..
         await inngest.send({
            name: 'app/connection-request',
            data: { connectionId: newConnection._id }
         })

         return res.json({ success: true, message: "Connection request sent successfully" });
      }
      else if (connection && connection.status === 'accepted') {
         return res.json({ success: false, message: "You are already connected with this user" })
      }
      return res.json({ success: false, message: "Connection request pending" })

   } catch (error) {
      console.log(error)
      res.json({ success: false, message: error.message })
   }
}

// GET user connections
export const getUserConnections = async (req, res) => {
   try {
      const { userId } = req.auth()
      const user = await User.findById(userId).populate('connections followers following')

      if (!user) {
         return res.json({ success: false, message: "User not found" })
      }

      const connections = user.connections
      const followers = user.followers
      const following = user.following
      const connectionIds = connections.map((connection) => connection._id.toString())
      const presenceMap = await getPresenceMap(connectionIds)

      const connectionsWithPresence = connections.map((connection) => ({
         ...connection.toObject(),
         presence: presenceMap[connection._id.toString()] || { isOnline: false, lastSeen: null },
      }))

      const pendingConnections = (await Connection.find({ to_user_id: userId, status: 'pending' }).populate('from_user_id')).map(connection => connection.from_user_id)

      res.json({ success: true, connections: connectionsWithPresence, followers, following, pendingConnections })

   } catch (error) {
      console.log(error)
      res.json({ success: false, message: error.message })
   }
}

// Accept Connection Request
export const acceptConnectionRequest = async (req, res) => {
   try {
      const { userId } = req.auth()
      const { id } = req.body;

      const connection = await Connection.findOne({ from_user_id: id, to_user_id: userId });
      if (!connection) {
         return res.json({ success: false, message: "Connection not found" })
      }
      const user = await User.findById(userId);
      user.connections.push(id)
      await user.save()

      const touser = await User.findById(id);
      touser.connections.push(userId)
      await touser.save()

      connection.status = 'accepted';
      await connection.save()

      await Promise.all([
         deleteFeedCacheForUser(userId),
         deleteFeedCacheForUser(id),
      ])

      res.json({ success: true, message: "Connection accepted successfully" })

   } catch (error) {
      console.log(error)
      res.json({ success: false, message: error.message })
   }
}

// Reject Connection Request 
export const rejectConnectionRequest = async (req, res) => {
   try {
      const { userId } = req.auth()
      const { id } = req.body;

      const connection = await Connection.findOneAndDelete({
         from_user_id: id,
         to_user_id: userId,
         status: 'pending'
      });

      if (!connection) {
         return res.json({ success: false, message: "Connection request not found" })
      }

      res.json({ success: true, message: "Connection request rejected" })

   } catch (error) {
      console.log(error)
      res.json({ success: false, message: error.message })
   }
}

// Delete Connection 
export const deleteConnection = async (req, res) => {
   try {
      const { userId } = req.auth()
      const { id } = req.body;

      const user = await User.findById(userId);
      const otherUser = await User.findById(id);

      if (!user || !otherUser) {
         return res.json({ success: false, message: "User not found" })
      }

      // Remove from connections array 
      user.connections = user.connections.filter(connId => connId.toString() !== id);
      otherUser.connections = otherUser.connections.filter(connId => connId.toString() !== userId);

      await user.save();
      await otherUser.save();

      // Delete the Connection document 
      await Connection.findOneAndDelete({
         $or: [
            { from_user_id: userId, to_user_id: id, status: 'accepted' },
            { from_user_id: id, to_user_id: userId, status: 'accepted' }
         ]
      });

      await Promise.all([
         deleteFeedCacheForUser(userId),
         deleteFeedCacheForUser(id),
      ])

      res.json({ success: true, message: "Connection removed successfully" })

   } catch (error) {
      console.log(error)
      res.json({ success: false, message: error.message })
   }
}


// Get User Profiles 
export const getUserProfiles = async (req, res) => {
   try {
      const { profileId } = req.body;
      const profile = await User.findById(profileId)

      if (!profile) {
         return res.json({ success: false, message: "profile not found" })
      }
      const posts = await Post.find({ user: profileId }).populate('user')
      res.json({ success: true, profile, posts })

   } catch (error) {
      console.log(error);
      res.json({ success: false, message: error.message })
   }
}