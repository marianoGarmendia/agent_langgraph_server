// import "dotenv/config";
// // import { createCua } from "@langchain/langgraph-cua";
// import { openai, UBUNTU_SYSTEM_PROMPT } from "scrapybara/openai";
// // Consume agent credits
// const model =  openai();
// // Bring your own API key
// // const model =  openai({ apiKey: process.env.OPENAI_API_KEY });

// import { ScrapybaraClient } from "scrapybara";
// import { bashTool, computerTool, editTool } from "scrapybara/tools";
// const client = new ScrapybaraClient();
// const instance = await client.startUbuntu();

// const response = await client.act({
//     model,
//   tools: [
//     bashTool(instance),
//     computerTool(instance),
//     editTool(instance),
//   ],
//   system: UBUNTU_SYSTEM_PROMPT,
//   prompt: "BUSCAME UN RESTAURANTE DE BUENAS OPINIONES EN GAVA MAR",
//   onStep: (step) => console.log(step.text),
// })

// console.log(response);
// console.log(response.output);


// console.log(response.text);
// await instance.browser.stop();
// await instance.stop();

// // const cuaGraph = createCua(
 
// //  );

// // // Define the input messages
// // const messages = [
// //   {
// //     role: "system",
// //     content:
// //       "Eres un asistente informático con IA avanzada. El navegador que estás usando " + " ya está inicializado y está visitando google.com",
// //   },
// //   {
// //     role: "user",
// //     content:
// //      "Quiero buscar restaurantes cerca de la zona de gava mar",
// //   },
// // ];

// // async function main() {
// //   // Stream the graph execution
// //   const stream = await cuaGraph.stream(
// //     { messages },
// //     {
// //       streamMode: "updates",
// //       subgraphs: true,
// //     }
// //   );

// //   // Process the stream updates
// //   for await (const update of stream) {
// //     console.log(update);
// //   }

// //   console.log("Done");
// // }

// // main().catch(console.error);