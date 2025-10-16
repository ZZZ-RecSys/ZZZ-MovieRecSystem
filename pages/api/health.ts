import type { NextApiRequest, NextApiResponse } from 'next';

import { getHealthStatus } from '../../lib/recommender';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const status = await getHealthStatus();

  if (status.status === 'error') {
    res.status(500).json(status);
    return;
  }

  if (status.status === 'initializing') {
    res.status(202).json(status);
    return;
  }

  res.status(200).json(status);
}
