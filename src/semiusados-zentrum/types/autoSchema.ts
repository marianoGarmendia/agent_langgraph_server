import {z} from "zod";
export const autoSchema = z.object({
    modelo: z.string().min(1, "El modelo es obligatorio").describe("Modelo del vehiculo"),
    combustible: z.enum(["Gasolina", "Diesel", "Eléctrico"]).nullable().optional(),
    transmision: z.string().nullable().optional(),
    anio: z.number().int().nullable().optional(),
    precio_contado: z.number().int().nullable().optional(),
  });

export type AutoInput = z.infer<typeof autoSchema>;

 export  type Auto = {
    modelo: string;
    anio: number;
    combustible: "Gasolina" | "Diésel" | "Eléctrico" | string;
    transmision: string;
    kilometraje_kms: number;
    precio_financiamiento: number;
    precio_contado: number;
    tag?: string | null;
   
  };
  