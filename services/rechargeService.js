const axios = require('axios');

class RechargeService {
  constructor() {
    this.baseURL = process.env.RECHARGE_API_URL;
    this.apiKey = process.env.RECHARGE_API_KEY;
    this.client = axios.create({
      baseURL: this.baseURL,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000 // 30 seconds timeout
    });
  }

  // Get available operators
  async getOperators(type = 'mobile') {
    try {
      // Mock data for demo - replace with actual API call
      const operators = {
        mobile: [
          { code: 'JIO', name: 'Reliance Jio', type: 'Prepaid' },
          { code: 'AIRTEL', name: 'Airtel', type: 'Prepaid' },
          { code: 'VI', name: 'Vodafone Idea', type: 'Prepaid' },
          { code: 'BSNL', name: 'BSNL', type: 'Prepaid' },
          { code: 'AIRTEL_POST', name: 'Airtel Postpaid', type: 'Postpaid' },
          { code: 'JIO_POST', name: 'Jio Postpaid', type: 'Postpaid' }
        ],
        dth: [
          { code: 'TATA_SKY', name: 'Tata Play', type: 'DTH' },
          { code: 'AIRTEL_DTH', name: 'Airtel Digital TV', type: 'DTH' },
          { code: 'DISH_TV', name: 'Dish TV', type: 'DTH' },
          { code: 'D2H', name: 'Videocon D2H', type: 'DTH' },
          { code: 'SUN_DIRECT', name: 'Sun Direct', type: 'DTH' }
        ],
        datacard: [
          { code: 'JIO_DATA', name: 'Jio DataCard', type: 'DataCard' },
          { code: 'AIRTEL_DATA', name: 'Airtel DataCard', type: 'DataCard' }
        ]
      };

      return operators[type] || [];

      // Uncomment below for actual API integration
      /*
      const response = await this.client.get('/operators', {
        params: { type }
      });
      return response.data.operators || [];
      */

    } catch (error) {
      console.error('Error fetching operators:', error);
      throw new Error('Failed to fetch operators');
    }
  }

  // Get recharge plans for specific operator
  async getPlans(operatorCode, circle = 'All') {
    try {
      // Mock data for demo - replace with actual API call
      const plans = {
        'JIO': [
          { amount: 149, validity: 28, description: '1GB/day + Unlimited Calls + 100 SMS/day' },
          { amount: 209, validity: 28, description: '1.5GB/day + Unlimited Calls + 100 SMS/day' },
          { amount: 299, validity: 28, description: '2GB/day + Unlimited Calls + 100 SMS/day' },
          { amount: 399, validity: 56, description: '1.5GB/day + Unlimited Calls + 100 SMS/day' },
          { amount: 666, validity: 84, description: '1.5GB/day + Unlimited Calls + 100 SMS/day' },
          { amount: 719, validity: 84, description: '2GB/day + Unlimited Calls + 100 SMS/day' }
        ],
        'AIRTEL': [
          { amount: 155, validity: 28, description: '1GB/day + Unlimited Calls + 100 SMS/day' },
          { amount: 265, validity: 28, description: '1.5GB/day + Unlimited Calls + 100 SMS/day' },
          { amount: 319, validity: 28, description: '2GB/day + Unlimited Calls + 100 SMS/day' },
          { amount: 479, validity: 56, description: '1.5GB/day + Unlimited Calls + 100 SMS/day' },
          { amount: 719, validity: 84, description: '1.5GB/day + Unlimited Calls + 100 SMS/day' }
        ]
      };

      return plans[operatorCode] || [];

      // Uncomment below for actual API integration
      /*
      const response = await this.client.get(`/plans/${operatorCode}`, {
        params: { circle }
      });
      return response.data.plans || [];
      */

    } catch (error) {
      console.error('Error fetching plans:', error);
      throw new Error('Failed to fetch recharge plans');
    }
  }

  // Process mobile recharge
  async processRecharge(rechargeData) {
    try {
      const {
        mobileNumber,
        operatorCode,
        amount,
        circle,
        transactionId
      } = rechargeData;

      // Validate input
      if (!mobileNumber || !operatorCode || !amount) {
        throw new Error('Missing required fields for recharge');
      }

      // Mock API response for demo - replace with actual API call
      const mockResponse = {
        success: Math.random() > 0.1, // 90% success rate for demo
        operatorTransactionId: `OP${Date.now()}${Math.random().toString(36).substr(2, 5)}`,
        status: 'completed',
        message: 'Recharge completed successfully',
        timestamp: new Date().toISOString()
      };

      if (!mockResponse.success) {
        mockResponse.errorCode = 'RECHARGE_FAILED';
        mockResponse.errorMessage = 'Operator service temporarily unavailable';
        mockResponse.status = 'failed';
      }

      return mockResponse;

      // Uncomment below for actual API integration
      /*
      const response = await this.client.post('/recharge', {
        mobile: mobileNumber,
        operator: operatorCode,
        amount: amount,
        circle: circle,
        clientTransactionId: transactionId
      });

      return {
        success: response.data.status === 'SUCCESS',
        operatorTransactionId: response.data.operatorTransactionId,
        status: response.data.status.toLowerCase(),
        message: response.data.message,
        errorCode: response.data.errorCode,
        errorMessage: response.data.errorMessage
      };
      */

    } catch (error) {
      console.error('Error processing recharge:', error);
      return {
        success: false,
        status: 'failed',
        errorCode: 'API_ERROR',
        errorMessage: error.message || 'Recharge processing failed'
      };
    }
  }

  // Process DTH recharge
  async processDTHRecharge(dthData) {
    try {
      const {
        customerNumber,
        operatorCode,
        amount,
        transactionId
      } = dthData;

      // Validate input
      if (!customerNumber || !operatorCode || !amount) {
        throw new Error('Missing required fields for DTH recharge');
      }

      // Mock API response for demo
      const mockResponse = {
        success: Math.random() > 0.1, // 90% success rate for demo
        operatorTransactionId: `DTH${Date.now()}${Math.random().toString(36).substr(2, 5)}`,
        status: 'completed',
        message: 'DTH recharge completed successfully',
        timestamp: new Date().toISOString()
      };

      if (!mockResponse.success) {
        mockResponse.errorCode = 'DTH_RECHARGE_FAILED';
        mockResponse.errorMessage = 'DTH operator service temporarily unavailable';
        mockResponse.status = 'failed';
      }

      return mockResponse;

      // Uncomment below for actual API integration
      /*
      const response = await this.client.post('/dth-recharge', {
        customerNumber: customerNumber,
        operator: operatorCode,
        amount: amount,
        clientTransactionId: transactionId
      });

      return {
        success: response.data.status === 'SUCCESS',
        operatorTransactionId: response.data.operatorTransactionId,
        status: response.data.status.toLowerCase(),
        message: response.data.message,
        errorCode: response.data.errorCode,
        errorMessage: response.data.errorMessage
      };
      */

    } catch (error) {
      console.error('Error processing DTH recharge:', error);
      return {
        success: false,
        status: 'failed',
        errorCode: 'API_ERROR',
        errorMessage: error.message || 'DTH recharge processing failed'
      };
    }
  }

  // Check recharge status
  async checkStatus(transactionId) {
    try {
      // Mock status check for demo
      const statuses = ['completed', 'failed', 'processing'];
      const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];

      return {
        transactionId: transactionId,
        status: randomStatus,
        message: `Transaction is ${randomStatus}`,
        timestamp: new Date().toISOString()
      };

      // Uncomment below for actual API integration
      /*
      const response = await this.client.get(`/status/${transactionId}`);
      
      return {
        transactionId: transactionId,
        status: response.data.status.toLowerCase(),
        message: response.data.message,
        operatorTransactionId: response.data.operatorTransactionId
      };
      */

    } catch (error) {
      console.error('Error checking recharge status:', error);
      throw new Error('Failed to check recharge status');
    }
  }

  // Get operator circle/region info
  async getCircles() {
    try {
      // Mock circle data for demo
      const circles = [
        { code: 'AP', name: 'Andhra Pradesh' },
        { code: 'AS', name: 'Assam' },
        { code: 'BH', name: 'Bihar' },
        { code: 'DL', name: 'Delhi' },
        { code: 'GJ', name: 'Gujarat' },
        { code: 'HR', name: 'Haryana' },
        { code: 'HP', name: 'Himachal Pradesh' },
        { code: 'JK', name: 'Jammu & Kashmir' },
        { code: 'KA', name: 'Karnataka' },
        { code: 'KL', name: 'Kerala' },
        { code: 'MP', name: 'Madhya Pradesh' },
        { code: 'MH', name: 'Maharashtra' },
        { code: 'MN', name: 'Manipur' },
        { code: 'MZ', name: 'Mizoram' },
        { code: 'NE', name: 'North East' },
        { code: 'OR', name: 'Orissa' },
        { code: 'PB', name: 'Punjab' },
        { code: 'RJ', name: 'Rajasthan' },
        { code: 'TN', name: 'Tamil Nadu' },
        { code: 'TS', name: 'Telangana' },
        { code: 'UP_E', name: 'UP East' },
        { code: 'UP_W', name: 'UP West' },
        { code: 'WB', name: 'West Bengal' }
      ];

      return circles;

    } catch (error) {
      console.error('Error fetching circles:', error);
      throw new Error('Failed to fetch circles');
    }
  }

  // Validate mobile number
  validateMobileNumber(mobile) {
    const mobileRegex = /^[6-9]\d{9}$/;
    return mobileRegex.test(mobile);
  }

  // Get operator from mobile number (basic detection)
  detectOperator(mobile) {
    // This is a simplified operator detection
    // In real implementation, you would use a more comprehensive database
    const operatorSeries = {
      'JIO': ['6', '7', '8', '9'],
      'AIRTEL': ['6', '7', '8', '9'],
      'VI': ['6', '7', '8', '9'],
      'BSNL': ['6', '7', '8', '9']
    };

    // Return default as this is just a demo
    return 'JIO';
  }
}

// Create singleton instance
const rechargeAPI = new RechargeService();

module.exports = {
  rechargeAPI,
  RechargeService
};