const express = require('express');
const User = require('../models/User');
const { verifyToken, requireKYC } = require('../middleware/auth');

const router = express.Router();

// Get insurance products
router.get('/products', async (req, res) => {
  try {
    const insuranceProducts = [
      {
        id: 'term_life',
        name: 'Term Life Insurance',
        description: 'Pure life cover at affordable premiums',
        minCoverage: 500000,
        maxCoverage: 10000000,
        ageLimit: '18-65 years',
        features: ['High coverage', 'Low premium', 'Tax benefits']
      },
      {
        id: 'health_insurance',
        name: 'Health Insurance',
        description: 'Comprehensive health coverage for family',
        minCoverage: 200000,
        maxCoverage: 5000000,
        ageLimit: '18-75 years',
        features: ['Cashless treatment', 'Pre-post hospitalization', 'Family floater']
      },
      {
        id: 'motor_insurance',
        name: 'Motor Insurance',
        description: 'Complete protection for your vehicle',
        minCoverage: 100000,
        maxCoverage: 2000000,
        features: ['Third party coverage', 'Own damage', 'Personal accident']
      }
    ];

    res.json({
      success: true,
      data: insuranceProducts
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch insurance products',
      error: error.message
    });
  }
});

// Apply for insurance
router.post('/apply', verifyToken, requireKYC, async (req, res) => {
  try {
    const {
      insuranceType,
      coverageAmount,
      premium,
      duration,
      nominees
    } = req.body;

    if (!insuranceType || !coverageAmount || !premium) {
      return res.status(400).json({
        success: false,
        message: 'Required fields missing'
      });
    }

    const policyId = `POL${Date.now()}${Math.random().toString(36).substr(2, 5)}`;

    // Mock approval (replace with actual underwriting)
    const isApproved = Math.random() > 0.2; // 80% approval rate
    const status = isApproved ? 'active' : 'rejected';

    if (isApproved) {
      req.user.services.insurance.policies.push({
        policyId,
        type: insuranceType,
        premium,
        coverageAmount,
        status,
        startDate: new Date(),
        endDate: new Date(Date.now() + duration * 365 * 24 * 60 * 60 * 1000)
      });

      await req.user.save();
    }

    res.json({
      success: true,
      message: `Insurance application ${status}`,
      data: {
        policyId,
        status,
        coverageAmount,
        premium
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to process insurance application',
      error: error.message
    });
  }
});

// Get user's policies
router.get('/my-policies', verifyToken, async (req, res) => {
  try {
    res.json({
      success: true,
      data: req.user.services.insurance.policies
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch policies',
      error: error.message
    });
  }
});

module.exports = router;