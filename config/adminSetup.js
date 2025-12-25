const AdminJS = require('adminjs');
const AdminJSExpress = require('@adminjs/express');
const AdminJSMongoose = require('@adminjs/mongoose');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const ConnectMongo = require('connect-mongo');
const MongoStore = ConnectMongo.default || ConnectMongo;
const { ComponentLoader } = require('adminjs');

const componentLoader = new ComponentLoader();
const Dashboard = componentLoader.add('Dashboard', './dashboard');

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
    componentLoader,
    dashboard: {
        component: Dashboard,
        handler: async () => {
            return {
                users: await User.countDocuments(),
                grounds: await Ground.countDocuments(),
                tournaments: await Tournament.countDocuments(),
            };
        },
    },
    resources: [
        // --- User Management ---
        {
            resource: User,
            options: {
                navigation: { name: 'User Management', icon: 'User' },
                properties: {
                    password: { isVisible: { list: false, filter: false, show: false, edit: true } },
                },
                actions: {
                    new: {
                        before: async (request) => {
                            if (request.payload.password) {
                                request.payload = {
                                    ...request.payload,
                                    password: await bcrypt.hash(request.payload.password, 10),
                                };
                            }
                            return request;
                        },
                    },
                    edit: {
                        before: async (request) => {
                            if (request.payload.password) {
                                request.payload = {
                                    ...request.payload,
                                    password: await bcrypt.hash(request.payload.password, 10),
                                };
                            }
                            return request;
                        },
                    },
                },
            },
        },
        {
            resource: Team,
            options: { navigation: { name: 'User Management', icon: 'Users' } }
        },

        // --- Ground Management ---
        {
            resource: Ground,
            options: { navigation: { name: 'Ground Management', icon: 'Map' } }
        },
        {
            resource: GroundBooking,
            options: { 
                navigation: { name: 'Ground Management', icon: 'Calendar' },
                properties: {
                    status: {
                        availableValues: [
                            { value: 'pending', label: '⏳ Pending' },
                            { value: 'booked', label: '✅ Booked' },
                            { value: 'rejected', label: '❌ Rejected' }
                        ]
                    }
                }
            }
        },
        {
            resource: WeeklyAvailability,
            options: { navigation: { name: 'Ground Management', icon: 'Clock' } }
        },

        // --- Match Management ---
        {
            resource: Tournament,
            options: { navigation: { name: 'Match Management', icon: 'Trophy' } }
        },
        {
            resource: Match,
            options: { navigation: { name: 'Match Management', icon: 'Activity' } }
        },
        {
            resource: GuestMatchRequest,
            options: { navigation: { name: 'Match Management', icon: 'Inbox' } }
        },
        {
            resource: HostOnlyRequest,
            options: { navigation: { name: 'Match Management', icon: 'Inbox' } }
        },
        {
            resource: TeamTournamentRegistration,
            options: { navigation: { name: 'Match Management', icon: 'Clipboard' } }
        },
    ],
    rootPath: '/admin',
    branding: {
        companyName: 'Crickonnect — Admin',
        logo: 'https://example.com/logo.png', 
        withMadeWithLove: false,
        theme: {
            colors: {
                primary100: '#d32f2f', // Red
                primary80: '#e57373',
                primary60: '#ef9a9a',
                primary40: '#ffcdd2',
                primary20: '#ffebee',
                accent: '#d32f2f', // Force accent color
            }
        }
    },
    locale: {
        translations: {
            en: {
                labels: {
                    loginWelcome: 'Crickonnect Admin',
                },
                messages: {
                    welcomeOnBoard_title: 'Crickonnect Dashboard',
                    welcomeOnBoard_subtitle: 'Manage your entire cricket platform from here.',
                    joinSlack_title: '', 
                    joinSlack_content: '', 
                    fromTheBrothers_title: '', 
                    fromTheBrothers_content: '',
                    addingResources_title: 'Getting Started',
                    addingResources_content: 'Use the sidebar menu to manage Users, Grounds, and Matches.',
                }
            }
        }
    },
};

// Authentication Function
const authenticate = async (email, password) => {
    try {
        const user = await User.findOne({ email });
        if (user && user.role === 'admin') {
            const matched = await bcrypt.compare(password, user.password);
            if (matched) {
                // Return a simple object with 'title' for the UI
                return {
                    _id: user._id,
                    email: user.email,
                    role: user.role,
                    title: user.name || user.email // Uses name if available
                };
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
