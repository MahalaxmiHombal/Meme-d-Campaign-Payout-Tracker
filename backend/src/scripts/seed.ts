import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import { User } from '../models/User';
import { Campaign } from '../models/Campaign';

async function seed() {
  const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/memed';
  await mongoose.connect(uri);
  console.log('✅ Connected to MongoDB');

  // Clear existing data
  await User.deleteMany({});
  await Campaign.deleteMany({});
  console.log('🗑  Cleared existing data');

  // Create brand user
  const brand = await User.create({
    name: 'Meme Brand Co.',
    email: 'brand@test.com',
    password: 'password123',
    role: 'brand',
  });
  console.log('🏢 Brand created:', brand.email);

  // Create creator users
  const creator1 = await User.create({
    name: 'MemeLord 420',
    email: 'creator@test.com',
    password: 'password123',
    role: 'creator',
  });
  console.log('🎨 Creator 1 created:', creator1.email);

  const creator2 = await User.create({
    name: 'Clip King',
    email: 'creator2@test.com',
    password: 'password123',
    role: 'creator',
  });
  console.log('🎨 Creator 2 created:', creator2.email);

  // Create sample campaigns
  await Campaign.create({
    name: 'Summer Vibe Drop 🌊',
    platform: 'Instagram',
    totalBudget: 20000,
    milestones: [
      { viewThreshold: 10000, payout: 500 },
      { viewThreshold: 50000, payout: 2000 },
      { viewThreshold: 100000, payout: 5000 },
    ],
    brand: brand._id,
    isActive: true,
  });

  await Campaign.create({
    name: 'Tech Review Blitz ⚡',
    platform: 'YouTube',
    totalBudget: 50000,
    milestones: [
      { viewThreshold: 5000,   payout: 300 },
      { viewThreshold: 25000,  payout: 1500 },
      { viewThreshold: 75000,  payout: 4000 },
      { viewThreshold: 200000, payout: 10000 },
    ],
    brand: brand._id,
    isActive: true,
  });

  await Campaign.create({
    name: 'Low Budget Promo 💸',
    platform: 'Instagram',
    totalBudget: 1000,
    milestones: [
      { viewThreshold: 5000,  payout: 200 },
      { viewThreshold: 20000, payout: 800 },
    ],
    brand: brand._id,
    isActive: true,
  });

  console.log('📢 3 campaigns created');

  console.log('\n========================================');
  console.log('🔑 TEST CREDENTIALS');
  console.log('========================================');
  console.log('BRAND:');
  console.log('  Email:    brand@test.com');
  console.log('  Password: password123');
  console.log('\nCREATOR 1:');
  console.log('  Email:    creator@test.com');
  console.log('  Password: password123');
  console.log('\nCREATOR 2:');
  console.log('  Email:    creator2@test.com');
  console.log('  Password: password123');
  console.log('========================================\n');

  await mongoose.disconnect();
  console.log('✅ Seed complete!');
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
