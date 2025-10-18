// Dashboard JavaScript
// Handles all dashboard interactions

// Pagination variables
let currentTablePage = 1;
let currentCardPage = 1;
const itemsPerPage = 12;
let allBroadcasts = [];

// View toggle functionality
let currentView = 'table'; // Default: table view

function switchView(view) {
  currentView = view;
  const tableContainer = document.getElementById('tableViewContainer');
  const cardContainer = document.getElementById('cardViewContainer');
  const cardViewBtn = document.getElementById('cardViewBtn');
  const tableViewBtn = document.getElementById('tableViewBtn');

  // Check if we're on mobile (screen width < 768px which is md breakpoint)
  const isMobile = window.innerWidth < 768;

  if (view === 'card') {
    // Show card view, hide table
    if (tableContainer) {
      tableContainer.classList.add('hidden');
      // On desktop, also remove md:block to force card view
      if (!isMobile) {
        tableContainer.classList.remove('md:block');
      }
    }
    if (cardContainer) {
      cardContainer.classList.remove('hidden');
      // On desktop, force display
      if (!isMobile) {
        cardContainer.classList.remove('md:hidden');
        cardContainer.classList.add('block');
      }
    }
    if (cardViewBtn) cardViewBtn.classList.add('bg-gray-600');
    if (tableViewBtn) tableViewBtn.classList.remove('bg-gray-600');
    
    // Update card pagination and filter
    updateCardPagination();
    filterCardItems();
  } else {
    // Show table view, hide card (only on desktop)
    if (!isMobile) {
      if (tableContainer) {
        tableContainer.classList.remove('hidden');
        tableContainer.classList.add('md:block');
      }
      if (cardContainer) {
        cardContainer.classList.add('hidden');
        cardContainer.classList.add('md:hidden');
        cardContainer.classList.remove('block');
      }
      if (tableViewBtn) tableViewBtn.classList.add('bg-gray-600');
      if (cardViewBtn) cardViewBtn.classList.remove('bg-gray-600');
      
      // Update table pagination and filter
      updateTablePagination();
      filterTableRows();
    }
  }
  
  // Save preference to localStorage (only for desktop)
  if (!isMobile) {
    localStorage.setItem('dashboardView', view);
  }
}

// Auto-detect and apply view based on screen size
function applyResponsiveView() {
  const isMobile = window.innerWidth < 768;
  const tableContainer = document.getElementById('tableViewContainer');
  const cardContainer = document.getElementById('cardViewContainer');
  const cardViewBtn = document.getElementById('cardViewBtn');
  const tableViewBtn = document.getElementById('tableViewBtn');
  
  if (isMobile) {
    // Force card view on mobile
    currentView = 'card';
    if (tableContainer) {
      tableContainer.classList.add('hidden');
      tableContainer.classList.remove('md:block');
    }
    if (cardContainer) {
      cardContainer.classList.remove('hidden');
      cardContainer.classList.add('block');
      cardContainer.classList.remove('md:hidden');
    }
    // Update button states (buttons hidden on mobile anyway)
    if (cardViewBtn) cardViewBtn.classList.add('bg-gray-600');
    if (tableViewBtn) tableViewBtn.classList.remove('bg-gray-600');
  } else {
    // On desktop, respect user preference
    const savedView = localStorage.getItem('dashboardView') || 'table';
    currentView = savedView;
    
    if (savedView === 'table') {
      if (tableContainer) {
        tableContainer.classList.remove('hidden');
        tableContainer.classList.add('md:block');
      }
      if (cardContainer) {
        cardContainer.classList.add('hidden');
        cardContainer.classList.add('md:hidden');
        cardContainer.classList.remove('block');
      }
      if (tableViewBtn) tableViewBtn.classList.add('bg-gray-600');
      if (cardViewBtn) cardViewBtn.classList.remove('bg-gray-600');
    } else {
      if (tableContainer) {
        tableContainer.classList.add('hidden');
        tableContainer.classList.remove('md:block');
      }
      if (cardContainer) {
        cardContainer.classList.remove('hidden');
        cardContainer.classList.remove('md:hidden');
        cardContainer.classList.add('block');
      }
      if (cardViewBtn) cardViewBtn.classList.add('bg-gray-600');
      if (tableViewBtn) tableViewBtn.classList.remove('bg-gray-600');
    }
  }
}

// Initialize responsive view on load and resize
window.addEventListener('load', applyResponsiveView);
window.addEventListener('resize', applyResponsiveView);

// Pagination functions for table
function changePage(direction) {
  const totalPages = Math.ceil(allBroadcasts.length / itemsPerPage);
  
  if (direction === 'prev' && currentTablePage > 1) {
    currentTablePage--;
  } else if (direction === 'next' && currentTablePage < totalPages) {
    currentTablePage++;
  } else if (typeof direction === 'number') {
    currentTablePage = direction;
  }
  
  updateTablePagination();
  filterTableRows();
}

function updateTablePagination() {
  const totalPages = Math.ceil(allBroadcasts.length / itemsPerPage);
  const start = (currentTablePage - 1) * itemsPerPage + 1;
  const end = Math.min(currentTablePage * itemsPerPage, allBroadcasts.length);
  
  // Update showing info
  const showingInfo = document.getElementById('tableShowingInfo');
  if (showingInfo) {
    showingInfo.textContent = `Showing ${start}-${end} of ${allBroadcasts.length} streams`;
  }
  
  // Update page numbers
  const paginationNumbers = document.getElementById('tablePaginationNumbers');
  if (paginationNumbers) {
    paginationNumbers.innerHTML = '';
    
    for (let i = 1; i <= totalPages; i++) {
      const button = document.createElement('button');
      button.textContent = i;
      button.onclick = () => changePage(i);
      button.className = `w-10 h-10 rounded transition-colors ${
        i === currentTablePage 
          ? 'bg-blue-600 text-white' 
          : 'bg-gray-700 hover:bg-gray-600 text-white'
      }`;
      paginationNumbers.appendChild(button);
    }
  }
  
  // Update prev/next button states
  const prevBtn = document.getElementById('tablePrevBtn');
  const nextBtn = document.getElementById('tableNextBtn');
  if (prevBtn) prevBtn.disabled = currentTablePage === 1;
  if (nextBtn) nextBtn.disabled = currentTablePage === totalPages;
}

function filterTableRows() {
  const tbody = document.getElementById('streamsTableBody');
  if (!tbody) return;
  
  const rows = Array.from(tbody.querySelectorAll('tr')).filter(row => 
    row.querySelector('[data-broadcast-id]')
  );
  
  const start = (currentTablePage - 1) * itemsPerPage;
  const end = start + itemsPerPage;
  
  rows.forEach((row, index) => {
    if (index >= start && index < end) {
      row.style.display = '';
    } else {
      row.style.display = 'none';
    }
  });
}

// Pagination functions for card
function changeCardPage(direction) {
  const totalPages = Math.ceil(allBroadcasts.length / itemsPerPage);
  
  if (direction === 'prev' && currentCardPage > 1) {
    currentCardPage--;
  } else if (direction === 'next' && currentCardPage < totalPages) {
    currentCardPage++;
  } else if (typeof direction === 'number') {
    currentCardPage = direction;
  }
  
  updateCardPagination();
  filterCardItems();
}

function updateCardPagination() {
  const totalPages = Math.ceil(allBroadcasts.length / itemsPerPage);
  const start = (currentCardPage - 1) * itemsPerPage + 1;
  const end = Math.min(currentCardPage * itemsPerPage, allBroadcasts.length);
  
  // Update showing info
  const showingInfo = document.getElementById('cardShowingInfo');
  if (showingInfo) {
    showingInfo.textContent = `Showing ${start}-${end} of ${allBroadcasts.length} streams`;
  }
  
  // Update page numbers
  const paginationNumbers = document.getElementById('cardPaginationNumbers');
  if (paginationNumbers) {
    paginationNumbers.innerHTML = '';
    
    for (let i = 1; i <= totalPages; i++) {
      const button = document.createElement('button');
      button.textContent = i;
      button.onclick = () => changeCardPage(i);
      button.className = `w-10 h-10 rounded transition-colors ${
        i === currentCardPage 
          ? 'bg-blue-600 text-white' 
          : 'bg-gray-700 hover:bg-gray-600 text-white'
      }`;
      paginationNumbers.appendChild(button);
    }
  }
  
  // Update prev/next button states
  const prevBtn = document.getElementById('cardPrevBtn');
  const nextBtn = document.getElementById('cardNextBtn');
  if (prevBtn) prevBtn.disabled = currentCardPage === 1;
  if (nextBtn) nextBtn.disabled = currentCardPage === totalPages;
}

function filterCardItems() {
  const cardGrid = document.getElementById('cardGrid');
  if (!cardGrid) return;
  
  const cards = Array.from(cardGrid.children).filter(card => 
    card.classList.contains('bg-gray-800')
  );
  
  const start = (currentCardPage - 1) * itemsPerPage;
  const end = start + itemsPerPage;
  
  cards.forEach((card, index) => {
    if (index >= start && index < end) {
      card.style.display = '';
    } else {
      card.style.display = 'none';
    }
  });
}

// Initialize view on page load
document.addEventListener('DOMContentLoaded', () => {
  // Collect all broadcasts from DOM
  const tbody = document.getElementById('streamsTableBody');
  if (tbody) {
    const rows = Array.from(tbody.querySelectorAll('tr')).filter(row => 
      row.querySelector('[data-broadcast-id]')
    );
    allBroadcasts = rows.map(row => ({
      id: row.querySelector('[data-broadcast-id]').getAttribute('data-broadcast-id')
    }));
  }
  
  // Initialize pagination
  updateTablePagination();
  updateCardPagination();
  filterTableRows();
  filterCardItems();
  
  // Apply responsive view will handle button states
  applyResponsiveView();
});

// Modal functions
function openNewStreamModal() {
  // Reset video preview to default state
  const video = document.getElementById('streamPreviewVideo');
  const noVideoDiv = document.getElementById('noVideoSelected');
  const videoInfo = document.getElementById('streamVideoInfo');
  
  if (video) {
    video.pause();
    video.currentTime = 0;
    video.classList.add('hidden');
  }
  if (noVideoDiv) noVideoDiv.classList.remove('hidden');
  if (videoInfo) videoInfo.classList.add('hidden');
  
  // Show modal
  document.getElementById('newStreamModal').classList.remove('hidden');
}

function closeNewStreamModal() {
  document.getElementById('newStreamModal').classList.add('hidden');
  document.getElementById('newStreamForm').reset();
  
  // Reset video preview
  const video = document.getElementById('streamPreviewVideo');
  const noVideoDiv = document.getElementById('noVideoSelected');
  const videoInfo = document.getElementById('streamVideoInfo');
  
  if (video) {
    video.pause();
    video.currentTime = 0;
    video.classList.add('hidden');
  }
  if (noVideoDiv) noVideoDiv.classList.remove('hidden');
  if (videoInfo) videoInfo.classList.add('hidden');
  
  // Clear selected video ID and dropdown text
  const selectedContentId = document.getElementById('selectedContentId');
  const selectedVideoText = document.getElementById('selectedVideoText');
  if (selectedContentId) selectedContentId.value = '';
  if (selectedVideoText) {
    selectedVideoText.textContent = 'Choose a video...';
    selectedVideoText.classList.add('text-gray-400');
    selectedVideoText.classList.remove('text-white');
  }
  
  // Reset platform selection to custom (default)
  document.querySelectorAll('.platform-btn').forEach(btn => {
    btn.classList.remove('border-blue-500');
    btn.classList.add('border-gray-600');
    if (btn.getAttribute('data-platform') === 'custom') {
      btn.classList.remove('border-gray-600');
      btn.classList.add('border-blue-500');
    }
  });
  document.getElementById('platformNameInput').value = 'custom';
  document.getElementById('destinationUrlInput').placeholder = 'Enter custom RTMP URL';
}

// Toggle video dropdown
function toggleVideoDropdown() {
  const dropdown = document.getElementById('videoDropdownList');
  dropdown.classList.toggle('hidden');
}

// Close dropdown when clicking outside
document.addEventListener('click', function(event) {
  const dropdown = document.getElementById('videoDropdownList');
  const button = document.getElementById('videoDropdownButton');
  
  if (dropdown && button && !dropdown.contains(event.target) && !button.contains(event.target)) {
    dropdown.classList.add('hidden');
  }
});

// Filter video dropdown
function filterVideoDropdown() {
  const searchInput = document.getElementById('videoSearchInput');
  const searchTerm = searchInput.value.toLowerCase();
  const items = document.querySelectorAll('.video-dropdown-item');
  
  items.forEach(item => {
    const title = item.getAttribute('data-title').toLowerCase();
    if (title.includes(searchTerm)) {
      item.style.display = '';
    } else {
      item.style.display = 'none';
    }
  });
}

// Select video from dropdown item
function selectVideoFromDropdownItem(element) {
  const contentId = element.getAttribute('data-content-id');
  const filename = element.getAttribute('data-filename');
  const title = element.getAttribute('data-title');
  const duration = parseInt(element.getAttribute('data-duration'));
  const resolution = element.getAttribute('data-resolution');
  const type = element.getAttribute('data-type') || 'content'; // Default to content if not specified
  const videoCount = element.getAttribute('data-video-count');
  
  // Update hidden input with format "type-id"
  const formattedId = `${type}-${contentId}`;
  document.getElementById('selectedContentId').value = formattedId;
  
  // Update button text
  document.getElementById('selectedVideoText').textContent = title;
  document.getElementById('selectedVideoText').classList.remove('text-gray-400');
  document.getElementById('selectedVideoText').classList.add('text-white');
  
  // Close dropdown
  document.getElementById('videoDropdownList').classList.add('hidden');
  
  // Update preview based on type
  const video = document.getElementById('streamPreviewVideo');
  const source = document.getElementById('streamPreviewSource');
  const noVideoDiv = document.getElementById('noVideoSelected');
  const videoInfo = document.getElementById('streamVideoInfo');
  const previewContainer = document.getElementById('streamPreviewContainer');
  
  if (type === 'playlist') {
    // Show playlist preview with gradient background
    if (video) video.classList.add('hidden');
    if (noVideoDiv) {
      noVideoDiv.classList.remove('hidden');
      noVideoDiv.innerHTML = `
        <div class="absolute inset-0 bg-gradient-to-br from-purple-600 to-blue-600 opacity-20"></div>
        <div class="relative z-10 flex flex-col items-center">
          <i class="ti ti-playlist text-6xl mb-3 text-purple-400"></i>
          <p class="text-lg font-medium text-white">${title}</p>
          <p class="text-sm text-gray-400">Playlist • ${videoCount} videos</p>
        </div>
      `;
    }
    
    // Update video info for playlist
    if (videoInfo) {
      document.getElementById('streamVideoTitle').textContent = title;
      document.getElementById('streamVideoResolution').textContent = 'Playlist';
      document.getElementById('streamVideoDuration').textContent = `${videoCount} videos`;
      videoInfo.classList.remove('hidden');
    }
  } else {
    // Show video preview
    if (video && source && filename) {
      // Reset noVideoDiv to default state
      if (noVideoDiv) {
        noVideoDiv.innerHTML = `
          <i class="ti ti-video-off text-6xl mb-3"></i>
          <p class="text-sm">Select a video to preview</p>
        `;
        noVideoDiv.classList.add('hidden');
      }
      
      // Set video source
      source.src = `/storage/uploads/${filename}`;
      video.load();
      
      // Show video
      video.classList.remove('hidden');
    }
    
    // Update video info
    if (videoInfo) {
      document.getElementById('streamVideoTitle').textContent = title;
      document.getElementById('streamVideoResolution').textContent = resolution || 'N/A';
      
      const minutes = Math.floor(duration / 60);
      const seconds = Math.floor(duration % 60);
      document.getElementById('streamVideoDuration').textContent = `${minutes}:${String(seconds).padStart(2, '0')}`;
      
      videoInfo.classList.remove('hidden');
    }
  }
}

// Platform selection
function selectPlatform(button) {
  const platform = button.getAttribute('data-platform');
  const url = button.getAttribute('data-url');
  
  // Update hidden input
  document.getElementById('platformNameInput').value = platform;
  
  // Update RTMP URL input (only if custom platform, allow manual input)
  const urlInput = document.getElementById('destinationUrlInput');
  if (platform !== 'custom') {
    urlInput.value = url;
    urlInput.placeholder = url + '[your-stream-key]';
  } else {
    urlInput.value = '';
    urlInput.placeholder = 'Enter custom RTMP URL';
  }
  
  // Update button styles
  document.querySelectorAll('.platform-btn').forEach(btn => {
    btn.classList.remove('border-blue-500');
    btn.classList.add('border-gray-600');
  });
  button.classList.remove('border-gray-600');
  button.classList.add('border-blue-500');
}

// Orientation selection
function selectOrientation(orientation, button) {
  // Update hidden input
  document.querySelector('input[name="orientation"]').value = orientation;
  
  // Update button styles
  const buttons = button.parentElement.querySelectorAll('button');
  buttons.forEach(btn => {
    if (btn === button) {
      btn.classList.remove('bg-gray-700', 'hover:bg-gray-600');
      btn.classList.add('bg-blue-600');
    } else {
      btn.classList.remove('bg-blue-600');
      btn.classList.add('bg-gray-700', 'hover:bg-gray-600');
    }
  });
}

// Toggle stream key visibility
function toggleStreamKeyVisibility() {
  const input = document.getElementById('streamKeyInput');
  const icon = document.getElementById('toggleKeyIcon');
  
  if (input.type === 'password') {
    input.type = 'text';
    icon.classList.remove('ti-eye');
    icon.classList.add('ti-eye-off');
  } else {
    input.type = 'password';
    icon.classList.remove('ti-eye-off');
    icon.classList.add('ti-eye');
  }
}

// Update platform hints
function updatePlatformHints(platform) {
  const hint = document.getElementById('platform-hint');
  const hints = {
    'YouTube': 'Example: rtmp://a.rtmp.youtube.com/live2',
    'Facebook': 'Example: rtmps://live-api-s.facebook.com:443/rtmp/',
    'Twitch': 'Example: rtmp://live.twitch.tv/app/',
    'TikTok': 'Example: rtmp://push.tiktok.com/rtmp/',
    'Instagram': 'Example: rtmps://live-upload.instagram.com:443/rtmp/',
    'Custom': 'Enter your custom RTMP server URL'
  };
  
  hint.textContent = hints[platform] || 'Enter your RTMP server URL';
}

// Handle new stream form submission
document.getElementById('newStreamForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const formData = new FormData(e.target);
  const data = Object.fromEntries(formData.entries());
  
  // Handle checkbox - checkbox only sends value if checked
  // If unchecked, it won't be in formData at all
  if (!data.loopVideo) {
    data.loopVideo = 'off'; // or false, depending on backend expectation
  }
  
  // Ensure broadcastName is sent even if empty
  if (!data.broadcastName || data.broadcastName.trim() === '') {
    data.broadcastName = ''; // Backend will use default
  }
  
  // Debug: Check what data is being sent
  console.log('Form data being sent:', data);
  console.log('Broadcast Name:', data.broadcastName);
  console.log('Content ID:', data.contentId);
  console.log('Destination URL:', data.destinationUrl);
  
  try {
    const response = await fetch('/api/broadcast/start', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });
    
    const result = await response.json();
    
    if (result.success) {
      showNotification('Broadcast created successfully!', 'success');
      closeNewStreamModal();
      setTimeout(() => location.reload(), 1000);
    } else {
      showNotification(result.message || 'Failed to create broadcast', 'error');
    }
  } catch (error) {
    console.error('Error:', error);
    showNotification('Failed to create broadcast', 'error');
  }
});

// Start broadcast (from offline to active)
async function startBroadcast(broadcastId) {
  if (!confirm('Start this broadcast?')) return;
  
  try {
    const response = await fetch(`/api/broadcast/start/${broadcastId}`, {
      method: 'POST'
    });
    
    const result = await response.json();
    
    if (result.success) {
      showNotification('Broadcast started!', 'success');
      setTimeout(() => location.reload(), 1000);
    } else {
      // Check if this is a Facebook connection error
      const errorMsg = result.message || 'Failed to start broadcast';
      if (errorMsg.includes('Facebook connection error')) {
        showNotification('⚠️ Facebook connection busy. Please wait 10-15 seconds and try again.', 'error');
      } else {
        showNotification(errorMsg, 'error');
      }
    }
  } catch (error) {
    console.error('Error:', error);
    showNotification('Failed to start broadcast', 'error');
  }
}

// Stop broadcast
async function stopBroadcast(broadcastId) {
  if (!confirm('Stop this broadcast?')) return;
  
  try {
    const response = await fetch(`/api/broadcast/stop/${broadcastId}`, {
      method: 'POST'
    });
    
    const result = await response.json();
    
    if (result.success) {
      showNotification('Broadcast stopped. Wait 10-15 seconds before restarting (especially for Facebook).', 'success');
      setTimeout(() => location.reload(), 2000);
    } else {
      showNotification(result.message || 'Failed to stop broadcast', 'error');
    }
  } catch (error) {
    console.error('Error:', error);
    showNotification('Failed to stop broadcast', 'error');
  }
}

// Delete broadcast
async function deleteBroadcast(broadcastId) {
  if (!confirm('Delete this broadcast? This action cannot be undone.')) return;
  
  try {
    const response = await fetch(`/api/broadcast/${broadcastId}`, {
      method: 'DELETE'
    });
    
    const result = await response.json();
    
    if (result.success) {
      showNotification('Broadcast deleted', 'success');
      setTimeout(() => location.reload(), 500);
    } else {
      showNotification(result.message || 'Failed to delete broadcast', 'error');
    }
  } catch (error) {
    console.error('Error:', error);
    showNotification('Failed to delete broadcast', 'error');
  }
}

// Edit broadcast (placeholder)
function editBroadcast(broadcastId) {
  showNotification('Edit feature coming soon!', 'info');
}

// Format bytes to GB
function formatGB(bytes) {
  return (bytes / (1024 * 1024 * 1024)).toFixed(2);
}

// Format network speed
function formatSpeed(bytesPerSecond) {
  const mbps = (bytesPerSecond * 8) / (1024 * 1024);
  if (mbps >= 1) {
    return mbps.toFixed(2) + ' Mbps';
  } else {
    const kbps = mbps * 1024;
    return kbps.toFixed(0) + ' Kbps';
  }
}

// Update live timers
function updateLiveTimers() {
  document.querySelectorAll('.timer').forEach(timer => {
    const startTime = new Date(timer.dataset.start);
    const now = new Date();
    const diff = Math.floor((now - startTime) / 1000); // seconds
    
    const hours = Math.floor(diff / 3600);
    const minutes = Math.floor((diff % 3600) / 60);
    const seconds = diff % 60;
    
    timer.textContent = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  });
}

// Update system stats
async function updateSystemStats() {
  try {
    const response = await fetch('/api/system/stats');
    const result = await response.json();
    
    if (result.success) {
      const stats = result.stats;
      
      // Update CPU
      document.getElementById('cpuUsage').textContent = stats.cpu.toFixed(1);
      document.getElementById('cpuBar').style.width = stats.cpu + '%';
      
      // Update Memory
      const memoryUsedGB = (stats.memory.used / (1024 * 1024 * 1024)).toFixed(2);
      const memoryTotalGB = (stats.memory.total / (1024 * 1024 * 1024)).toFixed(2);
      document.getElementById('memoryUsed').textContent = memoryUsedGB;
      document.getElementById('memoryTotal').textContent = memoryTotalGB;
      
      // Update Internet Speed (simulate for now - can be replaced with real network monitoring)
      const uploadMbps = (Math.random() * 10 + 5).toFixed(2);
      const downloadKbps = Math.floor(Math.random() * 400 + 100);
      document.getElementById('uploadSpeed').textContent = uploadMbps + ' Mbps';
      document.getElementById('downloadSpeed').textContent = downloadKbps + ' Kbps';
      
      // Update Active Streams Count
      const activeCount = document.querySelectorAll('[data-broadcast-id]').length;
      document.getElementById('activeBroadcastCount').textContent = activeCount;
      
      // Update live timers
      updateLiveTimers();
    }
  } catch (error) {
    console.error('Failed to update stats:', error);
  }
}

// Show notification
function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.className = `fixed top-4 right-4 z-50 px-6 py-3 rounded-lg shadow-lg transition-all transform translate-x-0 ${
    type === 'success' ? 'bg-green-600' :
    type === 'error' ? 'bg-red-600' :
    type === 'info' ? 'bg-blue-600' : 'bg-gray-600'
  } text-white`;
  notification.textContent = message;
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.style.transform = 'translateX(400px)';
    notification.style.opacity = '0';
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

// Search streams
document.getElementById('searchInput')?.addEventListener('input', (e) => {
  const searchTerm = e.target.value.toLowerCase();
  const rows = document.querySelectorAll('#streamsTableBody tr[data-broadcast-id]');
  
  rows.forEach(row => {
    const text = row.textContent.toLowerCase();
    row.style.display = text.includes(searchTerm) ? '' : 'none';
  });
});

// Initialize - Update stats every 5 seconds and timers every second
if (document.getElementById('cpuUsage')) {
  updateSystemStats();
  setInterval(updateSystemStats, 5000);
  setInterval(updateLiveTimers, 1000);
}

// Close modal on outside click
document.getElementById('newStreamModal')?.addEventListener('click', (e) => {
  if (e.target.id === 'newStreamModal') {
    closeNewStreamModal();
  }
});

// Stream Info Modal Functions
async function openStreamInfoModal(broadcastId) {
  try {
    const response = await fetch(`/api/broadcast/${broadcastId}`);
    const data = await response.json();

    if (data.success) {
      const broadcast = data.broadcast;
      
      // Populate modal with broadcast data
      document.getElementById('infoStreamName').textContent = broadcast.broadcast_name || 'N/A';
      document.getElementById('infoPlatform').textContent = broadcast.platform_name || 'N/A';
      document.getElementById('infoStatus').textContent = broadcast.broadcast_status || 'N/A';
      
      // Duration
      if (broadcast.duration) {
        const minutes = Math.floor(broadcast.duration / 60);
        const seconds = broadcast.duration % 60;
        document.getElementById('infoDuration').textContent = `${minutes}m ${seconds}s`;
      } else {
        document.getElementById('infoDuration').textContent = '0m 0s';
      }
      
      document.getElementById('infoDestination').textContent = broadcast.destination_url || 'N/A';
      document.getElementById('infoStreamKey').textContent = broadcast.stream_key || 'N/A';
      
      // Show modal
      document.getElementById('streamInfoModal').classList.remove('hidden');
    } else {
      showNotification(data.error || 'Failed to load stream info', 'error');
    }
  } catch (error) {
    console.error('Error loading stream info:', error);
    showNotification('Failed to load stream info', 'error');
  }
}

function closeStreamInfoModal() {
  document.getElementById('streamInfoModal').classList.add('hidden');
}

// Edit Stream Modal Functions
async function openEditStreamModal(broadcastId) {
  try {
    const response = await fetch(`/api/broadcast/${broadcastId}`);
    const data = await response.json();

    if (data.success) {
      const broadcast = data.broadcast;
      
      // Populate form with broadcast data
      document.getElementById('editBroadcastId').value = broadcast.broadcast_id;
      document.getElementById('editStreamName').value = broadcast.broadcast_name || '';
      document.getElementById('editDestinationUrl').value = broadcast.destination_url || '';
      document.getElementById('editStreamKey').value = broadcast.stream_key || '';
      
      // Detect and highlight current platform
      const destinationUrl = broadcast.destination_url || '';
      detectEditPlatform(destinationUrl);
      
      // Populate preview info
      document.getElementById('editBroadcastIdDisplay').textContent = broadcast.broadcast_id;
      
      // Content type
      const contentType = broadcast.content_type === 'playlist' ? 'Playlist' : 'Single Video';
      document.getElementById('editContentType').textContent = contentType;
      
      // Status with color
      const statusElement = document.getElementById('editBroadcastStatus');
      const statusColors = {
        'active': 'text-green-400',
        'offline': 'text-gray-400',
        'failed': 'text-red-400',
        'completed': 'text-blue-400',
        'scheduled': 'text-yellow-400'
      };
      const statusColor = statusColors[broadcast.broadcast_status] || 'text-gray-400';
      statusElement.innerHTML = `
        <span class="inline-flex items-center gap-1 px-2 py-1 bg-gray-700 rounded text-xs">
          <i class="ti ti-circle-filled text-xs ${statusColor}"></i>
          <span class="capitalize">${broadcast.broadcast_status || 'Unknown'}</span>
        </span>
      `;
      
      // Show/hide Schedule Settings preview
      const scheduleSettingsPreview = document.getElementById('editScheduleSettingsPreview');
      if (scheduleSettingsPreview) {
        // Check if there's any schedule settings
        const hasSchedule = broadcast.scheduled_time || broadcast.scheduled_time;
        const loopVideo = broadcast.content_type === 'playlist' || false;
        
        if (hasSchedule) {
          scheduleSettingsPreview.style.display = 'block';
          document.getElementById('editPreviewLoopVideo').textContent = loopVideo ? 'Yes' : 'No';
          document.getElementById('editPreviewScheduleTime').textContent = broadcast.scheduled_time ? new Date(broadcast.scheduled_time).toLocaleString() : 'Not scheduled';
        } else {
          scheduleSettingsPreview.style.display = 'none';
        }
      }
      
      // Show/hide Advanced Settings preview
      const advancedSettingsPreview = document.getElementById('editAdvancedSettingsPreview');
      if (advancedSettingsPreview) {
        // Check if there's any advanced settings
        const hasAdvancedSettings = broadcast.bitrate || broadcast.frame_rate || broadcast.resolution || broadcast.orientation;
        
        if (hasAdvancedSettings) {
          advancedSettingsPreview.style.display = 'block';
          document.getElementById('editPreviewBitrate').textContent = broadcast.bitrate || 'Default (2500k)';
          document.getElementById('editPreviewFrameRate').textContent = broadcast.frame_rate ? `${broadcast.frame_rate} FPS` : 'Default (30 FPS)';
          document.getElementById('editPreviewResolution').textContent = broadcast.resolution || 'Auto-detect';
          document.getElementById('editPreviewOrientation').textContent = broadcast.orientation ? broadcast.orientation.charAt(0).toUpperCase() + broadcast.orientation.slice(1) : 'Landscape';
        } else {
          advancedSettingsPreview.style.display = 'none';
        }
      }
      
      // Video info and preview
      const videoInfoElement = document.getElementById('editVideoInfo');
      const video = document.getElementById('editPreviewVideo');
      const source = document.getElementById('editPreviewSource');
      const noVideoDiv = document.getElementById('editNoVideoSelected');
      
      if (broadcast.content_type === 'playlist') {
        // For playlist, show info but no video preview
        if (broadcast.playlist_name) {
          videoInfoElement.textContent = `Playlist: ${broadcast.playlist_name}`;
        } else {
          videoInfoElement.textContent = 'Playlist';
        }
        
        // Hide video, show no video message
        if (video) video.classList.add('hidden');
        if (noVideoDiv) noVideoDiv.classList.remove('hidden');
      } else {
        // For single video, show preview
        if (broadcast.content_title) {
          videoInfoElement.textContent = broadcast.content_title;
        } else {
          videoInfoElement.textContent = 'Single Video';
        }
        
        // Load video preview if content_id exists
        if (broadcast.content_id) {
          fetch(`/api/content/${broadcast.content_id}`)
            .then(res => res.json())
            .then(data => {
              if (data.success && data.content) {
                source.src = `/storage/uploads/${data.content.filename}`;
                source.type = 'video/mp4';
                video.load();
                video.classList.remove('hidden');
                noVideoDiv.classList.add('hidden');
              }
            })
            .catch(err => console.error('Error loading video preview:', err));
        } else {
          // No content_id, show no video message
          if (video) video.classList.add('hidden');
          if (noVideoDiv) noVideoDiv.classList.remove('hidden');
        }
      }
      
      // Show modal
      document.getElementById('editStreamModal').classList.remove('hidden');
    } else {
      showNotification(data.error || 'Failed to load stream data', 'error');
    }
  } catch (error) {
    console.error('Error loading stream data:', error);
    showNotification('Failed to load stream data', 'error');
  }
}

function closeEditStreamModal() {
  document.getElementById('editStreamModal').classList.add('hidden');
  document.getElementById('editStreamForm').reset();
  
  // Reset platform selection
  document.querySelectorAll('.edit-platform-btn').forEach(btn => {
    btn.classList.remove('border-blue-500');
    btn.classList.add('border-gray-600');
  });
}

// Detect platform from URL
function detectEditPlatform(url) {
  const platforms = [
    { name: 'youtube', pattern: 'youtube.com' },
    { name: 'facebook', pattern: 'facebook.com' },
    { name: 'twitch', pattern: 'twitch.tv' },
    { name: 'tiktok', pattern: 'tiktok.com' },
    { name: 'instagram', pattern: 'instagram.com' }
  ];
  
  let detectedPlatform = 'custom';
  for (const platform of platforms) {
    if (url.includes(platform.pattern)) {
      detectedPlatform = platform.name;
      break;
    }
  }
  
  // Highlight detected platform
  document.querySelectorAll('.edit-platform-btn').forEach(btn => {
    if (btn.dataset.platform === detectedPlatform) {
      btn.classList.remove('border-gray-600');
      btn.classList.add('border-blue-500');
    } else {
      btn.classList.add('border-gray-600');
      btn.classList.remove('border-blue-500');
    }
  });
}

// Select platform in edit modal
function selectEditPlatform(button) {
  // Remove active state from all buttons
  document.querySelectorAll('.edit-platform-btn').forEach(btn => {
    btn.classList.remove('border-blue-500');
    btn.classList.add('border-gray-600');
  });
  
  // Add active state to clicked button
  button.classList.remove('border-gray-600');
  button.classList.add('border-blue-500');
  
  // Update destination URL based on platform
  const platform = button.dataset.platform;
  const url = button.dataset.url;
  
  if (platform === 'custom') {
    // For custom platform, clear the URL so user can input their own
    document.getElementById('editDestinationUrl').value = '';
  } else if (url) {
    // For other platforms, set the predefined URL
    document.getElementById('editDestinationUrl').value = url;
  }
}

// Toggle stream key visibility in edit modal
function toggleEditStreamKeyVisibility() {
  const input = document.getElementById('editStreamKey');
  const icon = document.getElementById('editToggleKeyIcon');
  
  if (input.type === 'password') {
    input.type = 'text';
    icon.classList.remove('ti-eye');
    icon.classList.add('ti-eye-off');
  } else {
    input.type = 'password';
    icon.classList.remove('ti-eye-off');
    icon.classList.add('ti-eye');
  }
}

// Update Stream Function
async function updateStream(event) {
  event.preventDefault();
  
  const broadcastId = document.getElementById('editBroadcastId').value;
  const formData = {
    broadcast_name: document.getElementById('editStreamName').value,
    destination_url: document.getElementById('editDestinationUrl').value,
    stream_key: document.getElementById('editStreamKey').value
  };

  console.log('Updating stream:', broadcastId, formData);

  try {
    const response = await fetch(`/api/broadcast/${broadcastId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(formData)
    });

    console.log('Response status:', response.status);
    const data = await response.json();
    console.log('Response data:', data);

    if (data.success) {
      showNotification('Stream updated successfully', 'success');
      closeEditStreamModal();
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } else {
      showNotification(data.error || 'Failed to update stream', 'error');
    }
  } catch (error) {
    console.error('Error updating stream:', error);
    showNotification('Failed to update stream', 'error');
  }
}

// Close modals on outside click
document.getElementById('streamInfoModal')?.addEventListener('click', (e) => {
  if (e.target.id === 'streamInfoModal') {
    closeStreamInfoModal();
  }
});

document.getElementById('editStreamModal')?.addEventListener('click', (e) => {
  if (e.target.id === 'editStreamModal') {
    closeEditStreamModal();
  }
});

console.log('Dashboard initialized');
