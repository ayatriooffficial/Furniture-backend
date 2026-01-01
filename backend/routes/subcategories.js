const express = require('express');
const router = express.Router();
const Subcategory = require('../models/Subcategory');
const Product = require('../models/Product');

// GET all subcategories
router.get('/', async (req, res) => {
  try {
    let filter = { isActive: true };
    
    // If category parameter is provided, filter by category
    if (req.query.category && req.query.category.trim() !== '') {
      const mongoose = require('mongoose');
      // Try to parse as ObjectId if it looks like one
      if (mongoose.Types.ObjectId.isValid(req.query.category)) {
        filter.category = mongoose.Types.ObjectId(req.query.category);
      } else {
        filter.category = { $regex: req.query.category, $options: 'i' };
      }
    }
    
    const subcategories = await Subcategory.find(filter).sort({ name: 1 });
    res.json(subcategories);
  } catch (error) {
    console.error('[Subcategories API] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET subcategory by slug and include related products
router.get('/:slug', async (req, res) => {
  try {
    const slug = req.params.slug;
    const subcat = await Subcategory.findOne({ slug });
    if (!subcat) return res.status(404).json({ error: 'Subcategory not found' });

    // Fetch products related to this subcategory
    const products = await Product.find({ subcategory: subcat._id, isActive: true }).sort({ createdAt: -1 });

    res.json({ subcategory: subcat, products });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
