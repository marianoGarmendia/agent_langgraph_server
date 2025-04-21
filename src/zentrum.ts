import {
  AIMessage,
  BaseMessage,
  HumanMessage,
  SystemMessage,
  RemoveMessage,
  ToolMessage,
  type BaseMessageLike,
} from "@langchain/core/messages";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { ChatOpenAI } from "@langchain/openai";
import { TavilySearchResults } from "@langchain/community/tools/tavily_search";

import {
  START,
  StateGraph,
  interrupt,
  Command,
  task,
  END,
} from "@langchain/langgraph";
import {
  MemorySaver,
  Annotation,
  MessagesAnnotation,
} from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import {
  pdfTool,
  cotizacion,
  mi_cobertura,
  getPisos2,
} from "./pdf-loader_tool";
import { encode } from "gpt-3-encoder";
import { createbookingTool, getAvailabilityTool } from "./booking-cal";

import { getUniversalFaq, noticias_y_tendencias } from "./firecrawl";
import { TavilySearchAPIRetriever } from "@langchain/community/retrievers/tavily_search_api";

import { contexts } from "./contexts";
import { info, log } from "console";
import { ToolCall } from "openai/resources/beta/threads/runs/steps.mjs";

const newState = MessagesAnnotation;

const get_cars = tool(
  async ({ query }, config) => {
    const tavilySearch = new TavilySearchResults({
      apiKey: process.env.TAVILY_API_KEY,
     

      maxResults: 5,
    });

    const prompt = `Busca en algun sitio web lo siguiente: query: ${query}. `;
    try {
      const response = await tavilySearch.invoke(prompt);
      log("response: ", response);
      return response;
    } catch (error) {
      console.error("Error al buscar en el sitio web:", error);
      throw new Error("Error al buscar en el sitio web de zentrum");
    }
  },
  {
    name: "Catalogo_de_Vehiculos",
    description: `Accede a la pagina web de datos actualizada de vehículos disponibles en Seminuevos Zentrum, incluyendo detalles como marca, modelo, año, kilometraje, precio y características específicas.`,
    schema: z.object({
      query: z.string(),
    }),
  }
);

const simulacion_de_credito = tool(
  async ({ valor_vehiculo, monto_a_financiar, cuotas }, config) => {
    const model = new ChatOpenAI({
      model: "gpt-4o-mini",
      streaming: true,
      apiKey: process.env.OPENAI_API_KEY,
      temperature: 0,
    });

    const prompt = `Simula un credito para un auto de ${valor_vehiculo} con un monto a financiar de ${monto_a_financiar} y ${cuotas} cuotas.`;
    try {
      const response = await model.invoke(prompt);
      return response.content as string;
    } catch (error) {
      console.error("Error al simular el credito:", error);
      throw new Error("Error al simular el credito");
    }
  },
  {
    name: "Simulador_de_Credito",
    description: `Ofrece a los clientes la posibilidad de simular opciones de financiamiento, calculando cuotas mensuales estimadas según el monto a financiar, número de cuotas y tasa de interés referencial.`,
    schema: z.object({
      valor_vehiculo: z.string(),
      monto_a_financiar: z.string(),
      cuotas: z.string(),
    }),
  }
);

const tools = [
  get_cars,
  simulacion_de_credito,
  getAvailabilityTool,
  createbookingTool,
];

export const model = new ChatOpenAI({
  model: "gpt-4o",
  streaming: true,
  apiKey: process.env.OPENAI_API_KEY,
  temperature: 0,
}).bindTools(tools);

const toolNode = new ToolNode(tools);

async function callModel(state: typeof newState.State, config: any) {
  const { messages } = state;
  const threadId = config.configurable?.thread_id;
  console.log("Thread ID:", threadId);

  // console.log("sumary agent en callModel");
  // console.log("-----------------------");
  // console.log(summary);

  const systemsMessage = new SystemMessage(
    `   
     🎯 System Prompt: Agente de Ventas de Vehículos Seminuevos
Eres un agente virtual especializado en vehículos seminuevos de marcas como Audi, Volkswagen, Skoda, entre otras. Tu objetivo es asistir a los usuarios en la búsqueda, simulación de crédito, pruebas de manejo y cotización de sus vehículos.

🧰 Herramientas Disponibles
get_cars

Descripción: Accede al catálogo actualizado de vehículos disponibles, incluyendo marca, modelo, año, precio y kilometraje. y le muestra al ususario opciones

Cuándo usar: Cuando el cliente solicita ver autos disponibles o tiene preferencias específicas.

simulacion_de_credito

Descripción: Calcula cuotas mensuales estimadas en base al valor del vehículo, monto a financiar y cantidad de cuotas.

Cuándo usar: Cuando el cliente desea financiar un vehículo.

getAvailabilityTool

Descripción: Consulta disponibilidad para agendar una prueba de manejo o una visita para cotizar el vehículo del cliente.

Cuándo usar: Siempre antes de intentar agendar una visita o prueba de manejo.

createbookingTool

Descripción: Agenda una cita (prueba de manejo o visita para cotización) en el horario disponible seleccionado.

Cuándo usar: Una vez que se confirma la disponibilidad con getAvailabilityTool.

👋 Inicio de Conversación
Saluda de forma amigable, ofrece ayuda y explica brevemente que puedes:

Mostrar opciones de vehículos seminuevos.

Simular opciones de crédito.

Coordinar pruebas de manejo.

Agendar una visita para cotizar su vehículo.

📌 Procedimiento para Simular Crédito
Pregunta por:

Valor del vehículo

Monto a financiar

Número de cuotas

Usa simulacion_de_credito con esos datos.

Devuelve:

Cuota mensual estimada

Condiciones adicionales (si aplica)

💬 Ejemplo:

Cliente: "Quiero financiar un vehículo de $15,000,000 en 36 cuotas."

Agente: "Perfecto. ¿Desea financiar el total o una parte? Con eso puedo estimar su cuota mensual."

🧪 Procedimiento para Prueba de Manejo
Pregunta si desea coordinar una prueba de manejo.

Usa getAvailabilityTool para consultar días y franjas horarias disponibles.

Una vez confirmada la disponibilidad, utiliza createbookingTool para reservar.

💬 Ejemplo:

Cliente: "Me gustaría probar el Audi Q5 antes de comprarlo."

Agente: "Genial, ¿qué día y franja horaria le gustaría? Voy a verificar disponibilidad."

💸 Procedimiento para Cotizar el Auto del Cliente
Si el cliente quiere cotizar su vehículo, preguntá por día y franja horaria para coordinar una visita de un asesor.

Usa getAvailabilityTool para consultar disponibilidad.

Una vez confirmada, agenda la cita con createbookingTool.

💬 Ejemplo:

Cliente: "Quiero saber cuánto me dan por mi auto actual."

Agente: "Podemos agendar una visita para que un asesor lo evalúe. ¿Qué día y franja horaria le resulta más cómodo?"



🕐 Contexto Actual
Hoy es ${new Date().toLocaleDateString("es-ES")} a las ${new Date().toLocaleTimeString("es-ES")}


    `
  );

  const response = await model.invoke([systemsMessage, ...messages]);
  console.log("call model");

  //   console.log("response: ", response);

  console.log("state en call model", state);

  const cadenaJSON = JSON.stringify(messages);
  // Tokeniza la cadena y cuenta los tokens
  const tokens = encode(cadenaJSON);
  const numeroDeTokens = tokens.length;

  console.log(`Número de tokens: ${numeroDeTokens}`);

  return { messages: [...messages, response] };

  // console.log(messages, response);

  // We return a list, because this will get added to the existing list
}

function shouldContinue(state: typeof newState.State) {
  const { messages } = state;

  const lastMessage = messages[messages.length - 1] as AIMessage;
  // If the LLM makes a tool call, then we route to the "tools" node
  if (lastMessage?.tool_calls?.length) {
    return "tools";
  } else {
    return END;
  }

  // Otherwise, we stop (reply to the user)
}

const toolNodo = async (state: typeof newState.State) => {
  const { messages } = state;

  const lastMessage = messages[messages.length - 1] as AIMessage;
  console.log("toolNodo");
  console.log("-----------------------");
  console.log(lastMessage);
  console.log(lastMessage?.tool_calls);

  let toolMessage: BaseMessageLike = "un tool message" as BaseMessageLike;
  if (lastMessage?.tool_calls?.length) {
    const toolName = lastMessage.tool_calls[0].name;
    const toolArgs = lastMessage.tool_calls[0].args as {
      habitaciones: string | null;
      precio_aproximado: string;
      zona: string;
      superficie_total: string | null;
      piscina: "si" | "no" | null;
      tipo_operacion: "venta" | "alquiler";
    } & { query: string } & { startTime: string; endTime: string } & {
      name: string;
      start: string;
      email: string;
    };
    let tool_call_id = lastMessage.tool_calls[0].id as string;

    if (toolName === "Obtener_pisos_en_venta_dos") {
      const response = await getPisos2.invoke(toolArgs);
      if (typeof response !== "string") {
        toolMessage = new ToolMessage(
          "Hubo un problema al consultar las propiedades intentemoslo nuevamente",
          tool_call_id,
          "Obtener_pisos_en_venta_dos"
        );
      } else {
        toolMessage = new ToolMessage(
          response,
          tool_call_id,
          "Obtener_pisos_en_venta_dos"
        );
      }
    } else if (toolName === "universal_info_2025") {
      const res = await pdfTool.invoke(toolArgs);
      toolMessage = new ToolMessage(res, tool_call_id, "universal_info_2025");
    } else if (toolName === "get_availability_Tool") {
      const res = await getAvailabilityTool.invoke(toolArgs);
      toolMessage = new ToolMessage(res, tool_call_id, "get_availability_Tool");
    } else if (toolName === "create_booking_tool") {
      const res = await createbookingTool.invoke(toolArgs);
      toolMessage = new ToolMessage(res, tool_call_id, "create_booking_tool");
    }
  } else {
    return { messages };
  }
  // tools.forEach((tool) => {
  //   if (tool.name === toolName) {
  //     tool.invoke(lastMessage?.tool_calls?[0]['args']);
  //   }
  // });
  // console.log("toolMessage: ", toolMessage);

  return { messages: [...messages, toolMessage] };
};

// const delete_messages = async (state: typeof newState.State) => {
//   const { messages, summary } = state;
//   console.log("delete_messages");
//   console.log("-----------------------");

//   console.log(messages);

//   let summary_text = "";

//   let messages_parsed: any[] = [];
//   messages_parsed = messages.map((message) => {
//     if (message instanceof AIMessage) {
//       return {
//         ...messages_parsed,
//         role: "assistant",
//         content: message.content,
//       };
//     }
//     if (message instanceof HumanMessage) {
//       return { ...messages_parsed, role: "Human", content: message.content };
//     }
//   });

//   // 1. Filtrar elementos undefined
//   const filteredMessages = messages_parsed.filter(
//     (message) => message !== undefined
//   );

//   // 2. Formatear cada objeto
//   const formattedMessages = filteredMessages.map(
//     (message) => `${message.role}: ${message.content}`
//   );

//   // 3. Unir las cadenas con un salto de línea
//   const prompt_to_messages = formattedMessages.join("\n");

//   if (messages.length > 3) {
//     if (!summary) {
//       const intructions_summary = `Como asistente de inteligencia artificial, tu tarea es resumir los siguientes mensajes para mantener el contexto de la conversación. Por favor, analiza cada mensaje y elabora un resumen conciso que capture la esencia de la información proporcionada, asegurándote de preservar el flujo y coherencia del diálogo
//         mensajes: ${prompt_to_messages}
//         `;

//       const summary_message = await model.invoke(intructions_summary);
//       summary_text = summary_message.content as string;
//     } else {
//       const instructions_with_summary = `"Como asistente de inteligencia artificial, tu tarea es resumir los siguientes mensajes para mantener el contexto de la conversación y además tener en cuenta el resumen previo de dicha conversación. Por favor, analiza cada mensaje y el resumen y elabora un nuevo resumen conciso que capture la esencia de la información proporcionada, asegurándote de preservar el flujo y coherencia del diálogo.

//       mensajes: ${prompt_to_messages}

//       resumen previo: ${summary}

//       `;

//       const summary_message = await model.invoke(instructions_with_summary);

//       summary_text = summary_message.content as string;
//     }

//     return {
//       messages: [
//         ...messages.slice(0, -3).map((message) => {
//           return new RemoveMessage({ id: message.id as string });
//         }),
//       ],
//       summary: summary_text,
//     };
//   }
//   return { messages };
// };

const graph = new StateGraph(newState);

graph
  .addNode("agent", callModel)
  .addNode("tools", toolNode)
  .addEdge("__start__", "agent")
  .addConditionalEdges("agent", shouldContinue)
  .addEdge("tools", "agent");

// .addEdge("agent", "delete_messages")
// .addEdge("delete_messages", "__end__")

const checkpointer = new MemorySaver();

export const workflow = graph.compile({ checkpointer });
// let config = { configurable: { thread_id: "123" } };

// const response = await workflow.invoke({messages:"dame las noticias ams relevantes de este 2025"}, config)

// console.log("response: ", response);

// const response =  workflow.streamEvents({messages: [new HumanMessage("Hola como estas? ")]}, {configurable: {thread_id: "1563"} , version: "v2" });
// console.log("-----------------------");
// console.log("response: ", response);

// await workflow.stream({messages: [new HumanMessage("Podes consultar mi cobertura?")]}, {configurable: {thread_id: "1563"} , streamMode: "messages" });

// console.log("-----------------------");

// await workflow.stream({messages: [new HumanMessage("Mi dni es 32999482, tipo dni")]}, {configurable: {thread_id: "1563"} , streamMode: "messages" });

// for await (const message of response) {

//   // console.log(message);
//   // console.log(message.content);
//   // console.log(message.tool_calls);

//   console.dir({
//     event: message.event,
//     messages: message.data,

//   },{
//     depth: 3,
//   });
// }

// for await (const message of response) {
//   // console.log(message);

//   console.dir(message, {depth: null});
// }

// await workflow.stream(new Command({resume: true}));

// Implementacion langgraph studio sin checkpointer
// export const workflow = graph.compile();

// MODIFICAR EL TEMA DE HORARIOS
// En el calendar de cal esta configurado el horario de bs.as.
// El agente detecta 3hs mas tarde de lo que es en realidad es.
// Ejemplo: si el agente detecta 16hs, en realidad es 13hs.
// Para solucionar este problema, se debe modificar el horario de la herramienta "create_booking_tool".
// En la herramienta "create_booking_tool" se debe modificar el horario de la variable "start".
// En la variable "start" se debe modificar la hora de la reserva.
