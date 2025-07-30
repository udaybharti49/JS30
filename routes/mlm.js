const express = require('express');
const User = require('../models/User');
const { verifyToken } = require('../middleware/auth');
const { getCommissionHistory, calculateNetworkEarnings } = require('../utils/commission');

const router = express.Router();

// Get referral link and code
router.get('/referral', verifyToken, async (req, res) => {
  try {
    const referralUrl = `${process.env.FRONTEND_URL}/register?ref=${req.user.referralCode}`;
    
    res.json({
      success: true,
      data: {
        referralCode: req.user.referralCode,
        referralUrl: referralUrl,
        referralCount: req.user.referredUsers.length,
        totalEarnings: req.user.earnings.totalEarnings
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch referral details',
      error: error.message
    });
  }
});

// Get commission history
router.get('/commissions', verifyToken, async (req, res) => {
  try {
    const options = {
      page: req.query.page || 1,
      limit: req.query.limit || 10,
      type: req.query.type,
      startDate: req.query.startDate,
      endDate: req.query.endDate
    };

    const commissionData = await getCommissionHistory(req.user._id, options);

    res.json({
      success: true,
      data: commissionData
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch commission history',
      error: error.message
    });
  }
});

// Get network tree/genealogy
router.get('/network-tree', verifyToken, async (req, res) => {
  try {
    const buildNetworkTree = async (userId, depth = 0, maxDepth = 3) => {
      if (depth >= maxDepth) return null;

      const user = await User.findById(userId)
        .select('firstName lastName email phone referralCode createdAt earnings services')
        .lean();

      if (!user) return null;

      const directReferrals = await User.find({ referredBy: userId })
        .select('_id firstName lastName email phone referralCode createdAt earnings services')
        .sort({ createdAt: -1 })
        .lean();

      const children = [];
      for (const referral of directReferrals) {
        const childTree = await buildNetworkTree(referral._id, depth + 1, maxDepth);
        if (childTree) {
          children.push(childTree);
        }
      }

      return {
        ...user,
        level: depth + 1,
        children: children,
        directReferrals: directReferrals.length,
        totalNetworkSize: children.reduce((sum, child) => sum + (child.totalNetworkSize || 0), 0) + directReferrals.length
      };
    };

    const networkTree = await buildNetworkTree(req.user._id);
    
    res.json({
      success: true,
      data: networkTree
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch network tree',
      error: error.message
    });
  }
});

// Get potential earnings calculator
router.get('/earnings-calculator', verifyToken, async (req, res) => {
  try {
    const potentialEarnings = await calculateNetworkEarnings(req.user._id);
    
    res.json({
      success: true,
      data: potentialEarnings
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to calculate potential earnings',
      error: error.message
    });
  }
});

// Get MLM statistics
router.get('/stats', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const networkSize = await user.getNetworkSize();
    
    // Get active users in network (logged in last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    const level1Ids = await User.find({ referredBy: req.user._id }).distinct('_id');
    const level2Ids = await User.find({ referredBy: { $in: level1Ids } }).distinct('_id');
    const level3Ids = await User.find({ referredBy: { $in: level2Ids } }).distinct('_id');
    
    const allNetworkIds = [...level1Ids, ...level2Ids, ...level3Ids];
    
    const activeUsers = await User.countDocuments({
      _id: { $in: allNetworkIds },
      lastLogin: { $gte: thirtyDaysAgo }
    });
    
    // Get total network business (transactions) in last 30 days
    const Transaction = require('../models/Transaction');
    const networkBusiness = await Transaction.aggregate([
      {
        $match: {
          userId: { $in: allNetworkIds },
          createdAt: { $gte: thirtyDaysAgo },
          status: 'completed'
        }
      },
      {
        $group: {
          _id: '$type',
          totalAmount: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      }
    ]);
    
    // Monthly growth rate
    const lastMonth = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
    const newReferralsThisMonth = await User.countDocuments({
      referredBy: req.user._id,
      createdAt: { $gte: thirtyDaysAgo }
    });
    
    const newReferralsLastMonth = await User.countDocuments({
      referredBy: req.user._id,
      createdAt: { $gte: lastMonth, $lt: thirtyDaysAgo }
    });
    
    const growthRate = newReferralsLastMonth > 0 ? 
      ((newReferralsThisMonth - newReferralsLastMonth) / newReferralsLastMonth) * 100 : 
      (newReferralsThisMonth > 0 ? 100 : 0);
    
    res.json({
      success: true,
      data: {
        networkSize,
        activeUsers,
        totalNetworkUsers: allNetworkIds.length,
        networkBusiness,
        growth: {
          thisMonth: newReferralsThisMonth,
          lastMonth: newReferralsLastMonth,
          growthRate: Math.round(growthRate * 100) / 100
        },
        earnings: user.earnings,
        rankInfo: {
          currentRank: getRank(networkSize.total, user.earnings.totalEarnings),
          nextRank: getNextRank(networkSize.total, user.earnings.totalEarnings),
          progress: calculateRankProgress(networkSize.total, user.earnings.totalEarnings)
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch MLM statistics',
      error: error.message
    });
  }
});

// Helper functions for rank calculation
function getRank(networkSize, totalEarnings) {
  if (networkSize >= 1000 && totalEarnings >= 100000) return 'Diamond';
  if (networkSize >= 500 && totalEarnings >= 50000) return 'Gold';
  if (networkSize >= 100 && totalEarnings >= 10000) return 'Silver';
  if (networkSize >= 25 && totalEarnings >= 2500) return 'Bronze';
  return 'Starter';
}

function getNextRank(networkSize, totalEarnings) {
  const currentRank = getRank(networkSize, totalEarnings);
  
  switch (currentRank) {
    case 'Starter': return 'Bronze';
    case 'Bronze': return 'Silver';
    case 'Silver': return 'Gold';
    case 'Gold': return 'Diamond';
    case 'Diamond': return 'Diamond Master';
    default: return 'Bronze';
  }
}

function calculateRankProgress(networkSize, totalEarnings) {
  const currentRank = getRank(networkSize, totalEarnings);
  
  const requirements = {
    'Bronze': { network: 25, earnings: 2500 },
    'Silver': { network: 100, earnings: 10000 },
    'Gold': { network: 500, earnings: 50000 },
    'Diamond': { network: 1000, earnings: 100000 }
  };
  
  const nextRank = getNextRank(networkSize, totalEarnings);
  if (!requirements[nextRank]) return 100;
  
  const req = requirements[nextRank];
  const networkProgress = Math.min((networkSize / req.network) * 100, 100);
  const earningsProgress = Math.min((totalEarnings / req.earnings) * 100, 100);
  
  return Math.min(networkProgress, earningsProgress);
}

module.exports = router;