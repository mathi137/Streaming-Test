const messageInput = document.getElementById('prompt');

let mediaRecorder;
let socket;

let stoppingRecording = false;

function swicthEnable() {
    const startButton = document.getElementById('startButton');
    const stopButton = document.getElementById('stopButton');

    startButton.disabled = !startButton.disabled;
    stopButton.disabled = !stopButton.disabled;
}

async function start_recording() {
    if (stoppingRecording) return;

    if (!navigator.mediaDevices.getUserMedia) {
        console.error("Microphone cannot be accessed.");
        return;
    }

    // Desable start and enable stop
    swicthEnable();

    // Connects to the server
    socket = io.connect('http://localhost:5000/speech', { reconnectionAttempts: 3, reconnectionDelay: 1000, reconnectionDelayMax: 5000 });

    // Get audio input from user
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const options = {
        mimeType: 'audio/webm;codecs:opus',
        audioBitsPerSecond: 128000,
    };
    mediaRecorder = new MediaRecorder(stream, options);

    // Temporarily stores the message
    let tempMessage = '';

    // Clear prompt
    messageInput.value = '';

    socket.on('connect', () => {
        console.log('Connect to server!');
    });

    socket.on('connect_error', (error) => {
        console.error('Connection error:', error);
    });

    socket.on('disconnect', () => {
        console.log("Disconnected from server");
    });

    // Receives the transcription from server
    socket.on('transcription', (json) => {
        messageInput.value = `${tempMessage} ${json.data}`;
        console.log(`Message -> ${json.data}`);
    });

    // Receives the formatted transcription from server
    socket.on('transcription_finished', (json) => {
        messageInput.value = `${tempMessage} ${json.data}`;
        tempMessage = messageInput.value;
        console.log(`Message finished -> ${json.data}`);
    });

    // Dispatch audio data to server
    mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0 && socket?.connected) {
            socket.emit('transcription_event', {data: e.data});
            console.log(e.data);
        }
    };

    // Start recording every 500ms
    mediaRecorder.start(500);
    console.log('MediaRecorder started.');
}

async function stop_recording() {
    if (stoppingRecording) return;

    stoppingRecording = true;

    // Desable stop and enable start
    swicthEnable();
    
    // Wait 2 seconds before stopping
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Stop recording
    if (mediaRecorder?.state === "recording") {
        mediaRecorder.stream.getTracks().forEach(track => track.stop());
    }
    
    // Disconnect from server
    if (socket?.connected) {
        socket.disconnect();
        socket = null;
    }

    // Recording already stopped
    stoppingRecording = false;
}

const chatForm = document.getElementById('chatForm');
const messageList = document.getElementById('messageList');
const chatMessage = document.getElementById('chatMessage');

// Escuta o envio do formulário ao pressionar "Enter"
messageInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) { // Enter sem Shift
        e.preventDefault();  // Previne a quebra de linha padrão
        sendChatMessage(); // Chama a função de envio de mensagem
    }
});

// Escuta o envio do formulário ao clicar no botão "Enviar"
chatForm.addEventListener('submit', function (e) {
    e.preventDefault(); // Previne o envio padrão do formulário
    sendChatMessage(); // Chama a função de envio de mensagem
});

async function* streamResponse(reader) {
    const decoder = new TextDecoder();
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) yield decoder.decode(value);
    }
}

async function sendChatMessage() {
    const messageText = messageInput.value.trim();

    if (messageText === '') return;

    // Clear the chat prompt
    messageInput.value = '';

    // Set up the parameters for the API call
    const params = new URLSearchParams({
        'question': messageText,
        'document_id': 'a31ccb52-fafc-4b50-9ad9-6424e5c9f285',
        'user_id': '1'
    });

    const response = await fetch(`http://localhost:5000/chat?${params}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        }
    });

    // If there's no response body, something went wrong
    if (!response.body) {
        console.error("No response body available");
        return;
    }

    // Get the reader for the response body
    const reader = response.body.getReader();
    let accumulatedResponse = '';

    // Iterate over the chunks of the response body
    for await (const chunk of streamResponse(reader)) {
        // Accumulate the chunks into a single string
        accumulatedResponse += chunk;

        // Update the chat list with the makedown accumulated response
        messageList.innerHTML = marked.parse(accumulatedResponse);
    }
}
