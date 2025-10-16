import { useEffect, useMemo, useRef, useState } from 'react';

import type { Recommendation } from '../lib/recommender';

const GAP = 20;

interface RecommendationCarouselProps {
  recommendations: Recommendation[];
}

const determineVisibleCount = (width: number): number => {
  if (width >= 1280) {
    return 4;
  }
  if (width >= 980) {
    return 3;
  }
  if (width >= 680) {
    return 2;
  }
  return 1;
};

export default function RecommendationCarousel({ recommendations }: RecommendationCarouselProps) {
  const windowRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState<number>(1);
  const [cardWidth, setCardWidth] = useState<number>(0);
  const [currentIndex, setCurrentIndex] = useState<number>(0);

  useEffect(() => {
    const updateLayout = () => {
      if (typeof window === 'undefined') {
        return;
      }

      const containerWidth = windowRef.current?.clientWidth ?? window.innerWidth;
      const nextVisible = determineVisibleCount(containerWidth);
      const effectiveVisible = Math.max(1, Math.min(nextVisible, recommendations.length || 1));
      const width = windowRef.current?.clientWidth ?? containerWidth;
      const computedCardWidth = Math.max(220, (width - GAP * (effectiveVisible - 1)) / effectiveVisible);

      setVisibleCount(effectiveVisible);
      setCardWidth(computedCardWidth);

      const maxIndex = Math.max(0, recommendations.length - effectiveVisible);
      setCurrentIndex((previous) => Math.min(previous, maxIndex));
    };

    updateLayout();

    if (typeof window !== 'undefined') {
      window.addEventListener('resize', updateLayout);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('resize', updateLayout);
      }
    };
  }, [recommendations]);

  useEffect(() => {
    if (!trackRef.current) {
      return;
    }
    trackRef.current.scrollLeft = 0;
    setCurrentIndex(0);
  }, [recommendations]);

  const maxIndex = useMemo(() => Math.max(0, recommendations.length - visibleCount), [
    recommendations.length,
    visibleCount,
  ]);

  const offset = useMemo(() => (cardWidth + GAP) * currentIndex, [cardWidth, currentIndex]);

  const canGoBack = currentIndex > 0;
  const canGoForward = recommendations.length > 0 && currentIndex < maxIndex;

  const move = (direction: -1 | 1) => {
    if (!trackRef.current) {
      return;
    }

    const nextIndex = direction === -1 ? Math.max(0, currentIndex - visibleCount) : Math.min(maxIndex, currentIndex + visibleCount);
    setCurrentIndex(nextIndex);
  };

  useEffect(() => {
    if (!trackRef.current) {
      return;
    }
    trackRef.current.style.transform = `translateX(-${offset}px)`;
  }, [offset]);

  const cardStyle = useMemo(() => ({ width: cardWidth ? `${cardWidth}px` : undefined }), [cardWidth]);

  return (
    <div className="carousel">
      <button
        type="button"
        className="carousel-button"
        onClick={() => move(-1)}
        disabled={!canGoBack}
        aria-label="Show previous recommendations"
      >
        ‹
      </button>
      <div className="carousel-window" ref={windowRef}>
        <div className="carousel-track" ref={trackRef}>
          {recommendations.map((recommendation) => (
            <article className="movie-card" style={cardStyle} key={recommendation.title}>
              <div className="poster-wrapper">
                {recommendation.poster ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={recommendation.poster} alt={recommendation.title} loading="lazy" />
                ) : (
                  <div className="poster-placeholder" aria-hidden="true">
                    <span>{recommendation.title.slice(0, 1)}</span>
                  </div>
                )}
              </div>
              <div className="movie-details">
                <h3 className="movie-title">{recommendation.title}</h3>
                <p className="movie-meta">
                  {recommendation.genre}
                  {recommendation.year ? ` · ${recommendation.year}` : ''}
                </p>
                <p className="movie-insight">{recommendation.insights}</p>
                <p className="movie-score">Match score: {(recommendation.score * 100).toFixed(1)}%</p>
                <p className="movie-plot">{recommendation.plot}</p>
              </div>
            </article>
          ))}
          {!recommendations.length && <div className="empty-state">No recommendations yet.</div>}
        </div>
      </div>
      <button
        type="button"
        className="carousel-button"
        onClick={() => move(1)}
        disabled={!canGoForward}
        aria-label="Show more recommendations"
      >
        ›
      </button>
    </div>
  );
}
