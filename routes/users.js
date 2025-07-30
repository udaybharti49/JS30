const express = require('express');
const User = require('../models/User');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

// Get user wallet details
router.get('/wallet', verifyToken, async (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        balance: req.user.wallet.balance,
        frozenAmount: req.user.wallet.frozenAmount,
        totalBalance: req.user.wallet.balance + req.user.wallet.frozenAmount
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch wallet details',
      error: error.message
    });
  }
});

// Add money to wallet (demo - in production would integrate with payment gateway)
router.post('/wallet/add', verifyToken, async (req, res) => {
  try {
    const { amount } = req.body;
    
    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid amount is required'
      });
    }

    req.user.wallet.balance += amount;
    await req.user.save();

    res.json({
      success: true,
      message: 'Money added to wallet successfully',
      data: {
        addedAmount: amount,
        newBalance: req.user.wallet.balance
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to add money to wallet',
      error: error.message
    });
  }
});

module.exports = router;