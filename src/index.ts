import express from "express";
import multer from "multer";
import cors from "cors";
import fs from "fs-extra";

import Openai from "openai";
import { v4 as uuidv4 } from "uuid";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import {
  convertirAudio,
  grabarAudio,
  transcribirAudio,
  convertirAudioWebmAWav,
} from "./procesing-voices/audio-transcription.js";
import { processAudioElevenLabs } from "./procesing-voices/text-to-speech.js";
// import { ensureToolCallsHaveResponses } from "./ensure-tool-response.ts";

const __filename = fileURLToPath(import.meta.url);
console.log("filename: ", __filename);

const __dirname = dirname(__filename);
console.log("dirname: ", __dirname);

// Guardar archivos de voz entrantes
// const upload = multer({ dest: 'uploads/' });
const audiosDir = path.join(__dirname, "audios");
fs.ensureDirSync("audios"); // crea la carpeta si no existe

// Asegurarse que exista la carpeta
// if (!fs.existsSync('audios')) {
//   fs.mkdirSync('audios');
// }

// ... acá tu Multer y resto del código ...

// Multer config
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "audios"),
  filename: (req, file, cb) => cb(null, `${uuidv4()}.webm`),
});
const upload = multer({ storage });

import { workflow } from "./graph";
import { text } from "stream/consumers";
import { HumanMessage } from "@langchain/core/messages";

const app = express();
const PORT = process.env.PORT || 5000;

const openai = new Openai({
  apiKey: process.env.OPENAI_API_KEY_WIN_2_WIN,
});

// const uploadsDir = 'uploads';
// if (!fs.existsSync(uploadsDir)) {
//   fs.mkdirSync(uploadsDir);
// }

// Servir audios generados
// app.use('/audios', express.static(path.join(__dirname, 'audios')));

// Middleware para parsear JSON
app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, "..")));
// Servir archivos estáticos desde la carpeta 'public'
app.use(express.static(path.join(__dirname, "public")));
console.log("path.join: ", path.join(__dirname, "public"));

// Ruta para servir el archivo index.html
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Endpoint principal
app.post("/procesar-audio", upload.single("audio"), async (req, res) => {
  const { threadId } = req.body; // Obtener el threadId del cuerpo de la solicitud
  const webmPath = req.file?.path as string;

  const audioName = `${uuidv4()}.wav`;
  const audioPath = path.join("audios", audioName);
  console.log("audioPath: ", audioPath);
  console.log("webmPath: ", webmPath);

  try {
    const audio_wav_converted = await convertirAudioWebmAWav(
      webmPath,
      audioPath
    );

    // const audio_path_wav = await convertirAudio(audio_wav_converted, audioPath);
    const textoUsuario = await transcribirAudio({
      path_to_audio: audio_wav_converted,
    });
    console.log("🗣️ Usuario dijo:", textoUsuario);

    // Le doy al agente el audio del humano
    let config = { configurable: { thread_id: "123" } };
    const responseGraph = await workflow.invoke(
      { messages: textoUsuario },
      config
    );
    const agent_message = responseGraph.messages[
      responseGraph.messages.length - 1
    ].content as string;

    await processAudioElevenLabs(agent_message, audioPath);

    // scheduleCleanup([wavPath, mp3Path], 2 * 60 * 1000); // elimina en 2 mins

    res.send(`http://localhost:${PORT}/respuesta.mp3`);
  } catch (err) {
    console.error("❌ Error en /procesar-audio:", err);
    res.status(500).send("Error procesando audio");
  }
});

// app.get("/start-recording", async (req, res) => {
//   const {threadId} = req.body
//   try {
//     await grabarAudio()
//     await convertirAudio()
//     const transcription = await transcribirAudio()

//     // Le doy al agente el audio del humano
//     let config =  { configurable: { thread_id: threadId } }
//     const responseGraph = await workflow.invoke({messages: transcription}, config)
//     const agent_message = responseGraph.messages[responseGraph.messages.length - 1].content

//    // Pasar texto a audio

//     res.json({ transcription });
//   } catch (error) {
//      res.status(500).json({ error: 'Error al procesar el audio' });
//   }
//   res.end()
// })

// Ruta /agent
app.post("/agent", async (req, res) => {
  const { message, thread_id } = req.body;
  let config = { configurable: { thread_id: thread_id } };
  const responseGraph = await workflow.invoke({ messages: message }, config);
  console.log(responseGraph);
  console.log("longitud de mensajes: " + responseGraph.messages.length);

  res
    .status(200)
    .json(responseGraph.messages[responseGraph.messages.length - 1].content);
});

// app.post("/agent_eleven",  (req, res) => {
//   console.log("agent eleven");
//   console.log(req.body);
//   res.status(200).json({message: "Hola"});

// })

const threadLocks = new Map<string, boolean>();

app.post("/v1/chat/completions", async (req, res) => {
  const { messages, stream } = req.body;
  const last_message = messages.at(-1);
 

  

  if (last_message.role !== "user") {
    res.write(
      `event: error\ndata: ${JSON.stringify({
        message: "El último mensaje debe ser del usuario",
      })}\n\n`
    );
    res.write("data: [DONE]\n\n");
    return;
  }

  if (!stream) {
    res.status(400).json({ error: "Solo soporta stream=true" });
    return;
  }
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

    // En tu handler de /chat/completions
    req.on("close", (e) => {
      console.log("[SSE] Cliente/proxy cerró la conexión");
      console.log("[SSE] Close:", e);
      threadLocks.set(thread_id, false);
      
    });
    res.on("error", (err) => {
      console.error("[SSE] Error en el stream:", err);
    });

  const heartbeat = setInterval(() =>     res.write(`: ping\n\n`), 2000);


  const thread_id = "149";
  if (threadLocks.get(thread_id)) {
    clearInterval(heartbeat);
    // Informamos por SSE y luego cerramos
    res.write(`event: error\ndata: ${JSON.stringify({
      message: "Espera un momento, estoy procesando información",
    })}\n\n`);
    res.write("data: [DONE]\n\n");
    res.end();
    return;
  }
 

  try {
    // inyectar ToolMessages faltantes
  
     
    // const state = await workflow.getState({ configurable: { thread_id } });
    // const history = state.values.messages || [];
    // console.log("last message of BEFORE invoke: ", history.at(-1)?.content);

    // const checked = ensureToolCallsHaveResponses(history);
    // const payload = [...checked, human];

    // obtener respuesta
    console.log("Human message: ", last_message);
    
    const agentResp = await workflow.invoke(
      { messages: last_message },
      { configurable: { thread_id } }
    );

    // const afterState = await workflow.getState({ configurable: { thread_id } });
    // const afterHistory = afterState.values.messages || [];
    // console.log("last message of AFTER invoke: ", afterHistory.at(-1)?.content);

    const reply =
      agentResp.messages.at(-1)?.content || "No hay respuesta del agente";

    // construir chunk
    const id = Date.now().toString();
    const created = Math.floor(Date.now() / 1000);
    const chunk = {
      id,
      object: "chat.completion.chunk",
      created,
      model: "gpt-4-o",
      choices: [
        {
          index: 0,
          delta: { role: "assistant", content: reply },
          finish_reason: "stop",
        },
      ],
    };
    
    console.log("send a elevenlabs");
    console.dir(chunk, { depth: null, colors: true });
    
    res.write(`data: ${JSON.stringify(chunk)}\n\n`);
    res.write("data: [DONE]\n\n");
    // res.end()
    
  } catch (err) {
    res.write(
      `event: error\ndata: ${JSON.stringify({ message: err.message })}\n\n`
    );
    res.write("data: [DONE]\n\n");
    console.log("Error en /v1/chat/completions:", err);
  } finally {
    clearInterval(heartbeat);
   
    res.end();
  }
});

//   const streamingDelay = 1000; // ms entre chunks

//   async function streamWaitMessage(res, chunk) {

//     const frase =
//       "Dame un momento por favor, estoy buscando propiedades según tus preferencias... ya casi termino, solo un momento por favor";
//     const palabras = frase.split(/(\s+|(?<=\w)(?=[.,]))/); // separa palabras y puntuación

//     const id = Date.now();

//     for (const palabra of palabras) {
//       const content = palabra;

//       const chunk_custom_graph = {
//         id: id,
//         object: "chat.completion.chunk",
//         created: "",
//         model: "gpt-4-o",
//         service_tier: "default",
//         system_fingerprint: "fp_18cc0f1fa0",
//         choices: [
//           {
//             index: 0,
//             delta: {
//               content: content,
//             },
//             logprobs: null,
//             finish_reason: null,
//           },
//         ],
//       };

//       res.write(`data: ${JSON.stringify(chunk_custom_graph)}\n\n`);
//       await new Promise((r) => setTimeout(r, streamingDelay)); // simula el stream
//     }

//     res.write("data: [DONE]\n\n");

//   }
// ------------------------------------------------------------------
//     for await (const chunk of completionStream) {
//         console.log(chunk[0].invalid_tool_calls.length);

//       const { id, content } = chunk[0];
//       const { ls_model_name } = chunk[1];
//   const chunk_custom_graph = {
//     id: id,
//     object: "chat.completion.chunk",
//     created: "",
//     model: ls_model_name,
//     service_tier: "default",
//     system_fingerprint: "fp_18cc0f1fa0",
//     choices: [
//       {
//         index: 0,
//         delta: {
//           content: content,
//         },
//         logprobs: null,
//         finish_reason: null,
//       },
//     ],
//   };

//       res.write(`data: ${JSON.stringify(chunk_custom_graph)}\n\n`);
//     }

//     res.write("data: [DONE]\n\n");
//     res.end();
//   } else {
//     const completion = await openai.chat.completions.create({
//       model,
//       messages,
//       temperature,
//       max_tokens,
//       user: user_id,
//     });

//     res.json(completion);
// }

// Iniciar el servidor
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
