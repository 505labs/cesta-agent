import { Router, type Router as RouterType, Request, Response } from 'express';
import { config } from '../config.js';
import { getFraudCheck } from '../fraud/index.js';
import { supabase } from '../db/supabase.js';

export const adminRouter: RouterType = Router();

// Simple bearer token auth for admin endpoints
function requireAdmin(req: Request, res: Response, next: () => void) {
  const auth = req.headers.authorization;
  if (auth !== `Bearer ${config.admin.secret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

/**
 * POST /admin/ban
 * Ban a user by World ID nullifier hash.
 * Body: { nullifier_hash: string, reason?: string }
 */
adminRouter.post('/ban', requireAdmin, async (req: Request, res: Response) => {
  const { nullifier_hash, reason } = req.body as {
    nullifier_hash?: string;
    reason?: string;
  };

  if (!nullifier_hash) {
    return res.status(400).json({ error: 'nullifier_hash is required' });
  }

  try {
    const fraudCheck = getFraudCheck();
    await fraudCheck.ban(nullifier_hash, reason || 'Manual ban by admin');
    res.json({ success: true, message: `Banned ${nullifier_hash}` });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

/**
 * DELETE /admin/ban/:nullifierHash
 * Unban a user.
 */
adminRouter.delete('/ban/:nullifierHash', requireAdmin, async (req: Request, res: Response) => {
  const { nullifierHash } = req.params;

  const { error } = await supabase
    .from('bans')
    .delete()
    .eq('nullifier_hash', nullifierHash);

  if (error) {
    return res.status(500).json({ error: error.message });
  }
  res.json({ success: true, message: `Unbanned ${nullifierHash}` });
});

/**
 * GET /admin/bans
 * List all banned users.
 */
adminRouter.get('/bans', requireAdmin, async (_req: Request, res: Response) => {
  const { data, error } = await supabase
    .from('bans')
    .select('*')
    .order('banned_at', { ascending: false });

  if (error) {
    return res.status(500).json({ error: error.message });
  }
  res.json({ bans: data });
});

/**
 * GET /admin/issuances
 * List recent card issuances for audit.
 */
adminRouter.get('/issuances', requireAdmin, async (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string || '50', 10);

  const { data, error } = await supabase
    .from('issuances')
    .select('*')
    .order('issued_at', { ascending: false })
    .limit(limit);

  if (error) {
    return res.status(500).json({ error: error.message });
  }
  res.json({ issuances: data });
});
