import { Router, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { Campaign } from '../models/Campaign';
import { authenticate, AuthRequest, requireRole } from '../middleware/auth';
import { createError } from '../middleware/errorHandler';
import { cacheGet, cacheSet, cacheDel } from '../config/redis';

const router = Router();

const CAMPAIGNS_CACHE_KEY = 'live_campaigns';
const CACHE_TTL = 60; // 60 seconds

// GET /api/campaigns — list all active campaigns (for creators to browse)
// Cached with Redis for performance
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  // Try Redis cache first
  const cached = await cacheGet(CAMPAIGNS_CACHE_KEY);
  if (cached) {
    res.json({ campaigns: JSON.parse(cached), fromCache: true });
    return;
  }

  const campaigns = await Campaign.find({ isActive: true })
    .populate('brand', 'name email')
    .sort({ createdAt: -1 });

  // Cache the result
  await cacheSet(CAMPAIGNS_CACHE_KEY, JSON.stringify(campaigns), CACHE_TTL);

  res.json({ campaigns, fromCache: false });
});

// POST /api/campaigns — brand creates a campaign
router.post(
  '/',
  authenticate,
  requireRole('brand'),
  [
    body('name').trim().notEmpty().withMessage('Campaign name is required'),
    body('platform')
      .isIn(['Instagram', 'YouTube'])
      .withMessage('Platform must be Instagram or YouTube'),
    body('totalBudget')
      .isFloat({ min: 1 })
      .withMessage('Total budget must be a positive number'),
    body('milestones')
      .isArray({ min: 1 })
      .withMessage('At least one milestone is required'),
    body('milestones.*.viewThreshold')
      .isInt({ min: 0 })
      .withMessage('Each milestone must have a valid viewThreshold'),
    body('milestones.*.payout')
      .isFloat({ min: 0 })
      .withMessage('Each milestone must have a valid payout'),
  ],
  async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ message: errors.array()[0].msg });
      return;
    }

    const { name, platform, totalBudget, milestones } = req.body;

    const campaign = await Campaign.create({
      name,
      platform,
      totalBudget,
      milestones,
      brand: req.user!._id,
    });

    // Invalidate campaign list cache
    await cacheDel(CAMPAIGNS_CACHE_KEY);

    res.status(201).json({ campaign });
  }
);

// GET /api/campaigns/brand — brand views their own campaigns with budget info
router.get('/brand', authenticate, requireRole('brand'), async (req: AuthRequest, res: Response) => {
  const campaigns = await Campaign.find({ brand: req.user!._id }).sort({ createdAt: -1 });

  const withBudget = campaigns.map((c) => ({
    ...c.toObject(),
    budgetRemaining: c.totalBudget - c.budgetSpent,
  }));

  res.json({ campaigns: withBudget });
});

// GET /api/campaigns/:id — get a single campaign
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  const campaign = await Campaign.findById(req.params.id).populate('brand', 'name email');
  if (!campaign) {
    throw createError('Campaign not found', 404);
  }
  res.json({ campaign });
});

export default router;
