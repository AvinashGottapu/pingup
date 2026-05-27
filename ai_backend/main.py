from fastapi import FastAPI, HTTPException, UploadFile, File, Form, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
from dotenv import load_dotenv
from google import genai
from google.genai import types
import redis.asyncio as redis
from services.ml_service import check_toxicity
import time
from uuid import uuid4

load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "https://pingup-six-lake.vercel.app"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

if not GEMINI_API_KEY:
    print("WARNING: GEMINI_API_KEY not found")

client = genai.Client(api_key=GEMINI_API_KEY)
REDIS_URL = os.getenv("REDIS_URL")
redis_client = redis.from_url(REDIS_URL, decode_responses=True) if REDIS_URL else None

SYSTEM_INSTRUCTION = """
You are PingUp AI, an intelligent assistant integrated inside a modern social media application.

- Be helpful, concise, and friendly.
- Do not mention backend or model providers.
"""

async def check_rate_limit(identifier: str, limit: int, window_seconds: int):
    if not redis_client:
        return {"allowed": True, "ttl": 0}

    try:
        now_ms = int(time.time() * 1000)
        window_ms = window_seconds * 1000
        member = f"{now_ms}-{uuid4().hex}"

        result = await redis_client.eval(
            """
            local now = tonumber(ARGV[1])
            local window_ms = tonumber(ARGV[2])
            local member = ARGV[3]
            local cutoff = now - window_ms

            redis.call('zadd', KEYS[1], now, member)
            redis.call('zremrangebyscore', KEYS[1], '-inf', cutoff)

            local current = redis.call('zcard', KEYS[1])
            local oldest = redis.call('zrange', KEYS[1], 0, 0, 'WITHSCORES')
            local ttl = 0

            if #oldest > 0 then
              local oldest_score = tonumber(oldest[2])
              ttl = math.max(0, math.ceil((oldest_score + window_ms - now) / 1000))
            end

            redis.call('expire', KEYS[1], tonumber(ARGV[4]))
            return { current, ttl }
            """,
            1,
            identifier,
            now_ms,
            window_ms,
            member,
            window_seconds,
        )

        current_count = int(result[0])
        ttl = max(int(result[1]), 0)

        return {
            "allowed": current_count <= limit,
            "ttl": ttl,
            "remaining": max(0, limit - current_count),
        }
    except Exception:
        return {"allowed": True, "ttl": 0}


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
async def chat_endpoint(request: Request, payload: ChatRequest):
    try:
        user_identifier = request.headers.get("x-user-id") or (request.client.host if request.client else "anonymous")
        rate_limit = await check_rate_limit(f"rate:ai:{user_identifier}", 5, 60)

        if not rate_limit["allowed"]:
            raise HTTPException(
                status_code=429,
                detail={
                    "message": "Too many AI requests. Please wait a minute before trying again.",
                    "retryAfter": rate_limit["ttl"],
                },
            )

        conversation = ""
        user_input = ""

        for msg in payload.messages:
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

    except HTTPException:
        raise
    except Exception as e:
        print("Error:", e)
        raise HTTPException(status_code=500, detail=str(e))



@app.post("/api/photo-magic")
async def photo_magic_endpoint(
    request: Request,
    type: str = Form(...),
    image: UploadFile = File(...)
):
    try:
        user_identifier = request.headers.get("x-user-id") or (request.client.host if request.client else "anonymous")    ## Redis-based rate limiting..
        rate_limit = await check_rate_limit(f"rate:ai:{user_identifier}", 5, 60)

        if not rate_limit["allowed"]:
            raise HTTPException(
                status_code=429,
                detail={
                    "message": "Too many AI requests. Please wait a minute before trying again.",
                    "retryAfter": rate_limit["ttl"],
                },
            )

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


class ToxicityRequest(BaseModel):
    comment: str

@app.post("/api/check-toxicity")
def toxicity(data: ToxicityRequest):

    result = check_toxicity(data.comment)

    return {
        "toxicity": result
    }


@app.get("/")
def read_root():
    return {"message": "PingUp AI Backend is running"}


