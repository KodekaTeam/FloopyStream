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
    const response = await fetch(`/api/playlist/${playlistId}/videos`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        videoIds: selectedVideos
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

// Move video up or down in playlist
async function moveVideo(videoId, direction) {
  try {
    const response = await fetch(`/api/playlist/${playlistId}/videos/${videoId}/move`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        direction: direction
      })
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
  if (!confirm('Remove this video from playlist?')) {
    return;
  }
  
  try {
    const response = await fetch(`/api/playlist/${playlistId}/videos/${videoId}`, {
      method: 'DELETE'
    });
    
    const result = await response.json();
    
    if (result.success) {
      showNotification('Video removed from playlist!', 'success');
      setTimeout(() => location.reload(), 1000);
    } else {
      showNotification(result.message || 'Failed to remove video', 'error');
    }
  } catch (error) {
    console.error('Error:', error);
    showNotification('Failed to remove video', 'error');
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
        const videoId = evt.item.getAttribute('data-video-id');
        const oldIndex = evt.oldIndex;
        const newIndex = evt.newIndex;
        
        if (oldIndex === newIndex) return;
        
        // Calculate direction and number of moves needed
        const direction = newIndex > oldIndex ? 'down' : 'up';
        const moves = Math.abs(newIndex - oldIndex);
        
        try {
          // Move video step by step
          for (let i = 0; i < moves; i++) {
            const response = await fetch(`/api/playlist/${playlistId}/videos/${videoId}/move`, {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ direction })
            });
            
            const result = await response.json();
            if (!result.success) {
              throw new Error(result.message);
            }
          }
          
          showNotification('Video order updated!', 'success');
          setTimeout(() => location.reload(), 500);
        } catch (error) {
          console.error('Error reordering:', error);
          showNotification('Failed to update order', 'error');
          location.reload(); // Reload to restore original order
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
