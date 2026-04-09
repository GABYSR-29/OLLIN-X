const express = require('express');
const passport = require('passport');
const authController = require('../controllers/authController');
const User = require('../models/User');

const router = express.Router();

passport.serializeUser((user, done) => done(null, user._id));
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});

const GoogleStrategy = require('passport-google-oauth20').Strategy;

const hasGoogleConfig = process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET;

if (hasGoogleConfig) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL || `http://localhost:${process.env.PORT || 5000}/api/auth/google/callback`,
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          let user = await User.findOne({ googleId: profile.id });
          if (user) return done(null, user);

          user = await User.findOne({ email: profile.emails[0].value });
          if (user) {
            user.googleId = profile.id;
            await user.save();
            return done(null, user);
          }

          user = await User.create({
            name: profile.displayName,
            email: profile.emails[0].value,
            googleId: profile.id,
          });
          done(null, user);
        } catch (err) {
          done(err, null);
        }
      }
    )
  );
}

router.post('/register', authController.register);
router.post('/login', authController.login);

router.get('/google', (req, res, next) => {
  if (!hasGoogleConfig) {
    return res.status(503).json({ message: 'Google OAuth no configurado. Añade GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET en .env' });
  }
  passport.authenticate('google', { scope: ['profile', 'email'] })(req, res, next);
});

router.get('/google/callback', (req, res, next) => {
  if (!hasGoogleConfig) {
    return res.redirect(process.env.FRONTEND_URL || 'http://localhost:5173');
  }
  passport.authenticate('google', { session: false, failureRedirect: process.env.FRONTEND_URL || 'http://localhost:5173' })(req, res, (err, user) => {
    if (err) return next(err);
    if (!user) return res.redirect(process.env.FRONTEND_URL || 'http://localhost:5173');
    req.user = user;
    authController.googleCallback(req, res);
  });
});

module.exports = router;
