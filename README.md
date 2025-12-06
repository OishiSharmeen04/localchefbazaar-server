# 🍽️ LocalChefBazaar - Server Side

### Backend API for LocalChefBazaar Food Marketplace

This is the backend server for LocalChefBazaar, built with Node.js, Express.js, and MongoDB. It handles user authentication, order management, payment processing, and all database operations.

---

## 🌐 Live API

- **Server URL:** [https://localchefbazaar-server.vercel.app](https://your-server-url.com)
- **Client Repository:** [LocalChefBazaar Client](https://github.com/yourusername/localchefbazaar-client)

---

## 📋 Project Purpose

This server provides RESTful APIs for the LocalChefBazaar platform, handling:
- User authentication and authorization with JWT
- Role-based access control (User, Chef, Admin)
- Order processing and management
- Payment integration with Stripe
- Database operations with MongoDB
- Secure cookie-based session management

---

## ✨ Key Features

### Authentication & Security
- 🔐 JWT-based authentication
- 🍪 HTTP-only cookie implementation
- 🔒 Password hashing with Bcryptjs
- 🛡️ Role-based middleware protection
- 🚫 CORS configuration
- ✅ Token verification on protected routes

### API Endpoints
- 👤 User management (CRUD operations)
- 🍽️ Meals management (Create, Read, Update, Delete)
- 📦 Order processing and tracking
- ⭐ Reviews and ratings system
- ❤️ Favorites management
- 💳 Stripe payment integration
- 📊 Admin statistics and analytics

### Database Operations
- MongoDB connection with error handling
- Indexed collections for performance
- Data validation and sanitization
- Aggregation pipelines for statistics
- Transaction support for payments

---

## 🛠️ Technologies Used

- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **MongoDB** - NoSQL database
- **JWT** - Authentication tokens
- **Bcryptjs** - Password encryption
- **Stripe** - Payment processing
- **Cookie Parser** - Cookie handling
- **CORS** - Cross-origin resource sharing
- **Dotenv** - Environment variables

---

## 📦 NPM Packages

```json
{
  "name": "localchefbazaar-server",
  "version": "1.0.0",
  "main": "index.js",
  "scripts": {
    "start": "node index.js",
    "dev": "nodemon index.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "mongodb": "^6.3.0",
    "dotenv": "^16.3.1",
    "cors": "^2.8.5",
    "jsonwebtoken": "^9.0.2",
    "bcryptjs": "^2.4.3",
    "cookie-parser": "^1.4.6",
    "stripe": "^14.8.0"
  },
  "devDependencies": {
    "nodemon": "^3.0.2"
  }
}
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18 or higher)
- MongoDB Atlas account or local MongoDB
- Stripe account for payment processing

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/yourusername/localchefbazaar-server.git
cd localchefbazaar-server
```

2. **Install dependencies**
```bash
npm install
```

3. **Setup environment variables**

Create a `.env` file in the root directory:
```env
# MongoDB Configuration
MONGODB_URI=

# JWT Configuration
JWT_SECRET=
JWT_EXPIRES_IN=7d

# Stripe Configuration
STRIPE_SECRET_KEY=

# Server Configuration
PORT=5000
NODE_ENV=development

# Client URL (for CORS)
CLIENT_URL=http://localhost:5173
```

**Note:** Never commit your `.env` file. It's already added to `.gitignore`.

4. **Run the development server**
```bash
npm run dev
```

The server will start at `http://localhost:5000`

5. **Run in production**
```bash
npm start
```

---


## 🛡️ Security Best Practices

- ✅ All passwords are hashed with Bcryptjs
- ✅ JWT tokens stored in HTTP-only cookies
- ✅ CORS configured for specific origin
- ✅ Environment variables for sensitive data
- ✅ Input validation on all endpoints
- ✅ Rate limiting on authentication routes (recommended)
- ✅ MongoDB injection prevention

---

## 📊 Error Handling

All API responses follow this structure:

**Success Response:**
```json
{
  "success": true,
  "message": "Operation successful",
  "data": { ... }
}
```

**Error Response:**
```json
{
  "success": false,
  "message": "Error description",
  "error": "Error details"
}
```

---

## 🧪 Testing

### Test the API with Thunder Client / Postman

1. Register a new user
2. Login and get JWT token
3. Use token in subsequent requests
4. Test protected routes

---

## 📈 Future Enhancements

- [ ] Add email notifications with Nodemailer
- [ ] Implement rate limiting
- [ ] Add request logging with Morgan
- [ ] Implement caching with Redis
- [ ] Add automated tests (Jest/Mocha)
- [ ] WebSocket for real-time updates
- [ ] API documentation with Swagger

---


## 👨‍💻 Developer

**Your Name**
- GitHub: [@yourusername](https://github.com/yourusername)
- LinkedIn: [Your LinkedIn](https://linkedin.com/in/yourprofile)
- Portfolio: [yourportfolio.com](https://yourportfolio.com)


---

<div align="center">
  <p>Made with ❤️ by [Your Name]</p>
  <p>© 2025 LocalChefBazaar Server. All rights reserved.</p>
</div>