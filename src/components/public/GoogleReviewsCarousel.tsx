"use client";

import { useEffect, useState } from "react";
import { Star } from "lucide-react";

export type GoogleReviewItem = {
  id: string;
  authorName: string;
  rating: number;
  text: string;
  reviewedAtLabel: string | null;
};

/**
 * Carrossel de prova social — avaliações do Google curadas, girando em
 * loop automático (pausa quando o mouse está em cima).
 */
export function GoogleReviewsCarousel({ reviews }: { reviews: GoogleReviewItem[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused || reviews.length <= 1) return;
    const t = setInterval(() => {
      setIndex((i) => (i + 1) % reviews.length);
    }, 6000);
    return () => clearInterval(t);
  }, [paused, reviews.length]);

  if (reviews.length === 0) return null;
  const r = reviews[index];

  return (
    <section
      className="rounded-3xl border border-roxa-100 bg-gradient-to-br from-white via-roxa-50/40 to-white px-6 py-10 text-center md:px-12"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <p className="text-xs font-semibold uppercase tracking-wider text-roxa-700">
        ⭐ O que Jaú está dizendo
      </p>
      <div className="mx-auto mt-4 max-w-2xl" aria-live="polite">
        <div className="flex items-center justify-center gap-1">
          {Array.from({ length: 5 }, (_, i) => (
            <Star
              key={i}
              className={`h-5 w-5 ${
                i < r.rating ? "fill-amber-400 text-amber-400" : "text-slate-200"
              }`}
            />
          ))}
        </div>
        <blockquote className="mt-4 font-serif text-xl leading-relaxed text-slate-800 md:text-2xl">
          &ldquo;{r.text}&rdquo;
        </blockquote>
        <p className="mt-4 text-sm font-semibold text-roxa-900">
          {r.authorName}
          {r.reviewedAtLabel && (
            <span className="ml-2 font-normal text-slate-400">· {r.reviewedAtLabel}</span>
          )}
        </p>
        <p className="mt-1 text-xs text-slate-400">avaliação no Google</p>
      </div>

      {reviews.length > 1 && (
        <div className="mt-6 flex items-center justify-center gap-2">
          {reviews.map((rev, i) => (
            <button
              key={rev.id}
              type="button"
              aria-label={`Ver avaliação ${i + 1}`}
              onClick={() => setIndex(i)}
              className={`h-2 rounded-full transition-all ${
                i === index ? "w-6 bg-roxa-600" : "w-2 bg-roxa-200 hover:bg-roxa-300"
              }`}
            />
          ))}
        </div>
      )}
    </section>
  );
}
