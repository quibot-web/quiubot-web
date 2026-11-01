import "server-only";

// Resuelve el token de PÁGINA a partir del token de usuario que ya
// guardamos en usuarios.meta_access_token -- /{page_id}/posts rechaza el
// token de usuario con la "nueva experiencia de páginas" (error 2069032),
// hace falta el access_token de /me/accounts para esa página puntual. No
// se guarda en ningún lado: se resuelve en caliente cada vez, igual que
// el instagram_user_id en /api/publicar-estrategia.
export async function resolverTokenPagina(accessTokenUsuario: string, pageId: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://graph.facebook.com/v21.0/me/accounts?fields=id,access_token&access_token=${accessTokenUsuario}`
    );
    const data = await res.json().catch(() => ({}));
    const pagina = Array.isArray(data?.data) ? data.data.find((p: any) => p?.id === pageId) : null;
    return pagina?.access_token || null;
  } catch (err) {
    console.error("Error resolviendo token de página para ADN de marca:", err);
    return null;
  }
}

export type CandidatoAdnMeta = {
  id: string;
  url: string;
  tipo: "post" | "creativo";
  creado_en: string;
};

const LIMITE_CANDIDATOS = 20;
const PAGINAS_CREATIVOS_MAX = 3; // hasta 300 creativos revisados -- de sobra para filtrar por page_id
const ANCHO_MINIATURA_META = 800; // nunca la miniatura de 64px que Meta manda por defecto

// Solo creativos de ESTA página -- la cuenta publicitaria puede ser de una
// agencia y mezclar varias marcas (object_story_spec.page_id es el filtro,
// no hay forma de pedírselo ya filtrado a Meta). image_url cuando existe
// (anuncios de imagen); si no, thumbnail_url pedido grande (sirve también
// para los anuncios de video, que no tienen image_url).
async function obtenerCreativosDePagina(
  accessTokenUsuario: string,
  adAccountId: string,
  pageId: string
): Promise<CandidatoAdnMeta[]> {
  const candidatos: CandidatoAdnMeta[] = [];
  let url: string | null =
    `https://graph.facebook.com/v21.0/${adAccountId}/adcreatives` +
    `?fields=id,created_time,image_url,thumbnail_url,object_story_spec` +
    `&thumbnail_width=${ANCHO_MINIATURA_META}&thumbnail_height=${ANCHO_MINIATURA_META}` +
    `&limit=100&access_token=${accessTokenUsuario}`;

  let paginas = 0;
  while (url && paginas < PAGINAS_CREATIVOS_MAX) {
    const res: Response = await fetch(url);
    const data: any = await res.json().catch(() => ({}));
    if (!Array.isArray(data?.data)) break;

    for (const creativo of data.data) {
      if (creativo?.object_story_spec?.page_id !== pageId) continue;
      const imagenUrl = creativo.image_url || creativo.thumbnail_url;
      if (!imagenUrl || !creativo.id || !creativo.created_time) continue;
      candidatos.push({ id: `creativo_${creativo.id}`, url: imagenUrl, tipo: "creativo", creado_en: creativo.created_time });
    }

    url = data?.paging?.next || null;
    paginas++;
  }

  return candidatos;
}

async function obtenerPostsDePagina(tokenPagina: string, pageId: string): Promise<CandidatoAdnMeta[]> {
  const res = await fetch(
    `https://graph.facebook.com/v21.0/${pageId}/posts?fields=id,full_picture,created_time&limit=25&access_token=${tokenPagina}`
  );
  const data = await res.json().catch(() => ({}));
  if (!Array.isArray(data?.data)) return [];

  return data.data
    .filter((post: any) => post?.full_picture && post?.created_time)
    .map((post: any) => ({ id: `post_${post.id}`, url: post.full_picture, tipo: "post" as const, creado_en: post.created_time }));
}

// Mezcla creativos de la cuenta publicitaria (filtrados por esta página) y
// publicaciones de la página, más recientes primero, hasta 20 en total --
// el cliente elige 3 a 5 de ahí (ver POST /api/marca-adn).
export async function obtenerCandidatosMeta(usuario: {
  metaAccessToken: string;
  metaPageId: string;
  metaAdAccountId: string | null;
}): Promise<CandidatoAdnMeta[]> {
  const tokenPagina = await resolverTokenPagina(usuario.metaAccessToken, usuario.metaPageId);

  const [creativos, posts] = await Promise.all([
    usuario.metaAdAccountId
      ? obtenerCreativosDePagina(usuario.metaAccessToken, usuario.metaAdAccountId, usuario.metaPageId).catch((err) => {
          console.error("Error obteniendo creativos de Meta para ADN de marca:", err);
          return [] as CandidatoAdnMeta[];
        })
      : Promise.resolve([] as CandidatoAdnMeta[]),
    tokenPagina
      ? obtenerPostsDePagina(tokenPagina, usuario.metaPageId).catch((err) => {
          console.error("Error obteniendo publicaciones de Meta para ADN de marca:", err);
          return [] as CandidatoAdnMeta[];
        })
      : Promise.resolve([] as CandidatoAdnMeta[]),
  ]);

  const vistos = new Set<string>();
  return [...creativos, ...posts]
    .sort((a, b) => new Date(b.creado_en).getTime() - new Date(a.creado_en).getTime())
    .filter((candidato) => {
      if (vistos.has(candidato.id)) return false;
      vistos.add(candidato.id);
      return true;
    })
    .slice(0, LIMITE_CANDIDATOS);
}

// Descarga las imágenes que el cliente eligió de Meta y las deja en el
// mismo formato que ya manda "Subir imágenes" (data URI base64) -- así
// analizar_adn_marca no necesita saber de dónde salió cada imagen.
export async function descargarImagenesComoBase64(urls: string[]): Promise<string[]> {
  return Promise.all(
    urls.map(async (url) => {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`No se pudo descargar una imagen de Meta (${res.status})`);
      const buffer = Buffer.from(await res.arrayBuffer());
      const tipo = res.headers.get("content-type") || "image/jpeg";
      return `data:${tipo};base64,${buffer.toString("base64")}`;
    })
  );
}
