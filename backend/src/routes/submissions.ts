import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import mongoose from 'mongoose';
import { Submission, ISubmission } from '../models/Submission';
import { Campaign } from '../models/Campaign';
import { authenticate, AuthRequest, requireRole } from '../middleware/auth';
import { createError } from '../middleware/errorHandler';
import { calculatePayout, calculatePayoutDelta, detectViewSpike } from '../services/payoutService';

const router = Router();

// POST /api/submissions — creator submits a post to a campaign
router.post(
  '/',
  authenticate,
  requireRole('creator'),
  [
    body('campaignId').isMongoId().withMessage('Valid campaign ID is required'),
    body('postLink').trim().isURL().withMessage('Valid post URL is required'),
  ],
  async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ message: errors.array()[0].msg });
      return;
    }

    const { campaignId, postLink } = req.body;

    const campaign = await Campaign.findById(campaignId);
    if (!campaign) throw createError('Campaign not found', 404);
    if (!campaign.isActive) throw createError('Campaign is no longer active', 400);

    const submission = await Submission.create({
      campaign: campaignId,
      creator: req.user!._id,
      postLink,
    });

    res.status(201).json({ submission });
  }
);

// GET /api/submissions/my — creator views their submissions with earnings
router.get('/my', authenticate, requireRole('creator'), async (req: AuthRequest, res: Response) => {
  const submissions = await Submission.find({ creator: req.user!._id })
    .populate('campaign', 'name platform milestones totalBudget budgetSpent')
    .sort({ createdAt: -1 });

  const totalEarnings = submissions.reduce((sum, s) => sum + s.currentPayout, 0);

  res.json({ submissions, totalEarnings });
});

// PATCH /api/submissions/:id/views — update view count (no role check, simulates platform data)
// Implements atomic update with optimistic concurrency to prevent race conditions (stretch goal)
router.patch('/:id/views', async (req: Request, res: Response) => {
  const { viewCount } = req.body;

  if (typeof viewCount !== 'number' || viewCount < 0) {
    throw createError('viewCount must be a non-negative number', 400);
  }

  // Use a MongoDB session for atomic updates (prevents race conditions / overspending)
  const session = await mongoose.startSession();

  try {
    let result: { submission: ISubmission; payoutDelta: number } | null = null;

    await session.withTransaction(async () => {
      // Fetch submission with session lock
      const submission = await Submission.findById(req.params.id).session(session);
      if (!submission) throw createError('Submission not found', 404);

      // Fetch campaign with session lock
      const campaign = await Campaign.findById(submission.campaign).session(session);
      if (!campaign) throw createError('Campaign not found', 404);

      // Detect view spike (bonus feature)
      const isSpiked = detectViewSpike(viewCount, submission.viewHistory);
      if (isSpiked) {
        submission.isFlagged = true;
      }

      // Calculate incremental payout (prevents double-pay on repeated updates)
      const budgetRemaining = campaign.totalBudget - campaign.budgetSpent;
      const payoutDelta = calculatePayoutDelta(
        submission.currentPayout,
        viewCount,
        campaign.milestones,
        budgetRemaining
      );

      const newTotalPayout = submission.currentPayout + payoutDelta;

      // Update submission
      submission.viewCount = viewCount;
      submission.currentPayout = newTotalPayout;
      submission.viewHistory.push({ viewCount, recordedAt: new Date() });

      // Deactivate campaign if budget is fully exhausted
      const newBudgetSpent = campaign.budgetSpent + payoutDelta;
      if (newBudgetSpent >= campaign.totalBudget) {
        campaign.isActive = false;
      }
      campaign.budgetSpent = newBudgetSpent;

      await submission.save({ session });
      await campaign.save({ session });

      result = { submission, payoutDelta };
    });

    const r = result!;
    res.json({
      submission: r.submission,
      payoutDelta: r.payoutDelta,
      message: 'View count updated successfully',
    });
  } finally {
    await session.endSession();
  }
});

// GET /api/submissions/campaign/:campaignId — brand views all submissions for their campaign
router.get(
  '/campaign/:campaignId',
  authenticate,
  requireRole('brand'),
  async (req: AuthRequest, res: Response) => {
    const campaign = await Campaign.findById(req.params.campaignId);
    if (!campaign) throw createError('Campaign not found', 404);

    // Verify brand owns this campaign
    if (campaign.brand.toString() !== req.user!._id.toString()) {
      throw createError('Access denied', 403);
    }

    const submissions = await Submission.find({ campaign: req.params.campaignId })
      .populate('creator', 'name email')
      .sort({ currentPayout: -1 });

    res.json({ submissions });
  }
);

export default router;
