/**
 * Gera slug de URL a partir de um nome: "Coxa e Sobrecoxa — 4 un." →
 * "coxa-e-sobrecoxa-4-un". Sem acentos, minúsculas, hífens.
 */
export function slugify(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}
