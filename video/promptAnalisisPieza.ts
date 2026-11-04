// Prompt para analizar una pieza del álbum antes de usarla en un video
// (sección "Análisis de cada pieza" del plan). Aparte de promptGuion.ts
// porque es un modelo y una tarea distinta (visión, no guionista).

export const PROMPT_ANALISIS_PIEZA = `Analiza esta imagen de un catálogo de anuncios y responde SOLO con este JSON, sin texto adicional ni backticks:
{"tiene_texto": boolean, "es_publicitaria": boolean, "fondo_limpio": boolean, "recuadro_producto": {"x": number, "y": number, "width": number, "height": number} | null}

- tiene_texto: true si hay CUALQUIER texto legible impreso o superpuesto en la imagen (precio, nombre del producto, frases, logos con texto). false si es una foto limpia del producto sin ningún texto.
- es_publicitaria: true si la imagen ya parece una pieza publicitaria armada (con tarjetas, fondos de color, textos superpuestos tipo anuncio), no una foto cruda del producto.
- fondo_limpio: true si el fondo detrás del producto es liso o simple (un solo color, estudio, superficie neutra), false si es un fondo cargado, otra escena, u otros objetos.
- recuadro_producto: el rectángulo que más ajustado rodea el producto principal, en PORCENTAJE del ancho y alto de la imagen (0 a 100, no píxeles). x,y es la esquina superior izquierda del rectángulo. Si no hay un producto claro o la imagen es solo texto/diseño, usa null.`;
