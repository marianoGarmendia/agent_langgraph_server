import fs from 'fs';
import mic from 'mic';
import { exec } from 'child_process';
import path from 'path';

const modelPath = 'C:/Users/usuario/lacalle_ai/whisper.cpp/models/ggml-small.bin';
const exePath = 'C:/Users/usuario/lacalle_ai/whisper.cpp/build/bin/Release/whisper-cli.exe';

const originalAudio = 'userInput.wav';
const convertedAudio = path.resolve('userInput_convertido.wav');

async function grabarAudio(duracionMs = 5000): Promise<void> {
  return new Promise((resolve) => {
    const micInstance = mic({
      rate: '16000',
      channels: '1',
      bitwidth: '16',
      encoding: 'signed-integer',
      fileType: 'wav', // importante para encabezado válido
    });

    const micInputStream = micInstance.getAudioStream();
    const fileStream = fs.createWriteStream(originalAudio);

    micInputStream.pipe(fileStream);
    micInstance.start();

    console.log('🎙️ Grabando audio...');
    
    // detener la grabación cuando detectemos silencio tras la voz del usuario (ver sección de VAD e interrupción más adelante),
    setTimeout(() => {
      micInstance.stop();
      console.log('🛑 Grabación finalizada.');
      resolve();
    }, duracionMs);
  });
}

async function convertirAudio(webmPath:string, audioPath:string): Promise<string> {
    const convertedAudio = path.resolve(audioPath);
  return new Promise((resolve, reject) => {
    const soxPath = `"C:\\Program Files (x86)\\sox-14-4-2\\sox.exe"`;
    const cmd = `${soxPath} ${webmPath} -r 16000 -c 1 -b 16 -e signed-integer ${convertedAudio}`;

    console.log('🔁 Convirtiendo audio con SoX...');

    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        console.error('❌ Error al convertir audio:', error.message);
        reject(error);
      } else {
        console.log('✅ Audio convertido correctamente.');
        resolve(convertedAudio);
      }
    });
  });
}

export async function convertirAudioWebmAWav(inputPath, outputPath):Promise<string> {
  const convertedAudio = path.resolve(outputPath);
  return new Promise((resolve, reject) => {
    const cmd = `ffmpeg -y -i "${inputPath}" -ar 16000 -ac 1 "${convertedAudio}"`;
    console.log('🔁 Convirtiendo audio con FFmpeg...');

    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        console.error('❌ Error al convertir audio con FFmpeg:', error.message);
        return reject(error);
      }
      console.log('✅ Audio convertido correctamente con FFmpeg.');
      resolve(convertedAudio);
    });
  });
}

async function transcribirAudio({path_to_audio}:{path_to_audio:string}): Promise<string> {
  return new Promise((resolve, reject) => {
    const cmd = `"${exePath}" -m "${modelPath}" -f "${path_to_audio}" -l es`;

    console.log('🧠 Transcribiendo audio...');

    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        console.error('❌ Error al transcribir:', error.message);
        reject(error);
      } else {
        resolve(stdout.trim());
      }
    });
  });
}

// (async () => {
//   try {
//     await grabarAudio();
//     await convertirAudio();
//     const texto = await transcribirAudio();
//     console.log('\n🗣️ Usuario dijo:\n', texto);
//   } catch (err) {
//     console.error('⚠️ Hubo un error:', err);
//   }
// })();

export {
    grabarAudio,
    convertirAudio,
    transcribirAudio,
    
}