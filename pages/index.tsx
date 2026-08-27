import Head from 'next/head';
import { FormEvent, useEffect, useMemo, useState } from 'react';

import RecommendationCarousel from '../components/RecommendationCarousel';
import type { Recommendation } from '../lib/recommender';

interface MovieSummary {
  title: string;
  genre: string;
  year: number | null;
}

interface ProfileSummary {
  genres: string[];
  year: number | null;
}

interface RecommendationResponse {
  seed: string;
  referenceTitle: string | null;
  recommendations: Recommendation[];
  profile: ProfileSummary;
}

export default function HomePage() {
  const [movies, setMovies] = useState<MovieSummary[]>([]);
  const [seed, setSeed] = useState('');
  const [defaultSeed, setDefaultSeed] = useState('');
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [profile, setProfile] = useState<ProfileSummary>({ genres: [], year: null });
  const [referenceTitle, setReferenceTitle] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    let active = true;

    const loadMovies = async () => {
      try {
        const response = await fetch('/api/movies');
        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }
        const data = await response.json();
        if (!active) {
          return;
        }
        setMovies(data.movies ?? []);
        setDefaultSeed(data.defaultSeed ?? '');
        if (data.defaultSeed) {
          setSeed(data.defaultSeed);
        }
      } catch (requestError) {
        if (!active) {
          return;
        }
        setError(requestError instanceof Error ? requestError.message : 'Failed to load movies');
      }
    };

    loadMovies();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!defaultSeed || initialized) {
      return;
    }

    const loadInitial = async () => {
      await submitRecommendation(defaultSeed, true);
      setInitialized(true);
    };

    loadInitial();
  }, [defaultSeed, initialized]);

  const submitRecommendation = async (value: string, silent = false) => {
    const query = value.trim();
    if (!query) {
      setRecommendations([]);
      setReferenceTitle(null);
      setProfile({ genres: [], year: null });
      return;
    }

    if (!silent) {
      setLoading(true);
    }
    setError(null);

    try {
      const response = await fetch(`/api/recommendations?seed=${encodeURIComponent(query)}`);
      if (!response.ok) {
        throw new Error(`Recommendation request failed (${response.status})`);
      }
      const data: RecommendationResponse = await response.json();
      setRecommendations(data.recommendations ?? []);
      setReferenceTitle(data.referenceTitle ?? null);
      setProfile(data.profile ?? { genres: [], year: null });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to load recommendations');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    submitRecommendation(seed);
  };

  const handleQuickSelect = (title: string) => {
    setSeed(title);
    submitRecommendation(title);
  };

  const genreSummary = useMemo(() => {
    if (!profile.genres?.length) {
      return 'No genre cues detected';
    }
    return `Focus genres: ${profile.genres.join(', ')}`;
  }, [profile.genres]);

  const yearSummary = useMemo(() => {
    if (!profile.year) {
      return 'No specific year inferred';
    }
    return `Year context: ${profile.year}`;
  }, [profile.year]);

  const quickSelectMovies = useMemo(() => movies.slice(0, 6), [movies]);

  return (
    <>
      <Head>
        <title>Movie Carousel Recommender — Zero-DB Latent Semantic Engine</title>
        <meta
          name="description"
          content="Explore a carousel of personalized movie recommendations powered by an in-process latent semantic model with zero external database dependencies."
        />
        <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🎬</text></svg>" />
      </Head>

      <div className="ambient-glow-1" aria-hidden="true" />
      <div className="ambient-glow-2" aria-hidden="true" />

      <header className="page-header">
        <div className="product-badge">
          <span className="sparkle">✨</span>
          <span>In-Process Latent Semantic Recommender · Zero External DB</span>
        </div>
        <h1>Movie Carousel Recommender</h1>
        <p className="tagline">
          Describe what you want to watch or pick a title you love. Our in-process SVD &amp; TF-IDF model blends plot
          semantics with genre and release-year cues to surface compelling matches in milliseconds.
        </p>
      </header>

      <main>
        <section className="controls">
          <form className="search-form" onSubmit={handleSubmit}>
            <label className="form-label" htmlFor="seed-input">
              Enter a movie title or describe your vibe
            </label>
            <div className="form-row">
              <div className="input-wrapper">
                <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  id="seed-input"
                  type="text"
                  value={seed}
                  onChange={(event) => setSeed(event.target.value)}
                  placeholder="e.g. cerebral sci-fi thriller set in space"
                  list="movie-seeds"
                  aria-describedby="seed-help"
                />
                {seed && (
                  <button
                    type="button"
                    className="clear-button"
                    onClick={() => {
                      setSeed('');
                      setRecommendations([]);
                      setReferenceTitle(null);
                      setProfile({ genres: [], year: null });
                    }}
                    aria-label="Clear search input"
                  >
                    ✕
                  </button>
                )}
              </div>
              <button className="primary-button" type="submit" disabled={loading}>
                {loading && <span className="spinner" />}
                {loading ? 'Finding matches…' : 'Recommend movies'}
              </button>
            </div>
            <div id="seed-help" className="form-help">
              <span className="form-help-label">
                {referenceTitle ? `Anchored to "${referenceTitle}". ` : 'Try these seeds:'}
              </span>
              {quickSelectMovies.map((movie) => (
                <button
                  key={movie.title}
                  type="button"
                  className="inline-chip"
                  onClick={() => handleQuickSelect(movie.title)}
                >
                  {movie.title}
                </button>
              ))}
            </div>
          </form>
        </section>

        {error && (
          <div className="error-banner">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        <section className="profile-panel">
          <div className="profile-header">
            <h2>Semantic Preference Profile</h2>
            <div className="pulse-badge">
              <span className="pulse-dot" />
              <span>LIVE HUD</span>
            </div>
          </div>
          <div className="profile-content">
            <div className="profile-row">
              <span className="profile-meta-label">Focus Genres:</span>
              {profile.genres?.length ? (
                profile.genres.map((g) => (
                  <span key={g} className="genre-tag">
                    #{g}
                  </span>
                ))
              ) : (
                <span style={{ color: '#64748b', fontSize: '0.85rem' }}>Awaiting seed query...</span>
              )}
            </div>
            <div className="profile-row">
              <span className="profile-meta-label">Temporal Context:</span>
              {profile.year ? (
                <span className="year-badge">
                  <span>📅</span>
                  <span>{profile.year}</span>
                </span>
              ) : (
                <span style={{ color: '#64748b', fontSize: '0.85rem' }}>No specific release era constraint</span>
              )}
            </div>
          </div>
        </section>

        <section className="recommendations">
          <div className="section-heading">
            <h2>Recommended for you</h2>
            <p className="section-subheading">
              {recommendations.length
                ? 'Semantic similarity ranked in latent space. Browse matches below.'
                : 'Submit a search to see tailored suggestions.'}
            </p>
          </div>
          <RecommendationCarousel recommendations={recommendations} loading={loading} />
        </section>
      </main>

      <footer className="site-footer">
        <div className="footer-links">
          <a
            href="https://github.com/ZZZ-RecSys/ZZZ-MovieRecSystem"
            target="_blank"
            rel="noreferrer"
            className="footer-link"
          >
            GitHub Repository
          </a>
          <span>·</span>
          <a
            href="https://devpost.com/software/zzz-movie-recommender"
            target="_blank"
            rel="noreferrer"
            className="footer-link"
          >
            DevPost Write-up
          </a>
          <span>·</span>
          <a
            href="https://github.com/ZZZ-RecSys/ZZZ-MovieSearch-Client"
            target="_blank"
            rel="noreferrer"
            className="footer-link"
          >
            Phase 2 Client
          </a>
        </div>
        <p style={{ margin: 0 }}>
          Originally created for Global Hack Week: AI/ML. Refactored into a zero-database standalone Next.js deployment.
        </p>
      </footer>

      <datalist id="movie-seeds">
        {movies.map((movie) => (
          <option key={movie.title} value={movie.title} />
        ))}
      </datalist>
    </>
  );
}
