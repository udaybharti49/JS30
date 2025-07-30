const express = require('express');
const User = require('../models/User');
const { verifyToken, requireKYC } = require('../middleware/auth');

const router = express.Router();

// Get banking products
router.get('/products', async (req, res) => {
  try {
    const bankingProducts = [
      {
        id: 'kotak_savings',
        bankName: 'Kotak Mahindra Bank',
        accountType: 'Savings Account',
        description: 'Digital savings account with attractive interest rates',
        features: [
          'Zero balance account',
          'Free debit card',
          'Mobile banking',
          'Internet banking',
          'ATM access nationwide'
        ],
        interestRate: '3.5% - 6.0%',
        minBalance: 0,
        documents: ['Aadhar Card', 'PAN Card', 'Address Proof']
      },
      {
        id: 'kotak_current',
        bankName: 'Kotak Mahindra Bank',
        accountType: 'Current Account',
        description: 'Business current account for entrepreneurs',
        features: [
          'High transaction limits',
          'Free cash deposit',
          'Business banking services',
          'Overdraft facility',
          'Trade services'
        ],
        minBalance: 25000,
        documents: ['Business registration', 'Aadhar Card', 'PAN Card']
      }
    ];

    res.json({
      success: true,
      data: bankingProducts
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch banking products',
      error: error.message
    });
  }
});

// Apply for Kotak bank account
router.post('/kotak/apply', verifyToken, requireKYC, async (req, res) => {
  try {
    const {
      accountType,
      purpose,
      initialDeposit,
      branchPreference,
      nomineeDetails
    } = req.body;

    if (!accountType) {
      return res.status(400).json({
        success: false,
        message: 'Account type is required'
      });
    }

    // Check if already applied
    if (req.user.services.banking.kotakAccount.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Account application already exists'
      });
    }

    // Generate application reference
    const applicationRef = `KOTAK${Date.now()}${Math.random().toString(36).substr(2, 5)}`;

    // Mock approval process (replace with actual API)
    const isApproved = Math.random() > 0.1; // 90% approval rate
    const status = isApproved ? 'active' : 'pending';
    const accountNumber = isApproved ? 
      `1234${Math.random().toString().substr(2, 8)}` : null;

    // Update user's banking service
    req.user.services.banking.kotakAccount = {
      accountNumber: accountNumber,
      status: status,
      appliedDate: new Date(),
      ...(isApproved && { approvedDate: new Date() })
    };

    await req.user.save();

    res.json({
      success: true,
      message: isApproved ? 
        'Kotak bank account opened successfully' : 
        'Application submitted for review',
      data: {
        applicationRef,
        accountType,
        status,
        ...(accountNumber && { accountNumber })
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to process bank account application',
      error: error.message
    });
  }
});

// Get account status
router.get('/kotak/status', verifyToken, async (req, res) => {
  try {
    const kotakAccount = req.user.services.banking.kotakAccount;

    res.json({
      success: true,
      data: {
        status: kotakAccount.status,
        accountNumber: kotakAccount.accountNumber,
        appliedDate: kotakAccount.appliedDate,
        approvedDate: kotakAccount.approvedDate
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch account status',
      error: error.message
    });
  }
});

// Get bank branches
router.get('/branches', async (req, res) => {
  try {
    const { city, state } = req.query;

    // Mock branch data
    const branches = [
      {
        branchCode: 'KTK001',
        branchName: 'Mumbai Main Branch',
        address: 'Nariman Point, Mumbai, Maharashtra 400001',
        city: 'Mumbai',
        state: 'Maharashtra',
        phone: '+91-22-12345678',
        ifscCode: 'KKBK0000001'
      },
      {
        branchCode: 'KTK002', 
        branchName: 'Delhi Connaught Place',
        address: 'Connaught Place, New Delhi, Delhi 110001',
        city: 'Delhi',
        state: 'Delhi',
        phone: '+91-11-12345678',
        ifscCode: 'KKBK0000002'
      },
      {
        branchCode: 'KTK003',
        branchName: 'Bangalore Electronic City',
        address: 'Electronic City, Bangalore, Karnataka 560100',
        city: 'Bangalore',
        state: 'Karnataka',
        phone: '+91-80-12345678',
        ifscCode: 'KKBK0000003'
      }
    ];

    let filteredBranches = branches;
    if (city) {
      filteredBranches = filteredBranches.filter(b => 
        b.city.toLowerCase().includes(city.toLowerCase())
      );
    }
    if (state) {
      filteredBranches = filteredBranches.filter(b => 
        b.state.toLowerCase().includes(state.toLowerCase())
      );
    }

    res.json({
      success: true,
      data: filteredBranches
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch branches',
      error: error.message
    });
  }
});

module.exports = router;