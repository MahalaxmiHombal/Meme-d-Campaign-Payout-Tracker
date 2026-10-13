'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import Navbar from '../../components/Navbar';
import { useAuth } from '../../context/AuthContext';
import { Campaign, Milestone } from '../../types';
import api from '../../lib/api';

const EMPTY_MILESTONE: Milestone = { viewThreshold: 0, payout: 0 };

function formatCurrency(amount: number) {
  return `₹${amount.toLocaleString('en-IN')}`;
}

function formatViews(views: number) {
  if (views >= 1_000_000) return `${(views / 1_000_000).toFixed(1)}M`;
  if (views >= 1_000) return `${(views / 1_000).toFixed(0)}K`;
  return views.toString();
}

export default function BrandDashboard() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loadingCampaigns, setLoadingCampaigns] = useState(true);
  const [activeTab, setActiveTab] = useState<'campaigns' | 'create'>('campaigns');

  // Create campaign form state
  const [formName, setFormName] = useState('');
  const [formPlatform, setFormPlatform] = useState<'Instagram' | 'YouTube'>('Instagram');
  const [formBudget, setFormBudget] = useState('');
  const [milestones, setMilestones] = useState<Milestone[]>([
    { viewThreshold: 10000, payout: 500 },
    { viewThreshold: 50000, payout: 2000 },
    { viewThreshold: 100000, payout: 5000 },
  ]);
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (!isLoading && (!user || user.role !== 'brand')) {
      router.replace('/login');
    }
  }, [user, isLoading, router]);

  const fetchCampaigns = useCallback(async () => {
    try {
      const res = await api.get('/campaigns/brand');
      setCampaigns(res.data.campaigns);
    } catch {
      toast.error('Failed to load campaigns');
    } finally {
      setLoadingCampaigns(false);
    }
  }, []);

  useEffect(() => {
    if (user?.role === 'brand') {
      fetchCampaigns();
    }
  }, [user, fetchCampaigns]);

  const addMilestone = () => {
    setMilestones([...milestones, { ...EMPTY_MILESTONE }]);
  };

  const removeMilestone = (index: number) => {
    setMilestones(milestones.filter((_, i) => i !== index));
  };

  const updateMilestone = (index: number, field: keyof Milestone, value: string) => {
    const updated = [...milestones];
    updated[index] = { ...updated[index], [field]: Number(value) };
    setMilestones(updated);
  };

  const validateMilestones = (): string | null => {
    if (milestones.length === 0) return 'Add at least one milestone';
    for (const m of milestones) {
      if (m.viewThreshold <= 0) return 'All view thresholds must be positive';
      if (m.payout <= 0) return 'All payouts must be positive';
    }
    const views = milestones.map((m) => m.viewThreshold);
    const uniqueViews = new Set(views);
    if (uniqueViews.size !== views.length) return 'View thresholds must be unique';

    const maxPayout = Math.max(...milestones.map((m) => m.payout));
    if (maxPayout > Number(formBudget)) return 'Highest milestone payout exceeds budget';
    return null;
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const milestoneError = validateMilestones();
    if (milestoneError) {
      setFormError(milestoneError);
      return;
    }

    setCreating(true);
    try {
      await api.post('/campaigns', {
        name: formName,
        platform: formPlatform,
        totalBudget: Number(formBudget),
        milestones,
      });

      toast.success('Campaign created successfully! 🚀');
      setFormName('');
      setFormPlatform('Instagram');
      setFormBudget('');
      setMilestones([
        { viewThreshold: 10000, payout: 500 },
        { viewThreshold: 50000, payout: 2000 },
        { viewThreshold: 100000, payout: 5000 },
      ]);
      setActiveTab('campaigns');
      fetchCampaigns();
    } catch (err: any) {
      setFormError(err?.response?.data?.message || 'Failed to create campaign');
    } finally {
      setCreating(false);
    }
  };

  const totalBudget = campaigns.reduce((sum, c) => sum + c.totalBudget, 0);
  const totalSpent = campaigns.reduce((sum, c) => sum + c.budgetSpent, 0);
  const activeCampaigns = campaigns.filter((c) => c.isActive).length;

  if (isLoading || !user) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="spinner" style={{ width: 40, height: 40, borderWidth: 3 }} />
      </div>
    );
  }

  return (
    <div className="page-wrapper">
      <Navbar />
      <main className="main-content">
        <div className="container">
          {/* Page header */}
          <div className="page-header">
            <h1 className="page-title">Brand Dashboard</h1>
            <p className="page-subtitle">Manage your campaigns and track budget performance</p>
          </div>

          {/* Stats row */}
          <div className="grid grid-3" style={{ marginBottom: 32 }}>
            <div className="stat-card purple">
              <div className="stat-label">Total Budget</div>
              <div className="stat-value">{formatCurrency(totalBudget)}</div>
              <div className="stat-sub">across {campaigns.length} campaign{campaigns.length !== 1 ? 's' : ''}</div>
            </div>
            <div className="stat-card cyan">
              <div className="stat-label">Budget Spent</div>
              <div className="stat-value">{formatCurrency(totalSpent)}</div>
              <div className="stat-sub">{totalBudget > 0 ? ((totalSpent / totalBudget) * 100).toFixed(1) : 0}% utilized</div>
            </div>
            <div className="stat-card green">
              <div className="stat-label">Active Campaigns</div>
              <div className="stat-value">{activeCampaigns}</div>
              <div className="stat-sub">{campaigns.length - activeCampaigns} inactive</div>
            </div>
          </div>

          {/* Tabs */}
          <div className="tabs">
            <button
              id="tab-campaigns"
              className={`tab-btn ${activeTab === 'campaigns' ? 'active' : ''}`}
              onClick={() => setActiveTab('campaigns')}
            >
              📋 My Campaigns
            </button>
            <button
              id="tab-create"
              className={`tab-btn ${activeTab === 'create' ? 'active' : ''}`}
              onClick={() => setActiveTab('create')}
            >
              ✨ Create Campaign
            </button>
          </div>

          {/* Campaigns list */}
          {activeTab === 'campaigns' && (
            <>
              {loadingCampaigns ? (
                <div style={{ textAlign: 'center', padding: 60 }}>
                  <div className="spinner" style={{ width: 36, height: 36, borderWidth: 3 }} />
                </div>
              ) : campaigns.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon">📭</div>
                  <div className="empty-state-title">No campaigns yet</div>
                  <div className="empty-state-desc">Create your first campaign to start tracking payouts</div>
                  <button
                    className="btn btn-primary"
                    style={{ marginTop: 20 }}
                    onClick={() => setActiveTab('create')}
                  >
                    Create Campaign
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  {campaigns.map((campaign) => {
                    const spent = campaign.budgetSpent;
                    const total = campaign.totalBudget;
                    const pct = total > 0 ? (spent / total) * 100 : 0;

                    return (
                      <div key={campaign._id} className="campaign-card">
                        <div className="card-header">
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                              <h3 className="card-title">{campaign.name}</h3>
                              <span className={`badge ${campaign.isActive ? 'active' : 'inactive'}`}>
                                {campaign.isActive ? '● Live' : '● Ended'}
                              </span>
                            </div>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                              <span className={`platform-badge ${campaign.platform.toLowerCase()}`}>
                                {campaign.platform === 'Instagram' ? '📸' : '▶️'} {campaign.platform}
                              </span>
                              <span className="card-subtitle">
                                Created {new Date(campaign.createdAt).toLocaleDateString('en-IN')}
                              </span>
                            </div>
                          </div>
                          <div style={{ textAlign: 'right', flexShrink: 0 }}>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 2 }}>Budget</div>
                            <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: '1.1rem' }}>
                              {formatCurrency(total)}
                            </div>
                          </div>
                        </div>

                        {/* Budget progress */}
                        <div className="progress-bar-wrapper">
                          <div className="progress-label">
                            <span>Spent: {formatCurrency(spent)}</span>
                            <span>Remaining: {formatCurrency(total - spent)}</span>
                          </div>
                          <div className="progress-bar-bg">
                            <div
                              className={`progress-bar-fill ${pct > 80 ? 'warning' : ''}`}
                              style={{ width: `${Math.min(pct, 100)}%` }}
                            />
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4, textAlign: 'right' }}>
                            {pct.toFixed(1)}% used
                          </div>
                        </div>

                        {/* Milestone ladder */}
                        <div style={{ marginTop: 16 }}>
                          <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                            Milestone Ladder
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

          {/* Create campaign form */}
          {activeTab === 'create' && (
            <div className="card" style={{ maxWidth: 680 }}>
              <h2 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: 24 }}>New Campaign</h2>

              {formError && (
                <div className="alert alert-error">
                  <span>⚠️</span> {formError}
                </div>
              )}

              <form onSubmit={handleCreate} id="create-campaign-form">
                <div className="form-group">
                  <label className="form-label" htmlFor="campaign-name">Campaign Name</label>
                  <input
                    id="campaign-name"
                    type="text"
                    className="form-input"
                    placeholder="e.g. Summer Launch 2025"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    required
                  />
                </div>

                <div className="grid grid-2">
                  <div className="form-group">
                    <label className="form-label" htmlFor="campaign-platform">Platform</label>
                    <select
                      id="campaign-platform"
                      className="form-select"
                      value={formPlatform}
                      onChange={(e) => setFormPlatform(e.target.value as 'Instagram' | 'YouTube')}
                    >
                      <option value="Instagram">📸 Instagram</option>
                      <option value="YouTube">▶️ YouTube</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="campaign-budget">Total Budget (₹)</label>
                    <input
                      id="campaign-budget"
                      type="number"
                      className="form-input"
                      placeholder="e.g. 50000"
                      value={formBudget}
                      onChange={(e) => setFormBudget(e.target.value)}
                      required
                      min={1}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Milestone Ladder</label>
                  <div className="form-hint" style={{ marginBottom: 12 }}>
                    Set view thresholds and corresponding payouts. Creators earn the highest milestone they cross.
                  </div>

                  <div className="milestone-builder">
                    <div className="milestone-builder-header">
                      <span>Views Threshold</span>
                      <span>Payout (₹)</span>
                      <span></span>
                    </div>

                    {milestones.map((m, index) => (
                      <div key={index} className="milestone-builder-row">
                        <input
                          id={`milestone-views-${index}`}
                          type="number"
                          className="form-input"
                          placeholder="e.g. 10000"
                          value={m.viewThreshold || ''}
                          onChange={(e) => updateMilestone(index, 'viewThreshold', e.target.value)}
                          min={1}
                          style={{ marginBottom: 0 }}
                        />
                        <input
                          id={`milestone-payout-${index}`}
                          type="number"
                          className="form-input"
                          placeholder="e.g. 500"
                          value={m.payout || ''}
                          onChange={(e) => updateMilestone(index, 'payout', e.target.value)}
                          min={1}
                          style={{ marginBottom: 0 }}
                        />
                        <button
                          type="button"
                          className="milestone-remove-btn"
                          onClick={() => removeMilestone(index)}
                          disabled={milestones.length <= 1}
                          title="Remove milestone"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    id="add-milestone-btn"
                    className="btn btn-secondary btn-sm"
                    style={{ marginTop: 10 }}
                    onClick={addMilestone}
                  >
                    + Add Milestone
                  </button>
                </div>

                <div className="divider" />

                <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setActiveTab('campaigns')}
                  >
                    Cancel
                  </button>
                  <button
                    id="create-campaign-submit"
                    type="submit"
                    className="btn btn-primary"
                    disabled={creating}
                  >
                    {creating ? <><span className="spinner" /> Creating...</> : '🚀 Create Campaign'}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
