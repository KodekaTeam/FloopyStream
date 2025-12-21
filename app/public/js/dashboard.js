// Dashboard JavaScript
// Handles all dashboard interactions

// Pagination variables
let currentTablePage = 1;
let currentCardPage = 1;
const itemsPerPage = 8;
let allBroadcasts = [];
let filteredBroadcasts = [];
let currentSearchTerm = '';

// Debug helper - accessible from console
window.debugPagination = function() {
  console.log('=== PAGINATION DEBUG INFO ===');
  console.log('currentTablePage:', currentTablePage);
  console.log('currentCardPage:', currentCardPage);
  console.log('itemsPerPage:', itemsPerPage);
  console.log('allBroadcasts.length:', allBroadcasts.length);
  console.log('filteredBroadcasts.length:', filteredBroadcasts.length);
  console.log('currentSearchTerm:', currentSearchTerm);
  
  const tbody = document.getElementById('streamsTableBody');
  if (tbody) {
    const allRows = tbody.querySelectorAll('tr[data-broadcast-id]');
    const visibleRows = Array.from(allRows).filter(r => r.style.display !== 'none');
    console.log('Total rows in DOM:', allRows.length);
    console.log('Visible rows:', visibleRows.length);
  }
  
  return {
    currentTablePage,
    currentCardPage,
    itemsPerPage,
    allBroadcasts: allBroadcasts.length,
    filteredBroadcasts: filteredBroadcasts.length,
    currentSearchTerm
  };
};

// View toggle functionality
let currentView = 'table'; // Default: table view

function switchView(view) {
  currentView = view;
  const tableContainer = document.getElementById('tableViewContainer');
  const cardContainer = document.getElementById('cardViewContainer');
  const tablePaginationContainer = document.getElementById('tablePaginationContainer');
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
    // Hide table pagination
    if (tablePaginationContainer) {
      tablePaginationContainer.style.display = 'none';
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
      // Show table pagination
      if (tablePaginationContainer) {
        tablePaginationContainer.style.display = 'block';
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
  const totalPages = Math.ceil(filteredBroadcasts.length / itemsPerPage);
  
  if (direction === 'prev' && currentTablePage > 1) {
    currentTablePage--;
  } else if (direction === 'next' && currentTablePage < totalPages) {
    currentTablePage++;
  } else if (typeof direction === 'number') {
    currentTablePage = Math.max(1, Math.min(direction, totalPages));
  }
  
  updateTablePagination();
  filterTableRows();
  
  // Scroll to table top
  const tableContainer = document.getElementById('tableViewContainer');
  if (tableContainer) {
    tableContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function updateTablePagination() {
  const totalPages = Math.ceil(filteredBroadcasts.length / itemsPerPage);
  const start = (currentTablePage - 1) * itemsPerPage + 1;
  const end = Math.min(currentTablePage * itemsPerPage, filteredBroadcasts.length);
  
  console.log('updateTablePagination:', {
    filteredLength: filteredBroadcasts.length,
    totalPages,
    currentTablePage,
    itemsPerPage,
    start,
    end
  });
  
  // Update showing info
  const showingInfo = document.getElementById('tableShowingInfo');
  if (showingInfo) {
    showingInfo.textContent = `Showing ${start}-${end} of ${filteredBroadcasts.length} streams`;
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
  if (prevBtn) prevBtn.disabled = currentTablePage === 1 || totalPages <= 1;
  if (nextBtn) nextBtn.disabled = currentTablePage === totalPages || totalPages <= 1;
}

function filterTableRows() {
  const tbody = document.getElementById('streamsTableBody');
  if (!tbody) {
    console.log('filterTableRows: tbody not found');
    return;
  }
  
  // Get all rows that have data-broadcast-id attribute directly on TR
  const allRows = Array.from(tbody.querySelectorAll('tr[data-broadcast-id]'));
  
  console.log('filterTableRows: Total rows with broadcast-id:', allRows.length);
  console.log('filterTableRows: filteredBroadcasts.length:', filteredBroadcasts.length);
  
  const start = (currentTablePage - 1) * itemsPerPage;
  const end = start + itemsPerPage;
  
  let filteredRowIndex = 0;
  let totalShown = 0;
  
  allRows.forEach((row, rowIndex) => {
    const broadcastId = row.getAttribute('data-broadcast-id');
    
    // Cek apakah broadcast ini ada di filtered list
    const isInFilteredList = filteredBroadcasts.some(b => b.id === broadcastId);
    
    if (rowIndex < 3) { // Log first 3 rows only
      console.log(`Row ${rowIndex}: ID=${broadcastId}, inFiltered=${isInFilteredList}, filteredRowIndex=${filteredRowIndex}`);
    }
    
    if (!isInFilteredList) {
      row.style.display = 'none';
      return;
    }
    
    // Tampilkan/sembunyikan berdasarkan pagination range
    if (filteredRowIndex >= start && filteredRowIndex < end) {
      row.style.display = '';
      totalShown++;
      if (rowIndex < 3) {
        console.log(`  → SHOWING (${filteredRowIndex} in range ${start}-${end})`);
      }
    } else {
      row.style.display = 'none';
      if (rowIndex < 3) {
        console.log(`  → HIDING (${filteredRowIndex} outside range ${start}-${end})`);
      }
    }
    
    filteredRowIndex++;
  });
  
  console.log('filterTableRows SUMMARY:', {
    start,
    end,
    itemsPerPage,
    currentTablePage,
    filteredRowIndex,
    totalShown,
    filteredLength: filteredBroadcasts.length
  });
}

// Pagination functions for card
function changeCardPage(direction) {
  const totalPages = Math.ceil(filteredBroadcasts.length / itemsPerPage);
  
  if (direction === 'prev' && currentCardPage > 1) {
    currentCardPage--;
  } else if (direction === 'next' && currentCardPage < totalPages) {
    currentCardPage++;
  } else if (typeof direction === 'number') {
    currentCardPage = Math.max(1, Math.min(direction, totalPages));
  }
  
  updateCardPagination();
  filterCardItems();
  
  // Scroll to card grid top
  const cardGrid = document.getElementById('cardGrid');
  if (cardGrid) {
    cardGrid.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function updateCardPagination() {
  const totalPages = Math.ceil(filteredBroadcasts.length / itemsPerPage);
  const start = (currentCardPage - 1) * itemsPerPage + 1;
  const end = Math.min(currentCardPage * itemsPerPage, filteredBroadcasts.length);
  
  // Update showing info
  const showingInfo = document.getElementById('cardShowingInfo');
  if (showingInfo) {
    showingInfo.textContent = `Showing ${start}-${end} of ${filteredBroadcasts.length} streams`;
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
  
  const cards = Array.from(cardGrid.children);
  const start = (currentCardPage - 1) * itemsPerPage;
  const end = start + itemsPerPage;
  
  let filteredCardIndex = 0; // Counter untuk cards yang ada di filtered list
  
  cards.forEach((card) => {
    const broadcastId = card.getAttribute('data-broadcast-id');
    
    // Skip cards without broadcast ID (empty states)
    if (!broadcastId) {
      card.style.display = 'none';
      return;
    }
    
    // Check if this broadcast is in the filtered list
    const isInFilteredList = filteredBroadcasts.some(b => b.id === broadcastId);
    
    if (!isInFilteredList) {
      card.style.display = 'none';
      return;
    }
    
    // Show/hide based on pagination
    if (filteredCardIndex >= start && filteredCardIndex < end) {
      card.style.display = '';
    } else {
      card.style.display = 'none';
    }
    
    filteredCardIndex++;
  });
}

// Initialize - Update stats every 5 seconds and timers every second
// Initialize view on page load
document.addEventListener('DOMContentLoaded', () => {
  console.log('=== DOMContentLoaded - Initializing pagination ===');
  
  // Initialize table pagination visibility based on saved view preference or screen size
  const tablePaginationContainer = document.getElementById('tablePaginationContainer');
  if (tablePaginationContainer) {
    const isMobile = window.innerWidth < 768;
    const savedView = localStorage.getItem('dashboardView');
    
    // On mobile, always hide table pagination
    // On desktop, show table pagination unless card view is saved in localStorage
    if (isMobile) {
      tablePaginationContainer.style.display = 'none';
    } else if (savedView === 'card') {
      tablePaginationContainer.style.display = 'none';
    } else {
      tablePaginationContainer.style.display = 'block';
    }
  }
  
  // Collect all broadcasts from table rows
  const tbody = document.getElementById('streamsTableBody');
  console.log('tbody found:', !!tbody);
  
  if (tbody) {
    // Get rows with data-broadcast-id directly on TR element
    const rows = Array.from(tbody.querySelectorAll('tr[data-broadcast-id]'));
    console.log('Found rows with data-broadcast-id:', rows.length);
    
    allBroadcasts = rows.map(row => {
      const id = row.getAttribute('data-broadcast-id');
      const text = row.textContent.toLowerCase();
      console.log(`  Broadcast ID: ${id}`);
      return {
        id: id,
        element: row,
        text: text
      };
    });
    
    console.log('allBroadcasts initialized:', allBroadcasts.length);
    console.log('allBroadcasts IDs:', allBroadcasts.map(b => b.id));
  }
  
  // If no broadcasts found in table, try to collect from cards
  if (allBroadcasts.length === 0) {
    console.log('No broadcasts in table, checking cards...');
    const cardGrid = document.getElementById('cardGrid');
    if (cardGrid) {
      const cards = Array.from(cardGrid.children).filter(card => 
        card.getAttribute('data-broadcast-id')
      );
      allBroadcasts = cards.map(card => ({
        id: card.getAttribute('data-broadcast-id'),
        element: card,
        text: card.textContent.toLowerCase()
      }));
      console.log('allBroadcasts from cards:', allBroadcasts.length);
    }
  }
  
  // Initialize filtered broadcasts with all broadcasts
  filteredBroadcasts = [...allBroadcasts];
  console.log('filteredBroadcasts initialized:', filteredBroadcasts.length);
  console.log('filteredBroadcasts IDs:', filteredBroadcasts.map(b => b.id));
  
  // Reset pagination
  currentTablePage = 1;
  currentCardPage = 1;
  
  console.log('Starting pagination initialization...');
  // Initialize pagination
  updateTablePagination();
  updateCardPagination();
  filterTableRows();
  filterCardItems();
  
  // Apply responsive view will handle button states
  applyResponsiveView();
});

// Load user's channels into channel selector
async function loadUserChannels() {
  try {
    const response = await fetch('/api/channels');
    const result = await response.json();
    
    if (result.success && result.data) {
      const channelSelect = document.getElementById('channelSelect');
      if (!channelSelect) return;
      
      // Clear existing options except the first one
      channelSelect.innerHTML = '<option value="">Choose a channel...</option>';
      
      // Add channels
      result.data.forEach(channel => {
        const option = document.createElement('option');
        option.value = channel.channel_uuid;
        // Use channel_platform if available, otherwise platform
        const platformName = channel.channel_platform || channel.platform || 'Unknown';
        option.textContent = `${channel.channel_name} (${platformName})`;
        option.dataset.platform = platformName;
        channelSelect.appendChild(option);
      });
      
      // If no channels, show warning
      if (result.data.length === 0) {
        const option = document.createElement('option');
        option.value = "";
        option.textContent = "No channels available - Create a channel first";
        option.disabled = true;
        channelSelect.appendChild(option);
      }
    }
  } catch (error) {
    console.error('Error loading channels:', error);
    showNotification('Failed to load channels', 'error');
  }
}

// Load videos by channel
async function loadChannelVideos(channelUuid) {
  const videoDropdownButton = document.getElementById('videoDropdownButton');
  const videoDropdownList = document.querySelector('#videoDropdownList .p-2');
  const selectedVideoText = document.getElementById('selectedVideoText');
  const selectedContentId = document.getElementById('selectedContentId');
  
  if (!channelUuid) {
    // Clear video dropdown and disable button
    if (videoDropdownList) {
      videoDropdownList.innerHTML = '<div class="p-4 text-center text-gray-400"><i class="ti ti-inbox text-3xl mb-2"></i><p>Select a channel first</p></div>';
    }
    // Reset video selector
    if (selectedVideoText) selectedVideoText.textContent = 'Choose a video...';
    if (selectedContentId) selectedContentId.value = '';
    // Disable dropdown button
    if (videoDropdownButton) {
      videoDropdownButton.disabled = true;
      videoDropdownButton.classList.add('opacity-50', 'cursor-not-allowed');
    }
    return;
  }
  
  // Enable dropdown button
  if (videoDropdownButton) {
    videoDropdownButton.disabled = false;
    videoDropdownButton.classList.remove('opacity-50', 'cursor-not-allowed');
  }
  
  try {
    // Show loading state
    if (videoDropdownList) {
      videoDropdownList.innerHTML = '<div class="p-4 text-center text-gray-400"><i class="ti ti-loader ti-spin text-3xl mb-2"></i><p>Loading videos...</p></div>';
    }
    
    // Fetch galleries for this channel
    const galleriesResponse = await fetch(`/api/galleries/channel/${channelUuid}`);
    const galleriesResult = await galleriesResponse.json();
    
    if (!galleriesResult.success || !galleriesResult.data || galleriesResult.data.length === 0) {
      videoDropdownList.innerHTML = '<div class="p-4 text-center text-gray-400"><i class="ti ti-inbox text-3xl mb-2"></i><p>No videos in this channel</p></div>';
      return;
    }
    
    // Get videos from all galleries
    let allVideos = [];
    for (const gallery of galleriesResult.data) {
      const videosResponse = await fetch(`/api/galleries/${gallery.gallery_uuid}/videos`);
      const videosResult = await videosResponse.json();
      if (videosResult.success && videosResult.data) {
        allVideos = allVideos.concat(videosResult.data.map(v => ({
          ...v,
          galleryName: gallery.gallery_title
        })));
      }
    }
    
    // Also fetch playlists for this channel
    const playlistsResponse = await fetch(`/api/playlists/channel/${channelUuid}`);
    const playlistsResult = await playlistsResponse.json();
    const playlists = (playlistsResult.success && playlistsResult.data) ? playlistsResult.data : [];
    
    // Build dropdown HTML
    let html = '';
    
    // Playlists section
    if (playlists.length > 0) {
      html += '<div class="px-2 py-1 text-xs text-gray-400 font-medium">PLAYLISTS</div>';
      playlists.forEach(playlist => {
        html += `
          <div
            class="video-dropdown-item flex items-center gap-3 p-2 rounded cursor-pointer hover:bg-gray-700 transition-colors"
            data-content-id="${playlist.playlist_uuid}"
            data-filename=""
            data-title="${playlist.playlist_name}"
            data-duration="0"
            data-resolution="Playlist"
            data-type="playlist"
            data-video-count="${playlist.video_count || 0}"
            onclick="selectVideoFromDropdownItem(this)"
          >
            <div class="w-24 h-14 bg-gradient-to-br from-purple-600 to-blue-600 rounded overflow-hidden flex-shrink-0 flex items-center justify-center">
              <i class="ti ti-playlist text-white text-2xl"></i>
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-white font-medium truncate flex items-center gap-2">
                <i class="ti ti-playlist text-purple-400 text-sm"></i>
                ${playlist.playlist_name}
              </p>
              <p class="text-xs text-gray-400">Playlist • ${playlist.video_count || 0} videos</p>
            </div>
          </div>
        `;
      });
      html += '<div class="my-2 border-t border-gray-700"></div>';
    }
    
    // Videos section
    html += '<div class="px-2 py-1 text-xs text-gray-400 font-medium">VIDEOS</div>';
    if (allVideos.length > 0) {
      allVideos.forEach(video => {
        const duration = video.duration_seconds || 0;
        const mins = Math.floor(duration / 60);
        const secs = Math.floor(duration % 60);
        const durationStr = `${mins}:${String(secs).padStart(2, '0')}`;
        
        // Fix thumbnail path - check if path already includes directory
        let thumbnailSrc = '';
        if (video.thumbnail_path) {
          const path = video.thumbnail_path;
          // If already starts with full path, use as-is
          if (path.startsWith('/storage/') || path.startsWith('/uploads/') || path.startsWith('http')) {
            thumbnailSrc = path;
          }
          // If starts with thumbnails/ or media/, prepend /storage/
          else if (path.startsWith('thumbnails/') || path.startsWith('media/')) {
            thumbnailSrc = `/storage/${path}`;
          }
          // Otherwise assume it's just filename, prepend full path
          else {
            thumbnailSrc = `/storage/thumbnails/${path}`;
          }
        }
        
        html += `
          <div
            class="video-dropdown-item flex items-center gap-3 p-2 rounded cursor-pointer hover:bg-gray-700 transition-colors"
            data-content-id="${video.video_uuid}"
            data-filename="${video.filename || ''}"
            data-title="${video.video_title}"
            data-duration="${video.duration_seconds || 0}"
            data-resolution="${video.resolution || 'N/A'}"
            data-type="video"
            onclick="selectVideoFromDropdownItem(this)"
          >
            <div class="w-24 h-14 bg-gray-700 rounded overflow-hidden flex-shrink-0">
              ${thumbnailSrc ? 
                `<img src="${thumbnailSrc}" alt="${video.video_title}" class="w-full h-full object-cover" onerror="this.parentElement.innerHTML='<div class=\\'w-full h-full flex items-center justify-center\\'><i class=\\'ti ti-video text-gray-500\\'></i></div>'" />` :
                `<div class="w-full h-full flex items-center justify-center"><i class="ti ti-video text-gray-500"></i></div>`
              }
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-white font-medium truncate">${video.video_title}</p>
              <p class="text-xs text-gray-400">${video.resolution || '1248×704'} • ${durationStr}</p>
            </div>
          </div>
        `;
      });
    } else {
      html += '<div class="p-4 text-center text-gray-400"><i class="ti ti-inbox text-3xl mb-2"></i><p>No videos in this channel</p></div>';
    }
    
    videoDropdownList.innerHTML = html;
  } catch (error) {
    console.error('Error loading channel videos:', error);
    const videoDropdownList = document.querySelector('#videoDropdownList .p-2');
    if (videoDropdownList) {
      videoDropdownList.innerHTML = '<div class="p-4 text-center text-red-400"><i class="ti ti-alert-circle text-3xl mb-2"></i><p>Error loading videos</p></div>';
    }
  }
}

// Modal functions
function openNewStreamModal() {
  // Load user's channels first
  loadUserChannels();
  
  // After channels are loaded, load templates for the first/selected channel
  setTimeout(() => {
    const channelSelect = document.getElementById('channelSelect');
    if (channelSelect && channelSelect.value) {
      loadChannelTemplates(channelSelect.value);
    }
    
    // Ensure template select onchange works
    const templateSelect = document.getElementById('templateSelect');
    if (templateSelect) {
      templateSelect.addEventListener('change', function() {
        onTemplateChange(this.value);
      });
    }
  }, 100);
  
  // Disable video dropdown until channel is selected
  const videoDropdownButton = document.getElementById('videoDropdownButton');
  if (videoDropdownButton) {
    videoDropdownButton.disabled = true;
    videoDropdownButton.classList.add('opacity-50', 'cursor-not-allowed');
  }

  // Disable stream key dropdown until channel is selected
  const streamKeyDropdownButton = document.getElementById('streamKeyDropdownButton');
  if (streamKeyDropdownButton) {
    streamKeyDropdownButton.disabled = true;
    streamKeyDropdownButton.classList.add('opacity-50', 'cursor-not-allowed');
  }

  // Disable template dropdown until channel is selected
  const templateSelect = document.getElementById('templateSelect');
  if (templateSelect) {
    templateSelect.disabled = true;
    templateSelect.innerHTML = '<option value="">Choose a template...</option>';
  }

  // Reset stream key selection and hide manual input
  const selectedStreamKeyText = document.getElementById('selectedStreamKeyText');
  const selectedStreamKey = document.getElementById('selectedStreamKey');

  if (selectedStreamKeyText) {
    selectedStreamKeyText.textContent = 'Choose or paste stream key...';
    selectedStreamKeyText.classList.remove('text-white');
    selectedStreamKeyText.classList.add('text-gray-400');
  }
  if (selectedStreamKey) selectedStreamKey.value = '';
  hideManualStreamKeyInput();
  
  // Set minimum datetime for scheduled time to current time
  const scheduledTimeInput = document.getElementById('scheduledTimeInput');
  if (scheduledTimeInput) {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset()); // Convert to local time
    scheduledTimeInput.min = now.toISOString().slice(0, 16);
  }
  
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

  // Pastikan Advanced Settings input enable/disable sesuai state collapse
  const advDetails = document.getElementById('advancedSettingsDetails');
  if (advDetails) {
    toggleAdvancedSettings(advDetails);
    // Tambahkan event listener jika belum ada
    if (!advDetails.hasListener) {
      advDetails.addEventListener('toggle', function() {
        toggleAdvancedSettings(advDetails);
      });
      advDetails.hasListener = true;
    }
  }
}

// Toggle Advanced Settings tracking
function toggleAdvancedSettings(detailsElement) {
  const useAdvancedSettingsInput = document.getElementById('useAdvancedSettings');
  const isOpen = detailsElement.open;
  
  if (useAdvancedSettingsInput) {
    useAdvancedSettingsInput.value = isOpen ? 'true' : 'false';
  }
  
  // Enable/disable Advanced Settings fields based on collapse state
  const advFields = [
    'advSettingBitrate',
    'advSettingFramerate',
    'advSettingResolution',
    'advSettingLandscape',
    'advSettingPortrait'
  ];
  
  advFields.forEach(fieldId => {
    const field = document.getElementById(fieldId);
    if (field) {
      field.disabled = !isOpen;
    }
  });
  
  console.log('[DEBUG] Advanced Settings toggled:', {
    isOpen: isOpen,
    fieldsDisabled: !isOpen
  });
}



// Update broadcast name character counter
function updateBroadcastNameCounter(input) {
  const counter = document.getElementById('broadcastNameCounter');
  if (counter) {
    const length = input.value.length;
    counter.textContent = `${length}/100`;
    
    // Change color when nearing limit (80+ characters)
    if (length >= 80) {
      counter.classList.remove('text-gray-400');
      counter.classList.add('text-amber-400');
    } else {
      counter.classList.remove('text-amber-400');
      counter.classList.add('text-gray-400');
    }
  }
}

// Update edit stream name character counter
function updateEditStreamNameCounter(input) {
  const counter = document.getElementById('editStreamNameCounter');
  if (counter) {
    const length = input.value.length;
    counter.textContent = `${length}/100`;
    
    // Change color when nearing limit (80+ characters)
    if (length >= 80) {
      counter.classList.remove('text-gray-400');
      counter.classList.add('text-amber-400');
    } else {
      counter.classList.remove('text-amber-400');
      counter.classList.add('text-gray-400');
    }
  }
}

function closeNewStreamModal() {
  document.getElementById('newStreamModal').classList.add('hidden');
  document.getElementById('newStreamForm').reset();
  
  // Reset broadcast name counter
  const broadcastNameCounter = document.getElementById('broadcastNameCounter');
  if (broadcastNameCounter) {
    broadcastNameCounter.textContent = '0/100';
    broadcastNameCounter.classList.remove('text-amber-400');
    broadcastNameCounter.classList.add('text-gray-400');
  }
  
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
  
  // Trim long titles (max 30 characters + ...)
  const maxLength = 30;
  const trimmedTitle = title.length > maxLength ? title.substring(0, maxLength) + '...' : title;
  
  // Update button text
  document.getElementById('selectedVideoText').textContent = trimmedTitle;
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
          <p class="text-lg font-medium text-white">${trimmedTitle}</p>
          <p class="text-sm text-gray-400">Playlist • ${videoCount} videos</p>
        </div>
      `;
    }
    
    // Update video info for playlist
    if (videoInfo) {
      document.getElementById('streamVideoTitle').textContent = trimmedTitle;
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
      
      // Build video source path - handle different path formats
      let videoSrc = '';
      if (filename.startsWith('/')) {
        // Already has full path
        videoSrc = filename;
      } else if (filename.startsWith('http')) {
        // External URL
        videoSrc = filename;
      } else if (filename.includes('uploads/') || filename.includes('media/')) {
        // Already has subdirectory
        videoSrc = `/storage/${filename}`;
      } else {
        // Plain filename - default to uploads
        videoSrc = `/storage/uploads/${filename}`;
      }
      
      console.log('Loading video from:', videoSrc);
      source.src = videoSrc;
      
      // Add error handler
      video.onerror = function() {
        console.error('Video failed to load:', videoSrc);
        if (noVideoDiv) {
          noVideoDiv.classList.remove('hidden');
          noVideoDiv.innerHTML = `
            <i class="ti ti-alert-circle text-6xl mb-3 text-red-400"></i>
            <p class="text-sm text-red-400">Failed to load video</p>
            <p class="text-xs text-gray-500 mt-2">${videoSrc}</p>
          `;
        }
        video.classList.add('hidden');
      };
      
      video.load();
      
      // Show video
      video.classList.remove('hidden');
    } else {
      // No filename - show error
      console.warn('Video preview missing filename:', { video, source, filename });
      if (noVideoDiv) {
        noVideoDiv.classList.remove('hidden');
        noVideoDiv.innerHTML = `
          <i class="ti ti-alert-circle text-6xl mb-3 text-red-400"></i>
          <p class="text-sm text-red-400">Video file not found</p>
        `;
      }
      if (video) video.classList.add('hidden');
    }
    
    // Update video info
    if (videoInfo) {
      document.getElementById('streamVideoTitle').textContent = trimmedTitle;
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
  console.log('Form submission started');
  
  // Get submit button and set loading state
  const submitBtn = document.getElementById('createStreamBtn');
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<i class="ti ti-loader ti-spin"></i><span>Creating...</span>';
  
  // Check if video is selected
  const selectedContentId = document.getElementById('selectedContentId');
  if (!selectedContentId || !selectedContentId.value || selectedContentId.value.trim() === '') {
    showNotification('Please select a video or playlist before creating the stream', 'error');
    e.preventDefault();
    return;
  }
  
  e.preventDefault();
  
  const formData = new FormData(e.target);
  const data = Object.fromEntries(formData.entries());
  
  console.log('Form data before parsing:', data);
  
  // Parse contentId to extract type and UUID
  if (data.contentId && data.contentId.trim() !== '') {
    const firstDashIndex = data.contentId.indexOf('-');
    if (firstDashIndex === -1) {
      console.error('Invalid contentId format:', data.contentId);
      showNotification('Invalid content selection', 'error');
      // Reset button state
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i class="ti ti-broadcast"></i><span>Create Stream</span>';
      return;
    }
    const type = data.contentId.substring(0, firstDashIndex);
    const uuid = data.contentId.substring(firstDashIndex + 1);
    console.log('Parsed contentId:', { contentId: data.contentId, type, uuid });
    if (type === 'playlist') {
      data.broadcastType = 'playlist';
      data.videoUuid = uuid; // For playlist, videoUuid contains playlist UUID
    } else if (type === 'video') {
      data.broadcastType = 'single';
      data.videoUuid = uuid;
    } else {
      console.error('Unknown content type:', type);
      showNotification('Invalid content type selected', 'error');
      // Reset button state
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i class="ti ti-broadcast"></i><span>Create Stream</span>';
      return;
    }
    // Remove the original contentId as API doesn't expect it
    delete data.contentId;
  } else {
    // No content selected
    showNotification('Please select a video or playlist', 'error');
    // Reset button state
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<i class="ti ti-broadcast"></i><span>Create Stream</span>';
    return;
  }
  
  // Handle checkbox - checkbox only sends value if checked
  // If unchecked, it won't be in formData at all
  if (!data.loopVideo) {
    data.loopVideo = 'off'; // or false, depending on backend expectation
  }
  
  // Ensure broadcastName is sent even if empty
  if (!data.broadcastName || data.broadcastName.trim() === '') {
    data.broadcastName = ''; // Backend will use default
  }
  
  // Check if Advanced Settings is enabled
  const useAdvancedSettings = data.useAdvancedSettings === 'true';

  // Only build advanced_settings object if user explicitly enabled Advanced Settings
  if (useAdvancedSettings) {
    // Build snake_case advanced_settings object expected by backend
    data.advanced_settings = {
      bitrate: data.bitrate || '2500k',
      framerate: data.framerate || '60',
      resolution: data.resolution || '480p',
      orientation: data.orientation || 'landscape'
    };

    // Also include camelCase version for API handlers that expect advancedSettings
    data.advancedSettings = data.advanced_settings;
  } else {
    // If user didn't enable advanced settings, don't send any advanced_settings
    data.advanced_settings = null;
    data.advancedSettings = null;
  }

  // Keep the tracking field for backend to know if user explicitly enabled Advanced Settings
  data.useAdvancedSettingsEnabled = useAdvancedSettings;

  // Collect advanced streaming features
  data.enableAutostart = data.autostart === 'on' ? 'true' : 'false';
  data.enableAutoend = data.autoend === 'on' ? 'true' : 'false';
  data.enableDvr = data.enabledvr === 'on' ? 'true' : 'false';
  data.enable360 = data.enable360 === 'on' ? 'true' : 'false';
  data.enablePrivateReplay = data.enablePrivateReplay === 'on' ? 'true' : 'false';

  // Collect repeat stream settings
  if (data.repeatStream === 'on' && data.repeatFrequency) {
    data.repeatStream = data.repeatFrequency; // 'daily', 'weekly', or 'monthly'
  } else {
    data.repeatStream = null; // No repeat
  }

  // Remove individual fields so backend reads only advanced_settings
  delete data.bitrate;
  delete data.framerate;
  delete data.resolution;
  delete data.orientation;
  delete data.autostart;
  delete data.autoend;
  delete data.enabledvr;
  delete data.enable360;
  delete data.repeatFrequency;

  // Debug: Check what data is being sent
  console.log('[DEBUG] Form submission:', {
    useAdvancedSettings: useAdvancedSettings,
    dataToSend: data,
    hasAdvancedFields: data.advanced_settings !== undefined
  });
  
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
  } finally {
    // Reset button state
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<i class="ti ti-broadcast"></i><span>Create Stream</span>';
  }
});

// Start broadcast (from offline to active)
async function startBroadcast(broadcastId) {
  if (typeof Swal !== 'undefined') {
    Swal.fire({
      toast: true,
      position: "top",
      title: "Start Broadcast?",
      text: "Are you sure you want to start this broadcast?",
      icon: "question",
      showCancelButton: true,
      confirmButtonColor: "#3085d6",
      cancelButtonColor: "#d33",
      confirmButtonText: "Yes, start it!",
      cancelButtonText: "Cancel",
    }).then((result) => {
      if (result.isConfirmed) {
        startBroadcastProcess(broadcastId);
      }
    });
  } else {
    if (!confirm('Start this broadcast?')) return;
    startBroadcastProcess(broadcastId);
  }
}

async function startBroadcastProcess(broadcastId) {
  try {
    const response = await fetch(`/api/broadcast/start/${broadcastId}`, {
      method: 'POST'
    });
    
    const result = await response.json();
    
    if (result.success) {
      if (typeof Swal !== 'undefined') {
        Swal.fire({
          toast: true,
          position: 'top',
          icon: 'success',
          title: 'Broadcast started!',
          showConfirmButton: false,
          timer: 2000
        }).then(() => {
          setTimeout(() => location.reload(), 500);
        });
      } else {
        showNotification('Broadcast started!', 'success');
        setTimeout(() => location.reload(), 1000);
      }
    } else {
      // Check if this is a Facebook connection error
      const errorMsg = result.message || 'Failed to start broadcast';
      if (typeof Swal !== 'undefined') {
        Swal.fire({
          toast: true,
          position: 'top',
          icon: 'error',
          title: errorMsg.includes('Facebook connection error') ? '⚠️ Facebook connection busy. Please wait 10-15 seconds and try again.' : errorMsg,
          showConfirmButton: false,
          timer: 3000
        });
      } else {
        if (errorMsg.includes('Facebook connection error')) {
          showNotification('⚠️ Facebook connection busy. Please wait 10-15 seconds and try again.', 'error');
        } else {
          showNotification(errorMsg, 'error');
        }
      }
    }
  } catch (error) {
    console.error('Error:', error);
    if (typeof Swal !== 'undefined') {
      Swal.fire({
        toast: true,
        position: 'top',
        icon: 'error',
        title: 'Failed to start broadcast',
        showConfirmButton: false,
        timer: 3000
      });
    } else {
      showNotification('Failed to start broadcast', 'error');
    }
  }
}

// Stop broadcast
async function stopBroadcast(broadcastId) {
  if (typeof Swal !== 'undefined') {
    Swal.fire({
      toast: true,
      position: "top",
      title: "Stop Broadcast?",
      text: "Are you sure you want to stop this broadcast?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "Yes, stop it!",
      cancelButtonText: "Cancel",
    }).then((result) => {
      if (result.isConfirmed) {
        stopBroadcastProcess(broadcastId);
      }
    });
  } else {
    if (!confirm('Stop this broadcast?')) return;
    stopBroadcastProcess(broadcastId);
  }
}

async function stopBroadcastProcess(broadcastId) {
  try {
    const response = await fetch(`/api/broadcast/stop/${broadcastId}`, {
      method: 'POST'
    });
    
    const result = await response.json();
    
    if (result.success) {
      if (typeof Swal !== 'undefined') {
        Swal.fire({
          toast: true,
          position: 'top',
          icon: 'success',
          title: 'Broadcast stopped. Wait 10-15 seconds before restarting (especially for Facebook).',
          showConfirmButton: false,
          timer: 3000
        }).then(() => {
          setTimeout(() => location.reload(), 500);
        });
      } else {
        showNotification('Broadcast stopped. Wait 10-15 seconds before restarting (especially for Facebook).', 'success');
        setTimeout(() => location.reload(), 2000);
      }
    } else {
      if (typeof Swal !== 'undefined') {
        Swal.fire({
          toast: true,
          position: 'top',
          icon: 'error',
          title: result.message || 'Failed to stop broadcast',
          showConfirmButton: false,
          timer: 3000
        });
      } else {
        showNotification(result.message || 'Failed to stop broadcast', 'error');
      }
    }
  } catch (error) {
    console.error('Error:', error);
    if (typeof Swal !== 'undefined') {
      Swal.fire({
        toast: true,
        position: 'top',
        icon: 'error',
        title: 'Failed to stop broadcast',
        showConfirmButton: false,
        timer: 3000
      });
    } else {
      showNotification('Failed to stop broadcast', 'error');
    }
  }
}

// Delete broadcast
async function deleteBroadcast(broadcastId) {
  if (typeof Swal !== 'undefined') {
    Swal.fire({
      toast: true,
      position: "top",
      title: "Delete Broadcast?",
      text: "Delete this broadcast? This action cannot be undone.",
      icon: "error",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "Yes, delete it!",
      cancelButtonText: "Cancel",
    }).then((result) => {
      if (result.isConfirmed) {
        deleteBroadcastProcess(broadcastId);
      }
    });
  } else {
    if (!confirm('Delete this broadcast? This action cannot be undone.')) return;
    deleteBroadcastProcess(broadcastId);
  }
}

async function deleteBroadcastProcess(broadcastId) {
  try {
    const response = await fetch(`/api/broadcast/${broadcastId}`, {
      method: 'DELETE'
    });
    
    const result = await response.json();
    
    if (result.success) {
      if (typeof Swal !== 'undefined') {
        Swal.fire({
          toast: true,
          position: 'top',
          icon: 'success',
          title: 'Broadcast deleted',
          showConfirmButton: false,
          timer: 1500
        }).then(() => {
          setTimeout(() => location.reload(), 500);
        });
      } else {
        showNotification('Broadcast deleted', 'success');
        setTimeout(() => location.reload(), 500);
      }
    } else {
      if (typeof Swal !== 'undefined') {
        Swal.fire({
          toast: true,
          position: 'top',
          icon: 'error',
          title: result.message || 'Failed to delete broadcast',
          showConfirmButton: false,
          timer: 3000
        });
      } else {
        showNotification(result.message || 'Failed to delete broadcast', 'error');
      }
    }
  } catch (error) {
    console.error('Error:', error);
    if (typeof Swal !== 'undefined') {
      Swal.fire({
        toast: true,
        position: 'top',
        icon: 'error',
        title: 'Failed to delete broadcast',
        showConfirmButton: false,
        timer: 3000
      });
    } else {
      showNotification('Failed to delete broadcast', 'error');
    }
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
    const response = await fetch('/api/system/stats', {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      credentials: 'include' // Ensure cookies are sent
    });
    
    // Check if response is OK
    if (!response.ok) {
      // If 401 (Unauthorized), session expired - redirect to login
      if (response.status === 401) {
        console.warn('Session expired or unauthorized');
        // Redirect to login after a brief delay
        setTimeout(() => {
          window.location.href = '/login';
        }, 500);
        return;
      }
      throw new Error(`HTTP Error: ${response.status}`);
    }
    
    // Verify response is JSON before parsing
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      console.error('Invalid response type:', contentType);
      // If not JSON, might be HTML error page - redirect to login
      setTimeout(() => {
        window.location.href = '/login';
      }, 500);
      return;
    }
    
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
      
      // Update Active Streams Count - use backend data instead of DOM counting
      const activeCount = stats.activeBroadcasts || 0;
      document.getElementById("activeBroadcastCount").textContent = activeCount;
      
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
  currentSearchTerm = e.target.value.toLowerCase();
  
  console.log('Search input:', {
    searchTerm: currentSearchTerm,
    allBroadcastsLength: allBroadcasts.length
  });
  
  // Filter broadcasts based on search term
  if (currentSearchTerm === '') {
    filteredBroadcasts = [...allBroadcasts];
  } else {
    filteredBroadcasts = allBroadcasts.filter(broadcast => 
      broadcast.text.includes(currentSearchTerm)
    );
  }
  
  console.log('Filtered result:', {
    filteredLength: filteredBroadcasts.length,
    searchTerm: currentSearchTerm
  });
  
  // Reset pagination to page 1
  currentTablePage = 1;
  currentCardPage = 1;
  
  // Update pagination and display
  updateTablePagination();
  updateCardPagination();
  filterTableRows();
  filterCardItems();
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
      document.getElementById('editBroadcastId').value = broadcast.broadcast_uuid;
      document.getElementById('editBroadcastIdDisplay').textContent = broadcast.broadcast_id;
      const editStreamNameInput = document.getElementById('editStreamName');
      editStreamNameInput.value = broadcast.broadcast_name || '';
      // Update character counter after populating the field
      updateEditStreamNameCounter(editStreamNameInput);
      document.getElementById('editDestinationUrl').value = broadcast.destination_url || '';
      document.getElementById('editStreamKey').value = broadcast.stream_key || '';
      
      // Detect and highlight current platform
      const destinationUrl = broadcast.destination_url || '';
      detectEditPlatform(destinationUrl);
      
      // Populate preview info
      document.getElementById('editBroadcastIdDisplay').textContent = broadcast.broadcast_id;
      
      // Content type
      const contentType = broadcast.broadcast_type === 'playlist' ? 'Playlist' : 'Single Video';
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
        const hasSchedule = broadcast.scheduled_time;
        const loopVideo = broadcast.loopvideo === 'on' || broadcast.loopvideo === true || broadcast.loopvideo === 1;
        const hasDurationTimeout = broadcast.duration_timeout !== null && broadcast.duration_timeout !== undefined;
        const hasRepeatStream = broadcast.repeat_stream && broadcast.repeat_stream !== 'null' && broadcast.repeat_stream !== null;
        
        if (hasSchedule || loopVideo || hasDurationTimeout || hasRepeatStream) {
          scheduleSettingsPreview.style.display = 'block';
          document.getElementById('editPreviewLoopVideo').textContent = loopVideo ? 'Yes' : 'No';
          document.getElementById('editPreviewScheduleTime').textContent = broadcast.scheduled_time ? new Date(broadcast.scheduled_time).toLocaleString() : 'Not scheduled';
          // Display duration_timeout in schedule preview (gracefully handle multiple possible keys/formats)
          // Prefer defensive checks instead of nullish coalescing to avoid syntax errors on older runtimes
          const durationTimeoutRaw = (typeof broadcast.duration_timeout !== 'undefined' && broadcast.duration_timeout !== null && broadcast.duration_timeout !== '')
            ? broadcast.duration_timeout
            : (typeof broadcast.durationTimeout !== 'undefined' && broadcast.durationTimeout !== null && broadcast.durationTimeout !== '')
              ? broadcast.durationTimeout
              : (typeof broadcast.duration_timeout_seconds !== 'undefined' && broadcast.duration_timeout_seconds !== null && broadcast.duration_timeout_seconds !== '')
                ? broadcast.duration_timeout_seconds
                : null;
          let durationTimeoutText = 'Not set';

          if (durationTimeoutRaw !== null && durationTimeoutRaw !== '' && !Number.isNaN(Number(durationTimeoutRaw))) {
            const totalSeconds = Math.max(0, Number(durationTimeoutRaw));
            const hours = Math.floor(totalSeconds / 3600);
            const minutes = Math.floor((totalSeconds % 3600) / 60);
            const seconds = totalSeconds % 60;

            if (hours > 0) {
              durationTimeoutText = hours + 'h ' + minutes + 'm ' + seconds + 's';
            } else if (minutes > 0) {
              durationTimeoutText = minutes + 'm ' + seconds + 's';
            } else {
              durationTimeoutText = seconds + 's';
            }
          }

          // Update the DOM element if present
          const durationElem = document.getElementById('editPreviewDurationTimeout');
          if (durationElem) {
            durationElem.textContent = durationTimeoutText;
          }

          // Update repeat stream info
          const repeatStreamElem = document.getElementById('editPreviewRepeatStream');
          if (repeatStreamElem) {
            if (broadcast.repeat_stream && broadcast.repeat_stream !== 'null' && broadcast.repeat_stream !== null) {
              const repeatText = broadcast.repeat_stream.charAt(0).toUpperCase() + broadcast.repeat_stream.slice(1);
              repeatStreamElem.textContent = repeatText;
            } else {
              repeatStreamElem.textContent = 'No repeat';
            }
          }
        } else {
          scheduleSettingsPreview.style.display = 'none';
        }
      }
      
      // Show/hide Advanced Settings preview
      const advancedSettingsPreview = document.getElementById('editAdvancedSettingsPreview');
      if (advancedSettingsPreview) {
        // Normalize advanced_settings which may be stored as JSON string in DB
        let advancedSettingsObj = null;
        if (broadcast.advanced_settings) {
          if (typeof broadcast.advanced_settings === 'string') {
            try {
              advancedSettingsObj = JSON.parse(broadcast.advanced_settings);
            } catch (err) {
              console.warn('Failed to parse advanced_settings JSON:', err);
              advancedSettingsObj = null;
            }
          } else if (typeof broadcast.advanced_settings === 'object') {
            advancedSettingsObj = broadcast.advanced_settings;
          }
        }

        // Always show Advanced Settings preview, even if no advanced settings are configured
        advancedSettingsPreview.style.display = 'block';
        document.getElementById('editPreviewBitrate').textContent = advancedSettingsObj?.bitrate || 'Default (2500k)';
        document.getElementById('editPreviewFrameRate').textContent = advancedSettingsObj?.framerate ? `${advancedSettingsObj.framerate} FPS` : 'Default (30 FPS)';
        document.getElementById('editPreviewResolution').textContent = advancedSettingsObj?.resolution || 'Auto-detect';
        document.getElementById('editPreviewOrientation').textContent = advancedSettingsObj?.orientation ? advancedSettingsObj.orientation.charAt(0).toUpperCase() + advancedSettingsObj.orientation.slice(1) : 'Landscape';
      }

      // Show/hide Additional Settings preview
      const additionalSettingsPreview = document.getElementById('editAdditionalSettingsPreview');
      if (additionalSettingsPreview) {
        // Check if any enable_* fields are active
        const hasAdditionalSettings =
          (broadcast.enable_autostart === 'true' || broadcast.enable_autostart === true || broadcast.enable_autostart === 1) ||
          (broadcast.enable_autoend === 'true' || broadcast.enable_autoend === true || broadcast.enable_autoend === 1) ||
          (broadcast.enable_dvr === 'true' || broadcast.enable_dvr === true || broadcast.enable_dvr === 1) ||
          (broadcast.enable_360 === 'true' || broadcast.enable_360 === true || broadcast.enable_360 === 1) ||
          (broadcast.enable_private_replay === 'true' || broadcast.enable_private_replay === true || broadcast.enable_private_replay === 1);

        if (hasAdditionalSettings) {
          additionalSettingsPreview.style.display = 'block';
          // Populate additional settings preview
          document.getElementById('editPreviewAutostart').textContent = (broadcast.enable_autostart === 'true' || broadcast.enable_autostart === true || broadcast.enable_autostart === 1) ? 'Enabled' : 'Disabled';
          document.getElementById('editPreviewAutoend').textContent = (broadcast.enable_autoend === 'true' || broadcast.enable_autoend === true || broadcast.enable_autoend === 1) ? 'Enabled' : 'Disabled';
          document.getElementById('editPreviewDvr').textContent = (broadcast.enable_dvr === 'true' || broadcast.enable_dvr === true || broadcast.enable_dvr === 1) ? 'Enabled' : 'Disabled';
          document.getElementById('editPreview360').textContent = (broadcast.enable_360 === 'true' || broadcast.enable_360 === true || broadcast.enable_360 === 1) ? 'Enabled' : 'Disabled';
          document.getElementById('editPreviewPrivateReplay').textContent = (broadcast.enable_private_replay === 'true' || broadcast.enable_private_replay === true || broadcast.enable_private_replay === 1) ? 'Enabled' : 'Disabled';
        } else {
          additionalSettingsPreview.style.display = 'none';
        }
      }
      
      // Video info and preview
      const videoInfoElement = document.getElementById('editVideoInfo');
      const video = document.getElementById('editPreviewVideo');
      const source = document.getElementById('editPreviewSource');
      const noVideoDiv = document.getElementById('editNoVideoSelected');
      
      if (broadcast.broadcast_type === 'playlist') {
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
        if (broadcast.broadcast_title) {
          videoInfoElement.textContent = broadcast.broadcast_title;
        } else {
          videoInfoElement.textContent = 'Single Video';
        }
        
        // Load video preview if broadcast.video_uuid exists
        if (broadcast.video_uuid) {
          fetch(`/api/content/${broadcast.video_uuid}`)
            .then(res => res.json())
            .then(data => {
              if (data.success && data.content) {
                const filename = data.content.filepath || data.content.filename;
                
                // Build video source path - handle different path formats
                let videoSrc = '';
                if (filename.startsWith('/')) {
                  // Already has full path
                  videoSrc = filename;
                } else if (filename.startsWith('http')) {
                  // External URL
                  videoSrc = filename;
                } else if (filename.includes('uploads/') || filename.includes('media/')) {
                  // Already has subdirectory
                  videoSrc = `/storage/${filename}`;
                } else {
                  // Plain filename - default to uploads
                  videoSrc = `/storage/uploads/${filename}`;
                }
                
                console.log('Loading video from:', videoSrc);
                source.src = videoSrc;
                source.type = 'video/mp4';
                video.load();
                video.classList.remove('hidden');
                noVideoDiv.classList.add('hidden');
              }
            })
            .catch(err => {
              console.error('Error loading video preview:', err);
              // Show error state
              if (noVideoDiv) {
                noVideoDiv.classList.remove('hidden');
                noVideoDiv.innerHTML = `
                  <i class="ti ti-alert-circle text-6xl mb-3 text-red-400"></i>
                  <p class="text-sm text-red-400">Failed to load video</p>
                  <p class="text-xs text-gray-500 mt-2">Could not load video preview</p>
                `;
              }
              if (video) video.classList.add('hidden');
            });
        } else {
          // No video_uuid, show no video message
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
  
  // Reset edit stream name counter
  const editStreamNameCounter = document.getElementById('editStreamNameCounter');
  if (editStreamNameCounter) {
    editStreamNameCounter.textContent = '0/100';
    editStreamNameCounter.classList.remove('text-amber-400');
    editStreamNameCounter.classList.add('text-gray-400');
  }
  
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
  
  // Get submit button and set loading state
  const submitBtn = document.getElementById('editStreamBtn');
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<i class="ti ti-loader ti-spin"></i><span>Saving...</span>';
  
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
  } finally {
    // Reset button state
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<i class="ti ti-device-floppy"></i><span>Save Changes</span>';
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

// Load stream keys by channel
async function loadChannelStreamKeys(channelUuid) {
  const streamKeyDropdownButton = document.getElementById('streamKeyDropdownButton');
  const streamKeyDropdownList = document.querySelector('#streamKeyDropdownList .p-2');
  const selectedStreamKeyText = document.getElementById('selectedStreamKeyText');
  const selectedStreamKey = document.getElementById('selectedStreamKey');

  // Hide manual input when loading new channel
  hideManualStreamKeyInput();

  // Reset selection
  if (selectedStreamKeyText) selectedStreamKeyText.textContent = 'Choose or paste stream key...';
  if (selectedStreamKeyText) selectedStreamKeyText.classList.remove('text-white');
  if (selectedStreamKeyText) selectedStreamKeyText.classList.add('text-gray-400');
  if (selectedStreamKey) selectedStreamKey.value = '';

  if (!channelUuid) {
    // Clear stream key dropdown and disable button
    if (streamKeyDropdownList) {
      streamKeyDropdownList.innerHTML = '<div class="p-4 text-center text-gray-400"><i class="ti ti-inbox text-3xl mb-2"></i><p>Select a channel first</p></div>';
    }
    // Disable dropdown button
    if (streamKeyDropdownButton) {
      streamKeyDropdownButton.disabled = true;
      streamKeyDropdownButton.classList.add('opacity-50', 'cursor-not-allowed');
    }
    return;
  }

  // Enable dropdown button
  if (streamKeyDropdownButton) {
    streamKeyDropdownButton.disabled = false;
    streamKeyDropdownButton.classList.remove('opacity-50', 'cursor-not-allowed');
  }

  try {
    // Show loading state
    if (streamKeyDropdownList) {
      streamKeyDropdownList.innerHTML = '<div class="p-4 text-center text-gray-400"><i class="ti ti-loader ti-spin text-3xl mb-2"></i><p>Loading stream keys...</p></div>';
    }

    // Fetch stream keys for this channel
    const response = await fetch(`/api/streamkeys/channel/${channelUuid}`);
    const result = await response.json();

    // Build dropdown HTML
    let html = '';

    // Manual entry option (always show)
    html += `
      <div
        class="stream-key-dropdown-item flex items-center gap-3 p-2 rounded cursor-pointer hover:bg-gray-700 transition-colors"
        data-stream-key=""
        data-name="Manual Entry"
        data-description="Paste your own stream key"
        onclick="selectStreamKeyFromDropdownItem(this)"
      >
        <div class="w-10 h-10 bg-gray-600 rounded overflow-hidden flex-shrink-0 flex items-center justify-center">
          <i class="ti ti-edit text-gray-300"></i>
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-white font-medium">Manual Entry</p>
          <p class="text-xs text-gray-400">Paste your own stream key</p>
        </div>
      </div>
    `;

    // Show stream keys section only if there are stream keys in database
    if (result.success && result.data && result.data.length > 0) {
      // Stream keys section
      html += '<div class="px-2 py-1 text-xs text-gray-400 font-medium border-t border-gray-700 mt-2 pt-2">STREAM KEYS</div>';
      result.data.forEach(streamKey => {
        const keyMasked = streamKey.stream_key ? '***' + streamKey.stream_key.slice(-4) : 'N/A';
        const platformIcon = streamKey.channel_platform === 'youtube' ? 'ti-brand-youtube text-red-500' :
                            streamKey.channel_platform === 'twitch' ? 'ti-brand-twitch text-purple-500' :
                            streamKey.channel_platform === 'facebook' ? 'ti-brand-facebook text-blue-500' :
                            'ti-cast text-gray-400';

        html += `
          <div
            class="stream-key-dropdown-item flex items-center gap-3 p-2 rounded cursor-pointer hover:bg-gray-700 transition-colors"
            data-stream-key="${streamKey.stream_key || ''}"
            data-name="${streamKey.streamkey_name}"
            data-description="${streamKey.streamkey_description || ''}"
            onclick="selectStreamKeyFromDropdownItem(this)"
          >
            <div class="w-10 h-10 bg-gray-700 rounded overflow-hidden flex-shrink-0 flex items-center justify-center">
              <i class="ti ${platformIcon}"></i>
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-white font-medium truncate">${streamKey.streamkey_name}</p>
              <p class="text-xs text-gray-400">${keyMasked}</p>
            </div>
          </div>
        `;
      });
    }

    streamKeyDropdownList.innerHTML = html;
  } catch (error) {
    console.error('Error loading channel stream keys:', error);
    const streamKeyDropdownList = document.querySelector('#streamKeyDropdownList .p-2');
    if (streamKeyDropdownList) {
      streamKeyDropdownList.innerHTML = '<div class="p-4 text-center text-red-400"><i class="ti ti-alert-circle text-3xl mb-2"></i><p>Error loading stream keys</p></div>';
    }
  }
}

// Load templates by channel
async function loadChannelTemplates(channelUuid) {
  console.log('loadChannelTemplates called with channelUuid:', channelUuid);
  const templateSelect = document.getElementById('templateSelect');

  if (!channelUuid) {
    console.log('No channelUuid provided, clearing template dropdown');
    // Clear template dropdown
    if (templateSelect) {
      templateSelect.innerHTML = '<option value="">Choose a template...</option>';
      templateSelect.disabled = true;
    }
    return;
  }

  // Enable dropdown
  if (templateSelect) {
    templateSelect.disabled = false;
  }

  try {
    // Show loading state
    if (templateSelect) {
      templateSelect.innerHTML = '<option value="">Loading templates...</option>';
    }

    console.log('Fetching templates from:', `/api/channels/${channelUuid}/upload-templates`);
    // Fetch templates for this channel
    const response = await fetch(`/api/channels/${channelUuid}/upload-templates`);
    const result = await response.json();
    console.log('Templates API response:', result);

    if (!result.success || !result.data || result.data.length === 0) {
      console.log('No templates found');
      templateSelect.innerHTML = '<option value="">No templates available</option>';
      return;
    }

    // Build options
    let html = '<option value="">Choose a template...</option>';
    result.data.forEach(template => {
      console.log('Adding template option:', template.template_name, template.template_uuid);
      html += `<option value="${template.template_uuid}">${template.template_name}</option>`;
    });

    templateSelect.innerHTML = html;
    console.log('Templates loaded successfully');
  } catch (error) {
    console.error('Error loading channel templates:', error);
    if (templateSelect) {
      templateSelect.innerHTML = '<option value="">Error loading templates</option>';
    }
  }
}

// Handle template selection change
async function onTemplateChange(templateUuid) {
  console.log('onTemplateChange called with templateUuid:', templateUuid);
  const broadcastNameInput = document.getElementById('broadcastNameInput');
  const channelSelect = document.getElementById('channelSelect');

  if (!templateUuid || !channelSelect || !channelSelect.value) {
    console.log('Clearing broadcast name - no template or channel selected');
    // Clear broadcast name if no template selected or no channel selected
    if (broadcastNameInput) {
      broadcastNameInput.value = '';
    }
    return;
  }

  try {
    // Fetch template data using channel UUID
    const channelUuid = channelSelect.value;
    console.log('Fetching template data from:', `/api/channels/${channelUuid}/upload-templates/${templateUuid}`);
    const response = await fetch(`/api/channels/${channelUuid}/upload-templates/${templateUuid}`);
    const result = await response.json();
    console.log('Template API response:', result);

    if (result.success && result.data) {
      // Auto-fill broadcast name with template name
      if (broadcastNameInput && result.data.template_title) {
        console.log('Setting broadcast name to template_title:', result.data.template_title);
        broadcastNameInput.value = result.data.template_title;
        // Show success notification
        // showNotification(`Broadcast name set to: ${result.data.template_title}`, 'success');
      } else {
        console.log('No template_title found in data:', result.data);
        // showNotification('Template has no name configured', 'error');
      }
    } else {
      console.log('API call failed or no data returned');
      showNotification('Failed to load template data', 'error');
    }
  } catch (error) {
    console.error('Error loading template data:', error);
  }
}

// Select stream key from dropdown item
function selectStreamKeyFromDropdownItem(element) {
  const streamKey = element.getAttribute('data-stream-key');
  const name = element.getAttribute('data-name');
  const description = element.getAttribute('data-description');

  // Update hidden input
  document.getElementById('selectedStreamKey').value = streamKey;

  // Trim long names (max 25 characters + ...)
  const maxLength = 25;
  const trimmedName = name.length > maxLength ? name.substring(0, maxLength) + '...' : name;

  // Update button text
  const displayText = streamKey ? `${trimmedName} (${streamKey ? '***' + streamKey.slice(-4) : 'N/A'})` : 'Manual Entry - Paste your stream key';
  document.getElementById('selectedStreamKeyText').textContent = displayText;
  document.getElementById('selectedStreamKeyText').classList.remove('text-gray-400');
  document.getElementById('selectedStreamKeyText').classList.add('text-white');

  // Close dropdown
  document.getElementById('streamKeyDropdownList').classList.add('hidden');

  // Handle manual input visibility
  if (!streamKey) {
    // Manual entry selected - show input
    showManualStreamKeyInput();
  } else {
    // Stream key selected - hide manual input
    hideManualStreamKeyInput();
  }
}

// Toggle stream key dropdown
function toggleStreamKeyDropdown() {
  const dropdown = document.getElementById('streamKeyDropdownList');
  const isHidden = dropdown.classList.contains('hidden');

  // Close other dropdowns
  document.getElementById('videoDropdownList').classList.add('hidden');

  // Toggle this dropdown
  if (isHidden) {
    dropdown.classList.remove('hidden');
    // Focus on search input
    const searchInput = document.getElementById('streamKeySearchInput');
    if (searchInput) {
      setTimeout(() => searchInput.focus(), 100);
    }
  } else {
    dropdown.classList.add('hidden');
  }
}

// Show manual stream key input
function showManualStreamKeyInput() {
  const manualContainer = document.getElementById('manualStreamKeyContainer');
  const manualInput = document.getElementById('manualStreamKeyInput');

  if (manualContainer) {
    manualContainer.classList.remove('hidden');
    if (manualInput) {
      manualInput.focus();
    }
  }
}

// Hide manual stream key input
function hideManualStreamKeyInput() {
  const manualContainer = document.getElementById('manualStreamKeyContainer');
  const manualInput = document.getElementById('manualStreamKeyInput');

  if (manualContainer) {
    manualContainer.classList.add('hidden');
    if (manualInput) {
      manualInput.value = '';
    }
  }
}

// Update manual stream key value
function updateManualStreamKey(value) {
  document.getElementById('selectedStreamKey').value = value;
}

// Toggle manual stream key visibility
function toggleManualStreamKeyVisibility() {
  const input = document.getElementById('manualStreamKeyInput');
  const icon = document.getElementById('manualToggleKeyIcon');

  if (!input || !icon) return;

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

// Close dropdowns when clicking outside
document.addEventListener('click', (e) => {
  const videoDropdown = document.getElementById('videoDropdownList');
  const streamKeyDropdown = document.getElementById('streamKeyDropdownList');
  const videoButton = document.getElementById('videoDropdownButton');
  const streamKeyButton = document.getElementById('streamKeyDropdownButton');

  if (videoDropdown && !videoDropdown.contains(e.target) && !videoButton.contains(e.target)) {
    videoDropdown.classList.add('hidden');
  }

  if (streamKeyDropdown && !streamKeyDropdown.contains(e.target) && !streamKeyButton.contains(e.target)) {
    streamKeyDropdown.classList.add('hidden');
  }
});

console.log('Dashboard initialized');
