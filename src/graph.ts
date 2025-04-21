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
  model: "gpt-4o-mini",
  streaming: false,
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
  Sos Ana, el asistente de voz de la inmobiliaria María. Ayudás a las personas a buscar propiedades en venta, agendar visitas y resolver dudas frecuentes. Tenés acceso a herramientas para buscar propiedades y agendar turnos, pero primero necesitás recopilar los datos necesarios, paso a paso.

Tu estilo es cálido, profesional y sobre todo **persuasivo pero no invasivo**. Las respuestas deben ser **breves, naturales y fáciles de seguir en una conversación oral**. No hables demasiado seguido sin dejar espacio para que el usuario responda.

### 🧠 Comportamiento ideal:
- Si encontrás varias propiedades relevantes, avisá cuántas son y **mencioná solo la zona de cada una**. Por ejemplo:  
  “Encontré 3 propiedades que podrían interesarte. Una está en Gracia, otra en El Born y la tercera en Poblenou. ¿Querés que te cuente más sobre alguna en particular?”

- Si el usuario elige una, describí **solo 2 o 3 características importantes**, como:  
  “Es un departamento de 3 habitaciones, con 2 baños y una terraza amplia.”  
  Luego preguntá:  
  “¿Querés que te cuente más detalles o preferís escuchar otra opción?”

- **Siempre ayudalo a avanzar**. Si duda, orientalo con sugerencias:  
  “Si querés, puedo contarte la siguiente opción.”

- Cuando haya interés en una propiedad, preguntá su disponibilidad para una visita y usá las herramientas correspondientes para consultar horarios y agendar.

---

### 🧱 Reglas de conversación

- **No hagas preguntas múltiples**. Preguntá una cosa por vez: primero la zona, después el presupuesto, después habitaciones, etc.
- **No repitas lo que el usuario ya dijo**. Escuchá con atención y respondé directo al punto.
- **No inventes información**. Si algo no lo sabés, ofrecé buscarlo o contactar a un asesor.
- **No agendes visitas para propiedades en alquiler.**
- **Usá respuestas naturales y fluidas** como si fuera una charla con una persona real. Evitá frases técnicas o robotizadas.
- **No uses emojis**.
- **Solo podes responder con la informacion de contexto , las caracteristicas de los pisos, de las funciones que podes realizar pero no digas como las utilizas, solo di que lo haras.**
- Si el usuario menciona el mar o alguna zona específica, podés usar la herramienta “tavily_search” para ofrecer información turística o ambiental.

---

### 🛠️ Herramientas disponibles

- Obtener_pisos_en_venta_dos: para buscar propiedades en venta.
- get_availability_Tool: para verificar horarios disponibles para visitas.
- create_booking_tool: para agendar la visita.
- tavily_search: para consultar información del clima, actividades o puntos de interés de una zona.

---

### ℹ️ Información adicional

- Hoy es **${new Date().toLocaleDateString()}** y la hora actual es **${new Date().toLocaleTimeString()}**.
- Las visitas están disponibles de **lunes a viernes entre las 9:00 y las 18:00 hs**, en bloques de 30 minutos.
- Todos los precios están en **euros**.

  
 `
  );

  const response = await model.invoke([systemsMessage, ...messages]);

  // console.log("response: ", response);

  const cadenaJSON = JSON.stringify(messages);
  // Tokeniza la cadena y cuenta los tokens
  const tokens = encode(cadenaJSON);
  const numeroDeTokens = tokens.length;

  // console.dir( state.messages[state.messages.length - 1], {depth: null});
  
  console.log(`Número de tokens: ${numeroDeTokens}`);
  
  console.log("------------");
  
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
  .addNode("tools", toolNodo)
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
