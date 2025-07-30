const mongoose = require('mongoose');

const courseSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  shortDescription: {
    type: String,
    required: true,
    maxlength: 200
  },
  instructor: {
    name: String,
    bio: String,
    image: String,
    rating: { type: Number, default: 0 }
  },
  category: {
    type: String,
    required: true,
    enum: ['Technology', 'Business', 'Marketing', 'Finance', 'Health', 'Lifestyle', 'Education', 'Other']
  },
  subcategory: String,
  
  // Course Content
  thumbnail: {
    type: String,
    required: true
  },
  previewVideo: String,
  curriculum: [{
    module: String,
    lessons: [{
      title: String,
      duration: Number, // in minutes
      videoUrl: String,
      materials: [String], // PDF, docs etc.
      isPreview: { type: Boolean, default: false }
    }]
  }],
  
  // Pricing and MLM
  pricing: {
    originalPrice: {
      type: Number,
      required: true
    },
    discountedPrice: {
      type: Number,
      required: true
    },
    discountPercentage: Number,
    currency: { type: String, default: 'INR' }
  },
  
  // MLM Commission Structure
  commissionStructure: {
    level1: { type: Number, default: 10 }, // 10% for direct referral
    level2: { type: Number, default: 5 },  // 5% for 2nd level
    level3: { type: Number, default: 3 },  // 3% for 3rd level
    instructorShare: { type: Number, default: 50 }, // 50% for instructor
    platformShare: { type: Number, default: 32 } // remaining for platform
  },
  
  // Course Details
  duration: {
    total: Number, // total minutes
    weeks: Number,
    hoursPerWeek: Number
  },
  difficulty: {
    type: String,
    enum: ['Beginner', 'Intermediate', 'Advanced'],
    default: 'Beginner'
  },
  language: {
    type: String,
    default: 'Hindi'
  },
  subtitles: [String],
  
  // Requirements and Outcomes
  requirements: [String],
  learningOutcomes: [String],
  targetAudience: [String],
  
  // Course Status
  status: {
    type: String,
    enum: ['draft', 'published', 'archived'],
    default: 'draft'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isFeatured: {
    type: Boolean,
    default: false
  },
  
  // Statistics
  stats: {
    enrollments: { type: Number, default: 0 },
    completions: { type: Number, default: 0 },
    averageRating: { type: Number, default: 0 },
    totalReviews: { type: Number, default: 0 },
    totalRevenue: { type: Number, default: 0 }
  },
  
  // Reviews and Ratings
  reviews: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    rating: { type: Number, min: 1, max: 5 },
    comment: String,
    createdAt: { type: Date, default: Date.now },
    isVerified: { type: Boolean, default: false }
  }],
  
  // SEO and Marketing
  seo: {
    metaTitle: String,
    metaDescription: String,
    keywords: [String],
    slug: { type: String, unique: true }
  },
  
  tags: [String],
  publishedAt: Date,
  lastUpdated: Date,
  
}, {
  timestamps: true
});

// Create slug before saving
courseSchema.pre('save', function(next) {
  if (this.isModified('title') && !this.seo.slug) {
    this.seo.slug = this.title
      .toLowerCase()
      .replace(/[^\w ]+/g, '')
      .replace(/ +/g, '-');
  }
  
  // Calculate discount percentage
  if (this.pricing.originalPrice && this.pricing.discountedPrice) {
    this.pricing.discountPercentage = Math.round(
      ((this.pricing.originalPrice - this.pricing.discountedPrice) / this.pricing.originalPrice) * 100
    );
  }
  
  next();
});

// Calculate course statistics
courseSchema.methods.updateStats = async function() {
  const User = mongoose.model('User');
  
  // Count enrollments
  const enrollments = await User.countDocuments({
    'services.courses.purchasedCourses.courseId': this._id
  });
  
  // Count completions
  const completions = await User.countDocuments({
    'services.courses.purchasedCourses': {
      $elemMatch: {
        courseId: this._id,
        status: 'completed'
      }
    }
  });
  
  // Calculate average rating
  const totalRating = this.reviews.reduce((sum, review) => sum + review.rating, 0);
  const averageRating = this.reviews.length > 0 ? totalRating / this.reviews.length : 0;
  
  this.stats.enrollments = enrollments;
  this.stats.completions = completions;
  this.stats.averageRating = averageRating;
  this.stats.totalReviews = this.reviews.length;
  
  await this.save();
};

module.exports = mongoose.model('Course', courseSchema);