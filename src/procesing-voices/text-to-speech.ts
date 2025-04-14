// const axios = require('axios');
import axios from 'axios';
import fs ,{createWriteStream , promises}from 'fs';
import dotenv from 'dotenv';
import { v4 as uuid } from 'uuid';
dotenv.config();
import { ElevenLabsClient } from "elevenlabs";
const API_KEY = process.env.ELEVEN_LABS_API_KEY;
const VOICE_ID = process.env.VOICE_ID as string;  // Reemplace con su ID de voz

const client = new ElevenLabsClient({ apiKey: API_KEY });


export const createAudioFileFromText = async (
    text: string
  ): Promise<string> => {
    return new Promise<string>(async (resolve, reject) => {
      try {
        const audio = await client.textToSpeech.convert(VOICE_ID, {
          text,
          model_id: "eleven_multilingual_v2",
          output_format: "mp3_44100_128",
        });
        const fileName = `${uuid()}.mp3`;
        const fileStream = createWriteStream(fileName);
  
        audio.pipe(fileStream);
        fileStream.on("finish", () => resolve(fileName)); // Resolve with the fileName
        fileStream.on("error", reject);
      } catch (error) {
        reject(error);
      }
    });
  };




async function textoAVozElevenLabs(texto:string): Promise<Buffer> {
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`;
  const config = {
    headers: {
      'xi-api-key': API_KEY,
      'Content-Type': 'application/json',
      'accept': 'audio/mpeg'  // solicitamos audio en MP3 (también puede ser 'audio/wav')
    },
    responseType: 'arraybuffer' as const  // esperamos datos binarios (audio) como ArrayBuffer
  };
  const data = { text: texto };
  const response = await axios.post(url, data, config);
  return response.data;  // Buffer con los bytes de audio (MP3)
}

// Ejemplo de usos:
const respuestaAgente = "Este es el texto de respuesta del agente";  // normalmente viene de LangGraph
// const audioBuffer = await createAudioFileFromText(respuestaAgente);


// Guarda el audio en local
async function guardarAudio(audioBuffer:Buffer): Promise<boolean> {
    return promises.writeFile('respuesta.mp3', audioBuffer)
    .then(() => true)
    .catch((error) => {
        console.error('Error al guardar el archivo:', error);
        return false;
    });
}


// Uso:
// guardarAudio(audioBuffer).then((exito) => {
//     if (exito) {
//         // Hacer algo cuando se guarda con éxito
//         console.log('Audio guardado correctamente.');
//     } else {
//       // Hacer algo si hubo error
//       console.log('Falló la grabación.');
//     }
// });


export async function processAudioElevenLabs(respuestaAgente:string, mp3Path:string) {
    const audioBuffer = await textoAVozElevenLabs(respuestaAgente)
    const exito = await guardarAudio(audioBuffer);
    if (exito) {
        console.log('Audio guardado correctamente.');
    }
    else {
        console.log('Falló la grabación.');
    }   

}
// const audioBuffer = await textoAVozElevenLabs(respuestaAgente);

// fs.writeFileSync('respuesta.mp3', audioBuffer);
// console.log("Audio de respuesta guardado (respuesta.mp3)");
