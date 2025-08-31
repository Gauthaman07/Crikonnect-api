# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Crikonnect-api is a Node.js/Express sports booking and tournament management API with MongoDB, Firebase, and Cloudinary integrations. It handles cricket team management, ground bookings, tournaments, and push notifications.

## Development Commands

```bash
# Start the server
npm start

# Development (no specific dev script configured)
node server.js

# Testing (not configured - no test framework set up)
npm test  # Will show "Error: no test specified"
```

## Architecture

### Core Structure
- **server.js**: Main application entry point with Express setup, middleware configuration, and route mounting
- **MVC Pattern**: Controllers handle business logic, models define MongoDB schemas, routes define API endpoints

### Key Directories
- **config/**: External service configurations (Firebase, Cloudinary, email, PDF generation)
- **controllers/**: Business logic for each domain (auth, teams, grounds, tournaments, bookings, notifications)
- **middleware/**: Authentication (JWT) and file upload handling
- **models/**: Mongoose schemas for User, Team, Ground, Tournament, Match, etc.
- **routes/**: API route definitions that map to controllers
- **services/**: External service integrations (Firebase push notifications)
- **uploads/**: Local file storage directory

### Database
- MongoDB with Mongoose ODM
- Connection string from `MONGO_URI` environment variable (defaults to localhost)
- Models include User, Team, Ground, Tournament, TeamTournamentRegistration, Match, GroundBooking

### Authentication
- JWT-based authentication using `jsonwebtoken`
- Middleware: `authenticateUser.js` extracts Bearer tokens and verifies JWT
- User passwords hashed with `bcryptjs`

### External Integrations
- **Firebase Admin SDK**: Push notifications via FCM tokens stored in User model
- **Cloudinary**: Image upload and storage with multer integration
- **Nodemailer**: Email notifications
- **PDFKit**: Tournament fixture PDF generation

### File Uploads
- Multer configured for local storage in `./uploads` directory
- Cloudinary integration available for cloud storage
- Static file serving enabled for uploaded files

### Environment Variables Required
- `MONGO_URI`: MongoDB connection string
- `JWT_SECRET`: JWT signing secret
- `PORT`: Server port (defaults to 5000)
- Firebase: `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`
- Cloudinary credentials for image uploads
- Email service configuration

### API Structure
All routes prefixed with `/api/`:
- `/api/auth`: User authentication (login, signup)
- `/api/user`: User profile management
- `/api/team`: Team creation and management
- `/api/grounds`: Ground listings and details
- `/api/ground-booking`: Ground booking system
- `/api/tournaments`: Tournament management
- `/api/fixtures`: Match fixtures
- `/api/notifications`: Push notification management

### Security
- Helmet middleware for security headers
- CORS enabled with permissive configuration (origin: '*')
- JWT token authentication for protected routes
- Input validation handled at controller level