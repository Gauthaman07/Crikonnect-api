const AdminJS = require('adminjs');
const AdminJSExpress = require('@adminjs/express');
const AdminJSMongoose = require('@adminjs/mongoose');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const ConnectMongo = require('connect-mongo');
const MongoStore = ConnectMongo.default || ConnectMongo;

// Register the Mongoose adapter
AdminJS.registerAdapter(AdminJSMongoose);

// Import your models
const User = require('../models/User');
const Ground = require('../models/ground');
const GroundBooking = require('../models/groundBooking');
const GuestMatchRequest = require('../models/guestMatchRequest');
const HostOnlyRequest = require('../models/hostOnlyRequest');
const Match = require('../models/match');
const Team = require('../models/team');
const TeamTournamentRegistration = require('../models/TeamTournamentRegistration');
const Tournament = require('../models/tournament');
const WeeklyAvailability = require('../models/weeklyAvailability');

// AdminJS Options
const adminOptions = {
    resources: [
        User,
        Ground,
        GroundBooking,
        GuestMatchRequest,
        HostOnlyRequest,
        Match,
        Team,
        TeamTournamentRegistration,
        Tournament,
        WeeklyAvailability,
    ],
    rootPath: '/admin',
    branding: {
        companyName: 'Crickonnect Admin',
        logo: 'https://example.com/logo.png', // You can replace this
        softwareBrothers: false, // Hides the "SoftwareBrothers" link
    },
};

// Authentication Function
const authenticate = async (email, password) => {
    try {
        const user = await User.findOne({ email });
        if (user && user.role === 'admin') {
            const matched = await bcrypt.compare(password, user.password);
            if (matched) {
                return user;
            }
        }
        return false;
    } catch (error) {
        console.error('Admin Auth Error:', error);
        return false;
    }
};

// Build and export the router
const adminRouter = AdminJSExpress.buildAuthenticatedRouter(
    new AdminJS(adminOptions),
    {
        authenticate,
        cookieName: 'adminjs',
        cookiePassword: process.env.COOKIE_PASSWORD || 'super-secret-password-change-this-in-env',
    },
    null,
    {
        resave: false,
        saveUninitialized: false,
        secret: process.env.SESSION_SECRET || 'super-secret-session-key',
        store: MongoStore.create({
            mongoUrl: process.env.MONGO_URI || 'mongodb://localhost:27017/sportsBooking',
            collectionName: 'sessions' 
        })
    }
);

module.exports = adminRouter;
