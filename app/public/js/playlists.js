// Playlists page JavaScript

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
