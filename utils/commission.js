const User = require('../models/User');
const Transaction = require('../models/Transaction');

// Process commission distribution for MLM structure
const processCommission = async (transaction, purchasingUser) => {
  try {
    const commissionRates = {
      1: parseFloat(process.env.LEVEL_1_COMMISSION) || 5, // 5% for level 1
      2: parseFloat(process.env.LEVEL_2_COMMISSION) || 3, // 3% for level 2
      3: parseFloat(process.env.LEVEL_3_COMMISSION) || 2, // 2% for level 3
    };

    const maxLevels = parseInt(process.env.MAX_LEVELS) || 3;
    const commissionDistribution = [];

    // Get upline users for commission distribution
    const uplineUsers = purchasingUser.uplineUsers || [];

    for (let i = 0; i < Math.min(uplineUsers.length, maxLevels); i++) {
      const uplineUser = uplineUsers[i];
      const level = uplineUser.level;
      
      if (level <= maxLevels && commissionRates[level]) {
        const commissionRate = commissionRates[level];
        const commissionAmount = Math.round((transaction.amount * commissionRate) / 100);

        if (commissionAmount > 0) {
          // Add to commission distribution array
          commissionDistribution.push({
            userId: uplineUser.userId,
            level: level,
            percentage: commissionRate,
            amount: commissionAmount,
            status: 'pending'
          });

          // Update upline user's earnings and wallet
          await User.findByIdAndUpdate(uplineUser.userId, {
            $inc: {
              [`earnings.levelCommissions.level${level}`]: commissionAmount,
              'earnings.totalEarnings': commissionAmount,
              'wallet.balance': commissionAmount,
              ...(transaction.type === 'recharge' && {
                'earnings.serviceCommissions': commissionAmount
              }),
              ...(transaction.type === 'course_purchase' && {
                'earnings.courseCommissions': commissionAmount
              })
            }
          });

          // Create commission transaction for upline user
          await createCommissionTransaction(uplineUser.userId, {
            amount: commissionAmount,
            sourceTransaction: transaction,
            level: level,
            percentage: commissionRate,
            sourceUserId: purchasingUser._id
          });
        }
      }
    }

    // Update original transaction with commission distribution
    transaction.commissionDistribution = commissionDistribution;
    await transaction.save();

    return {
      success: true,
      totalCommissionPaid: commissionDistribution.reduce((sum, comm) => sum + comm.amount, 0),
      distributionCount: commissionDistribution.length
    };

  } catch (error) {
    console.error('Error processing commission:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Create commission transaction record
const createCommissionTransaction = async (userId, commissionData) => {
  try {
    const commissionTransaction = new Transaction({
      userId: userId,
      type: 'commission_earned',
      subType: `${commissionData.sourceTransaction.type}_commission`,
      amount: commissionData.amount,
      status: 'completed',
      serviceDetails: {
        sourceUserId: commissionData.sourceUserId,
        sourceTransactionId: commissionData.sourceTransaction.transactionId,
        commissionLevel: commissionData.level,
        commissionPercentage: commissionData.percentage
      },
      description: `Level ${commissionData.level} commission from ${commissionData.sourceTransaction.type}`,
      completedAt: new Date()
    });

    await commissionTransaction.save();
    return commissionTransaction;

  } catch (error) {
    console.error('Error creating commission transaction:', error);
    throw error;
  }
};

// Calculate potential earnings for a user based on their network
const calculateNetworkEarnings = async (userId) => {
  try {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Get all downline users
    const networkSize = await user.getNetworkSize();
    
    // Calculate potential monthly earnings based on average activity
    const avgRechargePerUser = 500; // Average monthly recharge per user
    const avgCourseSpendPerUser = 1000; // Average course purchase per user per year
    
    const monthlyRechargeEarnings = {
      level1: networkSize.level1 * avgRechargePerUser * 0.05, // 5% commission
      level2: networkSize.level2 * avgRechargePerUser * 0.03, // 3% commission
      level3: networkSize.level3 * avgRechargePerUser * 0.02, // 2% commission
    };

    const yearlyEarnings = {
      recharge: Object.values(monthlyRechargeEarnings).reduce((sum, val) => sum + val, 0) * 12,
      courses: (networkSize.level1 * avgCourseSpendPerUser * 0.10) + 
               (networkSize.level2 * avgCourseSpendPerUser * 0.05) + 
               (networkSize.level3 * avgCourseSpendPerUser * 0.03)
    };

    return {
      networkSize,
      monthlyPotential: Object.values(monthlyRechargeEarnings).reduce((sum, val) => sum + val, 0),
      yearlyPotential: yearlyEarnings.recharge + yearlyEarnings.courses,
      breakdown: {
        monthlyRecharge: monthlyRechargeEarnings,
        yearlyRecharge: yearlyEarnings.recharge,
        yearlyCourses: yearlyEarnings.courses
      }
    };

  } catch (error) {
    console.error('Error calculating network earnings:', error);
    throw error;
  }
};

// Get commission history for a user
const getCommissionHistory = async (userId, options = {}) => {
  try {
    const {
      page = 1,
      limit = 10,
      type = null,
      startDate = null,
      endDate = null
    } = options;

    const query = {
      userId: userId,
      type: 'commission_earned'
    };

    if (type) {
      query.subType = type;
    }

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const commissions = await Transaction.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .populate('serviceDetails.sourceUserId', 'firstName lastName email phone');

    const total = await Transaction.countDocuments(query);

    // Calculate summary
    const summary = await Transaction.aggregate([
      { $match: { userId: userId, type: 'commission_earned' } },
      {
        $group: {
          _id: '$serviceDetails.commissionLevel',
          totalAmount: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      }
    ]);

    const totalEarned = await Transaction.aggregate([
      { $match: { userId: userId, type: 'commission_earned' } },
      {
        $group: {
          _id: null,
          total: { $sum: '$amount' }
        }
      }
    ]);

    return {
      commissions,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalRecords: total,
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1
      },
      summary: {
        byLevel: summary,
        totalEarned: totalEarned[0]?.total || 0
      }
    };

  } catch (error) {
    console.error('Error getting commission history:', error);
    throw error;
  }
};

// Update monthly earnings for user
const updateMonthlyEarnings = async (userId) => {
  try {
    const currentDate = new Date();
    const currentMonth = currentDate.toLocaleString('default', { month: 'long' });
    const currentYear = currentDate.getFullYear();

    // Get total earnings for current month
    const monthlyEarnings = await Transaction.aggregate([
      {
        $match: {
          userId: userId,
          type: 'commission_earned',
          createdAt: {
            $gte: new Date(currentYear, currentDate.getMonth(), 1),
            $lt: new Date(currentYear, currentDate.getMonth() + 1, 1)
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

    const monthlyAmount = monthlyEarnings[0]?.total || 0;

    // Update user's monthly earnings record
    await User.findOneAndUpdate(
      {
        _id: userId,
        'earnings.monthlyEarnings.month': currentMonth,
        'earnings.monthlyEarnings.year': currentYear
      },
      {
        $set: {
          'earnings.monthlyEarnings.$.amount': monthlyAmount
        }
      }
    );

    // If no record exists for current month, create one
    const userWithMonthlyRecord = await User.findOne({
      _id: userId,
      'earnings.monthlyEarnings': {
        $elemMatch: {
          month: currentMonth,
          year: currentYear
        }
      }
    });

    if (!userWithMonthlyRecord) {
      await User.findByIdAndUpdate(userId, {
        $push: {
          'earnings.monthlyEarnings': {
            month: currentMonth,
            year: currentYear,
            amount: monthlyAmount
          }
        }
      });
    }

    return monthlyAmount;

  } catch (error) {
    console.error('Error updating monthly earnings:', error);
    throw error;
  }
};

module.exports = {
  processCommission,
  createCommissionTransaction,
  calculateNetworkEarnings,
  getCommissionHistory,
  updateMonthlyEarnings
};