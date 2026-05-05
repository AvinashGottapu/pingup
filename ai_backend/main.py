from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
from dotenv import load_dotenv
from google import genai
from google.genai import types

load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

if not GEMINI_API_KEY:
    print("WARNING: GEMINI_API_KEY not found")

client = genai.Client(api_key=GEMINI_API_KEY)

SYSTEM_INSTRUCTION = """
You are PingUp AI, an intelligent assistant integrated inside a modern social media application.

- Be helpful, concise, and friendly.
- Do not mention backend or model providers.
"""

def get_direct_reply(user_message: str):
    msg = user_message.strip().lower()

    greetings = {"hi", "hii", "hello", "hey", "heyy", "good morning", "good evening"}
    okay_msgs = {"ok", "okay", "okk", "fine", "alright"}
    thanks_msgs = {"thanks", "thank you", "thx", "thanksss"}
    bye_msgs = {"bye", "goodbye", "see you"}

    if msg in greetings:
        return "Hello! How can I help you with PingUp?"
    elif msg in okay_msgs:
        return "Alright 👍"
    elif msg in thanks_msgs:
        return "You're welcome!"
    elif msg in bye_msgs:
        return "Bye! See you again on PingUp 👋"

    return None

class Message(BaseModel):
    role: str
    text: str

class ChatRequest(BaseModel):
    messages: list[Message]

@app.post("/api/chat")
async def chat_endpoint(request: ChatRequest):
    try:
        conversation = ""
        user_input = ""

        for msg in request.messages:
            if msg.role == "user":
                conversation += f"User: {msg.text}\n"
                user_input = msg.text
            else:
                conversation += f"Assistant: {msg.text}\n"
        
        direct_reply = get_direct_reply(user_input)

        if direct_reply:
            return {"response": direct_reply}

        prompt = SYSTEM_INSTRUCTION + "\n" + conversation

        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt
        )

        return {"response": response.text}

    except Exception as e:
        print("Error:", e)
        raise HTTPException(status_code=500, detail=str(e))



@app.post("/api/photo-magic")
async def photo_magic_endpoint(
    type: str = Form(...),
    image: UploadFile = File(...)
):
    try:
        image_bytes = await image.read()

        if not image_bytes:
            raise HTTPException(status_code=400, detail="Empty image file uploaded.")

        mime_type = image.content_type or "image/jpeg"

        if type == "quotes":
            prompt = "Generate 3 inspiring and highly engaging quotes for this image. Format nicely."
        elif type == "captions":
            prompt = "Generate 3 catchy and aesthetic social media captions for this image. Include emojis."
        elif type == "hashtags":
            prompt = "Generate 3 highly relevant and trending hashtags for this image. Just return the hashtags."
        else:
            prompt = f"Analyze this image and generate {type} for it."

        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=[
                types.Part.from_bytes(
                    data=image_bytes,
                    mime_type=mime_type
                ),
                prompt
            ]
        )

        return {"response": response.text}

    except Exception as e:
        print("Error in photo-magic:", e)
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/")
def read_root():
    return {"message": "PingUp AI Backend is running"}

