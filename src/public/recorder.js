
const base_url = "http://localhost:5000"

// const startRecording = async () => {
//   const response = await fetch(`${base_url}/start-recording`, {
//   })
//   const data = await response.json()
//   console.log(data.transcription);
  
// }


// const button = document.getElementById("startRecordButton")
// button.addEventListener("click", startRecording
// )

let mediaRecorder;
let audioChunks = [];

document.getElementById('startRecordButton').onclick = async () => {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

  // Grabación en formato WAV
  mediaRecorder = new MediaRecorder(stream, {
    mimeType: 'audio/webm'
  });

  mediaRecorder.ondataavailable = (e) => {
    audioChunks.push(e.data);
  };

  mediaRecorder.onstop = async () => {
    const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
    audioChunks = [];

    const formData = new FormData();
    formData.append('audio', audioBlob, 'voz.webm');

    // Enviar al backend
    const res = await fetch('http://localhost:5000/procesar-audio', {
      method: 'POST',
      body: formData
    });

    const audioURL = await res.text(); // MP3 que devuelve el backend
    const audioPlayer = document.getElementById('respuesta');
    audioPlayer.src = `${audioURL}?t=${Date.now()}`; // URL del audio procesado

    // Esperar reproducción y volver a grabar
    audioPlayer.onended = () => {
      mediaRecorder.start();
      setTimeout(() => mediaRecorder.stop(), 5000); // Graba 3 segundos
    };
  };

  // Inicia el ciclo de grabación-respuesta
  mediaRecorder.start();
  setTimeout(() => mediaRecorder.stop(), 3000);
};