// Playlist Detail page JavaScript

// Open add videos modal
function openAddVideosModal() {
  document.getElementById('addVideosModal').classList.remove('hidden');
}

// Close add videos modal
function closeAddVideosModal() {
  document.getElementById('addVideosModal').classList.add('hidden');
  // Uncheck all checkboxes
  document.querySelectorAll('.video-checkbox').forEach(cb => cb.checked = false);
}

// Toggle video selection
function toggleVideoSelection(videoId) {
  const checkbox = document.getElementById(`video-${videoId}`);
  if (checkbox) {
    checkbox.checked = !checkbox.checked;
  }
}

// Add selected videos to playlist
async function addSelectedVideos() {
  const selectedVideos = Array.from(document.querySelectorAll('.video-checkbox:checked'))
    .map(cb => cb.id.replace('video-', ''));
  if (selectedVideos.length === 0) {
    showNotification('Please select at least one video', 'error');
    return;
  }
  try {
    const response = await fetch(`/api/playlists/${playlistId}/videos`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        videoUuids: selectedVideos // API expects "videoUuids" array
      })
    });
    const result = await response.json();
    if (result.success) {
      showNotification(`Added ${selectedVideos.length} video(s) to playlist!`, 'success');
      closeAddVideosModal();
      setTimeout(() => location.reload(), 1000);
    } else {
      showNotification(result.message || 'Failed to add videos', 'error');
    }
  } catch (error) {
    console.error('Error:', error);
    showNotification('Failed to add videos', 'error');
  }
}

// Move video up or down in playlist (by reordering itemUuids and sending to backend)
async function moveVideo(videoUuid, direction) {
  const videosList = document.getElementById('videosList');
  if (!videosList) return;
  // Get array of item_uuids in current order
  const items = Array.from(videosList.children);
  const idx = items.findIndex(el => el.getAttribute('data-video-id') === videoUuid);
  if (idx === -1) return;
  let newIdx = idx;
  if (direction === 'up' && idx > 0) newIdx = idx - 1;
  if (direction === 'down' && idx < items.length - 1) newIdx = idx + 1;
  if (newIdx === idx) return;
  // Swap the items
  const temp = items[idx];
  items[idx] = items[newIdx];
  items[newIdx] = temp;
  // Build new itemUuids order
  const itemUuids = items.map(el => el.getAttribute('data-item-uuid'));
  try {
    const response = await fetch(`/api/playlists/${playlistId}/reorder`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ itemUuids })
    });
    const result = await response.json();
    if (result.success) {
      showNotification(`Video moved ${direction}!`, 'success');
      setTimeout(() => location.reload(), 500);
    } else {
      showNotification(result.message || 'Failed to move video', 'error');
    }
  } catch (error) {
    console.error('Error:', error);
    showNotification('Failed to move video', 'error');
  }
}

// Remove video from playlist
async function removeFromPlaylist(videoId) {
  if (typeof Swal !== 'undefined') {
    Swal.fire({
      title: 'Remove Video?',
      text: 'Remove this video from playlist?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Yes, remove it!',
      cancelButtonText: 'Cancel'
    }).then((result) => {
      if (result.isConfirmed) {
        removeFromPlaylistProcess(videoId);
      }
    });
  } else {
    if (!confirm('Remove this video from playlist?')) {
      return;
    }
    removeFromPlaylistProcess(videoId);
  }
}

async function removeFromPlaylistProcess(videoId) {
  try {
    const response = await fetch(`/api/playlists/${playlistId}/videos/${videoId}`, {
      method: 'DELETE'
    });
    
    const result = await response.json();
    
    if (result.success) {
      if (typeof Swal !== 'undefined') {
        Swal.fire({
          toast: true,
          position: 'top',
          icon: 'success',
          title: 'Video removed from playlist!',
          showConfirmButton: false,
          timer: 1500,
          timerProgressBar: true
        }).then(() => {
          setTimeout(() => location.reload(), 500);
        });
      } else {
        showNotification('Video removed from playlist!', 'success');
        setTimeout(() => location.reload(), 1000);
      }
    } else {
      if (typeof Swal !== 'undefined') {
        Swal.fire({
          toast: true,
          position: 'top',
          icon: 'error',
          title: result.message || 'Failed to remove video',
          showConfirmButton: false,
          timer: 3000,
          timerProgressBar: true
        });
      } else {
        showNotification(result.message || 'Failed to remove video', 'error');
      }
    }
  } catch (error) {
    console.error('Error:', error);
    if (typeof Swal !== 'undefined') {
      Swal.fire({
        toast: true,
        position: 'top',
        icon: 'error',
        title: 'Failed to remove video',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true
      });
    } else {
      showNotification('Failed to remove video', 'error');
    }
  }
}

// Start playlist broadcast
function startPlaylistBroadcast() {
  showNotification('Playlist streaming feature coming soon!', 'info');
  // TODO: Implement playlist streaming
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

// Initialize drag and drop for reordering with SortableJS
function initializeDragAndDrop() {
  const videosList = document.getElementById('videosList');
  if (videosList && typeof Sortable !== 'undefined') {
    new Sortable(videosList, {
      animation: 150,
      handle: '.ti-grip-vertical',
      ghostClass: 'bg-blue-900',
      dragClass: 'opacity-50',
      onEnd: async function(evt) {
        // Collect new order of item_uuids
        const itemUuids = Array.from(videosList.children).map(
          el => el.getAttribute('data-item-uuid')
        );
        try {
          const response = await fetch(`/api/playlists/${playlistId}/reorder`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ itemUuids })
          });
          const result = await response.json();
          if (result.success) {
            showNotification('Video order updated!', 'success');
            setTimeout(() => location.reload(), 500);
          } else {
            showNotification(result.message || 'Failed to update order', 'error');
            location.reload();
          }
        } catch (error) {
          console.error('Error reordering:', error);
          showNotification('Failed to update order', 'error');
          location.reload();
        }
      }
    });
    console.log('Drag and drop initialized');
  }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', initializeDragAndDrop);

// Close modal on outside click
document.getElementById('addVideosModal')?.addEventListener('click', (e) => {
  if (e.target.id === 'addVideosModal') {
    closeAddVideosModal();
  }
});

console.log('Playlist detail page initialized');
