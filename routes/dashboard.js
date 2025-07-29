const express = require('express');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const Course = require('../models/Course');
const { verifyToken } = require('../middleware/auth');
const { calculateNetworkEarnings } = require('../utils/commission');

const router = express.Router();

// Get dashboard overview
router.get('/overview', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    
    // Get network size
    const networkSize = await user.getNetworkSize();
    
    // Get recent transactions
    const recentTransactions = await Transaction.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(5)
      .select('type subType amount status createdAt serviceDetails');
    
    // Get monthly earnings
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth();
    const currentYear = currentDate.getFullYear();
    
    const monthlyEarnings = await Transaction.aggregate([
      {
        $match: {
          userId: req.user._id,
          type: 'commission_earned',
          createdAt: {
            $gte: new Date(currentYear, currentMonth, 1),
            $lt: new Date(currentYear, currentMonth + 1, 1)
          }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$amount' }
        }
      }
    ]);
    
    // Get service statistics
    const serviceStats = {
      recharge: {
        totalTransactions: await Transaction.countDocuments({
          userId: req.user._id,
          type: 'recharge',
          status: 'completed'
        }),
        totalAmount: user.services.recharge.totalAmount
      },
      courses: {
        purchasedCourses: user.services.courses.purchasedCourses.length,
        totalSpent: user.services.courses.totalSpent
      },
      loans: {
        activeLoans: user.services.loans.currentLoans.filter(loan => 
          ['active', 'approved'].includes(loan.status)
        ).length,
        creditScore: user.services.loans.creditScore
      },
      insurance: {
        activePolicies: user.services.insurance.policies.filter(policy => 
          policy.status === 'active'
        ).length
      }
    };
    
    // Calculate potential earnings
    const potentialEarnings = await calculateNetworkEarnings(req.user._id);
    
    res.json({
      success: true,
      data: {
        user: {
          name: user.fullName,
          email: user.email,
          phone: user.phone,
          referralCode: user.referralCode,
          walletBalance: user.wallet.balance,
          kycStatus: user.kyc.status,
          joinedDate: user.createdAt
        },
        earnings: {
          totalEarnings: user.earnings.totalEarnings,
          monthlyEarnings: monthlyEarnings[0]?.total || 0,
          referralBonus: user.earnings.referralBonus,
          levelCommissions: user.earnings.levelCommissions,
          courseCommissions: user.earnings.courseCommissions,
          serviceCommissions: user.earnings.serviceCommissions
        },
        network: networkSize,
        recentTransactions,
        serviceStats,
        potentialEarnings: potentialEarnings.monthlyPotential
      }
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard data',
      error: error.message
    });
  }
});

// Get earnings analytics
router.get('/earnings', verifyToken, async (req, res) => {
  try {
    const { period = 'monthly', year = new Date().getFullYear() } = req.query;
    
    let groupBy, startDate, endDate;
    
    if (period === 'monthly') {
      groupBy = {
        year: { $year: '$createdAt' },
        month: { $month: '$createdAt' }
      };
      startDate = new Date(year, 0, 1);
      endDate = new Date(parseInt(year) + 1, 0, 1);
    } else if (period === 'weekly') {
      groupBy = {
        year: { $year: '$createdAt' },
        week: { $week: '$createdAt' }
      };
      startDate = new Date(year, 0, 1);
      endDate = new Date(parseInt(year) + 1, 0, 1);
    } else {
      groupBy = {
        year: { $year: '$createdAt' },
        month: { $month: '$createdAt' },
        day: { $dayOfMonth: '$createdAt' }
      };
      // Last 30 days
      startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      endDate = new Date();
    }
    
    const earningsData = await Transaction.aggregate([
      {
        $match: {
          userId: req.user._id,
          type: 'commission_earned',
          createdAt: { $gte: startDate, $lt: endDate }
        }
      },
      {
        $group: {
          _id: groupBy,
          totalEarnings: { $sum: '$amount' },
          count: { $sum: 1 },
          types: {
            $push: {
              type: '$subType',
              amount: '$amount'
            }
          }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1, '_id.week': 1 } }
    ]);
    
    // Get commission breakdown by levels
    const levelBreakdown = await Transaction.aggregate([
      {
        $match: {
          userId: req.user._id,
          type: 'commission_earned',
          createdAt: { $gte: startDate, $lt: endDate }
        }
      },
      {
        $group: {
          _id: '$serviceDetails.commissionLevel',
          totalAmount: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      }
    ]);
    
    res.json({
      success: true,
      data: {
        period,
        year,
        earningsData,
        levelBreakdown,
        summary: {
          totalEarnings: earningsData.reduce((sum, item) => sum + item.totalEarnings, 0),
          totalTransactions: earningsData.reduce((sum, item) => sum + item.count, 0),
          averagePerTransaction: earningsData.length > 0 ? 
            earningsData.reduce((sum, item) => sum + item.totalEarnings, 0) / 
            earningsData.reduce((sum, item) => sum + item.count, 0) : 0
        }
      }
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch earnings analytics',
      error: error.message
    });
  }
});

// Get network analytics
router.get('/network', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    
    // Get detailed network information
    const level1Users = await User.find({ referredBy: req.user._id })
      .select('firstName lastName email phone createdAt services earnings')
      .sort({ createdAt: -1 });
    
    const level1Ids = level1Users.map(u => u._id);
    
    const level2Users = await User.find({ referredBy: { $in: level1Ids } })
      .select('firstName lastName email phone createdAt referredBy services earnings')
      .populate('referredBy', 'firstName lastName')
      .sort({ createdAt: -1 });
    
    const level2Ids = level2Users.map(u => u._id);
    
    const level3Users = await User.find({ referredBy: { $in: level2Ids } })
      .select('firstName lastName email phone createdAt referredBy services earnings')
      .populate('referredBy', 'firstName lastName')
      .sort({ createdAt: -1 });
    
    // Calculate network activity
    const networkActivity = await Transaction.aggregate([
      {
        $match: {
          userId: { $in: [...level1Ids, ...level2Ids, ...level2Ids] },
          createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
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
    
    // Get potential earnings
    const potentialEarnings = await calculateNetworkEarnings(req.user._id);
    
    res.json({
      success: true,
      data: {
        networkSize: await user.getNetworkSize(),
        networkUsers: {
          level1: level1Users,
          level2: level2Users,
          level3: level3Users
        },
        networkActivity,
        potentialEarnings,
        summary: {
          totalNetworkUsers: level1Users.length + level2Users.length + level3Users.length,
          activeUsersThisMonth: await User.countDocuments({
            _id: { $in: [...level1Ids, ...level2Ids, ...level2Ids] },
            lastLogin: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
          }),
          totalNetworkEarnings: level1Users.reduce((sum, user) => sum + user.earnings.totalEarnings, 0) +
                                level2Users.reduce((sum, user) => sum + user.earnings.totalEarnings, 0) +
                                level3Users.reduce((sum, user) => sum + user.earnings.totalEarnings, 0)
        }
      }
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch network analytics',
      error: error.message
    });
  }
});

// Get service usage statistics
router.get('/services', verifyToken, async (req, res) => {
  try {
    const { period = '30' } = req.query; // days
    const startDate = new Date(Date.now() - parseInt(period) * 24 * 60 * 60 * 1000);
    
    // Get service usage statistics
    const serviceUsage = await Transaction.aggregate([
      {
        $match: {
          userId: req.user._id,
          createdAt: { $gte: startDate },
          status: 'completed'
        }
      },
      {
        $group: {
          _id: '$type',
          totalAmount: { $sum: '$amount' },
          count: { $sum: 1 },
          avgAmount: { $avg: '$amount' },
          lastUsed: { $max: '$createdAt' }
        }
      }
    ]);
    
    // Get popular courses
    const popularCourses = await Course.find({
      '_id': { 
        $in: req.user.services.courses.purchasedCourses.map(c => c.courseId) 
      }
    })
    .select('title category pricing stats')
    .sort({ 'stats.enrollments': -1 })
    .limit(5);
    
    res.json({
      success: true,
      data: {
        period: `${period} days`,
        serviceUsage,
        courseStats: {
          totalCourses: req.user.services.courses.purchasedCourses.length,
          totalSpent: req.user.services.courses.totalSpent,
          completedCourses: req.user.services.courses.purchasedCourses.filter(
            c => c.status === 'completed'
          ).length,
          popularCourses
        },
        rechargeStats: {
          totalRecharges: req.user.services.recharge.totalRecharges,
          totalAmount: req.user.services.recharge.totalAmount,
          avgRechargeAmount: req.user.services.recharge.totalRecharges > 0 ? 
            req.user.services.recharge.totalAmount / req.user.services.recharge.totalRecharges : 0
        },
        financialServices: {
          loans: {
            active: req.user.services.loans.currentLoans.length,
            creditScore: req.user.services.loans.creditScore,
            eligibleAmount: req.user.services.loans.eligibleAmount
          },
          insurance: {
            activePolicies: req.user.services.insurance.policies.length
          },
          banking: {
            kotakAccountStatus: req.user.services.banking.kotakAccount.status
          }
        }
      }
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch service statistics',
      error: error.message
    });
  }
});

module.exports = router;