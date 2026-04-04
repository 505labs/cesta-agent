"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminRouter = void 0;
const express_1 = require("express");
const config_js_1 = require("../config.js");
const index_js_1 = require("../fraud/index.js");
const supabase_js_1 = require("../db/supabase.js");
exports.adminRouter = (0, express_1.Router)();
// Simple bearer token auth for admin endpoints
function requireAdmin(req, res, next) {
    const auth = req.headers.authorization;
    if (auth !== `Bearer ${config_js_1.config.admin.secret}`) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
}
/**
 * POST /admin/ban
 * Ban a user by World ID nullifier hash.
 * Body: { nullifier_hash: string, reason?: string }
 */
exports.adminRouter.post('/ban', requireAdmin, async (req, res) => {
    const { nullifier_hash, reason } = req.body;
    if (!nullifier_hash) {
        return res.status(400).json({ error: 'nullifier_hash is required' });
    }
    try {
        const fraudCheck = (0, index_js_1.getFraudCheck)();
        await fraudCheck.ban(nullifier_hash, reason || 'Manual ban by admin');
        res.json({ success: true, message: `Banned ${nullifier_hash}` });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
/**
 * DELETE /admin/ban/:nullifierHash
 * Unban a user.
 */
exports.adminRouter.delete('/ban/:nullifierHash', requireAdmin, async (req, res) => {
    const { nullifierHash } = req.params;
    const { error } = await supabase_js_1.supabase
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
exports.adminRouter.get('/bans', requireAdmin, async (_req, res) => {
    const { data, error } = await supabase_js_1.supabase
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
exports.adminRouter.get('/issuances', requireAdmin, async (req, res) => {
    const limit = parseInt(req.query.limit || '50', 10);
    const { data, error } = await supabase_js_1.supabase
        .from('issuances')
        .select('*')
        .order('issued_at', { ascending: false })
        .limit(limit);
    if (error) {
        return res.status(500).json({ error: error.message });
    }
    res.json({ issuances: data });
});
