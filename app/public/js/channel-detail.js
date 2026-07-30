/**
 * Channel Detail Page Functions
 * Handles galleries, playlists, and OAuth management
 */

// Get channel UUID from URL
function getChannelUuidFromUrl() {
  const path = window.location.pathname;
  const match = path.match(/\/channels\/([a-f0-9-]+)/);
  return match ? match[1] : null;
}

// Utility function to escape HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ============================================
// EDIT CHANNEL MODAL
// ============================================

function editChannel() {
  const channelUuid = getChannelUuidFromUrl();
  if (!channelUuid) return;

  // Fetch channel data
  fetch(`/api/channels/${channelUuid}`)
    .then(res => res.json())
    .then(result => {
      if (result.success && result.data) {
        showEditChannelModal(result.data);
      } else {
        showNotification('Failed to load channel data', 'error');
      }
    })
    .catch(error => {
      console.error('Error loading channel:', error);
      showNotification('Error loading channel data', 'error');
    });
}

function showEditChannelModal(channel) {
  // Create modal HTML
  const modalHtml = `
    <div id="editChannelModal" class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div class="relative top-20 mx-auto p-5 border w-full max-w-md shadow-lg rounded-lg bg-gray-800 border-gray-700">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-semibold text-white">Edit Channel</h3>
          <button onclick="closeEditChannelModal()" class="text-gray-400 hover:text-white transition-colors">
            <i class="ti ti-x text-2xl"></i>
          </button>
        </div>

        <form id="editChannelForm" class="space-y-4">
          <div>
            <label for="edit_channel_name" class="block text-sm font-medium text-gray-300 mb-2">
              Channel Name <span class="text-red-500">*</span>
            </label>
            <input type="text"
                   id="edit_channel_name"
                   name="channel_name"
                   value="${channel.channel_name}"
                   required
                   class="w-full px-4 py-2 bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
          </div>

          <div>
            <label for="edit_platform" class="block text-sm font-medium text-gray-300 mb-2">
              Platform <span class="text-red-500">*</span>
            </label>
            <select id="edit_platform"
                    name="platform"
                    required
                    class="w-full px-4 py-2 bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
              <option value="youtube" ${channel.channel_platform === 'youtube' ? 'selected' : ''}>YouTube</option>
              <option value="facebook" ${channel.channel_platform === 'facebook' ? 'selected' : ''}>Facebook</option>
              <option value="twitch" ${channel.channel_platform === 'twitch' ? 'selected' : ''}>Twitch</option>
              <option value="tiktok" ${channel.channel_platform === 'tiktok' ? 'selected' : ''}>TikTok</option>
              <option value="instagram" ${channel.channel_platform === 'instagram' ? 'selected' : ''}>Instagram</option>
              <option value="twitter" ${channel.channel_platform === 'twitter' ? 'selected' : ''}>Twitter/X</option>
            </select>
          </div>

          <div>
            <label for="edit_external_id" class="block text-sm font-medium text-gray-300 mb-2">
              External ID (Optional)
            </label>
            <input type="text"
                   id="edit_external_id"
                   name="external_id"
                   value="${channel.external_id || ''}"
                   class="w-full px-4 py-2 bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                   placeholder="e.g., Channel ID or Username">
            <p class="mt-1 text-xs text-gray-400">Platform-specific channel ID</p>
          </div>

          <div class="flex items-center space-x-3 pt-4">
            <button type="button"
                    onclick="closeEditChannelModal()"
                    class="flex-1 px-4 py-2 border border-gray-600 rounded-lg text-sm font-medium text-gray-300 bg-gray-700 hover:bg-gray-600 transition-colors">
              Cancel
            </button>
            <button type="submit"
                    class="flex-1 px-4 py-2 bg-blue-600 border border-transparent rounded-lg text-sm font-medium text-white hover:bg-blue-700 transition-colors">
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  `;

  // Add to body
  document.body.insertAdjacentHTML('beforeend', modalHtml);

  // Add form submit handler
  document.getElementById('editChannelForm').addEventListener('submit', async function(e) {
    e.preventDefault();

    const formData = {
      channel_name: document.getElementById('edit_channel_name').value,
      channel_platform: document.getElementById('edit_platform').value,
      external_id: document.getElementById('edit_external_id').value || null
    };

    try {
      const response = await fetch(`/api/channels/${channel.channel_uuid}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData)
      });

      const result = await response.json();

      if (response.ok) {
        showNotification("Channel updated successfully!", "success");
        setTimeout(() => window.location.reload(), 1000);
      } else {
        showNotification('Error: ' + (result.message || 'Failed to update channel'), 'error');
      }
    } catch (error) {
      console.error('Error updating channel:', error);
      showNotification('An error occurred while updating the channel', 'error');
    }
  });
}

function closeEditChannelModal() {
  const modal = document.getElementById('editChannelModal');
  if (modal) {
    modal.remove();
  }
}

// ============================================
// GALLERY MANAGEMENT
// ============================================

function openNewGalleryModal() {
  const channelUuid = getChannelUuidFromUrl();
  if (!channelUuid) return;

  const modalHtml = `
    <div id="newGalleryModal" class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div class="relative top-20 mx-auto p-5 border w-full max-w-md shadow-lg rounded-lg bg-gray-800 border-gray-700">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-semibold text-white">Create New Gallery</h3>
          <button onclick="closeNewGalleryModal()" class="text-gray-400 hover:text-white transition-colors">
            <i class="ti ti-x text-2xl"></i>
          </button>
        </div>

        <form id="newGalleryForm" class="space-y-4">
          <div>
            <label for="gallery_title" class="block text-sm font-medium text-gray-300 mb-2">
              Gallery Title <span class="text-red-500">*</span>
            </label>
            <input type="text"
                   id="gallery_title"
                   name="gallery_title"
                   required
                   class="w-full px-4 py-2 bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                   placeholder="e.g., Gaming Highlights">
          </div>

          <div>
            <label for="gallery_description" class="block text-sm font-medium text-gray-300 mb-2">
              Description (Optional)
            </label>
            <textarea
                   id="gallery_description"
                   name="gallery_description"
                   rows="3"
                   class="w-full px-4 py-2 bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                   placeholder="Describe this gallery..."></textarea>
          </div>

          <div class="flex items-center space-x-3 pt-4">
            <button type="button"
                    onclick="closeNewGalleryModal()"
                    class="flex-1 px-4 py-2 border border-gray-600 rounded-lg text-sm font-medium text-gray-300 bg-gray-700 hover:bg-gray-600 transition-colors">
              Cancel
            </button>
            <button type="submit"
                    class="flex-1 px-4 py-2 bg-blue-600 border border-transparent rounded-lg text-sm font-medium text-white hover:bg-blue-700 transition-colors">
              Create Gallery
            </button>
          </div>
        </form>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);

  document.getElementById('newGalleryForm').addEventListener('submit', async function(e) {
    e.preventDefault();

    const formData = {
      channelUuid: channelUuid,
      galleryTitle: document.getElementById('gallery_title').value,
      galleryDescription: document.getElementById('gallery_description').value || ''
    };

    try {
      const response = await fetch('/api/galleries', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData)
      });

      const result = await response.json();

      if (response.ok) {
        showNotification("Gallery created successfully!", "success");
        setTimeout(() => window.location.reload(), 1000);
      } else {
        showNotification('Error: ' + (result.message || 'Failed to create gallery'), 'error');
      }
    } catch (error) {
      console.error('Error creating gallery:', error);
      showNotification('An error occurred while creating the gallery', 'error');
    }
  });
}

function closeNewGalleryModal() {
  const modal = document.getElementById('newGalleryModal');
  if (modal) modal.remove();
}

function editGallery(galleryUuid) {
  // Fetch gallery data
  fetch(`/api/galleries/${galleryUuid}`)
    .then(res => res.json())
    .then(result => {
      if (result.success && result.data) {
        showEditGalleryModal(result.data);
      } else {
        showNotification('Failed to load gallery data', 'error');
      }
    })
    .catch(error => {
      console.error('Error loading gallery:', error);
      showNotification('Error loading gallery data', 'error');
    });
}

function showEditGalleryModal(gallery) {
  // Similar to create gallery modal but with pre-filled data
  const modalHtml = `
    <div id="editGalleryModal" class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div class="relative top-20 mx-auto p-5 border w-full max-w-md shadow-lg rounded-lg bg-gray-800 border-gray-700">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-semibold text-white">Edit Gallery</h3>
          <button onclick="closeEditGalleryModal()" class="text-gray-400 hover:text-white transition-colors">
            <i class="ti ti-x text-2xl"></i>
          </button>
        </div>

        <form id="editGalleryForm" class="space-y-4">
          <div>
            <label for="edit_gallery_title" class="block text-sm font-medium text-gray-300 mb-2">
              Gallery Title <span class="text-red-500">*</span>
            </label>
            <input type="text"
                   id="edit_gallery_title"
                   value="${gallery.gallery_title}"
                   required
                   class="w-full px-4 py-2 bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
          </div>

          <div>
            <label for="edit_gallery_description" class="block text-sm font-medium text-gray-300 mb-2">
              Description
            </label>
            <textarea
                   id="edit_gallery_description"
                   rows="3"
                   class="w-full px-4 py-2 bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500">${gallery.gallery_description || ''}</textarea>
          </div>

          <div class="flex items-center space-x-3 pt-4">
            <button type="button"
                    onclick="closeEditGalleryModal()"
                    class="flex-1 px-4 py-2 border border-gray-600 rounded-lg text-sm font-medium text-gray-300 bg-gray-700 hover:bg-gray-600 transition-colors">
              Cancel
            </button>
            <button type="submit"
                    class="flex-1 px-4 py-2 bg-blue-600 border border-transparent rounded-lg text-sm font-medium text-white hover:bg-blue-700 transition-colors">
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);

  document.getElementById('editGalleryForm').addEventListener('submit', async function(e) {
    e.preventDefault();

    const formData = {
      gallery_title: document.getElementById('edit_gallery_title').value,
      gallery_description: document.getElementById('edit_gallery_description').value || ''
    };

    try {
      const response = await fetch(`/api/galleries/${gallery.gallery_uuid}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData)
      });

      const result = await response.json();

      if (response.ok) {
        showNotification("Gallery updated successfully!", "success");
        setTimeout(() => window.location.reload(), 1000);
      } else {
        showNotification('Error: ' + (result.message || 'Failed to update gallery'), 'error');
      }
    } catch (error) {
      console.error('Error updating gallery:', error);
      showNotification('An error occurred while updating the gallery', 'error');
    }
  });
}

function closeEditGalleryModal() {
  const modal = document.getElementById('editGalleryModal');
  if (modal) modal.remove();
}

function deleteGallery(galleryUuid) {
  if (typeof Swal !== 'undefined') {
    Swal.fire({
      toast: true,
      position: 'top',
      title: 'Delete Gallery?',
      html: 'Are you sure you want to delete this gallery?<br><br><small class="text-gray-400">All videos in this gallery will also be deleted. This action cannot be undone.</small>',
      icon: 'error',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Yes, delete it!',
      cancelButtonText: 'Cancel'
    }).then((result) => {
      if (result.isConfirmed) {
        deleteGalleryProcess(galleryUuid);
      }
    });
  } else {
    if (!confirm('Are you sure you want to delete this gallery? All videos in this gallery will also be deleted. This action cannot be undone.')) {
      return;
    }
    deleteGalleryProcess(galleryUuid);
  }
}

function deleteGalleryProcess(galleryUuid) {
  fetch(`/api/galleries/${galleryUuid}`, {
    method: 'DELETE'
  })
  .then(response => response.json())
  .then(result => {
    if (result.success) {
      if (typeof Swal !== 'undefined') {
        Swal.fire({
          toast: true,
          position: 'top',
          icon: 'success',
          title: 'Gallery deleted successfully!',
          showConfirmButton: false,
          timer: 1500,
          timerProgressBar: true
        }).then(() => {
          setTimeout(() => window.location.reload(), 500);
        });
      } else {
        showNotification("Gallery deleted successfully!", "success");
        setTimeout(() => window.location.reload(), 1000);
      }
    } else {
      if (typeof Swal !== 'undefined') {
        Swal.fire({
          toast: true,
          position: 'top',
          icon: 'error',
          title: result.message || 'Failed to delete gallery',
          showConfirmButton: false,
          timer: 3000,
          timerProgressBar: true
        });
      } else {
        showNotification('Error: ' + (result.message || 'Failed to delete gallery'), 'error');
      }
    }
  })
  .catch(error => {
    console.error('Error deleting gallery:', error);
    if (typeof Swal !== 'undefined') {
      Swal.fire({
        toast: true,
        position: 'top',
        icon: 'error',
        title: 'An error occurred while deleting the gallery',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true
      });
    } else {
      showNotification('An error occurred while deleting the gallery', 'error');
    }
  });
}

// ============================================
// PLAYLIST MANAGEMENT
// ============================================

function openNewPlaylistModal() {
  const channelUuid = getChannelUuidFromUrl();
  if (!channelUuid) return;

  const modalHtml = `
    <div id="newPlaylistModal" class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div class="relative top-20 mx-auto p-5 border w-full max-w-md shadow-lg rounded-lg bg-gray-800 border-gray-700">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-semibold text-white">Create New Playlist</h3>
          <button onclick="closeNewPlaylistModal()" class="text-gray-400 hover:text-white transition-colors">
            <i class="ti ti-x text-2xl"></i>
          </button>
        </div>

        <form id="newPlaylistForm" class="space-y-4">
          <div>
            <label for="playlist_name" class="block text-sm font-medium text-gray-300 mb-2">
              Playlist Name <span class="text-red-500">*</span>
            </label>
            <input type="text"
                   id="playlist_name"
                   name="playlist_name"
                   required
                   class="w-full px-4 py-2 bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                   placeholder="e.g., 24/7 Lofi Mix">
          </div>

          <div>
            <label for="playlist_description" class="block text-sm font-medium text-gray-300 mb-2">
              Description (Optional)
            </label>
            <textarea
                   id="playlist_description"
                   name="playlist_description"
                   rows="3"
                   class="w-full px-4 py-2 bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                   placeholder="Describe this playlist..."></textarea>
          </div>

          <div>
            <label for="playback_mode" class="block text-sm font-medium text-gray-300 mb-2">
              Playback Mode
            </label>
            <select id="playback_mode"
                    name="playback_mode"
                    class="w-full px-4 py-2 bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
              <option value="sequential">Sequential (in order)</option>
              <option value="shuffle">Shuffle (random)</option>
              <option value="random">Random (truly random)</option>
            </select>
          </div>

          <div class="flex items-center space-x-3 pt-4">
            <button type="button"
                    onclick="closeNewPlaylistModal()"
                    class="flex-1 px-4 py-2 border border-gray-600 rounded-lg text-sm font-medium text-gray-300 bg-gray-700 hover:bg-gray-600 transition-colors">
              Cancel
            </button>
            <button type="submit"
                    class="flex-1 px-4 py-2 bg-blue-600 border border-transparent rounded-lg text-sm font-medium text-white hover:bg-blue-700 transition-colors">
              Create Playlist
            </button>
          </div>
        </form>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);

  document.getElementById('newPlaylistForm').addEventListener('submit', async function(e) {
    e.preventDefault();

    const formData = {
      channelUuid: channelUuid,
      playlistName: document.getElementById('playlist_name').value,
      description: document.getElementById('playlist_description').value || '',
      playbackMode: document.getElementById('playback_mode').value
    };

    try {
      const response = await fetch('/api/playlists', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData)
      });

      const result = await response.json();

      if (response.ok) {
        showNotification("Playlist created successfully!", "success");
        setTimeout(() => window.location.reload(), 1000);
      } else {
        showNotification('Error: ' + (result.message || 'Failed to create playlist'), 'error');
      }
    } catch (error) {
      console.error('Error creating playlist:', error);
      showNotification('An error occurred while creating the playlist', 'error');
    }
  });
}

function closeNewPlaylistModal() {
  const modal = document.getElementById('newPlaylistModal');
  if (modal) modal.remove();
}

function editPlaylist(playlistUuid) {
  // Fetch playlist data
  fetch(`/api/playlists/${playlistUuid}`)
    .then(res => res.json())
    .then(result => {
      if (result.success && result.data) {
        showEditPlaylistModal(result.data);
      } else {
        showNotification('Failed to load playlist data', 'error');
      }
    })
    .catch(error => {
      console.error('Error loading playlist:', error);
      showNotification('Error loading playlist data', 'error');
    });
}

function showEditPlaylistModal(playlist) {
  const modalHtml = `
    <div id="editPlaylistModal" class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div class="relative top-20 mx-auto p-5 border w-full max-w-md shadow-lg rounded-lg bg-gray-800 border-gray-700">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-semibold text-white">Edit Playlist</h3>
          <button onclick="closeEditPlaylistModal()" class="text-gray-400 hover:text-white transition-colors">
            <i class="ti ti-x text-2xl"></i>
          </button>
        </div>

        <form id="editPlaylistForm" class="space-y-4">
          <div>
            <label for="edit_playlist_name" class="block text-sm font-medium text-gray-300 mb-2">
              Playlist Name <span class="text-red-500">*</span>
            </label>
            <input type="text"
                   id="edit_playlist_name"
                   value="${playlist.playlist_name}"
                   required
                   class="w-full px-4 py-2 bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
          </div>

          <div>
            <label for="edit_playlist_description" class="block text-sm font-medium text-gray-300 mb-2">
              Description (Optional)
            </label>
            <textarea
                   id="edit_playlist_description"
                   rows="3"
                   class="w-full px-4 py-2 bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500">${playlist.description || ''}</textarea>
          </div>

          <div>
            <label for="edit_playback_mode" class="block text-sm font-medium text-gray-300 mb-2">
              Playback Mode
            </label>
            <select id="edit_playback_mode"
                    class="w-full px-4 py-2 bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
              <option value="sequential" ${playlist.playback_mode === 'sequential' ? 'selected' : ''}>Sequential (in order)</option>
              <option value="shuffle" ${playlist.playback_mode === 'shuffle' ? 'selected' : ''}>Shuffle (random)</option>
              <option value="random" ${playlist.playback_mode === 'random' ? 'selected' : ''}>Random (truly random)</option>
            </select>
          </div>

          <div class="flex items-center space-x-3 pt-4">
            <button type="button"
                    onclick="closeEditPlaylistModal()"
                    class="flex-1 px-4 py-2 border border-gray-600 rounded-lg text-sm font-medium text-gray-300 bg-gray-700 hover:bg-gray-600 transition-colors">
              Cancel
            </button>
            <button type="submit"
                    class="flex-1 px-4 py-2 bg-blue-600 border border-transparent rounded-lg text-sm font-medium text-white hover:bg-blue-700 transition-colors">
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', modalHtml);

  document.getElementById('editPlaylistForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const formData = {
      playlistName: document.getElementById('edit_playlist_name').value,
      description: document.getElementById('edit_playlist_description').value || '',
      playbackMode: document.getElementById('edit_playback_mode').value
    };
    try {
      const response = await fetch(`/api/playlists/${playlist.playlist_uuid}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData)
      });
      const result = await response.json();
      if (response.ok) {
        showNotification('Playlist updated successfully!', 'success');
        setTimeout(() => window.location.reload(), 1000);
      } else {
        showNotification('Error: ' + (result.message || 'Failed to update playlist'), 'error');
      }
    } catch (error) {
      console.error('Error updating playlist:', error);
      showNotification('An error occurred while updating the playlist', 'error');
    }
  });
}

function closeEditPlaylistModal() {
  const modal = document.getElementById('editPlaylistModal');
  if (modal) modal.remove();
}

function deletePlaylist(playlistUuid) {
  if (typeof Swal !== 'undefined') {
    Swal.fire({
      toast: true,
      position: "top",
      title: "Delete Playlist?",
      text: "Are you sure you want to delete this playlist? This action cannot be undone.",
      icon: "error",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "Yes, delete it!",
      cancelButtonText: "Cancel",
    }).then((result) => {
      if (result.isConfirmed) {
        deletePlaylistProcess(playlistUuid);
      }
    });
  } else {
    if (!confirm('Are you sure you want to delete this playlist? This action cannot be undone.')) {
      return;
    }
    deletePlaylistProcess(playlistUuid);
  }
}

function deletePlaylistProcess(playlistUuid) {
  fetch(`/api/playlists/${playlistUuid}`, {
    method: 'DELETE'
  })
  .then(response => response.json())
  .then(result => {
    if (result.success) {
      if (typeof Swal !== 'undefined') {
        Swal.fire({
          toast: true,
          position: 'top',
          icon: 'success',
          title: 'Playlist deleted successfully!',
          showConfirmButton: false,
          timer: 1500,
          timerProgressBar: true
        }).then(() => {
          setTimeout(() => window.location.reload(), 500);
        });
      } else {
        showNotification('Playlist deleted successfully!', 'success');
        setTimeout(() => window.location.reload(), 1000);
      }
    } else {
      if (typeof Swal !== 'undefined') {
        Swal.fire({
          toast: true,
          position: 'top',
          icon: 'error',
          title: result.message || 'Failed to delete playlist',
          showConfirmButton: false,
          timer: 3000,
          timerProgressBar: true
        });
      } else {
        showNotification('Error: ' + (result.message || 'Failed to delete playlist'), 'error');
      }
    }
  })
  .catch(error => {
    console.error('Error deleting playlist:', error);
    if (typeof Swal !== 'undefined') {
      Swal.fire({
        toast: true,
        position: 'top',
        icon: 'error',
        title: 'An error occurred while deleting the playlist',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true
      });
    } else {
      showNotification('An error occurred while deleting the playlist', 'error');
    }
  });
}

// ============================================
// OAUTH MANAGEMENT
// ============================================

function connectOAuth() {
  const channelUuid = getChannelUuidFromUrl();
  if (!channelUuid) {
    showNotification('Channel UUID not found', 'error');
    return;
  }

  // Show loading state
  const connectBtn = document.querySelector('[onclick="connectOAuth()"]');
  if (connectBtn) {
    connectBtn.disabled = true;
    connectBtn.textContent = 'Connecting...';
  }

  // Get channel data to determine provider
  fetch(`/api/channels/${channelUuid}`)
    .then(res => res.json())
    .then(result => {
      if (!result.success || !result.data) {
        throw new Error('Failed to load channel data');
      }

      const channel = result.data;
      let provider = null;

      // Map channel platform to OAuth provider
      switch (channel.channel_platform.toLowerCase()) {
        case 'youtube':
          provider = 'google';
          break;
        case 'facebook':
          provider = 'facebook';
          break;
        case 'twitch':
          provider = 'twitch';
          break;
        case 'tiktok':
          provider = 'tiktok';
          break;
        default:
          throw new Error(`OAuth not supported for platform: ${channel.channel_platform}`);
      }

      // Initiate OAuth flow
      return fetch(`/api/oauth/connect/${provider}/${channelUuid}`);
    })
    .then(res => res.json())
    .then(result => {
      if (result.success && result.authUrl) {
        // Redirect to OAuth provider
        window.location.href = result.authUrl;
      } else {
        throw new Error(result.message || 'Failed to initiate OAuth');
      }
    })
    .catch(error => {
      console.error('OAuth connection error:', error);
      showNotification('Error: ' + error.message, 'error');

      // Reset button state
      if (connectBtn) {
        connectBtn.disabled = false;
        connectBtn.textContent = 'Connect OAuth';
      }
    });
}

function disconnectOAuth(oauthUuid) {
  if (typeof Swal !== 'undefined') {
    Swal.fire({
      toast: true,
      position: "top",
      title: "Disconnect OAuth?",
      text: "Are you sure you want to disconnect OAuth? You will lose access to automated features.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "Yes, disconnect it!",
      cancelButtonText: "Cancel",
    }).then((result) => {
      if (result.isConfirmed) {
        disconnectOAuthProcess(oauthUuid);
      }
    });
  } else {
    if (!confirm('Are you sure you want to disconnect OAuth? You will lose access to automated features.')) {
      return;
    }
    disconnectOAuthProcess(oauthUuid);
  }
}

function disconnectOAuthProcess(oauthUuid) {
  // Show loading state
  const disconnectBtn = document.querySelector(`[onclick="disconnectOAuth('${oauthUuid}')"]`);
  if (disconnectBtn) {
    disconnectBtn.disabled = true;
    disconnectBtn.textContent = 'Disconnecting...';
  }

  fetch(`/api/oauth/disconnect/${oauthUuid}`, {
    method: 'DELETE'
  })
  .then(response => response.json())
  .then(result => {
    if (result.success) {
      if (typeof Swal !== 'undefined') {
        Swal.fire({
          toast: true,
          position: 'top',
          icon: 'success',
          title: 'OAuth disconnected successfully!',
          showConfirmButton: false,
          timer: 1500,
          timerProgressBar: true
        }).then(() => {
          setTimeout(() => window.location.reload(), 500);
        });
      } else {
        showNotification('OAuth disconnected successfully!', 'success');
        setTimeout(() => window.location.reload(), 1000);
      }
    } else {
      if (typeof Swal !== 'undefined') {
        Swal.fire({
          toast: true,
          position: 'top',
          icon: 'error',
          title: result.message || 'Failed to disconnect OAuth',
          showConfirmButton: false,
          timer: 3000,
          timerProgressBar: true
        });
      } else {
        showNotification('Error: ' + (result.message || 'Failed to disconnect OAuth'), 'error');
      }

      // Reset button state
      if (disconnectBtn) {
        disconnectBtn.disabled = false;
        disconnectBtn.textContent = 'Disconnect';
      }
    }
  })
  .catch(error => {
    console.error('OAuth disconnect error:', error);
    if (typeof Swal !== 'undefined') {
      Swal.fire({
        toast: true,
        position: 'top',
        icon: 'error',
        title: 'Error: ' + error.message,
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true
      });
    } else {
      showNotification('Error: ' + error.message, 'error');
    }

    // Reset button state
    if (disconnectBtn) {
      disconnectBtn.disabled = false;
      disconnectBtn.textContent = 'Disconnect';
    }
  });
}

function refreshOAuth(oauthUuid) {
  // Show loading state
  const refreshBtn = document.querySelector(`[onclick="refreshOAuth('${oauthUuid}')"]`);
  if (refreshBtn) {
    refreshBtn.disabled = true;
    refreshBtn.textContent = 'Refreshing...';
  }

  fetch(`/api/oauth/refresh/${oauthUuid}`, {
    method: 'POST'
  })
  .then(response => response.json())
  .then(result => {
    if (result.success) {
      // alert('OAuth token refreshed successfully!');
      // window.location.reload();
      Swal.fire({
        toast: true,
        position: 'top',
        icon: 'success',
        title: 'OAuth token refreshed successfully!',
        showConfirmButton: false,
        timer: 1500 // Tutup otomatis setelah 1.5 detik
      }).then(() => {
        window.location.reload();
      });
    } else {
      // throw new Error(result.message || 'Failed to refresh OAuth token');
      Swal.fire({
        toast: true,
        position: "top",
        icon: "success",
        title: result.message || "Failed to refresh OAuth token",
        showConfirmButton: false,
        timer: 1500, // Tutup otomatis setelah 1.5 detik
      }).then(() => {
        window.location.reload();
      });
    }
  })
  .catch(error => {
    console.error('OAuth refresh error:', error);
    showNotification('Error: ' + error.message, 'error');

    // Reset button state
    if (refreshBtn) {
      refreshBtn.disabled = false;
      refreshBtn.textContent = 'Refresh Token';
    }
  });
}

// ============================================
// YOUTUBE ANALYTICS
// ============================================

function refreshYouTubeData() {
  const channelUuid = getChannelUuidFromUrl();
  if (!channelUuid) {
    showNotification('Channel UUID not found', 'error');
    return;
  }

  // Show loading state on the refresh button
  const refreshBtn = document.querySelector('[onclick="refreshYouTubeData()"]');
  if (refreshBtn) {
    refreshBtn.disabled = true;
    refreshBtn.innerHTML = '<i class="ti ti-loader animate-spin mr-2"></i>Refreshing...';
  }

  // Fetch YouTube analytics using channel UUID
  fetch(`/api/oauth/youtube-analytics/channel/${channelUuid}`)
    .then(response => response.json())
    .then(result => {
      if (result.success && result.data) {
        // Update the UI with new data
        updateYouTubeAnalyticsUI(result.data);

        // Show success message
        if (typeof Swal !== 'undefined') {
          Swal.fire({
            toast: true,
            position: 'top',
            icon: 'success',
            title: 'YouTube data refreshed successfully!',
            showConfirmButton: false,
            timer: 2000
          });
        } else {
          showNotification('YouTube data refreshed successfully!', 'success');
        }
      } else {
        throw new Error(result.message || 'Failed to refresh YouTube data');
      }
    })
    .catch(error => {
      console.error('YouTube refresh error:', error);

      // Show error message
      if (typeof Swal !== 'undefined') {
        Swal.fire({
          toast: true,
          position: 'top',
          icon: 'error',
          title: error.message || 'Failed to refresh YouTube data',
          showConfirmButton: false,
          timer: 3000
        });
      } else {
        showNotification('Error: ' + error.message, 'error');
      }
    })
    .finally(() => {
      // Reset button state
      if (refreshBtn) {
        refreshBtn.disabled = false;
        refreshBtn.innerHTML = '<i class="ti ti-refresh mr-2"></i>Refresh Data';
      }
    });
}

function updateYouTubeAnalyticsUI(data) {
  // Update subscriber count
  const subscriberElements = document.querySelectorAll('.bg-gray-800.rounded-lg.p-6.border.border-gray-700.flex.flex-col.items-center');
  if (subscriberElements.length >= 1 && data.subscriberCount !== undefined) {
    const subscriberSpan = subscriberElements[0].querySelector('.text-2xl.font-bold.text-white');
    if (subscriberSpan) {
      subscriberSpan.textContent = data.subscriberCount.toLocaleString();
    }
  }

  // Update video count
  if (subscriberElements.length >= 2 && data.videoCount !== undefined) {
    const videoSpan = subscriberElements[1].querySelector('.text-2xl.font-bold.text-white');
    if (videoSpan) {
      videoSpan.textContent = data.videoCount.toLocaleString();
    }
  }

  // Update view count
  if (subscriberElements.length >= 3 && data.viewCount !== undefined) {
    const viewSpan = subscriberElements[2].querySelector('.text-2xl.font-bold.text-white');
    if (viewSpan) {
      viewSpan.textContent = data.viewCount.toLocaleString();
    }
  }

  // Update channel info section
  const channelInfoSection = document.querySelector('.mt-6.bg-gray-800.rounded-lg.p-6.border.border-gray-700');
  if (channelInfoSection) {
    // Update title
    const titleElement = channelInfoSection.querySelector('.text-lg.font-bold.text-white');
    if (titleElement && data.title) {
      titleElement.textContent = data.title;
    }

    // Update description
    const descriptionElement = channelInfoSection.querySelector('.text-gray-400.text-sm');
    if (descriptionElement && data.description) {
      descriptionElement.textContent = data.description;
    }

    // Update thumbnail
    const thumbnailElement = channelInfoSection.querySelector('.w-16.h-16.rounded-full.border.border-gray-700');
    if (thumbnailElement && data.thumbnailUrl) {
      thumbnailElement.src = data.thumbnailUrl;
    }

    // Update published date
    const publishedLabel = channelInfoSection.querySelector('.font-medium');
    if (publishedLabel && publishedLabel.textContent.includes('Published:') && data.publishedAt) {
      const publishedDate = new Date(data.publishedAt).toLocaleDateString();
      publishedLabel.nextElementSibling.textContent = publishedDate;
    }

    // Update visit channel link
    const visitLink = channelInfoSection.querySelector('a[href*="youtube.com/channel/"]');
    if (visitLink && data.channelId) {
      visitLink.href = `https://www.youtube.com/channel/${data.channelId}`;
    }
  }
}

// ============================================
// YOUTUBE STREAM KEY
// ============================================

function refreshStreamKey() {
  const channelUuid = getChannelUuidFromUrl();
  if (!channelUuid) {
    showNotification('Channel UUID not found', 'error');
    return;
  }

  // Show loading state
  const refreshBtn = document.querySelector('[onclick="refreshStreamKey()"]');
  if (refreshBtn) {
    refreshBtn.disabled = true;
    refreshBtn.innerHTML = '<i class="ti ti-loader animate-spin mr-2"></i>Refreshing...';
  }

  // Update status
  const statusElement = document.getElementById('stream-status-display');
  if (statusElement) {
    statusElement.innerHTML = '<i class="ti ti-loader mr-1 animate-spin"></i>Loading...';
    statusElement.className = 'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-900/50 text-yellow-300';
  }

  // Fetch stream key
  fetch(`/api/oauth/youtube-streamkey/channel/${channelUuid}`)
    .then(response => response.json())
    .then(result => {
      if (result.success && result.data) {
        updateStreamKeyUI(result.data);

        // Show success message
        if (typeof Swal !== 'undefined') {
          Swal.fire({
            toast: true,
            position: 'top',
            icon: 'success',
            title: 'Stream key refreshed successfully!',
            showConfirmButton: false,
            timer: 2000
          });
        } else {
          showNotification('Stream key refreshed successfully!', 'success');
        }
      } else {
        throw new Error(result.message || 'Failed to refresh stream key');
      }
    })
    .catch(error => {
      console.error('Stream key refresh error:', error);

      // Update status to error
      if (statusElement) {
        statusElement.innerHTML = '<i class="ti ti-alert-circle mr-1"></i>Error';
        statusElement.className = 'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-900/50 text-red-300';
      }

      // Show error message
      if (typeof Swal !== 'undefined') {
        Swal.fire({
          toast: true,
          position: 'top',
          icon: 'error',
          title: error.message || 'Failed to refresh stream key',
          showConfirmButton: false,
          timer: 3000
        });
      } else {
        showNotification('Error: ' + error.message, 'error');
      }
    })
    .finally(() => {
      // Reset button state
      if (refreshBtn) {
        refreshBtn.disabled = false;
        refreshBtn.innerHTML = '<i class="ti ti-refresh mr-2"></i>Refresh Stream Key';
      }
    });
}

function updateStreamKeyUI(data) {
  // Update stream key
  const streamKeyElement = document.getElementById('stream-key-display');
  if (streamKeyElement && data.streamKey) {
    streamKeyElement.textContent = data.streamKey;
  }

  // Update RTMP URL
  const rtmpUrlElement = document.getElementById('rtmp-url-display');
  if (rtmpUrlElement && data.rtmpUrl) {
    rtmpUrlElement.textContent = data.rtmpUrl;
  }

  // Update full stream URL
  const fullStreamUrlElement = document.getElementById('full-stream-url-display');
  if (fullStreamUrlElement && data.streamUrl) {
    fullStreamUrlElement.textContent = data.streamUrl;
  }

  // Update status
  const statusElement = document.getElementById('stream-status-display');
  if (statusElement) {
    const status = data.status || 'unknown';
    let statusClass = 'bg-gray-800 text-gray-300';
    let statusIcon = 'ti ti-circle';
    let statusText = 'Unknown';

    switch (status.toLowerCase()) {
      case 'active':
        statusClass = 'bg-green-900/50 text-green-300';
        statusIcon = 'ti ti-circle-filled';
        statusText = 'Active';
        break;
      case 'inactive':
        statusClass = 'bg-yellow-900/50 text-yellow-300';
        statusIcon = 'ti ti-circle';
        statusText = 'Inactive';
        break;
      case 'error':
        statusClass = 'bg-red-900/50 text-red-300';
        statusIcon = 'ti ti-alert-circle';
        statusText = 'Error';
        break;
      default:
        statusClass = 'bg-gray-800 text-gray-300';
        statusIcon = 'ti ti-circle';
        statusText = 'Unknown';
    }

    statusElement.className = `inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${statusClass}`;
    statusElement.innerHTML = `<i class="${statusIcon} mr-1"></i>${statusText}`;
  }
}

function copyStreamKey() {
  const streamKeyElement = document.getElementById('stream-key-display');
  if (streamKeyElement && streamKeyElement.textContent && streamKeyElement.textContent !== 'Loading...') {
    navigator.clipboard.writeText(streamKeyElement.textContent).then(() => {
      showNotification('Stream key copied to clipboard!', 'success');
    }).catch(() => {
      showNotification('Failed to copy stream key', 'error');
    });
  }
}

function copyFullStreamUrl() {
  const fullStreamUrlElement = document.getElementById('full-stream-url-display');
  if (fullStreamUrlElement && fullStreamUrlElement.textContent && fullStreamUrlElement.textContent !== 'Loading...') {
    navigator.clipboard.writeText(fullStreamUrlElement.textContent).then(() => {
      showNotification('Full stream URL copied to clipboard!', 'success');
    }).catch(() => {
      showNotification('Failed to copy stream URL', 'error');
    });
  }
}

// ============================================
// TAB SWITCHING
// ============================================

function switchTab(tabName) {
  // Hide all tab contents
  document.querySelectorAll('.tab-content').forEach(tab => {
    tab.classList.add('hidden');
  });

  // Remove active state from all tab buttons
  document.querySelectorAll('.tab-button').forEach(btn => {
    btn.classList.remove('border-blue-500', 'text-blue-600');
    btn.classList.add('border-gray-300', 'text-gray-600');
  });

  // Show selected tab content
  const selectedTab = document.getElementById(`content-${tabName}`);
  if (selectedTab) {
    selectedTab.classList.remove('hidden');
  }

  // Add active state to selected tab button
  const selectedBtn = document.getElementById(`tab-${tabName}`);
  if (selectedBtn) {
    selectedBtn.classList.remove('border-gray-300', 'text-gray-600');
    selectedBtn.classList.add('border-blue-500', 'text-blue-600');
  }
}

// ============================================
// STREAM KEYS MANAGEMENT
// ============================================

function loadStreamKeys() {
  const channelUuid = getChannelUuidFromUrl();
  if (!channelUuid) return;

  const container = document.getElementById('stream-keys-container');
  const emptyState = document.getElementById('empty-state-streamkeys');
  if (!container) return;

  // Show loading in container
  container.innerHTML = `
    <div class="col-span-full text-center py-12">
      <i class="ti ti-loader animate-spin text-2xl text-gray-400 mb-2"></i>
      <p class="text-gray-400">Loading stream keys...</p>
    </div>
  `;

  // Hide empty state while loading
  if (emptyState) emptyState.classList.add('hidden');

  fetch(`/api/streamkeys/channel/${channelUuid}`)
    .then(response => response.json())
    .then(result => {
      if (result.success) {
        renderStreamKeys(result.data);
      } else {
        throw new Error(result.message || 'Failed to load stream keys');
      }
    })
    .catch(error => {
      console.error('Load stream keys error:', error);
      listContainer.innerHTML = `
        <div class="text-center py-8">
          <i class="ti ti-alert-circle text-2xl text-red-400 mb-2"></i>
          <p class="text-red-400">Error loading stream keys</p>
          <p class="text-gray-500 text-sm">${error.message}</p>
        </div>
      `;
    });
}

function renderStreamKeys(streamKeys) {
  const container = document.getElementById('stream-keys-container');
  const emptyState = document.getElementById('empty-state-streamkeys');

  if (!container) return;

  if (!streamKeys || streamKeys.length === 0) {
    container.innerHTML = '';
    if (emptyState) emptyState.classList.remove('hidden');
    return;
  }

  if (emptyState) emptyState.classList.add('hidden');

  container.innerHTML = streamKeys
    .map(
      (key) => `
    <div class="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-6 border border-gray-700 shadow-lg hover:shadow-xl transition-shadow">
        <div class="flex items-start justify-between mb-4">
            <div class="flex-1 min-w-0">
                <div class="flex items-center gap-3 mb-2">
                    <h3 class="text-lg font-semibold text-white truncate">${escapeHtml(
                      key.streamkey_name
                    )}</h3>
                    <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      key.is_active === 1 || key.is_active === "1" || key.is_active === "active"
                        ? "bg-green-900/50 text-green-300"
                        : "bg-yellow-900/50 text-yellow-300"
                    }">
                        <i class="ti ti-circle-filled mr-1 text-xs"></i>
                        ${key.is_active === 1 || key.is_active === "1" || key.is_active === "active" ? 'active' : 'inactive'}
                    </span>
                </div>
                ${
                  key.streamkey_description
                    ? `<p class="text-gray-400 text-sm mb-2 line-clamp-2">${escapeHtml(
                        key.streamkey_description
                      )}</p>`
                    : '<p class="text-gray-400 text-sm mb-12 line-clamp-2"></p>'
                }
            </div>
            <div class="flex items-center gap-2 ml-4">
                <button onclick="editStreamKey('${key.streamkey_id}')"
                        class="text-gray-400 hover:text-blue-400 transition-colors p-1"
                        title="Edit stream key">
                    <i class="ti ti-edit text-lg"></i>
                </button>
                <button onclick="deleteStreamKey('${key.streamkey_id}')"
                        class="text-gray-400 hover:text-red-400 transition-colors p-1"
                        title="Delete stream key">
                    <i class="ti ti-trash text-lg"></i>
                </button>
            </div>
        </div>

        <div class="space-y-3">
            <div>
                <span class="text-xs font-medium text-gray-500 uppercase tracking-wide">RTMP URL</span>
                <div class="flex items-center gap-2 mt-1">
                    <code class="text-xs text-gray-300 bg-gray-900 px-2 py-1 rounded flex-1 truncate">${
                      key.server_url
                    }</code>
                    <button onclick="copyToClipboard('${
                      key.server_url
                    }')" class="text-gray-400 hover:text-white transition-colors" title="Copy RTMP URL">
                        <i class="ti ti-copy text-sm"></i>
                    </button>
                </div>
            </div>
            <div>
                <span class="text-xs font-medium text-gray-500 uppercase tracking-wide">Stream Key</span>
                <div class="flex items-center gap-2 mt-1">
                    <code class="text-xs text-gray-300 bg-gray-900 px-2 py-1 rounded flex-1 truncate">${
                      key.stream_key
                    }</code>
                    <button onclick="copyToClipboard('${
                      key.stream_key
                    }')" class="text-gray-400 hover:text-white transition-colors" title="Copy Stream Key">
                        <i class="ti ti-copy text-sm"></i>
                    </button>
                </div>
            </div>

            <div class="flex items-center justify-between pt-2 border-t border-gray-700">
                <div class="flex items-center space-x-4 text-xs text-gray-400">
                    <span class="flex items-center">
                        <i class="ti ti-calendar mr-1"></i>
                        Created ${new Date(key.created_at).toLocaleDateString()}
                    </span>
                    ${
                      key.last_used_at
                        ? `<span class="flex items-center"><i class="ti ti-clock mr-1"></i>Last used ${new Date(
                            key.last_used_at
                          ).toLocaleDateString()}</span>`
                        : ""
                    }
                </div>
            </div>
        </div>
    </div>
  `
    )
    .join("");
}

function createNewStreamKey() {
  const modal = document.getElementById('createStreamKeyModal');
  if (modal) {
    modal.classList.remove('hidden');
  }
}

function closeCreateStreamKeyModal() {
  const modal = document.getElementById('createStreamKeyModal');
  if (modal) {
    modal.classList.add('hidden');
    // Reset form
    const form = document.getElementById('createStreamKeyForm');
    if (form) form.reset();
  }
}

function editStreamKey(streamKeyId) {
  // Fetch stream key data
  fetch(`/api/streamkeys/${streamKeyId}`)
    .then(response => response.json())
    .then(result => {
      if (result.success && result.data) {
        showEditStreamKeyModal(result.data);
      } else {
        showNotification('Failed to load stream key data', 'error');
      }
    })
    .catch(error => {
      console.error('Error loading stream key:', error);
      showNotification('Error loading stream key data', 'error');
    });
}

function showEditStreamKeyModal(streamKey) {
  // Populate edit modal
  document.getElementById('editStreamKeyId').value = streamKey.streamkey_id;
  document.getElementById('editStreamKeyName').value = streamKey.streamkey_name;
  document.getElementById('editStreamKeyDescription').value = streamKey.streamkey_description || '';

  // Populate streaming settings (read-only for manual settings after creation)
  document.getElementById('editStreamingProtocol').value = streamKey.streaming_protocol || 'rtmp';

  // Set checkbox states (disabled in HTML, but show current values)
  const manualSettingsCheckbox = document.getElementById('editEnableManualSettings');
  const enable60fpsCheckbox = document.getElementById('editEnable60fps');
  const manualSettingsOptions = document.getElementById('editManualSettingsOptions');

  // Show current values (checkboxes are disabled in HTML)
  manualSettingsCheckbox.checked = streamKey.enable_manual_settings || false;
  enable60fpsCheckbox.checked = streamKey.enable_60fps || false;

  // Always show manual settings options if previously enabled (for display purposes)
  // Even though they're disabled, users should see what was previously set
  if (streamKey.enable_manual_settings) {
    manualSettingsOptions.style.display = 'block';
  } else {
    manualSettingsOptions.style.display = 'none';
  }

  // Set resolution value (field is disabled in HTML)
  const resolutionField = document.getElementById('editManualResolution');
  resolutionField.value = streamKey.manual_resolution || '1080p';

  const modal = document.getElementById('editStreamKeyModal');
  if (modal) {
    modal.classList.remove('hidden');
  }
}

function closeEditStreamKeyModal() {
  const modal = document.getElementById('editStreamKeyModal');
  if (modal) {
    modal.classList.add('hidden');
    // Reset form
    const form = document.getElementById('editStreamKeyForm');
    if (form) form.reset();
  }
}

// ============================================
// MANUAL SETTINGS TOGGLE FUNCTIONS
// ============================================

function toggleManualSettings() {
  const checkbox = document.getElementById('enableManualSettings');
  const optionsDiv = document.getElementById('manualSettingsOptions');

  if (checkbox.checked) {
    optionsDiv.classList.remove('hidden');
  } else {
    optionsDiv.classList.add('hidden');
  }
}

function toggleEditManualSettings() {
  const checkbox = document.getElementById('editEnableManualSettings');
  const optionsDiv = document.getElementById('editManualSettingsOptions');

  if (checkbox.checked) {
    optionsDiv.classList.remove('hidden');
  } else {
    optionsDiv.classList.add('hidden');
  }
}

function deleteStreamKey(streamKeyId) {
  if (typeof Swal !== 'undefined') {
    Swal.fire({
      toast: true,
      position: "top",
      title: "Delete Stream Key?",
      text: "Are you sure you want to delete this stream key? This action cannot be undone.",
      icon: "error",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "Yes, delete it!",
      cancelButtonText: "Cancel",
    }).then((result) => {
      if (result.isConfirmed) {
        deleteStreamKeyProcess(streamKeyId);
      }
    });
  } else {
    if (!confirm('Are you sure you want to delete this stream key? This action cannot be undone.')) {
      return;
    }
    deleteStreamKeyProcess(streamKeyId);
  }
}

function deleteStreamKeyProcess(streamKeyId) {
  fetch(`/api/streamkeys/${streamKeyId}`, {
    method: 'DELETE'
  })
  .then(response => response.json())
  .then(result => {
    if (result.success) {
      if (typeof Swal !== 'undefined') {
        Swal.fire({
          toast: true,
          position: 'top',
          icon: 'success',
          title: 'Stream key deleted successfully!',
          showConfirmButton: false,
          timer: 1500,
          timerProgressBar: true
        }).then(() => {
          loadStreamKeys(); // Reload the list
        });
      } else {
        showNotification('Stream key deleted successfully!', 'success');
        loadStreamKeys(); // Reload the list
      }
    } else {
      if (typeof Swal !== 'undefined') {
        Swal.fire({
          toast: true,
          position: 'top',
          icon: 'error',
          title: result.message || 'Failed to delete stream key',
          showConfirmButton: false,
          timer: 3000,
          timerProgressBar: true
        });
      } else {
        showNotification('Error: ' + (result.message || 'Failed to delete stream key'), 'error');
      }
    }
  })
  .catch(error => {
    console.error('Error deleting stream key:', error);
    if (typeof Swal !== 'undefined') {
      Swal.fire({
        toast: true,
        position: 'top',
        icon: 'error',
        title: 'An error occurred while deleting the stream key',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true
      });
    } else {
      showNotification('An error occurred while deleting the stream key', 'error');
    }
  });
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => {
    showNotification('Copied to clipboard!', 'success');
  }).catch(() => {
    showNotification('Failed to copy to clipboard', 'error');
  });
}

// Handle create stream key form
document.addEventListener('DOMContentLoaded', function() {
  const createForm = document.getElementById('createStreamKeyForm');
  if (createForm) {
    createForm.addEventListener('submit', async function(e) {
      e.preventDefault();

      const channelUuid = getChannelUuidFromUrl();
      if (!channelUuid) return;

      const formData = {
        name: document.getElementById('streamKeyName').value.trim(),
        description: document.getElementById('streamKeyDescription').value.trim() || null,
        streamingProtocol: document.getElementById('streamingProtocol').value,
        enableManualSettings: document.getElementById('enableManualSettings').checked,
        manualResolution: document.getElementById('manualResolution').value,
        enable60fps: document.getElementById('enable60fps').checked
      };

      try {
        const response = await fetch(`/api/streamkeys/channel/${channelUuid}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(formData)
        });

        const result = await response.json();

        if (response.ok) {
          showNotification('Stream key created successfully!', 'success');
          closeCreateStreamKeyModal();
          loadStreamKeys(); // Reload the list
        } else {
          showNotification('Error: ' + (result.message || 'Failed to create stream key'), 'error');
        }
      } catch (error) {
        console.error('Error creating stream key:', error);
        showNotification('An error occurred while creating the stream key', 'error');
      }
    });
  }

  // Handle edit stream key form
  const editForm = document.getElementById('editStreamKeyForm');
  if (editForm) {
    editForm.addEventListener('submit', async function(e) {
      e.preventDefault();

      const streamKeyId = document.getElementById('editStreamKeyId').value;
      const formData = {
        name: document.getElementById('editStreamKeyName').value.trim(),
        description: document.getElementById('editStreamKeyDescription').value.trim() || null,
        streamingProtocol: document.getElementById('editStreamingProtocol').value
        // Note: Manual settings fields are disabled and cannot be changed after creation
        // The backend will preserve the original values for enableManualSettings, manualResolution, and enable60fps
      };

      try {
        const response = await fetch(`/api/streamkeys/${streamKeyId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(formData)
        });

        const result = await response.json();

        if (response.ok) {
          showNotification('Stream key updated successfully!', 'success');
          closeEditStreamKeyModal();
          loadStreamKeys(); // Reload the list
        } else {
          showNotification('Error: ' + (result.message || 'Failed to update stream key'), 'error');
        }
      } catch (error) {
        console.error('Error updating stream key:', error);
        showNotification('An error occurred while updating the stream key', 'error');
      }
    });
  }
});

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
  // Set first tab as active
  switchTab('channel');

  // Load stream keys when stream keys tab is active
  const streamKeysTab = document.getElementById('tab-streamkeys');
  if (streamKeysTab) {
    streamKeysTab.addEventListener('click', function() {
      setTimeout(() => loadStreamKeys(), 100); // Small delay to ensure tab is active
    });
  }

  // Load YouTube stream key if OAuth is connected (legacy)
  const channelUuid = getChannelUuidFromUrl();
  if (channelUuid) {
    // Check if YouTube analytics section exists (indicates OAuth connection)
    const youtubeSection = document.querySelector('.mt-8.mb-6 .text-lg.font-semibold.text-white');
    if (youtubeSection && youtubeSection.textContent.includes('YouTube Channel Analytics')) {
      // DISABLED: Legacy functionality that creates new YouTube streams automatically
      // refreshStreamKey();
      console.log('🔍 DEBUG: Legacy YouTube stream key auto-loading disabled');
    }
  }
});

// ============================================
// STREAM KEY DROPDOWN FUNCTIONS
// ============================================

function toggleStreamKeyDropdown() {
  const dropdown = document.getElementById('streamKeyDropdown');
  if (dropdown) {
    dropdown.classList.toggle('hidden');
  }
}

// Close dropdown when clicking outside
document.addEventListener('click', function(event) {
  const dropdown = document.getElementById('streamKeyDropdown');
  const button = document.getElementById('streamKeyDropdownBtn');

  if (dropdown && button) {
    if (!button.contains(event.target) && !dropdown.contains(event.target)) {
      dropdown.classList.add('hidden');
    }
  }
});

function syncFromYouTubeStudio() {
  const channelUuid = getChannelUuidFromUrl();
  if (!channelUuid) {
    showNotification('Channel UUID not found', 'error');
    return;
  }

  // Close dropdown
  const dropdown = document.getElementById('streamKeyDropdown');
  if (dropdown) {
    dropdown.classList.add('hidden');
  }

  // Show loading
  showNotification('Syncing stream keys from YouTube Studio...', 'info');

  fetch(`/api/streamkeys/sync-youtube/${channelUuid}`, {
    method: 'POST'
  })
  .then(response => response.json())
  .then(result => {
    if (result.success) {
      showNotification(`Successfully synced ${result.data.syncedCount} stream keys from YouTube Studio!`, 'success');
      loadStreamKeys(); // Reload the list
    } else {
      showNotification('Error: ' + (result.message || 'Failed to sync from YouTube Studio'), 'error');
    }
  })
  .catch(error => {
    console.error('Error syncing from YouTube Studio:', error);
    showNotification('An error occurred while syncing from YouTube Studio', 'error');
  });
}
