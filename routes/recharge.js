const express = require('express');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const { verifyToken } = require('../middleware/auth');
const { processCommission } = require('../utils/commission');
const { rechargeAPI } = require('../services/rechargeService');

const router = express.Router();

// Get available operators
router.get('/operators', verifyToken, async (req, res) => {
  try {
    const { type } = req.query; // mobile, dth, datacard, etc.
    
    const operators = await rechargeAPI.getOperators(type);
    
    res.json({
      success: true,
      data: operators
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch operators',
      error: error.message
    });
  }
});

// Get recharge plans for operator
router.get('/plans/:operatorCode', verifyToken, async (req, res) => {
  try {
    const { operatorCode } = req.params;
    const { circle } = req.query;
    
    const plans = await rechargeAPI.getPlans(operatorCode, circle);
    
    res.json({
      success: true,
      data: plans
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch plans',
      error: error.message
    });
  }
});

// Get user's recharge history
router.get('/history', verifyToken, async (req, res) => {
  try {
    const { page = 1, limit = 10, status, type } = req.query;
    
    const query = {
      userId: req.user._id,
      type: 'recharge'
    };
    
    if (status) query.status = status;
    if (type) query.subType = type;
    
    const transactions = await Transaction.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .populate('userId', 'firstName lastName email');
    
    const total = await Transaction.countDocuments(query);
    
    res.json({
      success: true,
      data: {
        transactions,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalRecords: total,
          hasNext: page < Math.ceil(total / limit),
          hasPrev: page > 1
        }
      }
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch recharge history',
      error: error.message
    });
  }
});

// Process mobile recharge
router.post('/mobile', verifyToken, async (req, res) => {
  try {
    const {
      mobileNumber,
      operatorCode,
      operatorName,
      amount,
      circle
    } = req.body;

    // Validate input
    if (!mobileNumber || !operatorCode || !amount) {
      return res.status(400).json({
        success: false,
        message: 'Mobile number, operator, and amount are required'
      });
    }

    // Check user wallet balance
    const user = await User.findById(req.user._id);
    if (user.wallet.balance < amount) {
      return res.status(400).json({
        success: false,
        message: 'Insufficient wallet balance'
      });
    }

    // Create transaction
    const transaction = new Transaction({
      userId: req.user._id,
      type: 'recharge',
      subType: 'mobile_recharge',
      amount: amount,
      status: 'processing',
      serviceDetails: {
        operatorName,
        operatorCode,
        mobileNumber,
        rechargeAmount: amount
      },
      balanceDetails: {
        beforeBalance: user.wallet.balance,
        afterBalance: user.wallet.balance - amount,
        walletUsed: amount,
        gatewayAmount: 0
      }
    });

    await transaction.save();

    try {
      // Process recharge through API
      const rechargeResult = await rechargeAPI.processRecharge({
        mobileNumber,
        operatorCode,
        amount,
        circle,
        transactionId: transaction.transactionId
      });

      if (rechargeResult.success) {
        // Update transaction status
        transaction.status = 'completed';
        transaction.completedAt = new Date();
        transaction.apiDetails = {
          apiProvider: 'recharge_api',
          apiTransactionId: rechargeResult.operatorTransactionId,
          responsePayload: rechargeResult
        };

        // Deduct amount from user wallet
        user.wallet.balance -= amount;
        user.services.recharge.totalRecharges += 1;
        user.services.recharge.totalAmount += amount;

        await Promise.all([
          transaction.save(),
          user.save()
        ]);

        // Process commissions for upline users
        await processCommission(transaction, user);

        res.json({
          success: true,
          message: 'Recharge completed successfully',
          data: {
            transaction: {
              id: transaction._id,
              transactionId: transaction.transactionId,
              amount: transaction.amount,
              status: transaction.status,
              operatorTransactionId: rechargeResult.operatorTransactionId
            }
          }
        });

      } else {
        // Recharge failed
        transaction.status = 'failed';
        transaction.failedAt = new Date();
        transaction.errorDetails = {
          errorCode: rechargeResult.errorCode,
          errorMessage: rechargeResult.errorMessage
        };

        await transaction.save();

        res.status(400).json({
          success: false,
          message: 'Recharge failed',
          error: rechargeResult.errorMessage,
          data: {
            transactionId: transaction.transactionId
          }
        });
      }

    } catch (apiError) {
      // API call failed
      transaction.status = 'failed';
      transaction.failedAt = new Date();
      transaction.errorDetails = {
        errorMessage: apiError.message
      };

      await transaction.save();

      res.status(500).json({
        success: false,
        message: 'Recharge processing failed',
        error: apiError.message,
        data: {
          transactionId: transaction.transactionId
        }
      });
    }

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to process recharge',
      error: error.message
    });
  }
});

// Process DTH recharge
router.post('/dth', verifyToken, async (req, res) => {
  try {
    const {
      customerNumber,
      operatorCode,
      operatorName,
      amount
    } = req.body;

    // Validate input
    if (!customerNumber || !operatorCode || !amount) {
      return res.status(400).json({
        success: false,
        message: 'Customer number, operator, and amount are required'
      });
    }

    // Check user wallet balance
    const user = await User.findById(req.user._id);
    if (user.wallet.balance < amount) {
      return res.status(400).json({
        success: false,
        message: 'Insufficient wallet balance'
      });
    }

    // Create transaction
    const transaction = new Transaction({
      userId: req.user._id,
      type: 'recharge',
      subType: 'dth_recharge',
      amount: amount,
      status: 'processing',
      serviceDetails: {
        operatorName,
        operatorCode,
        mobileNumber: customerNumber, // Using same field for customer number
        rechargeAmount: amount
      },
      balanceDetails: {
        beforeBalance: user.wallet.balance,
        afterBalance: user.wallet.balance - amount,
        walletUsed: amount,
        gatewayAmount: 0
      }
    });

    await transaction.save();

    try {
      // Process DTH recharge through API
      const rechargeResult = await rechargeAPI.processDTHRecharge({
        customerNumber,
        operatorCode,
        amount,
        transactionId: transaction.transactionId
      });

      if (rechargeResult.success) {
        // Update transaction and user
        transaction.status = 'completed';
        transaction.completedAt = new Date();
        transaction.apiDetails = {
          apiProvider: 'recharge_api',
          apiTransactionId: rechargeResult.operatorTransactionId,
          responsePayload: rechargeResult
        };

        user.wallet.balance -= amount;
        user.services.recharge.totalRecharges += 1;
        user.services.recharge.totalAmount += amount;

        await Promise.all([
          transaction.save(),
          user.save()
        ]);

        // Process commissions
        await processCommission(transaction, user);

        res.json({
          success: true,
          message: 'DTH recharge completed successfully',
          data: {
            transaction: {
              id: transaction._id,
              transactionId: transaction.transactionId,
              amount: transaction.amount,
              status: transaction.status,
              operatorTransactionId: rechargeResult.operatorTransactionId
            }
          }
        });

      } else {
        transaction.status = 'failed';
        transaction.failedAt = new Date();
        transaction.errorDetails = {
          errorCode: rechargeResult.errorCode,
          errorMessage: rechargeResult.errorMessage
        };

        await transaction.save();

        res.status(400).json({
          success: false,
          message: 'DTH recharge failed',
          error: rechargeResult.errorMessage
        });
      }

    } catch (apiError) {
      transaction.status = 'failed';
      transaction.failedAt = new Date();
      transaction.errorDetails = {
        errorMessage: apiError.message
      };

      await transaction.save();

      res.status(500).json({
        success: false,
        message: 'DTH recharge processing failed',
        error: apiError.message
      });
    }

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to process DTH recharge',
      error: error.message
    });
  }
});

// Check recharge status
router.get('/status/:transactionId', verifyToken, async (req, res) => {
  try {
    const { transactionId } = req.params;
    
    const transaction = await Transaction.findOne({
      transactionId,
      userId: req.user._id
    });
    
    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found'
      });
    }
    
    // If transaction is still processing, check with API
    if (transaction.status === 'processing') {
      try {
        const statusResult = await rechargeAPI.checkStatus(
          transaction.apiDetails?.apiTransactionId || transactionId
        );
        
        if (statusResult.status !== transaction.status) {
          transaction.status = statusResult.status;
          if (statusResult.status === 'completed') {
            transaction.completedAt = new Date();
          } else if (statusResult.status === 'failed') {
            transaction.failedAt = new Date();
            transaction.errorDetails = {
              errorMessage: statusResult.errorMessage
            };
          }
          await transaction.save();
        }
      } catch (apiError) {
        console.error('Error checking recharge status:', apiError);
      }
    }
    
    res.json({
      success: true,
      data: {
        transaction: {
          transactionId: transaction.transactionId,
          amount: transaction.amount,
          status: transaction.status,
          type: transaction.subType,
          serviceDetails: transaction.serviceDetails,
          createdAt: transaction.createdAt,
          completedAt: transaction.completedAt
        }
      }
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to check transaction status',
      error: error.message
    });
  }
});

// Get commission earned from recharges
router.get('/commissions', verifyToken, async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    
    const commissions = await Transaction.find({
      'commissionDistribution.userId': req.user._id,
      type: 'recharge'
    })
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .populate('userId', 'firstName lastName email phone');
    
    const total = await Transaction.countDocuments({
      'commissionDistribution.userId': req.user._id,
      type: 'recharge'
    });
    
    // Calculate total commission amount
    const totalCommissionAmount = commissions.reduce((total, transaction) => {
      const userCommission = transaction.commissionDistribution.find(
        comm => comm.userId.toString() === req.user._id.toString()
      );
      return total + (userCommission ? userCommission.amount : 0);
    }, 0);
    
    res.json({
      success: true,
      data: {
        commissions,
        totalCommissionAmount,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalRecords: total
        }
      }
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch commission data',
      error: error.message
    });
  }
});

module.exports = router;