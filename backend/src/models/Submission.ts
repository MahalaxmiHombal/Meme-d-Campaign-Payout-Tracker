import mongoose, { Document, Schema } from 'mongoose';

export interface IViewHistory {
  viewCount: number;
  recordedAt: Date;
}

export interface ISubmission extends Document {
  _id: mongoose.Types.ObjectId;
  campaign: mongoose.Types.ObjectId;
  creator: mongoose.Types.ObjectId;
  postLink: string;
  viewCount: number;
  currentPayout: number;       // payout already credited for this submission
  isFlagged: boolean;          // spike detection flag
  viewHistory: IViewHistory[]; // for spike detection
  createdAt: Date;
  updatedAt: Date;
}

const viewHistorySchema = new Schema<IViewHistory>(
  {
    viewCount: { type: Number, required: true },
    recordedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const submissionSchema = new Schema<ISubmission>(
  {
    campaign: {
      type: Schema.Types.ObjectId,
      ref: 'Campaign',
      required: true,
    },
    creator: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    postLink: {
      type: String,
      required: [true, 'Post link is required'],
      trim: true,
    },
    viewCount: {
      type: Number,
      default: 0,
      min: [0, 'View count cannot be negative'],
    },
    currentPayout: {
      type: Number,
      default: 0,
      min: [0, 'Payout cannot be negative'],
    },
    isFlagged: {
      type: Boolean,
      default: false,
    },
    viewHistory: {
      type: [viewHistorySchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

// Compound index to prevent duplicate submissions for the same post
submissionSchema.index({ campaign: 1, postLink: 1 }, { unique: true });

export const Submission = mongoose.model<ISubmission>('Submission', submissionSchema);
