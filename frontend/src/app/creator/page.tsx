'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import Navbar from '../../components/Navbar';
import { useAuth } from '../../context/AuthContext';
import { Campaign, Submission } from '../../types';
import api from '../../lib/api';

function formatCurrency(amount: number) {
  return `₹${amount.toLocaleString('en-IN')}`;
}

function formatViews(views: number) {
  if (views >= 1_000_000) return `${(views / 1_000_000).toFixed(1)}M`;
  if (views >= 1_000) return `${(views / 1_000).toFixed(0)}K`;
  return views.toString();
}

export default function CreatorDashboard() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [totalEarnings, setTotalEarnings] = useState(0);
  const [loadingData, setLoadingData] = useState(true);
  const [activeTab, setActiveTab] = useState<'browse' | 'earnings'>('browse');

  // Submit modal state
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [postLink, setPostLink] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    if (!isLoading && (!user || user.role !== 'creator')) {
      router.replace('/login');
    }
  }, [user, isLoading, router]);

  const fetchData = useCallback(async () => {
    if (!user) return;
    try {
      const [campaignRes, submissionRes] = await Promise.all([
        api.get('/campaigns'),
        api.get('/submissions/my'),
      ]);
      setCampaigns(campaignRes.data.campaigns);
      setSubmissions(submissionRes.data.submissions);
      setTotalEarnings(submissionRes.data.totalEarnings);
    } catch {
      toast.error('Failed to load data');
    } finally {
      setLoadingData(false);
    }
  }, [user]);

  useEffect(() => {
    if (user?.role === 'creator') {
      fetchData();
    }
  }, [user, fetchData]);

  const openSubmitModal = (campaign: Campaign) => {
    setSelectedCampaign(campaign);
    setPostLink('');
    setSubmitError('');
    setShowSubmitModal(true);
  };

  const handleSubmitPost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCampaign) return;
    setSubmitError('');
    setSubmitting(true);

    try {
      await api.post('/submissions', {
        campaignId: selectedCampaign._id,
        postLink,
      });
      toast.success('Post submitted successfully! 🎉');
      setShowSubmitModal(false);
      fetchData();
    } catch (err: any) {
      setSubmitError(err?.response?.data?.message || 'Failed to submit post');
    } finally {
      setSubmitting(false);
    }
  };

  const getSubmittedCampaignIds = () => {
    return new Set(
      submissions.map((s) =>
        typeof s.campaign === 'string' ? s.campaign : (s.campaign as Campaign)._id
      )
    );
  };

  if (isLoading || !user) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="spinner" style={{ width: 40, height: 40, borderWidth: 3 }} />
      </div>
    );
  }

  const submittedIds = getSubmittedCampaignIds();

  return (
    <div className="page-wrapper">
      <Navbar />
      <main className="main-content">
        <div className="container">
          {/* Header */}
          <div className="page-header">
            <h1 className="page-title">Creator Dashboard</h1>
            <p className="page-subtitle">Browse campaigns and track your earnings</p>
          </div>

          {/* Stats */}
          <div className="grid grid-3" style={{ marginBottom: 32 }}>
            <div className="stat-card green">
              <div className="stat-label">Total Earnings</div>
              <div className="stat-value">{formatCurrency(totalEarnings)}</div>
              <div className="stat-sub">lifetime payout</div>
            </div>
            <div className="stat-card purple">
              <div className="stat-label">Posts Submitted</div>
              <div className="stat-value">{submissions.length}</div>
              <div className="stat-sub">across all campaigns</div>
            </div>
            <div className="stat-card cyan">
              <div className="stat-label">Live Campaigns</div>
              <div className="stat-value">{campaigns.length}</div>
              <div className="stat-sub">available to join</div>
            </div>
          </div>

          {/* Tabs */}
          <div className="tabs">
            <button
              id="tab-browse"
              className={`tab-btn ${activeTab === 'browse' ? 'active' : ''}`}
              onClick={() => setActiveTab('browse')}
            >
              🔍 Browse Campaigns
            </button>
            <button
              id="tab-earnings"
              className={`tab-btn ${activeTab === 'earnings' ? 'active' : ''}`}
              onClick={() => setActiveTab('earnings')}
            >
              💰 My Earnings
            </button>
          </div>

          {loadingData ? (
            <div style={{ textAlign: 'center', padding: 60 }}>
              <div className="spinner" style={{ width: 36, height: 36, borderWidth: 3 }} />
            </div>
          ) : (
            <>
              {/* Browse campaigns */}
              {activeTab === 'browse' && (
                <>
                  {campaigns.length === 0 ? (
                    <div className="empty-state">
                      <div className="empty-state-icon">🎯</div>
                      <div className="empty-state-title">No live campaigns right now</div>
                      <div className="empty-state-desc">Check back soon — brands launch new campaigns regularly!</div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                      {campaigns.map((campaign) => {
                        const alreadySubmitted = submittedIds.has(campaign._id);
                        const brand = typeof campaign.brand === 'string' ? null : campaign.brand;
                        const budgetPct = campaign.totalBudget > 0
                          ? ((campaign.budgetSpent / campaign.totalBudget) * 100)
                          : 0;

                        return (
                          <div key={campaign._id} className="campaign-card">
                            <div className="card-header">
                              <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                                  <h3 className="card-title">{campaign.name}</h3>
                                </div>
                                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                                  <span className={`platform-badge ${campaign.platform.toLowerCase()}`}>
                                    {campaign.platform === 'Instagram' ? '📸' : '▶️'} {campaign.platform}
                                  </span>
                                  {brand && (
                                    <span className="card-subtitle">by {brand.name}</span>
                                  )}
                                </div>
                              </div>

                              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                {alreadySubmitted ? (
                                  <span className="badge active">✓ Submitted</span>
                                ) : (
                                  <button
                                    id={`submit-post-${campaign._id}`}
                                    className="btn btn-primary btn-sm"
                                    onClick={() => openSubmitModal(campaign)}
                                  >
                                    Submit Post
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Budget remaining bar */}
                            <div className="progress-bar-wrapper">
                              <div className="progress-label">
                                <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                                  Budget: {formatCurrency(campaign.totalBudget - campaign.budgetSpent)} remaining
                                </span>
                                <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                                  {(100 - budgetPct).toFixed(0)}% left
                                </span>
                              </div>
                              <div className="progress-bar-bg">
                                <div
                                  className={`progress-bar-fill ${budgetPct > 80 ? 'warning' : ''}`}
                                  style={{ width: `${Math.min(100 - budgetPct, 100)}%`, background: 'var(--gradient-success)' }}
                                />
                              </div>
                            </div>

                            {/* Milestone ladder */}
                            <div style={{ marginTop: 16 }}>
                              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                Earn Up To
                              </div>
                              <div className="milestone-ladder">
                                {[...campaign.milestones]
                                  .sort((a, b) => a.viewThreshold - b.viewThreshold)
                                  .map((m, i) => (
                                    <div key={i} className="milestone-item">
                                      <span className="milestone-views">👁 {formatViews(m.viewThreshold)} views</span>
                                      <span className="milestone-payout">{formatCurrency(m.payout)}</span>
                                    </div>
                                  ))}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}

              {/* My Earnings */}
              {activeTab === 'earnings' && (
                <>
                  {submissions.length === 0 ? (
                    <div className="empty-state">
                      <div className="empty-state-icon">💸</div>
                      <div className="empty-state-title">No submissions yet</div>
                      <div className="empty-state-desc">Submit a post to a campaign to start earning!</div>
                      <button
                        className="btn btn-primary"
                        style={{ marginTop: 20 }}
                        onClick={() => setActiveTab('browse')}
                      >
                        Browse Campaigns
                      </button>
                    </div>
                  ) : (
                    <div>
                      {/* Earnings summary */}
                      <div
                        style={{
                          background: 'linear-gradient(135deg, rgba(16,185,129,0.15) 0%, rgba(6,182,212,0.1) 100%)',
                          border: '1px solid rgba(16,185,129,0.25)',
                          borderRadius: 'var(--radius-lg)',
                          padding: '20px 24px',
                          marginBottom: 24,
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <div>
                          <div style={{ fontSize: '0.85rem', color: 'var(--accent-green)', fontWeight: 600, marginBottom: 4 }}>
                            💰 TOTAL EARNINGS
                          </div>
                          <div style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: '2rem', color: 'var(--accent-green)' }}>
                            {formatCurrency(totalEarnings)}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                          <div>{submissions.length} post{submissions.length !== 1 ? 's' : ''} submitted</div>
                          <div style={{ marginTop: 4 }}>
                            {submissions.filter((s) => s.currentPayout > 0).length} earning
                          </div>
                        </div>
                      </div>

                      {/* Submission list */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {submissions.map((sub) => {
                          const campaign = sub.campaign as Campaign;
                          return (
                            <div key={sub._id} className="submission-item">
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                  <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                                    {typeof campaign === 'object' ? campaign.name : 'Campaign'}
                                  </span>
                                  {typeof campaign === 'object' && (
                                    <span className={`platform-badge ${campaign.platform.toLowerCase()}`} style={{ fontSize: '0.65rem', padding: '2px 6px' }}>
                                      {campaign.platform}
                                    </span>
                                  )}
                                  {sub.isFlagged && (
                                    <span className="badge flagged">⚠ Flagged</span>
                                  )}
                                </div>
                                <a
                                  href={sub.postLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="submission-link"
                                >
                                  {sub.postLink}
                                </a>
                              </div>
                              <div className="submission-meta">
                                <div className="submission-views">
                                  👁 {formatViews(sub.viewCount)} views
                                </div>
                                <div className="submission-payout">
                                  {sub.currentPayout > 0 ? formatCurrency(sub.currentPayout) : '—'}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </main>

      {/* Submit Post Modal */}
      {showSubmitModal && selectedCampaign && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 200,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
            background: 'rgba(0,0,0,0.7)',
            backdropFilter: 'blur(8px)',
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowSubmitModal(false); }}
        >
          <div
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-xl)',
              padding: '32px',
              width: '100%',
              maxWidth: '480px',
              boxShadow: 'var(--shadow-lg)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
              <div>
                <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: 4 }}>Submit Your Post</h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                  For: <strong>{selectedCampaign.name}</strong>
                </p>
              </div>
              <button
                onClick={() => setShowSubmitModal(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  fontSize: '1.2rem',
                  padding: 4,
                }}
              >
                ✕
              </button>
            </div>

            {submitError && (
              <div className="alert alert-error">
                <span>⚠️</span> {submitError}
              </div>
            )}

            <form onSubmit={handleSubmitPost} id="submit-post-form">
              <div className="form-group">
                <label className="form-label" htmlFor="post-link-input">Post URL</label>
                <input
                  id="post-link-input"
                  type="url"
                  className="form-input"
                  placeholder={`https://${selectedCampaign.platform.toLowerCase()}.com/...`}
                  value={postLink}
                  onChange={(e) => setPostLink(e.target.value)}
                  required
                  autoFocus
                />
                <div className="form-hint" style={{ marginTop: 6 }}>
                  Paste your {selectedCampaign.platform} post link
                </div>
              </div>

              {/* Milestone preview */}
              <div style={{
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                padding: 16,
                marginBottom: 20,
              }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Milestone Rewards
                </div>
                {[...selectedCampaign.milestones]
                  .sort((a, b) => a.viewThreshold - b.viewThreshold)
                  .map((m, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '0.875rem', borderBottom: i < selectedCampaign.milestones.length - 1 ? '1px solid var(--border)' : 'none' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>👁 {m.viewThreshold.toLocaleString()} views</span>
                      <span style={{ fontWeight: 700, color: 'var(--accent-green)' }}>₹{m.payout.toLocaleString()}</span>
                    </div>
                  ))}
              </div>

              <div style={{ display: 'flex', gap: 12 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowSubmitModal(false)}
                  style={{ flex: 1 }}
                >
                  Cancel
                </button>
                <button
                  id="submit-post-confirm"
                  type="submit"
                  className="btn btn-primary"
                  disabled={submitting}
                  style={{ flex: 2 }}
                >
                  {submitting ? <><span className="spinner" /> Submitting...</> : '🚀 Submit Post'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
