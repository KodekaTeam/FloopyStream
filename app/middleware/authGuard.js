/**
 * Authentication Middleware
 * Protects routes and verifies user sessions
 */

/**
 * Verify if user is authenticated
 */
function requireAuth(req, res, next) {
  if (req.session && req.session.accountId) {
    return next();
  }
  
  // Check if request expects JSON response
  const isAjaxRequest = req.xhr === true;
  const acceptHeader = req.headers.accept || '';
  const acceptsJson = acceptHeader.includes('application/json') || 
                      acceptHeader.includes('application/*') ||
                      acceptHeader.includes('*/*');
  const isApiRoute = req.path.startsWith('/api/');
  
  // Return JSON for AJAX, API routes, or explicit JSON accept header
  if (isAjaxRequest || isApiRoute) { // removed 'acceptsJson' to avoid false positives on normal page loads
    return res.status(401).json({ 
      success: false, 
      message: 'Authentication required' 
    });
  }
  
  return res.redirect('/login');
}

/**
 * Verify if user is administrator
 */
function requireAdmin(req, res, next) {
  if (req.session && req.session.accountId && req.session.accountRole === 'admin') {
    return next();
  }
  
  // Check if request expects JSON response
  const isAjaxRequest = req.xhr === true;
  const acceptHeader = req.headers.accept || '';
  const acceptsJson = acceptHeader.includes('application/json') || 
                      acceptHeader.includes('application/*') ||
                      acceptHeader.includes('*/*');
  const isApiRoute = req.path.startsWith('/api/');
  
  // Return JSON for AJAX, API routes, or explicit JSON accept header
  if (isAjaxRequest || acceptsJson || isApiRoute) {
    return res.status(403).json({ 
      success: false, 
      message: 'Administrator access required' 
    });
  }
  
  return res.redirect('/');
}

/**
 * Check if user is authenticated (doesn't redirect)
 */
function checkAuth(req, res, next) {
  req.isAuthenticated = !!(req.session && req.session.accountId);
  req.accountData = req.session || {};
  next();
}

/**
 * Redirect authenticated users away from auth pages
 */
function redirectIfAuth(req, res, next) {
  if (req.session && req.session.accountId) {
    return res.redirect('/dashboard');
  }
  next();
}

module.exports = {
  requireAuth,
  requireAdmin,
  checkAuth,
  redirectIfAuth
};
