// backend/routes/products.js
const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const Product = require("../models/Product");

const Subcategory = require("../models/Subcategory");

router.post("/", async (req, res) => {
  try {
    const data = req.body || {};

    const required = ["name", "price", "description"];
    for (const field of required) {
      if (!data[field]) {
        return res.status(400).json({ error: `${field} is required` });
      }
    }

    const productObj = {
      name: data.name,
      metaTitle: data.metaTitle,
      metaDescription: data.metaDescription,
      h1Tag: data.h1Tag,
      headerDescription: data.headerDescription,
      features: Array.isArray(data.features)
        ? data.features
        : data.features
        ? [data.features]
        : [],
      description: data.description,
      dimensions: data.dimensions,
      materials: data.materials,
      finish: data.finish,
      designer: data.designer,
      countryOfOrigin: data.countryOfOrigin,
      importerPackerMarketer: data.importerPackerMarketer,
      colors: Array.isArray(data.colors)
        ? data.colors
        : data.colors
        ? [data.colors]
        : [],
      articleNumber: data.articleNumber,
      images: Array.isArray(data.images)
        ? data.images
        : data.images
        ? [data.images]
        : [],
      reviews: Array.isArray(data.reviews) ? data.reviews : [],
      faq: Array.isArray(data.faq) ? data.faq : [],
      category: data.category,
      slug: data.slug,
      isActive: data.isActive !== undefined ? !!data.isActive : true,
    };

    if (data.price !== undefined) {
      productObj.price = mongoose.Types.Decimal128.fromString(
        String(data.price)
      );
    }
    if (
      data.originalPrice !== undefined &&
      data.originalPrice !== null &&
      data.originalPrice !== ""
    ) {
      productObj.originalPrice = mongoose.Types.Decimal128.fromString(
        String(data.originalPrice)
      );
    }
    if (data.offer) {
      productObj.offer = {
        isOnOffer: !!data.offer.isOnOffer,
        discountPercent:
          typeof data.offer.discountPercent === "number"
            ? data.offer.discountPercent
            : data.offer.discountPercent
            ? Number(data.offer.discountPercent)
            : undefined,
        offerPrice:
          data.offer.offerPrice !== undefined &&
          data.offer.offerPrice !== null &&
          data.offer.offerPrice !== ""
            ? mongoose.Types.Decimal128.fromString(
                String(data.offer.offerPrice)
              )
            : undefined,
      };
    }

    if (data.subcategory) {
      if (mongoose.Types.ObjectId.isValid(data.subcategory)) {
        productObj.subcategory = data.subcategory;
      } else {
        const sub = await Subcategory.findOne({ slug: data.subcategory });
        if (sub) productObj.subcategory = sub._id;
      }
    } else if (data.subcategorySlug) {
      const sub = await Subcategory.findOne({ slug: data.subcategorySlug });
      if (sub) productObj.subcategory = sub._id;
    }

    if (productObj.reviews && productObj.reviews.length) {
      for (const r of productObj.reviews) {
        if (!r.author || !r.comment || typeof r.rating !== "number") {
          return res.status(400).json({
            error: "Each review requires author, comment and numeric rating",
          });
        }
        if (r.rating < 1 || r.rating > 5)
          return res
            .status(400)
            .json({ error: "Review rating must be between 1 and 5" });
      }
    }

    if (productObj.faq && productObj.faq.length) {
      for (const f of productObj.faq) {
        if (!f.question || !f.answer)
          return res
            .status(400)
            .json({ error: "Each FAQ item requires question and answer" });
      }
    }

    const newProduct = new Product(productObj);
    await newProduct.save();

    const populated = await Product.findById(newProduct._id).populate(
      "subcategory"
    );

    res.status(201).json(populated);
  } catch (error) {
    console.error("[POST /api/products] Error:", error);
    if (error && error.code === 11000) {
      return res
        .status(409)
        .json({ error: "Duplicate key error", details: error.keyValue });
    }
    res.status(500).json({ error: error.message });
  }
});


router.get("/", async (req, res) => {
  try {
    const { category, isActive, subcategory } = req.query;
    const query = {};

    if (category) {
      // Check if the 'category' param is actually a subcategory slug
      const subcat = await Subcategory.findOne({ slug: category });
      if (subcat) {
        query.subcategory = subcat._id;
      } else {
        // Otherwise assume it's a parent category slug (or legacy string)
        query.category = category;
      }
    }

    if (subcategory) {
      // allow passing subcategory id or slug explicitly
      if (mongoose.Types.ObjectId.isValid(subcategory)) {
        query.subcategory = subcategory;
      } else {
        const sub = await Subcategory.findOne({ slug: subcategory });
        if (sub) query.subcategory = sub._id;
      }
    }

    if (isActive !== undefined) {
      query.isActive = isActive === "true";
    }

    console.log("[GET /api/products] Incoming Query Params:", req.query);
    console.log("[GET /api/products] MongoDB Query:", query);
    const products = await Product.find(query)
      .sort({ articleNumber: 1 })
      .populate("subcategory");
    console.log("[GET /api/products] Found:", products.length);

    res.json(products);
  } catch (error) {
    console.error("[GET /api/products] Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/products/subcategory/:slug
router.get("/subcategory/:slug", async (req, res) => {
  try {
    const slug = req.params.slug;
    const Subcategory = require("../models/Subcategory");

    const subcat = await Subcategory.findOne({ slug });
    if (!subcat) {
      return res.status(404).json({ error: "Subcategory not found" });
    }

    const products = await Product.find({
      subcategory: subcat._id,
      isActive: true,
    })
      .sort({ articleNumber: 1 })
      .populate("subcategory");

    res.json(products);
  } catch (error) {
    console.error("[GET /api/products/subcategory/:slug] Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/products/slug/:slug
router.get("/slug/:slug", async (req, res) => {
  try {
    const product = await Product.findOne({ slug: req.params.slug }).populate(
      "subcategory"
    );
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }
    res.json(product);
  } catch (error) {
    console.error("[GET /api/products/slug/:slug] Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/products/article/:articleNumber
router.get("/article/:articleNumber", async (req, res) => {
  try {
    const product = await Product.findOne({
      articleNumber: req.params.articleNumber,
    }).populate("subcategory");
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }
    res.json(product);
  } catch (error) {
    console.error("[GET /api/products/article/:articleNumber] Error:", error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/:id/faq", async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).select("faq name");
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }
    res.json({
      productId: product._id,
      productName: product.name,
      faq: product.faq || [],
      count: (product.faq || []).length,
    });
  } catch (error) {
    console.error("[GET /api/products/:id/faq] Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/products/slug/:slug/faq
// Fetch FAQ items for a product by slug
router.get("/slug/:slug/faq", async (req, res) => {
  try {
    const product = await Product.findOne({ slug: req.params.slug }).select(
      "faq name slug"
    );
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }
    res.json({
      productId: product._id,
      productName: product.name,
      slug: product.slug,
      faq: product.faq || [],
      count: (product.faq || []).length,
    });
  } catch (error) {
    console.error("[GET /api/products/slug/:slug/faq] Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/products/:id
router.get("/:id", async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).populate(
      "subcategory"
    );
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }
    res.json(product);
  } catch (error) {
    console.error("[GET /api/products/:id] Error:", error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
