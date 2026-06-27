from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

import ollama
import whisper

import tempfile
import subprocess
import os

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

print("Loading Whisper...")
whisper_model = whisper.load_model("base")
print("Whisper loaded")

MODEL_PATH = os.path.expanduser(
    "~/vc/en_US-lessac-medium.onnx"
)

SYSTEM_PROMPT = """
You are David Morgan.

Age: 42.

Role: Principal Software Engineer.

Personality:
- Calm
- Professional
- Curious
- Occasionally skeptical
- Encouraging but demanding

You are conducting a technical interview.

Ask one question at a time.
Keep answers under 30 words.
Challenge weak answers.
Ask follow-up questions.
Stay in character.
Never break character.

If the candidate says 'start interview',
begin immediately.
"""

conversation = [
    {
        "role": "system",
        "content": SYSTEM_PROMPT
    }
]


@app.post("/transcribe")
async def transcribe(audio: UploadFile = File(...)):

    with tempfile.NamedTemporaryFile(
        delete=False,
        suffix=".webm"
    ) as temp_file:

        temp_file.write(await audio.read())
        temp_path = temp_file.name

    result = whisper_model.transcribe(temp_path)

    os.remove(temp_path)

    return {
        "text": result["text"]
    }


@app.post("/chat")
async def chat(prompt: str = Form(...)):

    global conversation

    conversation.append(
        {
            "role": "user",
            "content": prompt
        }
    )

    response = ollama.chat(
        model="qwen3:8b",
        messages=conversation
    )

    text = response["message"]["content"]

    conversation.append(
        {
            "role": "assistant",
            "content": text
        }
    )

    if len(conversation) > 20:
        conversation = (
            conversation[:1]
            + conversation[-19:]
        )

    os.makedirs(
        "audio",
        exist_ok=True
    )

    print("=" * 60)
    print("USER:", prompt)
    print("ASSISTANT:", text[:200])
    print("=" * 60)

    subprocess.run(
        [
            "piper",
            "--model",
            MODEL_PATH,
            "--output_file",
            "audio/response.wav"
        ],
        input=text,
        text=True,
        check=True
    )

    return {
        "response": text,
        "tts": True
    }


@app.post("/reset")
async def reset():

    global conversation

    conversation = [
        {
            "role": "system",
            "content": SYSTEM_PROMPT
        }
    ]

    return {
        "status": "reset"
    }


@app.get("/audio")
async def get_audio():

    return FileResponse(
        "audio/response.wav",
        media_type="audio/wav"
    )
