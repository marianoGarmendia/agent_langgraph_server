import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";
// const model = new ChatOpenAI({
//     apiKey: process.env.OPENAI_API_KEY,
//     temperature: 0,
//     model: "gpt-4o",
// })

// {
//     "marca": "FORD",
//     "modelo": "ESCAPE TITANIUM 2.0 AUT",
//     "precio_financiamiento": 19590000,
//     "precio_contado": 20590000,
//     "anio": 2022,
//     "combustible": "Gasolina",
//     "transmision": "Automática",
//     "kilometraje_kms": 60658,
//     "tag": null
//   },

const searchSchema = z.object({
   marca: z.string(),
   modelo: z.string(),
    precio_financiamiento: z.number(),
    precio_contado: z.number(),
    anio: z.number(),
    combustible: z.enum(["Gasolina", "Diesel", "Eléctrico", "Híbrido"], ).describe("Combustible del vehiculo"),
    transmision: z.string(),

    
})

// model.withStructuredOutput()

const test_flow = async () => {
    const leadToAgent = await fetch(
      "https://mq0smpw9-3000.brs.devtunnels.ms/v1/messages",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer 1234`,
        },
        body: JSON.stringify({
          nombre: "Mariano",
          apellido: "Garmendia",
          number: "5492214371684",
          message: `Hola Agustin nos nos contactamos desde IMAR para solicitarte algunos datos y avanzar para completar tu consulta `,
          campos_faltantes: [
            "Obra_social",
            "Tipo_de_tratamiento", // Ambulatorio o Internación
            "Email",
          ],
        }),
      }
    );
      console.log(leadToAgent);
      
      
  };
  
  await test_flow();