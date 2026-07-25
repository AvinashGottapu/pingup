import fs from "fs"
import imagekit from "../configs/imageKit.js"
import Post from '../models/Post.js'
import User from "../models/User.js"
import Story from "../models/Story.js"
import { inngest } from "../inngest/index.js"

// Add User Story..

export const addUserStory = async (req, res) => {
    try {
        const { userId } = req.auth()
        const { content, media_type, background_color } = req.body
        const media = req.file
        let media_url = ''
        // Uploading media to imagekit 
        if (media_type === 'image' || media_type === 'video') {
            const fileBuffer = fs.readFileSync(media.path);
            const response = await imagekit.upload({
                file: fileBuffer,
                fileName: media.originalname
            })
            media_url = response.url;
            fs.unlinkSync(media.path); // 🧹 Delete temporary story media from disk!
        }

        // Create new story object
        const newStory = {
            content,
            media_url,
            media_type,
            background_color
        }

        // Find user story document and push new story, or create if doesn't exist
        const story = await Story.findOneAndUpdate(
            { user: userId },
            { $push: { stories: newStory } },
            { new: true, upsert: true, setDefaultsOnInsert: true }
        );

        // Schedule Story deletion after 24hours....
        // Note: Inngest function needs to be updated to handle specific story removal inside the array
        // Assuming we pass the specific sub-document ID
        const addedStory = story.stories[story.stories.length - 1];

        await inngest.send({
            name: 'app/story.delete',
            data: { storyId: addedStory._id, userId: userId } // We need userId now to find the doc
        })

        res.json({ success: true, story: addedStory })


    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}

// Get user tories.. 

export const getStories = async (req, res) => {
    try {
        const { userId } = req.auth();
        const user = await User.findById(userId);

        // User connections and followings..
        const userIds = [userId, ...user.connections, ...user.following]

        // Fetch users who have stories, populate user details
        const stories = await Story.find({
            user: { $in: userIds },
            'stories.0': { $exists: true } // Filter where 'stories' array has at least one element (index 0 exists)
        }).populate('user')
            // Don't rely on mongo sort for array contents, but we can sort docs
            .lean();

        // Sort users by their LATEST story time
        stories.sort((a, b) => {
            const lastStoryA = a.stories[a.stories.length - 1];
            const lastStoryB = b.stories[b.stories.length - 1];
            const timeA = lastStoryA ? new Date(lastStoryA.createdAt).getTime() : 0;
            const timeB = lastStoryB ? new Date(lastStoryB.createdAt).getTime() : 0;
            return timeB - timeA;
        });

        res.json({ success: true, stories });

    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}

// Delete Story manually (force delete)
export const deleteStory = async (req, res) => {
    try {
        const { userId } = req.auth();
        const { storyId } = req.params;

        // Pull specific story from the user's stories array
        const result = await Story.findOneAndUpdate(
            { user: userId },
            { $pull: { stories: { _id: storyId } } },
            { new: true }
        );

        if (!result) {
            return res.json({ success: false, message: "Story not found or unauthorized" });
        }

        res.json({ success: true, message: "Story deleted successfully" });

    } catch (error) {
        console.log(error);
        res.json({ success: false, message: error.message });
    }
};

// Mark story item as viewed by user
export const viewStoryItem = async (req, res) => {
    try {
        const { userId } = req.auth();
        const { storyId } = req.params;

        // Find user story that contains the specific story item ID, add user to its view_count array
        const result = await Story.findOneAndUpdate(
            { "stories._id": storyId },
            { $addToSet: { "stories.$.view_count": userId } },
            { new: true }
        );

        if (!result) {
            return res.json({ success: false, message: "Story item not found" });
        }

        res.json({ success: true, message: "Story marked as viewed successfully" });

    } catch (error) {
        console.log(error);
        res.json({ success: false, message: error.message });
    }
};
