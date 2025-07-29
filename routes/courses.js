const express = require('express');
const Course = require('../models/Course');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const { verifyToken, optionalAuth } = require('../middleware/auth');
const { processCommission } = require('../utils/commission');

const router = express.Router();

// Get all courses (with optional filters)
router.get('/', optionalAuth, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 12,
      category,
      difficulty,
      priceRange,
      sortBy = 'newest',
      search
    } = req.query;

    // Build query
    const query = { status: 'published', isActive: true };
    
    if (category) query.category = category;
    if (difficulty) query.difficulty = difficulty;
    if (search) {
      query.$text = { $search: search };
    }
    
    if (priceRange) {
      const [min, max] = priceRange.split('-').map(Number);
      query['pricing.discountedPrice'] = { $gte: min, $lte: max };
    }

    // Build sort
    let sort = {};
    switch (sortBy) {
      case 'newest':
        sort = { createdAt: -1 };
        break;
      case 'oldest':
        sort = { createdAt: 1 };
        break;
      case 'price_low':
        sort = { 'pricing.discountedPrice': 1 };
        break;
      case 'price_high':
        sort = { 'pricing.discountedPrice': -1 };
        break;
      case 'rating':
        sort = { 'stats.averageRating': -1 };
        break;
      case 'popular':
        sort = { 'stats.enrollments': -1 };
        break;
      default:
        sort = { createdAt: -1 };
    }

    const courses = await Course.find(query)
      .sort(sort)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .select('-curriculum.lessons.videoUrl -reviews'); // Exclude sensitive data

    const total = await Course.countDocuments(query);

    // Get categories for filters
    const categories = await Course.distinct('category', { status: 'published', isActive: true });

    res.json({
      success: true,
      data: {
        courses,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalRecords: total,
          hasNext: page < Math.ceil(total / limit),
          hasPrev: page > 1
        },
        filters: {
          categories,
          difficulties: ['Beginner', 'Intermediate', 'Advanced']
        }
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch courses',
      error: error.message
    });
  }
});

// Get featured courses
router.get('/featured', async (req, res) => {
  try {
    const featuredCourses = await Course.find({
      status: 'published',
      isActive: true,
      isFeatured: true
    })
    .sort({ 'stats.enrollments': -1 })
    .limit(6)
    .select('-curriculum.lessons.videoUrl -reviews');

    res.json({
      success: true,
      data: featuredCourses
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch featured courses',
      error: error.message
    });
  }
});

// Get single course details
router.get('/:courseId', optionalAuth, async (req, res) => {
  try {
    const { courseId } = req.params;
    
    const course = await Course.findOne({
      _id: courseId,
      status: 'published',
      isActive: true
    }).populate('reviews.userId', 'firstName lastName profileImage');

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    // Check if user has purchased this course
    let hasPurchased = false;
    let purchaseDetails = null;
    
    if (req.user) {
      const purchasedCourse = req.user.services.courses.purchasedCourses.find(
        pc => pc.courseId.toString() === courseId
      );
      
      if (purchasedCourse) {
        hasPurchased = true;
        purchaseDetails = purchasedCourse;
      }
    }

    // If user hasn't purchased, hide premium content
    let courseData = course.toObject();
    if (!hasPurchased) {
      courseData.curriculum = courseData.curriculum.map(module => ({
        ...module,
        lessons: module.lessons.map(lesson => ({
          title: lesson.title,
          duration: lesson.duration,
          isPreview: lesson.isPreview,
          ...(lesson.isPreview && { videoUrl: lesson.videoUrl })
        }))
      }));
    }

    // Get related courses
    const relatedCourses = await Course.find({
      _id: { $ne: courseId },
      category: course.category,
      status: 'published',
      isActive: true
    })
    .sort({ 'stats.enrollments': -1 })
    .limit(4)
    .select('title thumbnail pricing stats difficulty');

    res.json({
      success: true,
      data: {
        course: courseData,
        hasPurchased,
        purchaseDetails,
        relatedCourses
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch course details',
      error: error.message
    });
  }
});

// Purchase course
router.post('/:courseId/purchase', verifyToken, async (req, res) => {
  try {
    const { courseId } = req.params;
    const { paymentMethod = 'wallet' } = req.body;

    const course = await Course.findOne({
      _id: courseId,
      status: 'published',
      isActive: true
    });

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    // Check if user already purchased
    const alreadyPurchased = req.user.services.courses.purchasedCourses.find(
      pc => pc.courseId.toString() === courseId
    );

    if (alreadyPurchased) {
      return res.status(400).json({
        success: false,
        message: 'Course already purchased'
      });
    }

    const amount = course.pricing.discountedPrice;

    // Check wallet balance
    if (paymentMethod === 'wallet' && req.user.wallet.balance < amount) {
      return res.status(400).json({
        success: false,
        message: 'Insufficient wallet balance'
      });
    }

    // Create transaction
    const transaction = new Transaction({
      userId: req.user._id,
      type: 'course_purchase',
      amount: amount,
      status: 'completed',
      serviceDetails: {
        courseId: course._id,
        courseName: course.title
      },
      balanceDetails: {
        beforeBalance: req.user.wallet.balance,
        afterBalance: req.user.wallet.balance - amount,
        walletUsed: amount,
        gatewayAmount: 0
      },
      completedAt: new Date()
    });

    await transaction.save();

    // Update user wallet and course list
    req.user.wallet.balance -= amount;
    req.user.services.courses.purchasedCourses.push({
      courseId: course._id,
      purchaseDate: new Date(),
      amount: amount,
      status: 'active'
    });
    req.user.services.courses.totalSpent += amount;

    await req.user.save();

    // Update course statistics
    course.stats.enrollments += 1;
    course.stats.totalRevenue += amount;
    await course.save();

    // Process MLM commissions
    await processCommission(transaction, req.user);

    res.json({
      success: true,
      message: 'Course purchased successfully',
      data: {
        transaction: {
          id: transaction._id,
          transactionId: transaction.transactionId,
          amount: transaction.amount,
          status: transaction.status
        },
        course: {
          id: course._id,
          title: course.title,
          thumbnail: course.thumbnail
        }
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to purchase course',
      error: error.message
    });
  }
});

// Get user's purchased courses
router.get('/my/purchased', verifyToken, async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;

    let purchasedCourses = req.user.services.courses.purchasedCourses;

    if (status) {
      purchasedCourses = purchasedCourses.filter(pc => pc.status === status);
    }

    // Paginate
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + parseInt(limit);
    const paginatedCourses = purchasedCourses.slice(startIndex, endIndex);

    // Get course details
    const courseIds = paginatedCourses.map(pc => pc.courseId);
    const courses = await Course.find({
      _id: { $in: courseIds }
    }).select('title thumbnail category difficulty stats pricing');

    // Combine purchase info with course details
    const coursesWithDetails = paginatedCourses.map(pc => {
      const courseDetail = courses.find(c => c._id.toString() === pc.courseId.toString());
      return {
        purchaseInfo: pc,
        courseDetails: courseDetail
      };
    });

    res.json({
      success: true,
      data: {
        courses: coursesWithDetails,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(purchasedCourses.length / limit),
          totalRecords: purchasedCourses.length,
          hasNext: endIndex < purchasedCourses.length,
          hasPrev: page > 1
        },
        summary: {
          totalCourses: req.user.services.courses.purchasedCourses.length,
          totalSpent: req.user.services.courses.totalSpent,
          activeCourses: req.user.services.courses.purchasedCourses.filter(
            pc => pc.status === 'active'
          ).length,
          completedCourses: req.user.services.courses.purchasedCourses.filter(
            pc => pc.status === 'completed'
          ).length
        }
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch purchased courses',
      error: error.message
    });
  }
});

// Mark course as completed
router.post('/:courseId/complete', verifyToken, async (req, res) => {
  try {
    const { courseId } = req.params;

    const purchasedCourse = req.user.services.courses.purchasedCourses.find(
      pc => pc.courseId.toString() === courseId
    );

    if (!purchasedCourse) {
      return res.status(404).json({
        success: false,
        message: 'Course not purchased'
      });
    }

    if (purchasedCourse.status === 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Course already completed'
      });
    }

    // Mark as completed
    purchasedCourse.status = 'completed';
    await req.user.save();

    // Update course stats
    await Course.findByIdAndUpdate(courseId, {
      $inc: { 'stats.completions': 1 }
    });

    res.json({
      success: true,
      message: 'Course marked as completed',
      data: {
        courseId,
        status: 'completed'
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to mark course as completed',
      error: error.message
    });
  }
});

// Add course review
router.post('/:courseId/review', verifyToken, async (req, res) => {
  try {
    const { courseId } = req.params;
    const { rating, comment } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Rating must be between 1 and 5'
      });
    }

    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    // Check if user purchased the course
    const hasPurchased = req.user.services.courses.purchasedCourses.find(
      pc => pc.courseId.toString() === courseId
    );

    if (!hasPurchased) {
      return res.status(400).json({
        success: false,
        message: 'You must purchase the course to leave a review'
      });
    }

    // Check if user already reviewed
    const existingReview = course.reviews.find(
      review => review.userId.toString() === req.user._id.toString()
    );

    if (existingReview) {
      // Update existing review
      existingReview.rating = rating;
      existingReview.comment = comment;
    } else {
      // Add new review
      course.reviews.push({
        userId: req.user._id,
        rating,
        comment,
        createdAt: new Date()
      });
    }

    await course.save();
    await course.updateStats();

    res.json({
      success: true,
      message: existingReview ? 'Review updated successfully' : 'Review added successfully',
      data: {
        rating,
        comment
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to add review',
      error: error.message
    });
  }
});

// Get course categories
router.get('/categories/list', async (req, res) => {
  try {
    const categories = await Course.aggregate([
      {
        $match: { status: 'published', isActive: true }
      },
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
          avgPrice: { $avg: '$pricing.discountedPrice' },
          avgRating: { $avg: '$stats.averageRating' }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);

    res.json({
      success: true,
      data: categories
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch categories',
      error: error.message
    });
  }
});

module.exports = router;