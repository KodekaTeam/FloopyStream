// Main JavaScript file for FLoopyStream

document.addEventListener('DOMContentLoaded', () => {
  console.log('FLoopyStream initialized');
  
  // Add any interactive functionality here
  initializeFormValidation();
  initializeDarkMode();
  initializePWA();
});

/**
 * Initialize dark mode toggle
 */
function initializeDarkMode() {
  const darkModeToggle = document.getElementById('darkModeToggle');
  
  if (!darkModeToggle) return;
  
  // Check for saved preference or default to dark mode
  const isDarkMode = localStorage.getItem('darkMode') !== 'false';
  const icon = darkModeToggle.querySelector('i');
  
  // Apply saved preference on load
  applyDarkMode(isDarkMode);
  updateDarkModeIcon(icon, isDarkMode);
  
  // Add click event listener
  darkModeToggle.addEventListener('click', () => {
    const currentMode = localStorage.getItem('darkMode') !== 'false';
    const newMode = !currentMode;
    
    localStorage.setItem('darkMode', newMode);
    applyDarkMode(newMode);
    updateDarkModeIcon(icon, newMode);
  });
}

/**
 * Initialize PWA functionality
 */
function initializePWA() {
  console.log('[PWA] Initializing...');
  
  // Get PWA button
  const pwaInstallBtn = document.getElementById('pwaInstallBtn');
  if (!pwaInstallBtn) {
    console.log('[PWA] Button not found');
    return;
  }
  console.log('[PWA] Button found:', pwaInstallBtn);
  

  // Register service worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/service-worker.js')
      .then((registration) => {
        console.log('[PWA] Service Worker registered:', registration);
      })
      .catch((error) => {
        console.error('[PWA] Service Worker registration failed:', error);
      });
  } else {
    console.log('[PWA] Service Worker not supported');
  }

  // Check if app is already installed (call immediately)
  checkPWAInstalled();

  // Variable to store the install prompt
  let deferredPrompt = null;

  // Listen for beforeinstallprompt event
  window.addEventListener('beforeinstallprompt', (e) => {
    console.log('[PWA] beforeinstallprompt fired');
    // Prevent the mini-infobar from appearing
    e.preventDefault();
    // Stash the event for later use
    deferredPrompt = e;
    // Show PWA install button
    showPWAButton();
  });

  // Listen for app installed
  window.addEventListener('appinstalled', () => {
    console.log('[PWA] App installed');
    localStorage.setItem('pwaInstalled', 'true');
    hidePWAButton();
    showNotification('App installed successfully!', 'success');
    deferredPrompt = null;
  });

  // Handle button click
  if (pwaInstallBtn) {
    pwaInstallBtn.addEventListener('click', async () => {
      console.log('[PWA] Install button clicked');
      
      if (!deferredPrompt) {
        console.log('[PWA] No deferred prompt - checking if already installed');
        checkPWAInstalled();
        return;
      }

      // Show the install prompt
      deferredPrompt.prompt();
      
      // Wait for the user to respond
      try {
        const { outcome } = await deferredPrompt.userChoice;
        console.log('[PWA] User outcome:', outcome);
        
        if (outcome === 'accepted') {
          console.log('[PWA] Installation accepted');
          localStorage.setItem('pwaInstalled', 'true');
          hidePWAButton();
        } else {
          console.log('[PWA] Installation declined');
        }
        
        // Clear the deferred prompt
        deferredPrompt = null;
      } catch (error) {
        console.error('[PWA] Error during installation:', error);
      }
    });
  }

  // Monitor display mode changes
  const mediaQuery = window.matchMedia('(display-mode: standalone)');
  mediaQuery.addEventListener('change', (e) => {
    console.log('[PWA] Display mode changed:', e.matches ? 'standalone' : 'browser');
    if (e.matches) {
      localStorage.setItem('pwaInstalled', 'true');
      hidePWAButton();
    } else {
      // Only show if not already installed
      checkPWAInstalled();
    }
  });

  console.log('[PWA] Initialization complete');
}

/**
 * Show PWA install button
 */
function showPWAButton() {
  const pwaInstallBtn = document.getElementById('pwaInstallBtn');
  if (pwaInstallBtn) {
    pwaInstallBtn.style.display = 'block';
    pwaInstallBtn.style.visibility = 'visible';
    pwaInstallBtn.style.opacity = '1';
    pwaInstallBtn.style.pointerEvents = 'auto';
    console.log('[PWA] Button shown');
  } else {
    console.log('[PWA] Button not found for showing');
  }
}

/**
 * Hide PWA install button
 */
function hidePWAButton() {
  const pwaInstallBtn = document.getElementById('pwaInstallBtn');
  if (pwaInstallBtn) {
    pwaInstallBtn.style.display = 'none';
    pwaInstallBtn.style.visibility = 'hidden';
    pwaInstallBtn.style.opacity = '0';
    pwaInstallBtn.style.pointerEvents = 'none';
    console.log('[PWA] Button hidden');
  } else {
    console.log('[PWA] Button not found for hiding');
  }
}

/**
 * Check if PWA is already installed
 */
async function checkPWAInstalled() {
  console.log('[PWA] Checking installation status...');
  console.log('[PWA] DEBUG - localStorage pwaInstalled:', localStorage.getItem('pwaInstalled'));
  console.log('[PWA] DEBUG - window.navigator.standalone:', window.navigator.standalone);
  console.log('[PWA] DEBUG - display-mode standalone:', window.matchMedia('(display-mode: standalone)').matches);
  
  // Check localStorage flag first (workaround for persistent detection)
  if (localStorage.getItem('pwaInstalled') === 'true') {
    console.log('[PWA] App is installed (localStorage flag)');
    hidePWAButton();
    return true;
  }
  
  // Method 1: Check display-mode (Android, Chrome Desktop)
  if (window.matchMedia('(display-mode: standalone)').matches) {
    console.log('[PWA] App is installed (standalone display mode)');
    localStorage.setItem('pwaInstalled', 'true');
    hidePWAButton();
    return true;
  }

  // Method 2: iOS check
  if (window.navigator.standalone === true) {
    console.log('[PWA] App is installed (iOS standalone)');
    localStorage.setItem('pwaInstalled', 'true');
    hidePWAButton();
    return true;
  }

  // Method 3: Check installed related apps
  if ('getInstalledRelatedApps' in navigator) {
    try {
      const apps = await navigator.getInstalledRelatedApps();
      console.log('[PWA] DEBUG - getInstalledRelatedApps result:', apps);
      if (apps && apps.length > 0) {
        console.log('[PWA] App is installed (related apps check)');
        localStorage.setItem('pwaInstalled', 'true');
        hidePWAButton();
        return true;
      }
    } catch (error) {
      console.log('[PWA] Related apps check failed:', error);
    }
  }

  // App not installed - show button
  console.log('[PWA] App not installed - showing button');
  showPWAButton();
  return false;
}

/**
 * Apply dark mode to the document
 */
function applyDarkMode(isDarkMode) {
  const html = document.documentElement;
  const body = document.body;
  
  if (isDarkMode) {
    // Dark mode
    html.classList.remove('light');
    body.classList.add('bg-gray-900', 'text-white');
    body.classList.remove('bg-white', 'text-gray-900');
  } else {
    // Light mode
    html.classList.add('light');
    body.classList.add('bg-white', 'text-gray-900');
    body.classList.remove('bg-gray-900', 'text-white');
  }
}

/**
 * Update dark mode toggle icon
 */
function updateDarkModeIcon(icon, isDarkMode) {
  if (!icon) return;
  
  if (isDarkMode) {
    // Dark mode active - show sun icon
    icon.classList.remove('ti-sun');
    icon.classList.add('ti-moon');
  } else {
    // Light mode active - show moon icon
    icon.classList.remove('ti-moon');
    icon.classList.add('ti-sun');
  }
}

/**
 * Initialize form validation
 */
function initializeFormValidation() {
  const forms = document.querySelectorAll('form');
  
  forms.forEach(form => {
    form.addEventListener('submit', (e) => {
      const passwordField = form.querySelector('input[name="password"]');
      const confirmPasswordField = form.querySelector('input[name="confirmPassword"]');
      
      if (passwordField && confirmPasswordField) {
        if (passwordField.value !== confirmPasswordField.value) {
          e.preventDefault();
          alert('Passwords do not match!');
          return false;
        }
      }
    });
  });
}

/**
 * Show notification
 */
function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.className = `alert alert-${type}`;
  notification.textContent = message;
  notification.style.position = 'fixed';
  notification.style.top = '20px';
  notification.style.right = '20px';
  notification.style.zIndex = '9999';
  notification.style.minWidth = '300px';
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.remove();
  }, 5000);
}

/**
 * Format bytes to human readable
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Format duration to readable string
 */
function formatDuration(seconds) {
  if (!seconds || seconds < 0) return '00:00';
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  
  return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// Export functions for use in other scripts
window.MediaFlowLive = {
  showNotification,
  formatBytes,
  formatDuration
};