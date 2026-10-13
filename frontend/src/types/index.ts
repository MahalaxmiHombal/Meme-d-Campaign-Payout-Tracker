export interface Milestone {
  viewThreshold: number;
  payout: number;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'brand' | 'creator';
}

export interface Campaign {
  _id: string;
  name: string;
  platform: 'Instagram' | 'YouTube';
  totalBudget: number;
  budgetSpent: number;
  budgetRemaining: number;
  milestones: Milestone[];
  brand: { _id: string; name: string; email: string } | string;
  isActive: boolean;
  createdAt: string;
}

export interface Submission {
  _id: string;
  campaign: Campaign | string;
  creator: User | string;
  postLink: string;
  viewCount: number;
  currentPayout: number;
  isFlagged: boolean;
  createdAt: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface CampaignsResponse {
  campaigns: Campaign[];
  fromCache?: boolean;
}

export interface SubmissionsResponse {
  submissions: Submission[];
  totalEarnings?: number;
}
