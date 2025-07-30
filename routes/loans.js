const express = require('express');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const { verifyToken, requireKYC } = require('../middleware/auth');

const router = express.Router();

// Get loan products
router.get('/products', verifyToken, async (req, res) => {
  try {
    const loanProducts = [
      {
        id: 'personal_loan',
        name: 'Personal Loan',
        description: 'Quick personal loan for immediate needs',
        minAmount: 10000,
        maxAmount: 500000,
        interestRate: '12-24%',
        tenure: '12-60 months',
        features: ['Quick approval', 'Minimal documentation', 'Flexible repayment']
      },
      {
        id: 'business_loan',
        name: 'Business Loan',
        description: 'Grow your business with our business loans',
        minAmount: 50000,
        maxAmount: 2000000,
        interestRate: '14-20%',
        tenure: '12-84 months',
        features: ['Business growth', 'Working capital', 'Equipment financing']
      },
      {
        id: 'home_loan',
        name: 'Home Loan',
        description: 'Make your dream home a reality',
        minAmount: 500000,
        maxAmount: 10000000,
        interestRate: '8.5-12%',
        tenure: '5-30 years',
        features: ['Low interest rates', 'Long tenure', 'Tax benefits']
      }
    ];

    res.json({
      success: true,
      data: loanProducts
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch loan products',
      error: error.message
    });
  }
});

// Apply for loan
router.post('/apply', verifyToken, requireKYC, async (req, res) => {
  try {
    const {
      loanType,
      amount,
      tenure,
      purpose,
      monthlyIncome,
      employmentType,
      companyName
    } = req.body;

    // Basic validation
    if (!loanType || !amount || !tenure || !monthlyIncome) {
      return res.status(400).json({
        success: false,
        message: 'Required fields missing'
      });
    }

    // Generate loan application ID
    const loanId = `LOAN${Date.now()}${Math.random().toString(36).substr(2, 5)}`;

    // Mock approval logic (replace with actual credit assessment)
    const isApproved = Math.random() > 0.3; // 70% approval rate for demo
    const status = isApproved ? 'approved' : 'rejected';

    // Add to user's loan records
    req.user.services.loans.currentLoans.push({
      loanId,
      amount,
      status,
      appliedDate: new Date()
    });

    if (isApproved) {
      // Create disbursement transaction
      const transaction = new Transaction({
        userId: req.user._id,
        type: 'loan_disbursement',
        amount: amount,
        status: 'completed',
        serviceDetails: {
          loanId,
          loanAmount: amount,
          tenure: tenure,
          interestRate: 15 // Mock rate
        },
        completedAt: new Date()
      });

      await transaction.save();

      // Add to wallet
      req.user.wallet.balance += amount;
    }

    await req.user.save();

    res.json({
      success: true,
      message: `Loan application ${status}`,
      data: {
        loanId,
        amount,
        status,
        ...(isApproved && { disbursementAmount: amount })
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to process loan application',
      error: error.message
    });
  }
});

// Get user's loans
router.get('/my-loans', verifyToken, async (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        loans: req.user.services.loans.currentLoans,
        eligibleAmount: req.user.services.loans.eligibleAmount,
        creditScore: req.user.services.loans.creditScore
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch loans',
      error: error.message
    });
  }
});

module.exports = router;