/**
 * Broadcast Content Selector
 * Handles loading and displaying content + playlists in New Broadcast Modal
 */

let allContentItems = [];

// Load content and playlists for broadcast selector
async function loadBroadcastContentSelector() {
  try {
    const response = await fetch('/api/broadcast/content-selector');
    const data = await response.json();
    
    if (data.success) {
      allContentItems = data.items;
      renderContentSelectorItems(allContentItems);
    } else {
      console.error('Failed to load content:', data.message);
    }
  } catch (error) {
    console.error('Error loading content selector:', error);
  }
}

// Render content items in dropdown
function renderContentSelectorItems(items) {
  const dropdownList = document.getElementById('videoDropdownList');
  if (!dropdownList) return;

  const listContainer = dropdownList.querySelector('.p-2') || dropdownList;
  listContainer.innerHTML = '';

  if (items.length === 0) {
    listContainer.innerHTML = `
      <div class="text-center py-8 text-gray-400">
        <i class="ti ti-inbox text-4xl mb-2"></i>
        <p>No content available</p>
      </div>
    `;
    return;
  }

  items.forEach(item => {
    const itemDiv = document.createElement('div');
    itemDiv.className = 'video-dropdown-item flex items-center gap-3 p-2 rounded cursor-pointer hover:bg-gray-700 transition-colors';
    itemDiv.setAttribute('data-content-id', item.id);
    itemDiv.setAttribute('data-title', item.name);
    itemDiv.setAttribute('data-type', item.type);
    itemDiv.onclick = () => selectContentItem(item);

    if (item.type === 'playlist') {
      // Playlist item
      itemDiv.innerHTML = `
        <div class="w-24 h-14 bg-gradient-to-br from-blue-600 to-purple-600 rounded overflow-hidden flex-shrink-0 relative">
          <div class="w-full h-full flex items-center justify-center">
            <i class="ti ti-playlist text-white text-2xl"></i>
          </div>
          <div class="absolute top-0 right-0 bg-green-500 text-white text-xs px-1 rounded-bl font-bold">PL</div>
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-white font-medium truncate flex items-center gap-1">
            <i class="ti ti-playlist text-blue-400"></i>
            ${item.name}
          </p>
          <p class="text-xs text-blue-300">${item.resolution} • ${item.duration}</p>
        </div>
      `;
    } else {
      // Regular content item
      itemDiv.innerHTML = `
        <div class="w-24 h-14 bg-gray-700 rounded overflow-hidden flex-shrink-0">
          ${item.thumbnail ? `
            <img src="/storage/thumbnails/${item.thumbnail}" alt="${item.name}" class="w-full h-full object-cover" />
          ` : `
            <div class="w-full h-full flex items-center justify-center">
              <i class="ti ti-video text-gray-500"></i>
            </div>
          `}
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-white font-medium truncate">${item.name}</p>
          <p class="text-xs text-gray-400">${item.resolution} • ${item.duration}</p>
        </div>
      `;
    }

    listContainer.appendChild(itemDiv);
  });
}

// Select content item from dropdown
function selectContentItem(item) {
  // Update hidden input with format "type-id"
  const contentIdInput = document.getElementById('selectedContentId');
  if (contentIdInput) {
    // Format: "playlist-123" or "content-456"
    const formattedId = `${item.type}-${item.id}`;
    contentIdInput.value = formattedId;
    
    // Also store in data attribute for reference
    contentIdInput.setAttribute('data-content-type', item.type);
    contentIdInput.setAttribute('data-raw-id', item.id);
  }

  // Update button text
  const selectedText = document.getElementById('selectedVideoText');
  if (selectedText) {
    if (item.type === 'playlist') {
      selectedText.innerHTML = `<i class="ti ti-playlist text-blue-400 mr-1"></i> ${item.name}`;
      selectedText.classList.remove('text-gray-400');
      selectedText.classList.add('text-white');
    } else {
      selectedText.textContent = item.name;
      selectedText.classList.remove('text-gray-400');
      selectedText.classList.add('text-white');
    }
  }

  // Update video preview
  updateVideoPreview(item);

  // Close dropdown
  toggleVideoDropdown();
}

// Update video preview
function updateVideoPreview(item) {
  const previewVideo = document.getElementById('streamPreviewVideo');
  const previewSource = document.getElementById('streamPreviewSource');
  const noVideoSelected = document.getElementById('noVideoSelected');
  const videoInfo = document.getElementById('streamVideoInfo');
  const videoTitle = document.getElementById('streamVideoTitle');
  const videoResolution = document.getElementById('streamVideoResolution');
  const videoDuration = document.getElementById('streamVideoDuration');

  if (!previewVideo || !noVideoSelected) return;

  if (item.type === 'playlist') {
    // Hide video, show playlist info
    previewVideo.style.display = 'none';
    if (videoInfo) videoInfo.classList.add('hidden');
    
    if (noVideoSelected) {
      noVideoSelected.style.display = 'flex';
      noVideoSelected.innerHTML = `
        <i class="ti ti-playlist text-blue-400 text-6xl mb-3"></i>
        <p class="text-sm text-white font-medium">${item.name}</p>
        <p class="text-xs text-blue-300 mt-1">Playlist • ${item.duration}</p>
      `;
    }
  } else {
    // Show video preview for regular content
    if (previewSource && item.filepath) {
      const videoPath = `/storage/uploads/${item.filepath}`;
      previewSource.src = videoPath;
      previewVideo.load();
      previewVideo.style.display = 'block';
      if (noVideoSelected) noVideoSelected.style.display = 'none';
      
      // Update video info
      if (videoInfo) {
        videoInfo.classList.remove('hidden');
        if (videoTitle) videoTitle.textContent = item.name;
        if (videoResolution) videoResolution.textContent = item.resolution || 'N/A';
        if (videoDuration) videoDuration.textContent = item.duration || '0:00';
      }
    }
  }
}

// Toggle video dropdown
function toggleVideoDropdown() {
  const dropdown = document.getElementById('videoDropdownList');
  if (!dropdown) return;

  dropdown.classList.toggle('hidden');

  // Load content if first time opening
  if (!dropdown.classList.contains('hidden') && allContentItems.length === 0) {
    loadBroadcastContentSelector();
  }

  // Focus search input when opening
  if (!dropdown.classList.contains('hidden')) {
    setTimeout(() => {
      const searchInput = document.getElementById('videoSearchInput');
      if (searchInput) searchInput.focus();
    }, 100);
  }
}

// Filter video dropdown
function filterVideoDropdown() {
  const searchInput = document.getElementById('videoSearchInput');
  if (!searchInput) return;

  const searchTerm = searchInput.value.toLowerCase();
  
  const filteredItems = allContentItems.filter(item => {
    const nameMatch = item.name.toLowerCase().includes(searchTerm);
    const descMatch = item.description && item.description.toLowerCase().includes(searchTerm);
    return nameMatch || descMatch;
  });

  renderContentSelectorItems(filteredItems);
}

// Close dropdown when clicking outside
document.addEventListener('click', function(event) {
  const dropdown = document.getElementById('videoDropdownList');
  const button = document.getElementById('videoDropdownButton');
  
  if (dropdown && button) {
    if (!dropdown.contains(event.target) && !button.contains(event.target)) {
      dropdown.classList.add('hidden');
    }
  }
});

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
  // Pre-load content when modal is opened
  const newStreamModal = document.getElementById('newStreamModal');
  if (newStreamModal) {
    const observer = new MutationObserver(function(mutations) {
      mutations.forEach(function(mutation) {
        if (mutation.attributeName === 'class') {
          if (!newStreamModal.classList.contains('hidden')) {
            // Modal opened, load content
            if (allContentItems.length === 0) {
              loadBroadcastContentSelector();
            }
          }
        }
      });
    });

    observer.observe(newStreamModal, { attributes: true });
  }
});
