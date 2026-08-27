import { useEffect, useMemo, useRef, useState } from 'react';

import type { Recommendation } from '../lib/recommender';

const GAP = 20;

interface RecommendationCarouselProps {
  recommendations: Recommendation[];
  loading?: boolean;
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

const getScoreClass = (score: number): string => {
  const percent = score * 100;
  if (percent >= 70) {
    return 'score-high';
  }
  if (percent >= 40) {
    return 'score-medium';
  }
  return 'score-normal';
};

export default function RecommendationCarousel({ recommendations, loading = false }: RecommendationCarouselProps) {
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

    const nextIndex = direction === -1 ? Math.max(0, currentIndex - 1) : Math.min(maxIndex, currentIndex + 1);
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
    <div className="carousel-wrapper">
      <div className="carousel">
        <button
          type="button"
          className="carousel-button"
          onClick={() => move(-1)}
          disabled={!canGoBack || loading}
          aria-label="Show previous recommendations"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <div className="carousel-window" ref={windowRef}>
          <div className="carousel-track" ref={trackRef}>
            {loading ? (
              Array.from({ length: visibleCount || 3 }).map((_, idx) => (
                <div className="skeleton-card" style={cardStyle} key={`skeleton-${idx}`}>
                  <div className="skeleton-shimmer skeleton-poster" />
                  <div className="skeleton-shimmer skeleton-title" />
                  <div className="skeleton-shimmer skeleton-meta" />
                  <div className="skeleton-shimmer skeleton-insight" />
                  <div className="skeleton-shimmer skeleton-plot" />
                </div>
              ))
            ) : recommendations.length > 0 ? (
              recommendations.map((recommendation, idx) => (
                <article
                  className="movie-card"
                  style={{ ...cardStyle, animationDelay: `${idx * 60}ms` }}
                  key={recommendation.title}
                >
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
                    <div className="movie-meta-row">
                      <span className="movie-genre-badge">{recommendation.genre}</span>
                      <span className={`movie-score-badge ${getScoreClass(recommendation.score)}`}>
                        ★ {(recommendation.score * 100).toFixed(0)}%
                      </span>
                    </div>
                    {recommendation.year && (
                      <span style={{ fontSize: '0.78rem', color: '#64748b' }}>Release Year: {recommendation.year}</span>
                    )}
                    <div className="movie-insight-box">
                      <p className="movie-insight">{recommendation.insights}</p>
                    </div>
                    <p className="movie-plot">{recommendation.plot}</p>
                  </div>
                </article>
              ))
            ) : (
              <div className="empty-state">
                <p>No recommendations yet.</p>
                <span style={{ fontSize: '0.85rem', color: '#64748b' }}>Try entering a seed movie or plot above!</span>
              </div>
            )}
          </div>
        </div>
        <button
          type="button"
          className="carousel-button"
          onClick={() => move(1)}
          disabled={!canGoForward || loading}
          aria-label="Show more recommendations"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>

      {!loading && recommendations.length > visibleCount && (
        <div className="pagination-dots">
          {Array.from({ length: maxIndex + 1 }).map((_, idx) => (
            <button
              key={idx}
              type="button"
              className={`dot ${idx === currentIndex ? 'active' : ''}`}
              onClick={() => setCurrentIndex(idx)}
              aria-label={`Go to slide ${idx + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
