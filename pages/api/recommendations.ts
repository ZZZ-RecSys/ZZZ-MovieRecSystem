import type { NextApiRequest, NextApiResponse } from 'next';

import { recommendMovies } from '../../lib/recommender';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const seed = typeof req.query.seed === 'string' ? req.query.seed : '';

  try {
    const payload = await recommendMovies(seed);
    res.status(200).json(payload);
  } catch (error) {
    console.error('Failed to produce recommendations', error);
    res.status(500).json({ error: 'Unable to generate recommendations at this time.' });
  }
}
