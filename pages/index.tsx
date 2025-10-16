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
        <title>Movie Carousel Recommender</title>
        <meta
          name="description"
          content="Explore a carousel of personalized movie recommendations powered by a lightweight latent semantic model."
        />
      </Head>
      <header className="page-header">
        <h1>Movie Carousel Recommender</h1>
        <p className="tagline">
          Describe what you want to watch or pick a title you already love. Our lightweight embedding model blends plot
          semantics with genre and release-year cues to surface compelling matches.
        </p>
      </header>
      <main>
        <section className="controls">
          <form className="search-form" onSubmit={handleSubmit}>
            <label className="form-label" htmlFor="seed-input">
              Enter a seed movie or describe your mood
            </label>
            <div className="form-row">
              <input
                id="seed-input"
                type="text"
                value={seed}
                onChange={(event) => setSeed(event.target.value)}
                placeholder="e.g. cerebral sci-fi thriller set in space"
                list="movie-seeds"
                aria-describedby="seed-help"
              />
              <button className="primary-button" type="submit" disabled={loading}>
                {loading ? 'Finding matches…' : 'Recommend movies'}
              </button>
            </div>
            <p id="seed-help" className="form-help">
              {referenceTitle ? `Anchored to ${referenceTitle}. ` : ''}
              Suggestions:
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
            </p>
          </form>
        </section>

        {error && <div className="error-banner">{error}</div>}

        <section className="profile-panel">
          <h2>Your preference profile</h2>
          <p>{genreSummary}</p>
          <p>{yearSummary}</p>
        </section>

        <section className="recommendations">
          <div className="section-heading">
            <h2>Recommended for you</h2>
            <p className="section-subheading">
              {recommendations.length
                ? 'Use the carousel controls to explore the top semantic matches.'
                : 'Submit a search to see tailored suggestions.'}
            </p>
          </div>
          <RecommendationCarousel recommendations={recommendations} />
        </section>
      </main>
      <datalist id="movie-seeds">
        {movies.map((movie) => (
          <option key={movie.title} value={movie.title} />
        ))}
      </datalist>
    </>
  );
}
