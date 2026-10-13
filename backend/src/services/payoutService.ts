import { IMilestone } from '../models/Campaign';

/**
 * Calculate the payout for a given view count based on the campaign's milestone ladder.
 *
 * Decision: A creator earns the payout of the HIGHEST milestone they have crossed.
 * If a post crosses multiple milestones in a single update, they earn the highest one.
 * This means milestones are NOT additive — you get the tier payout, not the sum.
 *
 * Example: Milestones: [10K→₹500, 50K→₹2000, 100K→₹5000]
 * - 8K views  → ₹0    (no milestone crossed)
 * - 15K views → ₹500  (crossed 10K milestone)
 * - 60K views → ₹2000 (crossed 50K milestone, highest)
 * - 120K views→ ₹5000 (crossed 100K milestone, highest)
 *
 * @param views - Current view count of the post
 * @param milestones - Sorted array of milestone objects (sorted by viewThreshold asc)
 * @returns The payout amount for the highest milestone crossed
 */
export function calculatePayout(views: number, milestones: IMilestone[]): number {
  if (!milestones || milestones.length === 0) return 0;

  // Sort milestones by viewThreshold descending to find the highest crossed
  const sorted = [...milestones].sort((a, b) => b.viewThreshold - a.viewThreshold);

  for (const milestone of sorted) {
    if (views >= milestone.viewThreshold) {
      return milestone.payout;
    }
  }

  return 0; // No milestone crossed yet
}

/**
 * Calculate the incremental payout delta for a submission update.
 *
 * Given:
 * - previousPayout: what was already credited for this submission
 * - newViews: the updated view count
 * - milestones: the campaign's milestone ladder
 * - budgetRemaining: how much budget the campaign still has
 *
 * Decision: If a new payout is earned that is higher than what was previously credited,
 * we credit only the DIFFERENCE (delta). This prevents double-paying.
 *
 * Decision on budget cap: If the delta exceeds the remaining budget, we cap the payout
 * to whatever budget remains. The creator gets a partial payout up to the remaining budget.
 *
 * @returns The incremental payout amount to add to the campaign's budgetSpent
 */
export function calculatePayoutDelta(
  previousPayout: number,
  newViews: number,
  milestones: IMilestone[],
  budgetRemaining: number
): number {
  const newTotalPayout = calculatePayout(newViews, milestones);
  const delta = Math.max(0, newTotalPayout - previousPayout);

  // Cap to remaining budget
  return Math.min(delta, budgetRemaining);
}

/**
 * Detect if a view spike is unusual.
 *
 * A spike is flagged when the view count more than DOUBLES within 1 hour
 * AND the absolute increase exceeds 10,000 views.
 *
 * @param currentViews - The new view count being set
 * @param viewHistory - Historical (timestamp, viewCount) records
 * @returns true if the spike looks suspicious
 */
export function detectViewSpike(
  currentViews: number,
  viewHistory: { viewCount: number; recordedAt: Date }[]
): boolean {
  if (viewHistory.length === 0) return false;

  const ONE_HOUR_MS = 60 * 60 * 1000;
  const now = Date.now();

  // Find the most recent snapshot within the last hour
  const recentHistory = viewHistory.filter(
    (h) => now - new Date(h.recordedAt).getTime() <= ONE_HOUR_MS
  );

  if (recentHistory.length === 0) return false;

  // Get the oldest snapshot within the last hour (baseline)
  const oldestRecent = recentHistory.reduce((prev, curr) =>
    new Date(prev.recordedAt) < new Date(curr.recordedAt) ? prev : curr
  );

  const baselineViews = oldestRecent.viewCount;
  const absoluteIncrease = currentViews - baselineViews;
  const growthRate = baselineViews > 0 ? absoluteIncrease / baselineViews : Infinity;

  // Flag if views more than doubled AND absolute increase > 10K
  return growthRate > 1.0 && absoluteIncrease > 10_000;
}
