console.log("APP LOADED");

const face = document.getElementById("face");

const recordBtn = document.getElementById("recordBtn");
const resetBtn = document.getElementById("resetBtn");
const statusDiv = document.getElementById("status");
const responseDiv = document.getElementById("response");

const mouth = document.getElementById("mouth");
const eyes = document.querySelectorAll(".eye");

let mediaRecorder = null;
let chunks = [];
let isRecording = false;

let currentAudio = null;
let isSpeaking = false;

recordBtn.addEventListener(
    "click",
    toggleRecording
);

resetBtn.addEventListener(
    "click",
    resetMemory
);

function setState(state) {

    face.className = "";

    switch (state) {

        case "listening":
            face.classList.add("listening");
            break;

        case "thinking":
            face.classList.add("thinking");
            break;

        case "speaking":
            face.classList.add("speaking");
            break;

        default:
            face.classList.add("idle");
    }
}

function blink() {

    eyes.forEach(eye => {

        eye.style.height = "2px";

        setTimeout(() => {

            eye.style.height = "22px";

        }, 120);
    });
}

function scheduleBlink() {

    blink();

    const delay =
        3000 + Math.random() * 4000;

    setTimeout(
        scheduleBlink,
        delay
    );
}

scheduleBlink();

document.addEventListener(
    "mousemove",
    event => {

        const x =
            (event.clientX /
            window.innerWidth - 0.5) * 8;

        const y =
            (event.clientY /
            window.innerHeight - 0.5) * 8;

        eyes.forEach(eye => {

            eye.style.transform =
                `translate(${x}px, ${y}px)`;
        });
    }
);

async function toggleRecording() {

    if (!isRecording) {
        await startRecording();
    } else {
        stopRecording();
    }
}

async function startRecording() {

    if (isSpeaking && currentAudio) {

        currentAudio.pause();
        currentAudio.currentTime = 0;

        isSpeaking = false;
        currentAudio = null;

        mouth.style.transform =
            "translateX(-50%) scaleY(1)";
    }

    try {

        const stream =
            await navigator.mediaDevices.getUserMedia({
                audio: true
            });

        chunks = [];

        mediaRecorder =
            new MediaRecorder(stream);

        mediaRecorder.ondataavailable =
            event => {
                chunks.push(event.data);
            };

        mediaRecorder.start();

        isRecording = true;

        recordBtn.textContent =
            "Stop Recording";

        statusDiv.textContent =
            "Listening...";

        responseDiv.textContent =
            "";

        setState("listening");

    } catch (error) {

        console.error(
            "REAL ERROR:",
            error
        );

        statusDiv.textContent =
            error.message;
    }
}

function stopRecording() {

    if (!mediaRecorder) {
        return;
    }

    mediaRecorder.stop();

    isRecording = false;

    recordBtn.textContent =
        "Start Recording";

    statusDiv.textContent =
        "Processing...";

    setState("thinking");

    mediaRecorder.onstop =
        processRecording;
}

async function processRecording() {

    try {

        const blob =
            new Blob(
                chunks,
                {
                    type: "audio/webm"
                }
            );

        const formData =
            new FormData();

        formData.append(
            "audio",
            blob,
            "audio.webm"
        );

        const transcriptionResponse =
            await fetch(
                "http://127.0.0.1:8000/transcribe",
                {
                    method: "POST",
                    body: formData
                }
            );

        const transcription =
            await transcriptionResponse.json();

        console.log(
            "TRANSCRIPTION:",
            transcription
        );

        statusDiv.textContent =
            "You: " +
            transcription.text;

        const chatForm =
            new FormData();

        chatForm.append(
            "prompt",
            transcription.text
        );

        const chatResponse =
            await fetch(
                "http://127.0.0.1:8000/chat",
                {
                    method: "POST",
                    body: chatForm
                }
            );

        const result =
            await chatResponse.json();

        console.log(
            "CHAT RESULT:",
            result
        );

        responseDiv.textContent =
            result.response;

        statusDiv.textContent =
            "Speaking...";

        setState("speaking");

        await playAssistantAudio();

        statusDiv.textContent =
            "Ready";

        setState("idle");

    } catch (error) {

        console.error(error);

        statusDiv.textContent =
            "Error";

        setState("idle");
    }
}

async function playAssistantAudio() {

    currentAudio =
        new Audio(
            "http://127.0.0.1:8000/audio?" +
            Date.now()
        );

    isSpeaking = true;

    const mouthInterval =
        setInterval(() => {

            const scale =
                0.5 + Math.random() * 2;

            mouth.style.transform =
                `translateX(-50%) scaleY(${scale})`;

        }, 100);

    await currentAudio.play();

    return new Promise(resolve => {

        currentAudio.onended =
            () => {

                clearInterval(
                    mouthInterval
                );

                mouth.style.transform =
                    "translateX(-50%) scaleY(1)";

                isSpeaking = false;

                currentAudio = null;

                resolve();
            };
    });
}

async function resetMemory() {

    try {

        await fetch(
            "http://127.0.0.1:8000/reset",
            {
                method: "POST"
            }
        );

        responseDiv.textContent =
            "";

        statusDiv.textContent =
            "Memory Reset";

        setState("idle");

    } catch (error) {

        console.error(error);

        statusDiv.textContent =
            "Reset Failed";
    }
}

setState("idle");
