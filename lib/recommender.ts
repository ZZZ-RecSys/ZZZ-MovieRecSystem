import rawMovies from '../data/sample-movies.json';

export interface RawMovie {
  title: string;
  plot: string;
  genre: string;
  year: number | null;
  poster?: string;
}

interface EnrichedMovie extends RawMovie {
  genreList: string[];
  yearValue: number | null;
}

interface MovieRecord extends EnrichedMovie {
  vector: Float32Array;
  norm: number;
  normalizedYear: number;
}

export interface Recommendation {
  title: string;
  plot: string;
  genre: string;
  year: number | null;
  poster?: string;
  score: number;
  insights: string;
}

export interface RecommendationPayload {
  seed: string;
  referenceTitle: string | null;
  recommendations: Recommendation[];
  profile: {
    genres: string[];
    year: number | null;
  };
}

interface MoviesSummaryEntry {
  title: string;
  genre: string;
  year: number | null;
}

interface RecommenderState {
  projectionMatrix: Float32Array;
  latentDim: number;
  movieRecords: MovieRecord[];
  moviesSummary: MoviesSummaryEntry[];
  defaultSeed: string;
  titleIndex: Map<string, MovieRecord>;
}

const METADATA_WEIGHT = 0.35;

const tokenize = (text: string): string[] =>
  (text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

const parseGenres = (genreString: string | null | undefined): string[] =>
  (genreString || '')
    .split(',')
    .map((genre) => genre.trim())
    .filter(Boolean);

const enrichedMovies: EnrichedMovie[] = (rawMovies as RawMovie[]).map((movie) => {
  const genreList = parseGenres(movie.genre);
  const yearNumber = Number(movie.year);
  return {
    ...movie,
    genreList,
    yearValue: Number.isFinite(yearNumber) ? yearNumber : null,
  };
});

const uniqueGenres = new Set<string>();
const numericYears: number[] = [];

enrichedMovies.forEach((movie) => {
  movie.genreList.forEach((genre) => uniqueGenres.add(genre));
  if (Number.isFinite(movie.yearValue)) {
    numericYears.push(movie.yearValue as number);
  }
});

const genres = Array.from(uniqueGenres).sort((a, b) => a.localeCompare(b));
const genreIndex = new Map<string, number>(genres.map((genre, index) => [genre, index]));

const minYear = numericYears.length ? Math.min(...numericYears) : null;
const maxYear = numericYears.length ? Math.max(...numericYears) : null;
const yearRange =
  Number.isFinite(minYear) && Number.isFinite(maxYear) && maxYear !== minYear ? (maxYear! - minYear!) : 1;
const averageYear = numericYears.length
  ? numericYears.reduce((total, value) => total + value, 0) / numericYears.length
  : null;
const normalizedAverageYear =
  Number.isFinite(averageYear) && Number.isFinite(minYear)
    ? ((averageYear as number) - (minYear as number)) / yearRange
    : 0.5;

const metadataLength = genres.length + 1;

const createGenreKeywordList = (genre: string): string[] => {
  const lower = genre.toLowerCase();
  const variations = new Set<string>([
    lower,
    lower.replace(/-/g, ' '),
    lower.replace(/&/g, ' and '),
    lower.replace(/\//g, ' '),
    lower.replace(/\s+/g, ' '),
  ]);

  if (lower.includes('science fiction')) {
    variations.add('sci fi');
    variations.add('sci-fi');
    variations.add('scifi');
  }

  if (lower.includes('romance')) {
    variations.add('romantic');
  }

  if (lower.includes('thriller')) {
    variations.add('suspense');
  }

  if (lower.includes('comedy')) {
    variations.add('funny');
    variations.add('humor');
  }

  if (lower.includes('horror')) {
    variations.add('scary');
  }

  if (lower.includes('animation')) {
    variations.add('animated');
  }

  if (lower.includes('biography')) {
    variations.add('biopic');
  }

  return Array.from(variations);
};

const genreKeywordMap = new Map<string, string[]>(genres.map((genre) => [genre, createGenreKeywordList(genre)]));

const computeNormalizedYear = (year: number | null): number => {
  if (!Number.isFinite(year) || !Number.isFinite(minYear)) {
    return normalizedAverageYear;
  }

  const clampedYear = Math.min(
    Math.max(year as number, minYear as number),
    Number.isFinite(maxYear) ? (maxYear as number) : (year as number),
  );
  return (clampedYear - (minYear as number)) / yearRange;
};

const computeNorm = (vector: Float32Array): number => {
  let sum = 0;
  for (let index = 0; index < vector.length; index += 1) {
    const value = vector[index];
    sum += value * value;
  }
  return Math.sqrt(sum);
};

const combineFeatures = (latentVector: Float32Array, metadataFeatures: Float32Array): { vector: Float32Array; norm: number } => {
  const vector = new Float32Array(latentVector.length + metadataFeatures.length);
  for (let index = 0; index < latentVector.length; index += 1) {
    vector[index] = latentVector[index];
  }

  const offset = latentVector.length;
  for (let index = 0; index < metadataFeatures.length; index += 1) {
    vector[offset + index] = metadataFeatures[index] * METADATA_WEIGHT;
  }

  return {
    vector,
    norm: computeNorm(vector),
  };
};

const buildMovieMetadata = (movie: EnrichedMovie): { features: Float32Array; normalizedYear: number } => {
  const features = new Float32Array(metadataLength);

  movie.genreList.forEach((genre) => {
    const position = genreIndex.get(genre);
    if (position !== undefined) {
      features[position] = 1;
    }
  });

  const normalizedYear = computeNormalizedYear(movie.yearValue);
  features[metadataLength - 1] = normalizedYear;

  return {
    features,
    normalizedYear,
  };
};

const buildUserMetadata = (seedText: string): { features: Float32Array; activeGenres: string[]; year: number | null } => {
  const features = new Float32Array(metadataLength);
  const activeGenres: string[] = [];
  const lowercaseSeed = seedText.toLowerCase();

  genres.forEach((genre, index) => {
    const keywords = genreKeywordMap.get(genre) || [];
    if (keywords.some((keyword) => lowercaseSeed.includes(keyword))) {
      features[index] = 1;
      activeGenres.push(genre);
    }
  });

  const yearMatch = lowercaseSeed.match(/\b(19|20)\d{2}\b/);
  let inferredYear: number | null = null;

  if (yearMatch) {
    const parsedYear = Number(yearMatch[0]);
    if (Number.isFinite(parsedYear)) {
      inferredYear = parsedYear;
    }
  }

  const normalizedYear = computeNormalizedYear(inferredYear);
  features[metadataLength - 1] = normalizedYear;

  return {
    features,
    activeGenres,
    year: inferredYear,
  };
};

const buildInsights = (
  movie: MovieRecord,
  context: { activeGenres: string[]; contextYear: number | null; matchedByTitle: boolean },
): string => {
  const highlights: string[] = [];

  if (context.activeGenres?.length && movie.genreList?.length) {
    const sharedGenres = movie.genreList.filter((genre) => context.activeGenres.includes(genre));
    if (sharedGenres.length) {
      highlights.push(`Shared genres: ${sharedGenres.join(', ')}`);
    }
  }

  if (context.contextYear != null && movie.yearValue != null) {
    const difference = Math.abs(movie.yearValue - context.contextYear);
    if (difference === 0) {
      highlights.push('Released in the same year');
    } else if (difference <= 2) {
      highlights.push(`Released ${difference} year${difference === 1 ? '' : 's'} apart`);
    } else if (difference <= 5) {
      highlights.push(`Within ${difference} years of your reference`);
    }
  }

  if (!highlights.length) {
    highlights.push(
      context.matchedByTitle ? 'Semantic twin to your seed movie' : 'Semantic match to your description',
    );
  }

  return highlights.join(' • ');
};

const cosineSimilarity = (vectorA: Float32Array, normA: number, vectorB: Float32Array, normB: number): number => {
  if (!normA || !normB || vectorA.length !== vectorB.length) {
    return 0;
  }

  let dotProduct = 0;
  for (let index = 0; index < vectorA.length; index += 1) {
    dotProduct += vectorA[index] * vectorB[index];
  }

  return dotProduct / (normA * normB);
};

const multiplyMatrixVector = (
  matrix: Float32Array,
  rows: number,
  columns: number,
  vector: Float32Array,
): Float32Array => {
  const result = new Float32Array(rows);
  for (let row = 0; row < rows; row += 1) {
    let sum = 0;
    const offset = row * columns;
    for (let column = 0; column < columns; column += 1) {
      sum += matrix[offset + column] * vector[column];
    }
    result[row] = sum;
  }
  return result;
};

const multiplyTransposeVector = (
  matrix: Float32Array,
  rows: number,
  columns: number,
  vector: Float32Array,
): Float32Array => {
  const result = new Float32Array(columns);
  for (let column = 0; column < columns; column += 1) {
    let sum = 0;
    const columnOffset = column;
    for (let row = 0; row < rows; row += 1) {
      sum += matrix[row * columns + columnOffset] * vector[row];
    }
    result[column] = sum;
  }
  return result;
};

const randomUnitVector = (length: number): Float32Array => {
  const vector = new Float32Array(length);
  for (let index = 0; index < length; index += 1) {
    vector[index] = Math.random();
  }
  const norm = computeNorm(vector);
  if (!norm) {
    vector[0] = 1;
    return vector;
  }
  for (let index = 0; index < length; index += 1) {
    vector[index] /= norm;
  }
  return vector;
};

interface SVDComponent {
  u: Float32Array;
  v: Float32Array;
  sigma: number;
}

const computeTruncatedSVD = (
  matrix: Float32Array,
  rows: number,
  columns: number,
  rank: number,
  iterations = 50,
  tolerance = 1e-6,
): SVDComponent[] => {
  const effectiveRank = Math.min(rank, rows, columns);
  const residual = matrix.slice();
  const components: SVDComponent[] = [];

  for (let component = 0; component < effectiveRank; component += 1) {
    let v = randomUnitVector(columns);
    let converged = false;

    for (let iteration = 0; iteration < iterations; iteration += 1) {
      const uRaw = multiplyMatrixVector(residual, rows, columns, v);
      const uNorm = computeNorm(uRaw);
      if (!uNorm) {
        break;
      }

      const u = new Float32Array(rows);
      for (let row = 0; row < rows; row += 1) {
        u[row] = uRaw[row] / uNorm;
      }

      const vRaw = multiplyTransposeVector(residual, rows, columns, u);
      const vNorm = computeNorm(vRaw);
      if (!vNorm) {
        break;
      }

      const nextV = new Float32Array(columns);
      for (let column = 0; column < columns; column += 1) {
        nextV[column] = vRaw[column] / vNorm;
      }

      let alignment = 0;
      for (let index = 0; index < columns; index += 1) {
        alignment += nextV[index] * v[index];
      }

      v = nextV;

      if (Math.abs(1 - Math.abs(alignment)) < tolerance) {
        converged = true;
        break;
      }
    }

    const uRaw = multiplyMatrixVector(residual, rows, columns, v);
    const sigma = computeNorm(uRaw);
    if (!sigma || !Number.isFinite(sigma)) {
      break;
    }

    const u = new Float32Array(rows);
    for (let row = 0; row < rows; row += 1) {
      u[row] = uRaw[row] / sigma;
    }

    components.push({ u, v, sigma });

    for (let row = 0; row < rows; row += 1) {
      const rowOffset = row * columns;
      for (let column = 0; column < columns; column += 1) {
        residual[rowOffset + column] -= sigma * u[row] * v[column];
      }
    }

    if (!converged && sigma < tolerance) {
      break;
    }
  }

  return components;
};

const tokensByMovie = enrichedMovies.map((movie) =>
  tokenize([movie.title, movie.genre, movie.plot].filter(Boolean).join(' ')),
);

const documentFrequency = new Map<string, number>();

tokensByMovie.forEach((tokens) => {
  const uniqueTokens = new Set(tokens);
  uniqueTokens.forEach((token) => {
    documentFrequency.set(token, (documentFrequency.get(token) || 0) + 1);
  });
});

const vocabulary = Array.from(documentFrequency.keys()).sort();
const vocabIndex = new Map<string, number>(vocabulary.map((token, index) => [token, index]));
const vocabSize = vocabulary.length;
const totalDocuments = tokensByMovie.length;
const idfValues = new Float32Array(vocabSize);

vocabulary.forEach((token, index) => {
  const count = documentFrequency.get(token) || 0;
  idfValues[index] = Math.log((1 + totalDocuments) / (1 + count)) + 1;
});

const vectorizeTokens = (
  tokens: string[],
): { dense: Float32Array; entries: Array<[number, number]> } => {
  const counts = new Map<number, number>();
  tokens.forEach((token) => {
    const index = vocabIndex.get(token);
    if (index !== undefined) {
      counts.set(index, (counts.get(index) || 0) + 1);
    }
  });

  const dense = new Float32Array(vocabSize);
  const entries: Array<[number, number]> = [];

  counts.forEach((tfValue, index) => {
    const idf = idfValues[index];
    if (!idf) {
      return;
    }
    const weight = (1 + Math.log(tfValue)) * idf;
    dense[index] = weight;
    entries.push([index, weight]);
  });

  return { dense, entries };
};

const vectorizeText = (text: string) => vectorizeTokens(tokenize(text));

const projectToLatentSpace = (
  entries: Array<[number, number]>,
  projectionMatrix: Float32Array,
  latentDim: number,
): Float32Array => {
  const embedding = new Float32Array(latentDim);

  entries.forEach(([index, weight]) => {
    const base = index * latentDim;
    for (let dim = 0; dim < latentDim; dim += 1) {
      embedding[dim] += weight * projectionMatrix[base + dim];
    }
  });

  return embedding;
};

const formatMovie = (movie: MovieRecord, score: number, insights: string): Recommendation => ({
  title: movie.title,
  plot: movie.plot,
  genre: movie.genre,
  year: movie.year,
  poster: movie.poster,
  score: Number.isFinite(score) ? Number(score.toFixed(4)) : 0,
  insights,
});

let recommenderStatePromise: Promise<RecommenderState> | null = null;
let recommenderState: RecommenderState | null = null;
let initializationError: Error | null = null;

const initializeRecommender = async (): Promise<RecommenderState> => {
  if (!vocabSize) {
    return {
      projectionMatrix: new Float32Array(0),
      latentDim: 0,
      movieRecords: [],
      moviesSummary: [],
      defaultSeed: '',
      titleIndex: new Map(),
    };
  }

  const vectorizedMovies = tokensByMovie.map(vectorizeTokens);
  const movieCount = vectorizedMovies.length;

  const matrixData = new Float32Array(movieCount * vocabSize);
  vectorizedMovies.forEach(({ dense }, rowIndex) => {
    matrixData.set(dense, rowIndex * vocabSize);
  });

  const maxComponents = Math.min(32, Math.max(4, Math.min(movieCount, vocabSize)));
  const components = computeTruncatedSVD(matrixData, movieCount, vocabSize, maxComponents, 60);
  const latentDim = components.length;

  const flattenedProjection = new Float32Array(vocabSize * latentDim);
  components.forEach((component, componentIndex) => {
    const { v } = component;
    for (let column = 0; column < vocabSize; column += 1) {
      flattenedProjection[column * latentDim + componentIndex] = v[column];
    }
  });

  const movieEmbeddingArray = enrichedMovies.map((_, rowIndex) => {
    const embedding = new Float32Array(latentDim);
    for (let componentIndex = 0; componentIndex < latentDim; componentIndex += 1) {
      const { v } = components[componentIndex];
      let dotProduct = 0;
      const rowOffset = rowIndex * vocabSize;
      for (let column = 0; column < vocabSize; column += 1) {
        dotProduct += matrixData[rowOffset + column] * v[column];
      }
      embedding[componentIndex] = dotProduct;
    }
    return embedding;
  });

  const movieRecords: MovieRecord[] = enrichedMovies.map((movie, index) => {
    const latentVector = movieEmbeddingArray[index];
    const metadata = buildMovieMetadata(movie);
    const combined = combineFeatures(latentVector, metadata.features);

    return {
      ...movie,
      vector: combined.vector,
      norm: combined.norm,
      normalizedYear: metadata.normalizedYear,
    };
  });

  const titleIndex = new Map<string, MovieRecord>();
  movieRecords.forEach((movie) => {
    titleIndex.set(movie.title.toLowerCase(), movie);
  });

  const moviesSummary = movieRecords.map(({ title, genre, year }) => ({
    title,
    genre,
    year,
  }));

  return {
    projectionMatrix: flattenedProjection,
    latentDim,
    movieRecords,
    moviesSummary,
    defaultSeed: movieRecords[0]?.title || '',
    titleIndex,
  };
};

const ensureInitialized = async (): Promise<void> => {
  if (!recommenderStatePromise) {
    recommenderStatePromise = initializeRecommender()
      .then((state) => {
        recommenderState = state;
        return state;
      })
      .catch((error) => {
        initializationError = error instanceof Error ? error : new Error(String(error));
        throw initializationError;
      });
  }

  if (recommenderState) {
    return;
  }

  await recommenderStatePromise;
};

export const getMoviesSummary = async (): Promise<{ movies: MoviesSummaryEntry[]; defaultSeed: string }> => {
  await ensureInitialized();

  if (initializationError) {
    throw initializationError;
  }

  if (!recommenderState) {
    throw new Error('Recommender state unavailable');
  }

  const { moviesSummary, defaultSeed } = recommenderState;
  return { movies: moviesSummary, defaultSeed };
};

export const getHealthStatus = async (): Promise<{ status: 'ok' | 'error' | 'initializing'; message?: string }> => {
  try {
    await ensureInitialized();
  } catch (error) {
    initializationError = error instanceof Error ? error : new Error(String(error));
  }

  if (initializationError) {
    return { status: 'error', message: initializationError.message };
  }

  if (!recommenderState) {
    return { status: 'initializing' };
  }

  return { status: 'ok' };
};

export const recommendMovies = async (seedText: string): Promise<RecommendationPayload> => {
  await ensureInitialized();

  if (initializationError) {
    throw initializationError;
  }

  if (!recommenderState) {
    throw new Error('Recommender state unavailable');
  }

  const { movieRecords, titleIndex, projectionMatrix, latentDim } = recommenderState;
  const trimmedSeed = (seedText || '').trim();

  let baseMovie = trimmedSeed ? titleIndex.get(trimmedSeed.toLowerCase()) : null;
  let userVector: Float32Array | null = null;
  let userNorm: number | null = null;
  let referenceTitle: string | null = null;
  let activeGenres: string[] = [];
  let contextYear: number | null = null;
  let matchedByTitle = false;

  if (baseMovie) {
    userVector = baseMovie.vector;
    userNorm = baseMovie.norm;
    referenceTitle = baseMovie.title;
    activeGenres = baseMovie.genreList;
    contextYear = baseMovie.yearValue;
    matchedByTitle = true;
  } else if (trimmedSeed) {
    const { entries } = vectorizeText(trimmedSeed);
    if (!entries.length) {
      baseMovie = movieRecords[0] ?? null;
      if (baseMovie) {
        userVector = baseMovie.vector;
        userNorm = baseMovie.norm;
        referenceTitle = baseMovie.title;
        activeGenres = baseMovie.genreList;
        contextYear = baseMovie.yearValue;
        matchedByTitle = true;
      }
    } else {
      const latentVector = projectToLatentSpace(entries, projectionMatrix, latentDim);
      const metadata = buildUserMetadata(trimmedSeed);
      const combined = combineFeatures(latentVector, metadata.features);
      userVector = combined.vector;
      userNorm = combined.norm;
      activeGenres = metadata.activeGenres;
      contextYear = metadata.year;
    }
  } else {
    baseMovie = movieRecords[0] ?? null;
    if (baseMovie) {
      userVector = baseMovie.vector;
      userNorm = baseMovie.norm;
      referenceTitle = baseMovie.title;
      activeGenres = baseMovie.genreList;
      contextYear = baseMovie.yearValue;
      matchedByTitle = true;
    }
  }

  if (!userVector || !userNorm) {
    return {
      seed: trimmedSeed,
      referenceTitle,
      recommendations: [],
      profile: {
        genres: activeGenres,
        year: contextYear,
      },
    };
  }

  const recommendations = movieRecords
    .filter((movie) => !referenceTitle || movie.title !== referenceTitle)
    .map((movie) => {
      const score = cosineSimilarity(userVector as Float32Array, userNorm as number, movie.vector, movie.norm);
      const insights = buildInsights(movie, {
        activeGenres,
        contextYear,
        matchedByTitle,
      });
      return { movie, score, insights };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)
    .map(({ movie, score, insights }) => formatMovie(movie, score, insights));

  return {
    seed: trimmedSeed,
    referenceTitle,
    recommendations,
    profile: {
      genres: activeGenres,
      year: contextYear,
    },
  };
};
