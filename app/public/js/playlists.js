// Playlists page JavaScript

// Pagination variables
let allPlaylists = [];
let filteredPlaylists = [];
let currentPlaylistPage = 1;
let totalPlaylistPages = 1;
const playlistItemsPerPage = 10;

// Initialize pagination on page load
document.addEventListener('DOMContentLoaded', function() {
  initializePlaylistPagination();
});

/**
 * Initialize playlist pagination
 */
function initializePlaylistPagination() {
  const container = document.getElementById('playlistsContainer');
  if (!container) return;

  // Collect all playlist cards
  const cards = Array.from(container.querySelectorAll('div[class*="rounded-lg"][class*="overflow-hidden"]'));
  allPlaylists = cards.filter(card => {
    return card.querySelector('h3'); // Only cards with title
  });

  filteredPlaylists = [...allPlaylists];
  currentPlaylistPage = 1;
  
  // Render initial pagination
  renderPlaylistPagination();
}

/**
 * Render playlist pagination
 */
function renderPlaylistPagination() {
  const totalPlaylists = filteredPlaylists.length;
  totalPlaylistPages = Math.ceil(totalPlaylists / playlistItemsPerPage);

  // If no playlists or only 1 page, hide pagination
  if (totalPlaylists === 0) {
    document.getElementById('playlistsContainer').style.display = 'block';
    return;
  }

  // Calculate start and end index
  const startIndex = (currentPlaylistPage - 1) * playlistItemsPerPage;
  const endIndex = Math.min(startIndex + playlistItemsPerPage, totalPlaylists);

  // Hide all playlist cards first
  filteredPlaylists.forEach(card => {
    card.style.display = 'none';
  });

  // Show only current page playlists
  filteredPlaylists.slice(startIndex, endIndex).forEach(card => {
    card.style.display = 'block';
  });

  // Render pagination buttons
  renderPlaylistPageNumbers();

  // Update showing info
  const showingInfo = document.getElementById('playlistShowingInfo');
  if (showingInfo) {
    showingInfo.innerHTML = `Showing ${startIndex + 1}-${endIndex} of ${totalPlaylists} playlists | Page ${currentPlaylistPage} of ${totalPlaylistPages}`;
  }

  // Update button states
  const prevBtn = document.getElementById('playlistPrevBtn');
  const nextBtn = document.getElementById('playlistNextBtn');
  
  if (prevBtn) {
    if (currentPlaylistPage === 1) {
      prevBtn.disabled = true;
      prevBtn.classList.add('opacity-50', 'cursor-not-allowed');
    } else {
      prevBtn.disabled = false;
      prevBtn.classList.remove('opacity-50', 'cursor-not-allowed');
    }
  }

  if (nextBtn) {
    if (currentPlaylistPage === totalPlaylistPages) {
      nextBtn.disabled = true;
      nextBtn.classList.add('opacity-50', 'cursor-not-allowed');
    } else {
      nextBtn.disabled = false;
      nextBtn.classList.remove('opacity-50', 'cursor-not-allowed');
    }
  }
}

/**
 * Render page numbers
 */
function renderPlaylistPageNumbers() {
  const container = document.getElementById('playlistPaginationNumbers');
  if (!container) return;

  const pageRange = getPlaylistPageRange(currentPlaylistPage, totalPlaylistPages);
  
  let html = '';
  pageRange.forEach(page => {
    if (page === '...') {
      html += `<span class="w-8 h-8 flex items-center justify-center text-gray-500">...</span>`;
    } else if (page === currentPlaylistPage) {
      html += `
        <button
          class="w-8 h-8 flex items-center justify-center bg-blue-600 text-white rounded font-semibold"
          disabled
        >
          ${page}
        </button>
      `;
    } else {
      html += `
        <a
          href="#"
          onclick="goToPlaylistPage(${page}); return false;"
          class="w-8 h-8 flex items-center justify-center bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white rounded transition"
        >
          ${page}
        </a>
      `;
    }
  });

  container.innerHTML = html;
}

/**
 * Get page range for pagination
 */
function getPlaylistPageRange(current, total, range = 2) {
  const pages = [];
  const start = Math.max(1, current - range);
  const end = Math.min(total, current + range);
  
  if (start > 1) {
    pages.push(1);
    if (start > 2) pages.push('...');
  }
  
  for (let i = start; i <= end; i++) {
    pages.push(i);
  }
  
  if (end < total) {
    if (end < total - 1) pages.push('...');
    pages.push(total);
  }
  
  return pages;
}

/**
 * Go to specific page
 */
function goToPlaylistPage(page) {
  currentPlaylistPage = Math.max(1, Math.min(page, totalPlaylistPages));
  renderPlaylistPagination();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Open create playlist modal
function openCreatePlaylistModal() {
  document.getElementById('modalTitle').textContent = 'Create Playlist';
  document.getElementById('playlistId').value = '';
  document.getElementById('playlistName').value = '';
  document.getElementById('playlistDescription').value = '';
  document.getElementById('playbackMode').value = 'sequential';
  document.getElementById('playlistModal').classList.remove('hidden');
}

// Open edit playlist modal
function editPlaylist(id, name, description, playbackMode = 'sequential') {
  document.getElementById('modalTitle').textContent = 'Edit Playlist';
  document.getElementById('playlistId').value = id;
  document.getElementById('playlistName').value = name;
  document.getElementById('playlistDescription').value = description || '';
  document.getElementById('playbackMode').value = playbackMode || 'sequential';
  document.getElementById('playlistModal').classList.remove('hidden');
}

// Close playlist modal
function closePlaylistModal() {
  document.getElementById('playlistModal').classList.add('hidden');
  document.getElementById('playlistForm').reset();
}

// Handle form submission
document.getElementById('playlistForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const playlistId = document.getElementById('playlistId').value;
  const playlistName = document.getElementById('playlistName').value;
  const playlistDescription = document.getElementById('playlistDescription').value;
  const playbackMode = document.getElementById('playbackMode').value;
  
  const isEdit = playlistId !== '';
  const url = isEdit ? `/api/playlist/${playlistId}` : '/api/playlist/create';
  const method = isEdit ? 'PUT' : 'POST';
  
  try {
    const response = await fetch(url, {
      method: method,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: playlistName,
        description: playlistDescription,
        playbackMode: playbackMode
      })
    });
    
    const result = await response.json();
    
    if (result.success) {
      showNotification(
        isEdit ? 'Playlist updated successfully!' : 'Playlist created successfully!',
        'success'
      );
      closePlaylistModal();
      setTimeout(() => location.reload(), 1000);
    } else {
      showNotification(result.message || 'Failed to save playlist', 'error');
    }
  } catch (error) {
    console.error('Error:', error);
    showNotification('Failed to save playlist', 'error');
  }
});

// Delete playlist
async function deletePlaylist(id, name) {
  if (!confirm(`Are you sure you want to delete "${name}"?\n\nThis will remove all videos from the playlist (videos themselves won't be deleted).`)) {
    return;
  }
  
  try {
    const response = await fetch(`/api/playlist/${id}`, {
      method: 'DELETE'
    });
    
    const result = await response.json();
    
    if (result.success) {
      showNotification('Playlist deleted successfully!', 'success');
      setTimeout(() => location.reload(), 1000);
    } else {
      showNotification(result.message || 'Failed to delete playlist', 'error');
    }
  } catch (error) {
    console.error('Error:', error);
    showNotification('Failed to delete playlist', 'error');
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

// Close modal on outside click
document.getElementById('playlistModal')?.addEventListener('click', (e) => {
  if (e.target.id === 'playlistModal') {
    closePlaylistModal();
  }
});

console.log('Playlists page initialized');
