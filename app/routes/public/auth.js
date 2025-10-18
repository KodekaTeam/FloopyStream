const express = require('express');
const { body, validationResult } = require('express-validator');
const csrf = require('csrf');
const router = express.Router();

const Account = require('../../models/Account');
const { redirectIfAuth } = require('../../middleware/authGuard');
const { logInfo, logError } = require('../../services/activityLogger');

const tokens = new csrf();

// GET - Home page
router.get('/', (req, res) => {
  res.render('index', { 
    title: 'Home',
    session: req.session 
  });
});

// GET - Login page
router.get('/login', redirectIfAuth, (req, res) => {
  const csrfToken = tokens.create(tokens.secretSync());
  res.render('login', { 
    title: 'Login',
    csrfToken,
    error: null 
  });
});

// POST - Login
router.post('/login', [
  body('username').trim().notEmpty().withMessage('Username is required'),
  body('password').notEmpty().withMessage('Password is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const csrfToken = tokens.create(tokens.secretSync());
      return res.render('login', {
        title: 'Login',
        csrfToken,
        error: errors.array()[0].msg
      });
    }

    const { username, password } = req.body;
    const account = await Account.findByUsername(username);

    if (!account) {
      const csrfToken = tokens.create(tokens.secretSync());
      return res.render('login', {
        title: 'Login',
        csrfToken,
        error: 'Invalid username or password'
      });
    }

    const isValidPassword = await Account.verifyPassword(password, account.password_hash);
    
    if (!isValidPassword) {
      const csrfToken = tokens.create(tokens.secretSync());
      return res.render('login', {
        title: 'Login',
        csrfToken,
        error: 'Invalid username or password'
      });
    }

    // Set session
    req.session.accountId = account.account_id;
    req.session.username = account.username;
    req.session.accountRole = account.account_role;

    await logInfo('User logged in', { username: account.username });
    res.redirect('/dashboard');
  } catch (error) {
    console.error('Login error:', error);
    await logError('Login failed', { error: error.message });
    const csrfToken = tokens.create(tokens.secretSync());
    res.render('login', {
      title: 'Login',
      csrfToken,
      error: 'An error occurred. Please try again.'
    });
  }
});

// GET - Register page
router.get('/register', redirectIfAuth, async (req, res) => {
  const csrfToken = tokens.create(tokens.secretSync());
  
  res.render('register', {
    title: 'Register',
    csrfToken,
    error: null,
    allowRegistration: true // Always allow registration
  });
});

// POST - Register
router.post('/register', [
  body('username').trim().isLength({ min: 3 }).withMessage('Username must be at least 3 characters'),
  body('email').isEmail().withMessage('Invalid email address'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('confirmPassword').custom((value, { req }) => {
    if (value !== req.body.password) {
      throw new Error('Passwords do not match');
    }
    return true;
  })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const csrfToken = tokens.create(tokens.secretSync());
      return res.render('register', {
        title: 'Register',
        csrfToken,
        error: errors.array()[0].msg,
        allowRegistration: true
      });
    }

    const { username, email, password } = req.body;

    // Check if username exists
    const existingUser = await Account.findByUsername(username);
    if (existingUser) {
      const csrfToken = tokens.create(tokens.secretSync());
      return res.render('register', {
        title: 'Register',
        csrfToken,
        error: 'Username already exists',
        allowRegistration: true
      });
    }

    // Check if email exists
    const existingEmail = await Account.findByEmail(email);
    if (existingEmail) {
      const csrfToken = tokens.create(tokens.secretSync());
      return res.render('register', {
        title: 'Register',
        csrfToken,
        error: 'Email already registered',
        allowRegistration: true
      });
    }

    // Create account
    await Account.createNew(username, email, password);
    await logInfo('New account created', { username, email });

    res.redirect('/login');
  } catch (error) {
    console.error('Registration error:', error);
    await logError('Registration failed', { error: error.message });
    const csrfToken = tokens.create(tokens.secretSync());
    res.render('register', {
      title: 'Register',
      csrfToken,
      error: 'Registration failed. Please try again.',
      allowRegistration: true
    });
  }
});

// GET - Logout
router.get('/logout', (req, res) => {
  const username = req.session.username;
  req.session.destroy((err) => {
    if (err) {
      console.error('Logout error:', err);
    }
    logInfo('User logged out', { username });
    res.redirect('/');
  });
});

module.exports = router;
