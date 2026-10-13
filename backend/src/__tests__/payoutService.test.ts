import { calculatePayout, calculatePayoutDelta, detectViewSpike } from '../services/payoutService';
import { IMilestone } from '../models/Campaign';

describe('calculatePayout', () => {
  const milestones: IMilestone[] = [
    { viewThreshold: 10_000, payout: 500 },
    { viewThreshold: 50_000, payout: 2_000 },
    { viewThreshold: 100_000, payout: 5_000 },
  ];

  it('returns 0 when no milestones are crossed', () => {
    expect(calculatePayout(5_000, milestones)).toBe(0);
    expect(calculatePayout(0, milestones)).toBe(0);
    expect(calculatePayout(9_999, milestones)).toBe(0);
  });

  it('returns the payout for the first milestone when exactly at threshold', () => {
    expect(calculatePayout(10_000, milestones)).toBe(500);
  });

  it('returns the payout for the first milestone when above threshold but below next', () => {
    expect(calculatePayout(20_000, milestones)).toBe(500);
    expect(calculatePayout(49_999, milestones)).toBe(500);
  });

  it('returns the highest milestone payout when multiple milestones crossed at once', () => {
    expect(calculatePayout(50_000, milestones)).toBe(2_000);
    expect(calculatePayout(75_000, milestones)).toBe(2_000);
    expect(calculatePayout(100_000, milestones)).toBe(5_000);
    expect(calculatePayout(1_000_000, milestones)).toBe(5_000);
  });

  it('returns 0 when milestones array is empty', () => {
    expect(calculatePayout(100_000, [])).toBe(0);
  });

  it('handles a single milestone correctly', () => {
    const single: IMilestone[] = [{ viewThreshold: 10_000, payout: 1_000 }];
    expect(calculatePayout(5_000, single)).toBe(0);
    expect(calculatePayout(10_000, single)).toBe(1_000);
    expect(calculatePayout(50_000, single)).toBe(1_000);
  });

  it('handles unsorted milestones correctly', () => {
    const unsorted: IMilestone[] = [
      { viewThreshold: 100_000, payout: 5_000 },
      { viewThreshold: 10_000, payout: 500 },
      { viewThreshold: 50_000, payout: 2_000 },
    ];
    expect(calculatePayout(60_000, unsorted)).toBe(2_000);
    expect(calculatePayout(150_000, unsorted)).toBe(5_000);
  });
});

describe('calculatePayoutDelta', () => {
  const milestones: IMilestone[] = [
    { viewThreshold: 10_000, payout: 500 },
    { viewThreshold: 50_000, payout: 2_000 },
    { viewThreshold: 100_000, payout: 5_000 },
  ];

  it('returns the full payout delta when upgrading from 0', () => {
    // Going from 0 → 10K views: delta = 500 - 0 = 500
    expect(calculatePayoutDelta(0, 10_000, milestones, 10_000)).toBe(500);
  });

  it('returns incremental delta when moving between milestones', () => {
    // Already paid 500 (10K milestone), now at 50K: delta = 2000 - 500 = 1500
    expect(calculatePayoutDelta(500, 50_000, milestones, 10_000)).toBe(1_500);
  });

  it('returns 0 when view count decreases or stays in same milestone', () => {
    // Already paid 500, still in same tier at 15K: delta = 500 - 500 = 0
    expect(calculatePayoutDelta(500, 15_000, milestones, 10_000)).toBe(0);
  });

  it('returns 0 when view count drops below a milestone (no negative payouts)', () => {
    // Already paid 500, now views dropped to 5K: delta = max(0, 0 - 500) = 0
    expect(calculatePayoutDelta(500, 5_000, milestones, 10_000)).toBe(0);
  });

  it('caps payout delta to remaining budget', () => {
    // Already paid 0, crossing 100K milestone (5000 due), but only 3000 budget remains
    expect(calculatePayoutDelta(0, 100_000, milestones, 3_000)).toBe(3_000);
  });

  it('returns 0 when budget is exhausted', () => {
    expect(calculatePayoutDelta(0, 100_000, milestones, 0)).toBe(0);
  });

  it('prevents double-pay on repeated view updates at same count', () => {
    // Update 1: 0 → 50K, paid 2000
    const delta1 = calculatePayoutDelta(0, 50_000, milestones, 10_000);
    expect(delta1).toBe(2_000);

    // Update 2: same 50K views again, no additional payout
    const delta2 = calculatePayoutDelta(2_000, 50_000, milestones, 8_000);
    expect(delta2).toBe(0);
  });

  it('handles budget cap mid-payout correctly', () => {
    // Campaign has ₹1000 remaining, milestone crossed gives ₹2000 → cap to ₹1000
    expect(calculatePayoutDelta(0, 50_000, milestones, 1_000)).toBe(1_000);
  });
});

describe('detectViewSpike', () => {
  it('returns false when history is empty', () => {
    expect(detectViewSpike(100_000, [])).toBe(false);
  });

  it('returns false when growth is gradual (under threshold)', () => {
    const now = new Date();
    const thirtyMinsAgo = new Date(now.getTime() - 30 * 60 * 1000);
    const history = [{ viewCount: 50_000, recordedAt: thirtyMinsAgo }];
    // 50K → 60K: 20% growth, absolute increase 10K — not a spike (not > 100% AND not > 10K)
    expect(detectViewSpike(60_000, history)).toBe(false);
  });

  it('flags a spike when views more than double within an hour with large absolute jump', () => {
    const now = new Date();
    const thirtyMinsAgo = new Date(now.getTime() - 30 * 60 * 1000);
    const history = [{ viewCount: 5_000, recordedAt: thirtyMinsAgo }];
    // 5K → 50K: 900% growth, absolute increase 45K → SPIKE
    expect(detectViewSpike(50_000, history)).toBe(true);
  });

  it('does not flag if absolute increase is small even if growth rate is high', () => {
    const now = new Date();
    const thirtyMinsAgo = new Date(now.getTime() - 30 * 60 * 1000);
    const history = [{ viewCount: 100, recordedAt: thirtyMinsAgo }];
    // 100 → 5000: 4900% growth, but absolute increase only 4900 (< 10K) → NOT a spike
    expect(detectViewSpike(5_000, history)).toBe(false);
  });

  it('ignores history older than 1 hour', () => {
    const now = new Date();
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    const history = [{ viewCount: 1_000, recordedAt: twoHoursAgo }];
    // History is too old, so no comparison — no spike
    expect(detectViewSpike(1_000_000, history)).toBe(false);
  });
});
