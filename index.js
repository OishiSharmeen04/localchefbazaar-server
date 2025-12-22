const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();
const admin = require('firebase-admin');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');

const app = express();
const port = process.env.PORT || 5000;

// Firebase Admin Initialization
const serviceAccount = {
  type: "service_account",
  project_id: process.env.FIREBASE_PROJECT_ID,
  private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
  private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  client_email: process.env.FIREBASE_CLIENT_EMAIL,
  client_id: process.env.FIREBASE_CLIENT_ID,
  auth_uri: "https://accounts.google.com/o/oauth2/auth",
  token_uri: "https://oauth2.googleapis.com/token",
  auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
  client_x509_cert_url: process.env.FIREBASE_CERT_URL
};

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// Middleware
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:5174',
    process.env.CLIENT_URL
  ],
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// MongoDB Connection
const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

// JWT Middleware
const verifyToken = (req, res, next) => {
  const token = req.cookies?.token || req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).send({ message: 'Unauthorized access' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ message: 'Unauthorized access' });
    }
    req.user = decoded;
    next();
  });
};

// Verify Admin Middleware
const verifyAdmin = async (req, res, next) => {
  const email = req.user.email;
  const user = await client.db('localChefBazaar').collection('users').findOne({ email });
  
  if (user?.role !== 'admin') {
    return res.status(403).send({ message: 'Forbidden access' });
  }
  next();
};

// Verify Chef Middleware
const verifyChef = async (req, res, next) => {
  const email = req.user.email;
  const user = await client.db('localChefBazaar').collection('users').findOne({ email });
  
  if (user?.role !== 'chef') {
    return res.status(403).send({ message: 'Forbidden access' });
  }
  next();
};

async function run() {
  try {
    await client.connect();
    console.log("Connected to MongoDB!");

    const database = client.db('localChefBazaar');
    const usersCollection = database.collection('users');
    const mealsCollection = database.collection('meals');
    const reviewsCollection = database.collection('reviews');
    const ordersCollection = database.collection('orders');
    const favoritesCollection = database.collection('favorites');
    const requestsCollection = database.collection('requests');
    const paymentsCollection = database.collection('payments');

    // ============= AUTH ROUTES =============

    // Create JWT Token
    app.post('/jwt', async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.JWT_SECRET, { expiresIn: '7d' });
      
      res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict'
      }).send({ success: true });
    });

    // Logout
    app.post('/logout', (req, res) => {
      res.clearCookie('token', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict'
      }).send({ success: true });
    });

    // ============= USER ROUTES =============

    // Register User
    app.post('/users', async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const existingUser = await usersCollection.findOne(query);
      
      if (existingUser) {
        return res.send({ message: 'User already exists', insertedId: null });
      }

      const newUser = {
        ...user,
        role: 'user',
        status: 'active',
        createdAt: new Date()
      };

      const result = await usersCollection.insertOne(newUser);
      res.send(result);
    });

    // Get User by Email
    app.get('/users/:email', verifyToken, async (req, res) => {
      const email = req.params.email;
      
      if (email !== req.user.email) {
        return res.status(403).send({ message: 'Forbidden access' });
      }

      const user = await usersCollection.findOne({ email });
      res.send(user);
    });

    // Get All Users (Admin only)
    app.get('/users', verifyToken, verifyAdmin, async (req, res) => {
      const users = await usersCollection.find().toArray();
      res.send(users);
    });

    // Update User Status to Fraud (Admin only)
    app.patch('/users/fraud/:email', verifyToken, verifyAdmin, async (req, res) => {
      const email = req.params.email;
      const result = await usersCollection.updateOne(
        { email },
        { $set: { status: 'fraud' } }
      );
      res.send(result);
    });

    // ============= MEAL ROUTES =============

    // Create Meal (Chef only)
    app.post('/meals', verifyToken, verifyChef, async (req, res) => {
      const meal = req.body;
      const user = await usersCollection.findOne({ email: req.user.email });

      if (user.status === 'fraud') {
        return res.status(403).send({ message: 'Fraud users cannot create meals' });
      }

      const newMeal = {
        ...meal,
        createdAt: new Date()
      };

      const result = await mealsCollection.insertOne(newMeal);
      res.send(result);
    });

    // Get All Meals with Pagination and Sorting
    app.get('/meals', async (req, res) => {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const skip = (page - 1) * limit;
      const sort = req.query.sort;
      const search = req.query.search;

      let query = {};
      if (search) {
        query = { foodName: { $regex: search, $options: 'i' } };
      }

      let sortOption = {};
      if (sort === 'asc') {
        sortOption = { price: 1 };
      } else if (sort === 'desc') {
        sortOption = { price: -1 };
      }

      const meals = await mealsCollection
        .find(query)
        .sort(sortOption)
        .skip(skip)
        .limit(limit)
        .toArray();

      const total = await mealsCollection.countDocuments(query);

      res.send({
        meals,
        totalPages: Math.ceil(total / limit),
        currentPage: page,
        total
      });
    });

    // Get 6 Meals for Home Page
    app.get('/meals/home', async (req, res) => {
      const meals = await mealsCollection.find().limit(6).toArray();
      res.send(meals);
    });

    // Get 6 Daily Meals for Home Page (Alternative route for frontend)
    app.get('/meals/daily', async (req, res) => {
      try {
        const meals = await mealsCollection
          .find()
          .sort({ createdAt: -1 })
          .limit(6)
          .toArray();
        res.send({ success: true, meals });
      } catch (error) {
        res.status(500).send({ success: false, message: error.message });
      }
    });

    // Get Meal by ID
    app.get('/meals/:id', async (req, res) => {
      const id = req.params.id;
      const meal = await mealsCollection.findOne({ _id: new ObjectId(id) });
      res.send(meal);
    });

    // Get Meals by Chef Email
    app.get('/meals/chef/:email', verifyToken, async (req, res) => {
      const email = req.params.email;
      const meals = await mealsCollection.find({ userEmail: email }).toArray();
      res.send(meals);
    });

    // Update Meal (Chef only)
    app.patch('/meals/:id', verifyToken, verifyChef, async (req, res) => {
      const id = req.params.id;
      const meal = req.body;
      
      const result = await mealsCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: meal }
      );
      res.send(result);
    });

    // Delete Meal (Chef only)
    app.delete('/meals/:id', verifyToken, verifyChef, async (req, res) => {
      const id = req.params.id;
      const result = await mealsCollection.deleteOne({ _id: new ObjectId(id) });
      res.send(result);
    });

    // ============= REVIEW ROUTES =============

    // Create Review
    app.post('/reviews', verifyToken, async (req, res) => {
      const review = req.body;
      const newReview = {
        ...review,
        date: new Date()
      };

      const result = await reviewsCollection.insertOne(newReview);
      res.send(result);
    });

    // Get Reviews by Food ID
    app.get('/reviews/:foodId', async (req, res) => {
      const foodId = req.params.foodId;
      const reviews = await reviewsCollection.find({ foodId }).toArray();
      res.send(reviews);
    });

    // Get Reviews by User Email
    app.get('/reviews/user/:email', verifyToken, async (req, res) => {
      const email = req.params.email;
      const reviews = await reviewsCollection.find({ reviewerEmail: email }).toArray();
      res.send(reviews);
    });

    // Get All Reviews for Home Page
    app.get('/reviews', async (req, res) => {
      const reviews = await reviewsCollection.find().limit(6).toArray();
      res.send(reviews);
    });

    // Update Review
    app.patch('/reviews/:id', verifyToken, async (req, res) => {
      const id = req.params.id;
      const { rating, comment } = req.body;
      
      const result = await reviewsCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { rating, comment, date: new Date() } }
      );
      res.send(result);
    });

    // Delete Review
    app.delete('/reviews/:id', verifyToken, async (req, res) => {
      const id = req.params.id;
      const result = await reviewsCollection.deleteOne({ _id: new ObjectId(id) });
      res.send(result);
    });

    // ============= ORDER ROUTES =============

    // Create Order
    app.post('/orders', verifyToken, async (req, res) => {
      const order = req.body;
      const user = await usersCollection.findOne({ email: req.user.email });

      if (user.status === 'fraud') {
        return res.status(403).send({ message: 'Fraud users cannot place orders' });
      }

      const newOrder = {
        ...order,
        orderStatus: 'pending',
        paymentStatus: 'pending',
        orderTime: new Date()
      };

      const result = await ordersCollection.insertOne(newOrder);
      res.send(result);
    });

    // Get Orders by User Email
    app.get('/orders/user/:email', verifyToken, async (req, res) => {
      const email = req.params.email;
      const orders = await ordersCollection.find({ userEmail: email }).toArray();
      res.send(orders);
    });

    // Get Orders by Chef ID
    app.get('/orders/chef/:chefId', verifyToken, async (req, res) => {
      const chefId = req.params.chefId;
      const orders = await ordersCollection.find({ chefId }).toArray();
      res.send(orders);
    });

    // Update Order Status (Chef only)
    app.patch('/orders/:id/status', verifyToken, async (req, res) => {
      const id = req.params.id;
      const { orderStatus } = req.body;
      
      const result = await ordersCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { orderStatus } }
      );
      res.send(result);
    });

    // Update Order Payment Status
    app.patch('/orders/:id/payment', verifyToken, async (req, res) => {
      const id = req.params.id;
      const { paymentStatus } = req.body;
      
      const result = await ordersCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { paymentStatus } }
      );
      res.send(result);
    });

    // ============= FAVORITE ROUTES =============

    // Add to Favorites
    app.post('/favorites', verifyToken, async (req, res) => {
      const favorite = req.body;
      
      const existingFavorite = await favoritesCollection.findOne({
        userEmail: favorite.userEmail,
        mealId: favorite.mealId
      });

      if (existingFavorite) {
        return res.send({ message: 'Already in favorites', insertedId: null });
      }

      const newFavorite = {
        ...favorite,
        addedTime: new Date()
      };

      const result = await favoritesCollection.insertOne(newFavorite);
      res.send(result);
    });

    // Get Favorites by User Email
    app.get('/favorites/:email', verifyToken, async (req, res) => {
      const email = req.params.email;
      const favorites = await favoritesCollection.find({ userEmail: email }).toArray();
      res.send(favorites);
    });

    // Delete Favorite
    app.delete('/favorites/:id', verifyToken, async (req, res) => {
      const id = req.params.id;
      const result = await favoritesCollection.deleteOne({ _id: new ObjectId(id) });
      res.send(result);
    });

    // ============= REQUEST ROUTES =============

    // Create Request (Be a Chef / Be an Admin)
    app.post('/requests', verifyToken, async (req, res) => {
      const request = req.body;
      
      const existingRequest = await requestsCollection.findOne({
        userEmail: request.userEmail,
        requestType: request.requestType,
        requestStatus: 'pending'
      });

      if (existingRequest) {
        return res.send({ message: 'Request already pending', insertedId: null });
      }

      const newRequest = {
        ...request,
        requestStatus: 'pending',
        requestTime: new Date()
      };

      const result = await requestsCollection.insertOne(newRequest);
      res.send(result);
    });

    // Get All Requests (Admin only)
    app.get('/requests', verifyToken, verifyAdmin, async (req, res) => {
      const requests = await requestsCollection.find().toArray();
      res.send(requests);
    });

    // Accept Request (Admin only)
    app.patch('/requests/:id/accept', verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const request = await requestsCollection.findOne({ _id: new ObjectId(id) });

      if (!request) {
        return res.status(404).send({ message: 'Request not found' });
      }

      let updateData = { role: request.requestType };
      
      if (request.requestType === 'chef') {
        const chefId = `chef-${Math.floor(1000 + Math.random() * 9000)}`;
        updateData.chefId = chefId;
      }

      await usersCollection.updateOne(
        { email: request.userEmail },
        { $set: updateData }
      );

      const result = await requestsCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { requestStatus: 'approved' } }
      );

      res.send(result);
    });

    // Reject Request (Admin only)
    app.patch('/requests/:id/reject', verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      
      const result = await requestsCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { requestStatus: 'rejected' } }
      );
      res.send(result);
    });

    // ============= PAYMENT ROUTES =============

    // Create Payment Intent
    app.post('/create-payment-intent', verifyToken, async (req, res) => {
      const { amount } = req.body;
      const amountInCents = parseInt(amount * 100);

      const paymentIntent = await stripe.paymentIntents.create({
        amount: amountInCents,
        currency: 'usd',
        payment_method_types: ['card']
      });

      res.send({ clientSecret: paymentIntent.client_secret });
    });

    // Save Payment
    app.post('/payments', verifyToken, async (req, res) => {
      const payment = req.body;
      const newPayment = {
        ...payment,
        paymentTime: new Date()
      };

      const result = await paymentsCollection.insertOne(newPayment);

      // Update order payment status
      await ordersCollection.updateOne(
        { _id: new ObjectId(payment.orderId) },
        { $set: { paymentStatus: 'paid' } }
      );

      res.send(result);
    });

    // ============= STATISTICS ROUTES =============

    // Get Platform Statistics (Admin only)
    app.get('/statistics', verifyToken, verifyAdmin, async (req, res) => {
      const totalUsers = await usersCollection.countDocuments();
      const totalOrders = await ordersCollection.countDocuments();
      const pendingOrders = await ordersCollection.countDocuments({ orderStatus: 'pending' });
      const deliveredOrders = await ordersCollection.countDocuments({ orderStatus: 'delivered' });
      
      const payments = await paymentsCollection.find().toArray();
      const totalPaymentAmount = payments.reduce((sum, payment) => sum + payment.amount, 0);

      res.send({
        totalUsers,
        totalOrders,
        pendingOrders,
        deliveredOrders,
        totalPaymentAmount
      });
    });

    // Seed Meals Data (Development Only - Remove after seeding)
    app.post('/seed-meals', async (req, res) => {
      const sampleMeals = [
        {
          foodName: "Chicken Biryani",
          chefName: "Chef Rahim",
          foodImage: "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=500",
          price: 250,
          rating: 4.8,
          ingredients: ["Basmati Rice", "Chicken", "Yogurt", "Spices", "Saffron", "Ghee"],
          deliveryArea: "Dhaka, Mirpur, Dhanmondi",
          estimatedDeliveryTime: "45 minutes",
          chefExperience: "10 years specializing in Mughlai cuisine",
          chefId: "chef-1001",
          userEmail: "rahim@chef.com",
          createdAt: new Date("2025-01-15")
        },
        {
          foodName: "Beef Kacchi Biryani",
          chefName: "Chef Fatima",
          foodImage: "https://images.unsplash.com/photo-1589302168068-964664d93dc0?w=500",
          price: 350,
          rating: 4.9,
          ingredients: ["Beef", "Basmati Rice", "Potato", "Yogurt", "Spices", "Kewra Water"],
          deliveryArea: "Dhaka, Gulshan, Banani",
          estimatedDeliveryTime: "60 minutes",
          chefExperience: "8 years of traditional cooking experience",
          chefId: "chef-1002",
          userEmail: "fatima@chef.com",
          createdAt: new Date("2025-01-16")
        },
        {
          foodName: "Hilsa Fish Curry",
          chefName: "Chef Karim",
          foodImage: "https://images.unsplash.com/photo-1615141982883-c7ad0e69fd62?w=500",
          price: 450,
          rating: 4.7,
          ingredients: ["Hilsa Fish", "Mustard", "Green Chili", "Turmeric", "Mustard Oil"],
          deliveryArea: "Dhaka, Uttara, Mohakhali",
          estimatedDeliveryTime: "40 minutes",
          chefExperience: "15 years in Bengali traditional cooking",
          chefId: "chef-1003",
          userEmail: "karim@chef.com",
          createdAt: new Date("2025-01-17")
        },
        {
          foodName: "Beef Tehari",
          chefName: "Chef Salma",
          foodImage: "https://images.unsplash.com/photo-1596797038530-2c107229654b?w=500",
          price: 280,
          rating: 4.6,
          ingredients: ["Beef", "Rice", "Potato", "Mustard Oil", "Spices"],
          deliveryArea: "Dhaka, Old Dhaka, Lalbagh",
          estimatedDeliveryTime: "50 minutes",
          chefExperience: "12 years of Old Dhaka style cooking",
          chefId: "chef-1004",
          userEmail: "salma@chef.com",
          createdAt: new Date("2025-01-18")
        },
        {
          foodName: "Prawn Malai Curry",
          chefName: "Chef Hassan",
          foodImage: "https://images.unsplash.com/photo-1633504581786-316c8002b1b9?w=500",
          price: 400,
          rating: 4.8,
          ingredients: ["Prawns", "Coconut Milk", "Onion", "Garlic", "Ginger", "Spices"],
          deliveryArea: "Dhaka, Banani, Baridhara",
          estimatedDeliveryTime: "35 minutes",
          chefExperience: "9 years specializing in seafood",
          chefId: "chef-1005",
          userEmail: "hassan@chef.com",
          createdAt: new Date("2025-01-19")
        },
        {
          foodName: "Mutton Rezala",
          chefName: "Chef Ayesha",
          foodImage: "https://images.unsplash.com/photo-1574484284002-952d92456975?w=500",
          price: 380,
          rating: 4.7,
          ingredients: ["Mutton", "Yogurt", "Cashew", "Poppy Seeds", "White Pepper", "Ghee"],
          deliveryArea: "Dhaka, Dhanmondi, Lalmatia",
          estimatedDeliveryTime: "55 minutes",
          chefExperience: "11 years of Mughlai expertise",
          chefId: "chef-1006",
          userEmail: "ayesha@chef.com",
          createdAt: new Date("2025-01-20")
        },
        {
          foodName: "Chicken Roast",
          chefName: "Chef Nasir",
          foodImage: "https://images.unsplash.com/photo-1598103442097-8b74394b95c6?w=500",
          price: 200,
          rating: 4.5,
          ingredients: ["Chicken", "Onion", "Ginger-Garlic Paste", "Yogurt", "Spices"],
          deliveryArea: "Dhaka, Mohammadpur, Green Road",
          estimatedDeliveryTime: "40 minutes",
          chefExperience: "7 years in home-style cooking",
          chefId: "chef-1007",
          userEmail: "nasir@chef.com",
          createdAt: new Date("2025-01-21")
        },
        {
          foodName: "Beef Bhuna",
          chefName: "Chef Rubina",
          foodImage: "https://images.unsplash.com/photo-1567337710282-00832b415979?w=500",
          price: 320,
          rating: 4.9,
          ingredients: ["Beef", "Onion", "Tomato", "Ginger-Garlic", "Bay Leaf", "Spices"],
          deliveryArea: "Dhaka, Bashundhara, Badda",
          estimatedDeliveryTime: "60 minutes",
          chefExperience: "13 years of authentic Bengali cooking",
          chefId: "chef-1008",
          userEmail: "rubina@chef.com",
          createdAt: new Date("2025-01-22")
        },
        {
          foodName: "Fish Fry with Rice",
          chefName: "Chef Jahangir",
          foodImage: "https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=500",
          price: 180,
          rating: 4.4,
          ingredients: ["Rui Fish", "Rice", "Turmeric", "Chili Powder", "Garlic", "Oil"],
          deliveryArea: "Dhaka, Mirpur, Kallyanpur",
          estimatedDeliveryTime: "30 minutes",
          chefExperience: "6 years in daily meal preparation",
          chefId: "chef-1009",
          userEmail: "jahangir@chef.com",
          createdAt: new Date("2025-01-23")
        },
        {
          foodName: "Khichuri with Chicken",
          chefName: "Chef Taslima",
          foodImage: "https://images.unsplash.com/photo-1585032226651-759b368d7246?w=500",
          price: 220,
          rating: 4.6,
          ingredients: ["Rice", "Lentils", "Chicken", "Onion", "Ginger", "Spices"],
          deliveryArea: "Dhaka, Rampura, Badda",
          estimatedDeliveryTime: "35 minutes",
          chefExperience: "8 years in comfort food cooking",
          chefId: "chef-1010",
          userEmail: "taslima@chef.com",
          createdAt: new Date("2025-01-24")
        }
      ];

      const result = await mealsCollection.insertMany(sampleMeals);
      res.send({ message: 'Meals seeded successfully', insertedCount: result.insertedCount });
    });

    // Health Check
    app.get('/', (req, res) => {
      res.send('LocalChefBazaar Server is Running!');
    });

    app.listen(port, () => {
      console.log(`Server is running on port ${port}`);
    });

  } catch (error) {
    console.error('Error connecting to MongoDB:', error);
  }
}

run().catch(console.dir);