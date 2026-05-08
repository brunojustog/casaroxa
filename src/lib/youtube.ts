/**
 * Extrai o ID de vídeo de uma URL do YouTube em qualquer formato comum
 * (watch?v=, youtu.be/, /shorts/, /embed/) e retorna URL pronta pra
 * ser usada em <iframe>. Retorna null se não conseguir parsear.
 */
export function youtubeEmbedUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const url = raw.trim();
  if (!url) return null;

  // youtu.be/<id>
  const shortMatch = url.match(/youtu\.be\/([a-zA-Z0-9_-]{6,})/);
  if (shortMatch) return `https://www.youtube.com/embed/${shortMatch[1]}`;

  // youtube.com/watch?v=<id>
  const watchMatch = url.match(/[?&]v=([a-zA-Z0-9_-]{6,})/);
  if (watchMatch) return `https://www.youtube.com/embed/${watchMatch[1]}`;

  // youtube.com/shorts/<id>
  const shortsMatch = url.match(/youtube\.com\/shorts\/([a-zA-Z0-9_-]{6,})/);
  if (shortsMatch) return `https://www.youtube.com/embed/${shortsMatch[1]}`;

  // youtube.com/embed/<id> — já está no formato
  const embedMatch = url.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]{6,})/);
  if (embedMatch) return `https://www.youtube.com/embed/${embedMatch[1]}`;

  // Caso mande só o ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(url)) {
    return `https://www.youtube.com/embed/${url}`;
  }

  return null;
}
