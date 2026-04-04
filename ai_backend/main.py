from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
from dotenv import load_dotenv
from google import genai

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

class Message(BaseModel):
    role: str
    text: str

class ChatRequest(BaseModel):
    messages: list[Message]

@app.post("/api/chat")
async def chat_endpoint(request: ChatRequest):
    try:
        conversation = ""

        for msg in request.messages:
            if msg.role == "user":
                conversation += f"User: {msg.text}\n"
            else:
                conversation += f"Assistant: {msg.text}\n"

        prompt = SYSTEM_INSTRUCTION + "\n" + conversation

        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt
        )

        return {"response": response.text}

    except Exception as e:
        print("Error:", e)
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/")
def read_root():
    return {"message": "PingUp AI Backend is running"}