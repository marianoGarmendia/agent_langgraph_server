import { autoSchema, Auto, AutoInput } from "./types/autoSchema";

export function buscarAutos(
  params: AutoInput,
  autos: Auto[]
): { auto: Auto; score: number }[] {
  const  { modelo, combustible, transmision, anio, precio_contado } = params

  const modeloInput = modelo.toLowerCase().trim().split(/\s+/);

  const autosPuntuados = autos.map((auto) => {
    let score = 0;

    // Coincidencia de modelo (parcial y no sensible a mayúsculas)
    const modeloAuto = auto.modelo.toLowerCase();
    const modeloCoincide = modeloInput.every((palabra) =>
      modeloAuto.includes(palabra)
    );
    if (modeloCoincide) score++;

    // Combustible
    if (!combustible || auto.combustible === combustible) {
      score++;
    }

    // Transmisión
    if (
      !transmision ||
      auto.transmision.toLowerCase() === transmision.toLowerCase()
    ) {
      score++;
    }

    // Año
    if (!anio || auto.anio === anio) {
      score++;
    }

    // Precio contado
    if (!precio_contado) {
      score++;
    } else {
      const rango = 0.1; // 10% de tolerancia
      const min = precio_contado * (1 - rango);
      const max = precio_contado * (1 + rango);
      if (auto.precio_contado >= min && auto.precio_contado <= max) {
        score++;
      }
    }

    return { auto, score };
  });

  // Ordenar por puntuación descendente
  return autosPuntuados.sort((a, b) => b.score - a.score);
}
