/**
 * User Management JavaScript
 * Handles CRUD operations for user accounts
 */

let allUsers = [];
let filteredUsers = [];
let currentPage = 1;
const itemsPerPage = 10;

// Load users on page load
document.addEventListener('DOMContentLoaded', function() {
  loadUsers();
  loadStats();
});

/**
 * Preview profile picture before upload
 */
function previewProfilePicture(event) {
  const file = event.target.files[0];
  const preview = document.getElementById('profilePreview');
  
  if (file) {
    const reader = new FileReader();
    reader.onload = function(e) {
      preview.innerHTML = `<img src="${e.target.result}" alt="Preview" class="w-full h-full object-cover" />`;
    };
    reader.readAsDataURL(file);
  } else {
    preview.innerHTML = '<i class="ti ti-user text-3xl"></i>';
  }
}

/**
 * Load all users
 */
async function loadUsers() {
  try {
    const response = await fetch('/api/users');
    const data = await response.json();

    if (data.success) {
      allUsers = data.users;
      filteredUsers = allUsers;
      currentPage = 1;
      renderUsersTable(filteredUsers);
    } else {
      showToast('Failed to load users', 'error');
    }
  } catch (error) {
    console.error('Load users error:', error);
    showToast('Error loading users', 'error');
  }
}

/**
 * Load user statistics
 */
async function loadStats() {
  try {
    const response = await fetch('/api/users/stats');
    const data = await response.json();

    if (data.success) {
      const stats = data.stats;
      document.getElementById('totalUsers').textContent = stats.total || 0;
      document.getElementById('activeUsers').textContent = stats.active || 0;
      document.getElementById('adminUsers').textContent = stats.admins || 0;
      document.getElementById('memberUsers').textContent = stats.members || 0;
    }
  } catch (error) {
    console.error('Load stats error:', error);
  }
}

/**
 * Filter users based on search and filters
 */
function filterUsers() {
  const searchTerm = document.getElementById('searchUsers').value.toLowerCase();
  const roleFilter = document.getElementById('filterRole').value;
  const statusFilter = document.getElementById('filterStatus').value;

  filteredUsers = allUsers.filter(user => {
    // Search filter
    const matchesSearch = !searchTerm || 
      user.username.toLowerCase().includes(searchTerm) ||
      user.email.toLowerCase().includes(searchTerm) ||
      (user.account_uuid && user.account_uuid.toLowerCase().includes(searchTerm));

    // Role filter
    const matchesRole = roleFilter === 'all' || user.account_role === roleFilter;

    // Status filter
    const matchesStatus = statusFilter === 'all' || 
      (statusFilter === 'active' && user.is_active === 1) ||
      (statusFilter === 'inactive' && user.is_active === 0);

    return matchesSearch && matchesRole && matchesStatus;
  });

  currentPage = 1;
  renderUsersTable(filteredUsers);
}

/**
 * Render users table
 */
function renderUsersTable(users) {
  const tbody = document.getElementById('usersTableBody');
  
  if (users.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="px-4 py-8 text-center text-gray-400">
          <i class="ti ti-users-off text-3xl"></i>
          <p class="mt-2">No users found</p>
        </td>
      </tr>
    `;
    hidePagination();
    return;
  }

  // Calculate pagination
  const totalPages = Math.ceil(users.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, users.length);
  const paginatedUsers = users.slice(startIndex, endIndex);

  tbody.innerHTML = paginatedUsers.map(user => {
    const isActive = user.is_active === 1;
    const isAdmin = user.account_role === 'admin';
    const createdDate = new Date(user.created_at).toLocaleDateString('en-GB');
    
    // Video stats
    const videoCount = user.video_count || 0;
    const videoSize = user.total_video_size || 0;
    const videoSizeMB = videoSize > 0 ? (videoSize / (1024 * 1024)).toFixed(2) : '0';
    
    // Broadcast/Stream stats
    const streamCount = user.broadcast_count || 0;
    const onlineStreams = user.online_streams || 0;

    return `
      <tr class="hover:bg-gray-750 transition-colors">
        <td class="px-4 py-4">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold text-sm">
              ${user.username.charAt(0).toUpperCase()}
            </div>
            <div class="min-w-0">
              <p class="text-white font-medium truncate">${escapeHtml(user.username)}</p>
              <p class="text-gray-400 text-xs truncate">ID: ${escapeHtml(user.account_uuid || user.account_id)}</p>
            </div>
          </div>
        </td>
        <td class="px-4 py-4">
          <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${isAdmin ? 'bg-pink-500/20 text-pink-400' : 'bg-pink-500/20 text-pink-400'}">
            ${isAdmin ? 'admin' : 'admin'}
          </span>
        </td>
        <td class="px-4 py-4">
          <button
            onclick="toggleUserStatus(${user.account_id}, ${isActive})"
            class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${isActive ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30' : 'bg-red-500/20 text-red-400 hover:bg-red-500/30'}"
          >
            ${isActive ? 'active' : 'inactive'}
          </button>
        </td>
        <td class="px-4 py-4 hidden md:table-cell">
          <div class="text-sm">
            <div class="flex items-center gap-1 text-gray-300">
              <i class="ti ti-video text-xs"></i>
              <span>${videoCount} video</span>
            </div>
            ${videoCount > 0 ? `<div class="text-gray-500 text-xs mt-0.5">${videoSizeMB} MB</div>` : ''}
          </div>
        </td>
        <td class="px-4 py-4 hidden md:table-cell">
          <div class="text-sm">
            <div class="flex items-center gap-1 text-gray-300">
              <i class="ti ti-broadcast text-xs"></i>
              <span>${streamCount} stream</span>
            </div>
            ${streamCount > 0 ? `<div class="text-green-400 text-xs mt-0.5">${onlineStreams} online</div>` : ''}
          </div>
        </td>
        <td class="px-4 py-4 text-gray-400 text-sm hidden lg:table-cell">
          ${createdDate}
        </td>
        <td class="px-4 py-4">
          <div class="flex items-center justify-end gap-2">
            <button
              onclick="openEditUserModal(${user.account_id})"
              class="p-1.5 text-blue-400 hover:bg-blue-500/20 rounded transition-colors"
              title="Edit user"
            >
              <i class="ti ti-edit text-lg"></i>
            </button>
            ${!isAdmin || user.account_id !== 1 ? `
            <button
              onclick="openDeleteUserModal(${user.account_id})"
              class="p-1.5 text-red-400 hover:bg-red-500/20 rounded transition-colors"
              title="Delete user"
            >
              <i class="ti ti-trash text-lg"></i>
            </button>
            ` : ''}
          </div>
        </td>
      </tr>
    `;
  }).join('');

  // Render pagination
  renderPagination(users.length, totalPages);
}

/**
 * Render pagination controls
 */
function renderPagination(totalItems, totalPages) {
  const paginationButtons = document.getElementById('paginationButtons');
  const paginationInfo = document.getElementById('paginationInfo');
  
  if (totalItems === 0) {
    hidePagination();
    return;
  }

  // Generate page range
  const pageRange = getPageRange(currentPage, totalPages);
  
  let html = '';
  
  // Previous button
  html += `
    <a
      href="#"
      onclick="goToPage(${Math.max(1, currentPage - 1)}); return false;"
      class="w-8 h-8 flex items-center justify-center bg-gray-800 hover:bg-gray-700 rounded transition ${currentPage === 1 ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''}"
      ${currentPage === 1 ? 'onclick="event.preventDefault()"' : ''}
    >
      <i class="ti ti-chevron-left"></i>
    </a>
  `;

  // Page numbers
  pageRange.forEach(page => {
    if (page === '...') {
      html += `<span class="w-8 h-8 flex items-center justify-center text-gray-500">...</span>`;
    } else if (page === currentPage) {
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
          onclick="goToPage(${page}); return false;"
          class="w-8 h-8 flex items-center justify-center bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white rounded transition"
        >
          ${page}
        </a>
      `;
    }
  });

  // Next button
  html += `
    <a
      href="#"
      onclick="goToPage(${Math.min(totalPages, currentPage + 1)}); return false;"
      class="w-8 h-8 flex items-center justify-center bg-gray-800 hover:bg-gray-700 rounded transition ${currentPage === totalPages ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''}"
      ${currentPage === totalPages ? 'onclick="event.preventDefault()"' : ''}
    >
      <i class="ti ti-chevron-right"></i>
    </a>
  `;

  paginationButtons.innerHTML = html;

  // Update info text
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
  paginationInfo.innerHTML = `Showing ${startIndex + 1}-${endIndex} of ${totalItems} users | Page ${currentPage} of ${totalPages}`;
  
  // Show pagination
  document.getElementById('paginationContainer').classList.remove('hidden');
}

/**
 * Hide pagination
 */
function hidePagination() {
  document.getElementById('paginationContainer').classList.add('hidden');
}

/**
 * Generate page range for pagination
 */
function getPageRange(current, total, range = 2) {
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
function goToPage(page) {
  currentPage = Math.max(1, Math.min(page, Math.ceil(filteredUsers.length / itemsPerPage)));
  renderUsersTable(filteredUsers);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/**
 * Open create user modal
 */
function openCreateUserModal() {
  document.getElementById('createUserModal').classList.remove('hidden');
  document.getElementById('createUserForm').reset();
}

/**
 * Close create user modal
 */
function closeCreateUserModal() {
  document.getElementById('createUserModal').classList.add('hidden');
  document.getElementById('profilePreview').innerHTML = '<i class="ti ti-user text-3xl"></i>';
  document.getElementById('profilePictureInput').value = '';
}

/**
 * Handle create user form submission
 */
document.getElementById('createUserForm').addEventListener('submit', async function(e) {
  e.preventDefault();

  const formData = new FormData(this);
  
  // Create JSON data (profile picture akan di-handle terpisah di future update)
  const data = {
    username: formData.get('username'),
    password: formData.get('password'),
    role: formData.get('role'),
    status: formData.get('status'),
    _csrf: formData.get('_csrf')
  };

  try {
    const response = await fetch('/api/users', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });

    const result = await response.json();

    if (result.success) {
      showToast('User created successfully', 'success');
      closeCreateUserModal();
      // Reset profile preview
      document.getElementById('profilePreview').innerHTML = '<i class="ti ti-user text-3xl"></i>';
      document.getElementById('profilePictureInput').value = '';
      loadUsers();
      loadStats();
    } else {
      showToast(result.message || 'Failed to create user', 'error');
    }
  } catch (error) {
    console.error('Create user error:', error);
    showToast('Error creating user', 'error');
  }
});

/**
 * Open edit user modal
 */
function openEditUserModal(userId) {
  const user = allUsers.find(u => u.account_id === userId);
  if (!user) return;

  document.getElementById('editUserId').value = userId;
  document.getElementById('editUserRole').value = user.account_role;
  document.getElementById('editUserPassword').value = '';
  document.getElementById('editUserModal').classList.remove('hidden');
}

/**
 * Close edit user modal
 */
function closeEditUserModal() {
  document.getElementById('editUserModal').classList.add('hidden');
}

/**
 * Save user changes
 */
async function saveUserChanges() {
  const userId = document.getElementById('editUserId').value;
  const newRole = document.getElementById('editUserRole').value;
  const newPassword = document.getElementById('editUserPassword').value;

  try {
    // Update role
    const roleResponse = await fetch(`/api/users/${userId}/role`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ role: newRole })
    });

    const roleResult = await roleResponse.json();

    if (!roleResult.success) {
      showToast(roleResult.message || 'Failed to update role', 'error');
      return;
    }

    // Update password if provided
    if (newPassword && newPassword.length >= 6) {
      const passwordResponse = await fetch(`/api/users/${userId}/password`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ password: newPassword })
      });

      const passwordResult = await passwordResponse.json();

      if (!passwordResult.success) {
        showToast(passwordResult.message || 'Failed to update password', 'error');
        return;
      }
    }

    showToast('User updated successfully', 'success');
    closeEditUserModal();
    loadUsers();
    loadStats();
  } catch (error) {
    console.error('Update user error:', error);
    showToast('Error updating user', 'error');
  }
}

/**
 * Toggle user status
 */
async function toggleUserStatus(userId, currentStatus) {
  const newStatus = !currentStatus;

  try {
    const response = await fetch(`/api/users/${userId}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ isActive: newStatus })
    });

    const result = await response.json();

    if (result.success) {
      showToast(result.message, 'success');
      loadUsers();
      loadStats();
    } else {
      showToast(result.message || 'Failed to update status', 'error');
    }
  } catch (error) {
    console.error('Toggle status error:', error);
    showToast('Error updating status', 'error');
  }
}

/**
 * Open delete user modal
 */
function openDeleteUserModal(userId) {
  const user = allUsers.find(u => u.account_id === userId);
  if (!user) return;

  document.getElementById('deleteUserId').value = userId;
  document.getElementById('deleteUserName').textContent = user.username;
  document.getElementById('deleteUserModal').classList.remove('hidden');
}

/**
 * Close delete user modal
 */
function closeDeleteUserModal() {
  document.getElementById('deleteUserModal').classList.add('hidden');
}

/**
 * Confirm delete user
 */
async function confirmDeleteUser() {
  const userId = document.getElementById('deleteUserId').value;

  try {
    const response = await fetch(`/api/users/${userId}`, {
      method: 'DELETE'
    });

    const result = await response.json();

    if (result.success) {
      showToast('User deleted successfully', 'success');
      closeDeleteUserModal();
      loadUsers();
      loadStats();
    } else {
      showToast(result.message || 'Failed to delete user', 'error');
    }
  } catch (error) {
    console.error('Delete user error:', error);
    showToast('Error deleting user', 'error');
  }
}

/**
 * Show toast notification
 */
function showToast(message, type = 'info') {
  // Create toast element
  const toast = document.createElement('div');
  toast.className = `fixed bottom-4 right-4 px-6 py-3 rounded-lg shadow-lg z-50 flex items-center gap-3 transform transition-all duration-300 ${
    type === 'success' ? 'bg-green-600' :
    type === 'error' ? 'bg-red-600' :
    'bg-blue-600'
  }`;

  const icon = type === 'success' ? 'ti-check' :
               type === 'error' ? 'ti-alert-circle' :
               'ti-info-circle';

  toast.innerHTML = `
    <i class="ti ${icon} text-white text-xl"></i>
    <span class="text-white font-medium">${message}</span>
  `;

  document.body.appendChild(toast);

  // Auto remove after 3 seconds
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(20px)';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
  // Handle null, undefined, and non-string values
  if (text == null) return '';
  if (typeof text !== 'string') text = String(text);
  
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

// Close modals when clicking outside
window.addEventListener('click', function(event) {
  const createModal = document.getElementById('createUserModal');
  const editModal = document.getElementById('editUserModal');
  const deleteModal = document.getElementById('deleteUserModal');

  if (event.target === createModal) {
    closeCreateUserModal();
  }
  if (event.target === editModal) {
    closeEditUserModal();
  }
  if (event.target === deleteModal) {
    closeDeleteUserModal();
  }
});
