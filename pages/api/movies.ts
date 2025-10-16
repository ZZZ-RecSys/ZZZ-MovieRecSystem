import type { NextApiRequest, NextApiResponse } from 'next';

import { getMoviesSummary } from '../../lib/recommender';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const payload = await getMoviesSummary();
    res.status(200).json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Failed to retrieve movie summary', error);
    res.status(500).json({ error: message });
  }
}
