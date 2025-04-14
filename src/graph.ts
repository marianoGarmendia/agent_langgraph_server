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

import { contexts } from "./contexts";
import { log } from "console";
import { ToolCall } from "openai/resources/beta/threads/runs/steps.mjs";

export const empresa = {
  eventTypeId: contexts.clinica.eventTypeId,
  context: contexts.clinica.context,
};

// process.env.LANGCHAIN_CALLBACKS_BACKGROUND = "true";
// import * as dotenv from "dotenv";
// dotenv.config();

const tavilySearch = new TavilySearchResults({
  apiKey: process.env.TAVILY_API_KEY,
});

const tools = [getPisos2, getAvailabilityTool, createbookingTool, tavilySearch];

const stateAnnotation = MessagesAnnotation;

const newState = Annotation.Root({
  ...stateAnnotation.spec,
  summary: Annotation<string>,
});

// export const llmGroq = new ChatGroq({
//   model: "llama-3.3-70b-versatile",
//   apiKey: process.env.GROQ_API_KEY,
//   temperature: 0,
//   maxTokens: undefined,
//   maxRetries: 2,
//   // other params...
// }).bindTools(tools);

export const model = new ChatOpenAI({
  model: "gpt-4o",
  streaming: true,
  apiKey: process.env.OPENAI_API_KEY,
  temperature: 0,
}).bindTools(tools);

const toolNode = new ToolNode(tools);

async function callModel(state: typeof newState.State) {
  const { messages, summary } = state;

  // console.log("sumary agent en callModel");
  // console.log("-----------------------");
  // console.log(summary);

  const systemsMessage = new SystemMessage(
    `
   Sos el asistente de voz de la inmobiliaria María. Tu nombre es Ana , Ayudás a los usuarios a buscar propiedades, consultar servicios, agendar visitas y resolver dudas. Contás con herramientas para buscar información, pero antes de usarlas necesitás recopilar los parámetros necesarios, uno por uno.

    Tu estilo es amable, cálido y profesional. Tus respuestas son breves, claras y lo más resumidas posible, salvo que el usuario pida más detalle.

    No hagas preguntas múltiples. Siempre pedí la información paso a paso. Por ejemplo: si necesitás saber ubicación y presupuesto, preguntá primero una cosa y luego la otra.

    Evitá repetir lo que el usuario ya dijo. Escuchá con atención y respondé directo al punto.

   

 
  Nunca inventes información. Si no sabés algo, ofrecé buscarla o agendar el contacto con un asesor.

  Tu objetivo es asistir al usuario de forma eficiente, sin abrumarlo.

  ### Informacion adicional
  el dia de hoy es ${new Date()} y la hora es ${new Date().toLocaleTimeString()}
  - Los precios de los pisos siempre son en euros.
  - La disponibilidad de turnos es de lunes a viernes de 9 a 18hs.
  - La disponibilidad de turnos es de 30 minutos.

  
  
  

  - Si el usuario se muestra interesado en una propiedad luego de que le diste opciones, preguntá por su disponibilidad para agendar una visita.
  - Usá la herramienta "get_availability_Tool" para verificar horarios disponibles.
  - Finalmente, usá la herramienta "create_booking_tool" para agendar el turno de visita.

  ### Reglas estrictas
  - No agendes visitas si es por alquiler la consulta.

  - Si pregunta cerca del mar o alguna ubicacion en particular puedes consultar en la herramienta de "tavily_search" para obtener información sobre el clima, actividades y lugares de interés en esa zona. y despues ir a buscar propiedades y ver si queda cerca o no segun la consulta del usuario.


  ### Herramienta para utilizar:
  - **Obtener_pisos_en_venta_dos**. Usala exclusivamente cuando el usuario pregunte por pisos en venta.
  -****get_availability_Tool**. Usala para verificar horarios disponibles para agendar una visita.
  - **create_booking_tool**. Usala para agendar la visita a la propiedad.
  
 `
  );

  const response = await model.invoke([systemsMessage, ...messages]);

  console.log("response: ", response);

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
    } & { query: string } & { startTime: string; endTime: string; } &  { name: string; start: string; email: string; } ;
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
    }else if(toolName === "get_availability_Tool") {
      const res = await getAvailabilityTool.invoke(toolArgs);
      toolMessage = new ToolMessage(res, tool_call_id, "get_availability_Tool");
    }
    else if (toolName === "create_booking_tool") {
      const res = await createbookingTool.invoke(toolArgs);
      toolMessage = new ToolMessage(
        res,
        tool_call_id,
        "create_booking_tool"
      );
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

const delete_messages = async (state: typeof newState.State) => {
  const { messages, summary } = state;
  console.log("delete_messages");
  console.log("-----------------------");

  console.log(messages);

  let summary_text = "";

  let messages_parsed: any[] = [];
  messages_parsed = messages.map((message) => {
    if (message instanceof AIMessage) {
      return {
        ...messages_parsed,
        role: "assistant",
        content: message.content,
      };
    }
    if (message instanceof HumanMessage) {
      return { ...messages_parsed, role: "Human", content: message.content };
    }
  });

  // 1. Filtrar elementos undefined
  const filteredMessages = messages_parsed.filter(
    (message) => message !== undefined
  );

  // 2. Formatear cada objeto
  const formattedMessages = filteredMessages.map(
    (message) => `${message.role}: ${message.content}`
  );

  // 3. Unir las cadenas con un salto de línea
  const prompt_to_messages = formattedMessages.join("\n");

  if (messages.length > 3) {
    if (!summary) {
      const intructions_summary = `Como asistente de inteligencia artificial, tu tarea es resumir los siguientes mensajes para mantener el contexto de la conversación. Por favor, analiza cada mensaje y elabora un resumen conciso que capture la esencia de la información proporcionada, asegurándote de preservar el flujo y coherencia del diálogo 
        mensajes: ${prompt_to_messages}
        `;

      const summary_message = await model.invoke(intructions_summary);
      summary_text = summary_message.content as string;
    } else {
      const instructions_with_summary = `"Como asistente de inteligencia artificial, tu tarea es resumir los siguientes mensajes para mantener el contexto de la conversación y además tener en cuenta el resumen previo de dicha conversación. Por favor, analiza cada mensaje y el resumen y elabora un nuevo resumen conciso que capture la esencia de la información proporcionada, asegurándote de preservar el flujo y coherencia del diálogo.

      mensajes: ${prompt_to_messages}

      resumen previo: ${summary}
      
      `;

      const summary_message = await model.invoke(instructions_with_summary);

      summary_text = summary_message.content as string;
    }

    return {
      messages: [
        ...messages.slice(0, -3).map((message) => {
          return new RemoveMessage({ id: message.id as string });
        }),
      ],
      summary: summary_text,
    };
  }
  return { messages };
};

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
let config = { configurable: { thread_id: "123" } };

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
