import mongoose, { Document, Schema } from 'mongoose';

export interface IMilestone {
  viewThreshold: number; // e.g. 10000
  payout: number;        // e.g. 500
}

export interface ICampaign extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  platform: 'Instagram' | 'YouTube';
  totalBudget: number;
  budgetSpent: number;
  milestones: IMilestone[];
  brand: mongoose.Types.ObjectId;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  budgetRemaining: number; // virtual
}

const milestoneSchema = new Schema<IMilestone>(
  {
    viewThreshold: {
      type: Number,
      required: [true, 'View threshold is required'],
      min: [0, 'View threshold must be non-negative'],
    },
    payout: {
      type: Number,
      required: [true, 'Payout is required'],
      min: [0, 'Payout must be non-negative'],
    },
  },
  { _id: false }
);

const campaignSchema = new Schema<ICampaign>(
  {
    name: {
      type: String,
      required: [true, 'Campaign name is required'],
      trim: true,
      maxlength: [200, 'Campaign name cannot exceed 200 characters'],
    },
    platform: {
      type: String,
      enum: ['Instagram', 'YouTube'],
      required: [true, 'Platform is required'],
    },
    totalBudget: {
      type: Number,
      required: [true, 'Total budget is required'],
      min: [1, 'Budget must be at least 1'],
    },
    budgetSpent: {
      type: Number,
      default: 0,
      min: [0, 'Budget spent cannot be negative'],
    },
    milestones: {
      type: [milestoneSchema],
      required: [true, 'At least one milestone is required'],
      validate: {
        validator: function (milestones: IMilestone[]) {
          return milestones.length > 0;
        },
        message: 'Campaign must have at least one milestone',
      },
    },
    brand: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual: budgetRemaining
campaignSchema.virtual('budgetRemaining').get(function (this: ICampaign) {
  return this.totalBudget - this.budgetSpent;
});

// Ensure milestones are sorted by viewThreshold ascending before saving
campaignSchema.pre('save', function (next) {
  this.milestones.sort((a, b) => a.viewThreshold - b.viewThreshold);
  next();
});

export const Campaign = mongoose.model<ICampaign>('Campaign', campaignSchema);
