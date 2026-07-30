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
        <td colspan="6" class="px-6 py-20 text-center">
          <div class="flex flex-col items-center gap-3">
            <div class="w-16 h-16 bg-gray-800/50 rounded-2xl flex items-center justify-center border border-gray-700/50 mb-2">
              <i class="ti ti-users-off text-3xl text-gray-600"></i>
            </div>
            <p class="text-gray-500 font-medium">No users found matching your filters</p>
          </div>
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
    const videoSizeMB = videoSize > 0 ? (videoSize / (1024 * 1024)).toFixed(1) : '0';

    // Broadcast/Stream stats
    const streamCount = user.broadcast_count || 0;
    const onlineStreams = user.online_streams || 0;

    return `
      <tr class="hover:bg-gray-700/30 transition-all duration-300 group">
        <td class="px-6 py-5">
          <div class="flex items-center gap-4">
            <div class="w-11 h-11 bg-gradient-to-br ${isAdmin ? 'from-purple-600 to-pink-700' : 'from-blue-600 to-indigo-700'} rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-lg border-2 border-white/10 overflow-hidden">
               ${user.profile_picture ? `<img src="${user.profile_picture}" class="w-full h-full object-cover">` : user.username.charAt(0).toUpperCase()}
            </div>
            <div class="min-w-0">
              <p class="text-white font-bold truncate group-hover:text-blue-400 transition-colors">${escapeHtml(user.username)}</p>
              <div class="flex items-center gap-2 mt-0.5">
                <span class="text-[10px] text-gray-500 font-mono">ID: ${escapeHtml((user.account_uuid || user.account_id).toString().substring(0, 8))}...</span>
              </div>
            </div>
          </div>
        </td>
        <td class="px-6 py-5">
          <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${isAdmin ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'}">
            <i class="ti ${isAdmin ? 'ti-shield' : 'ti-user'} text-xs"></i>
            ${isAdmin ? 'Administrator' : 'Member'}
          </span>
        </td>
        <td class="px-6 py-5">
          <button
            onclick="toggleUserStatus(${user.account_id}, ${isActive})"
            class="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all duration-300 ${isActive ? 'bg-green-500/10 text-green-500 hover:bg-green-500/20 border border-green-500/20' : 'bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-500/20'}"
          >
            <div class="w-1.5 h-1.5 rounded-full ${isActive ? 'bg-green-500' : 'bg-red-500'}"></div>
            ${isActive ? 'Active' : 'Deactivated'}
          </button>
        </td>
        <td class="px-6 py-5 hidden md:table-cell">
          <div class="flex flex-col gap-1.5">
            <div class="flex items-center gap-2 text-xs font-semibold text-gray-300">
              <i class="ti ti-video text-blue-400"></i>
              <span>${videoCount} Files <span class="text-gray-500 font-normal">(${videoSizeMB}MB)</span></span>
            </div>
            <div class="flex items-center gap-2 text-xs font-semibold text-gray-300">
              <i class="ti ti-broadcast text-purple-400"></i>
              <span>${streamCount} Broadcasts ${onlineStreams > 0 ? `<span class="bg-green-500/20 text-green-500 px-1 rounded text-[9px]">${onlineStreams} Live</span>` : ''}</span>
            </div>
          </div>
        </td>
        <td class="px-6 py-5 text-gray-400 text-xs font-medium hidden lg:table-cell">
          <div class="flex items-center gap-2">
            <i class="ti ti-calendar text-gray-600"></i>
            ${createdDate}
          </div>
        </td>
        <td class="px-6 py-5 text-right">
          <div class="flex items-center justify-end gap-2">
            <button
              onclick="openEditUserModal(${user.account_id})"
              class="w-9 h-9 flex items-center justify-center bg-gray-800/50 hover:bg-blue-500/20 text-blue-400 border border-gray-700/50 rounded-xl transition-all"
              title="Edit Permissions"
            >
              <i class="ti ti-settings text-lg"></i>
            </button>
            ${(!isAdmin || user.account_id !== 1) ? `
            <button
              onclick="openDeleteUserModal(${user.account_id})"
              class="w-9 h-9 flex items-center justify-center bg-gray-800/50 hover:bg-red-500/20 text-red-400 border border-gray-700/50 rounded-xl transition-all"
              title="Delete Account"
            >
              <i class="ti ti-trash text-lg"></i>
            </button>
            ` : '<div class="w-9"></div>'}
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
    <button
      onclick="goToPage(${Math.max(1, currentPage - 1)})"
      class="w-10 h-10 flex items-center justify-center bg-gray-800/50 hover:bg-gray-700 text-gray-400 hover:text-white rounded-xl border border-gray-700/50 transition-all ${currentPage === 1 ? 'opacity-30 cursor-not-allowed' : ''}"
      ${currentPage === 1 ? 'disabled' : ''}
    >
      <i class="ti ti-chevron-left"></i>
    </button>
  `;

  // Page numbers
  pageRange.forEach(page => {
    if (page === '...') {
      html += `<span class="w-10 h-10 flex items-center justify-center text-gray-600">...</span>`;
    } else {
      const isCurrent = page === currentPage;
      html += `
        <button
          onclick="goToPage(${page})"
          class="w-10 h-10 flex items-center justify-center rounded-xl border font-bold text-sm transition-all ${isCurrent
            ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-600/20'
            : 'bg-gray-800/50 border-gray-700/50 text-gray-400 hover:text-white hover:bg-gray-700'}"
          ${isCurrent ? 'disabled' : ''}
        >
          ${page}
        </button>
      `;
    }
  });

  // Next button
  html += `
    <button
      onclick="goToPage(${Math.min(totalPages, currentPage + 1)})"
      class="w-10 h-10 flex items-center justify-center bg-gray-800/50 hover:bg-gray-700 text-gray-400 hover:text-white rounded-xl border border-gray-700/50 transition-all ${currentPage === totalPages ? 'opacity-30 cursor-not-allowed' : ''}"
      ${currentPage === totalPages ? 'disabled' : ''}
    >
      <i class="ti ti-chevron-right"></i>
    </button>
  `;

  paginationButtons.innerHTML = html;

  // Update info text
  const startIdx = (currentPage - 1) * itemsPerPage + 1;
  const endIdx = Math.min(currentPage * itemsPerPage, totalItems);
  paginationInfo.innerHTML = `Showing <span class="text-white font-bold">${startIdx}-${endIdx}</span> of <span class="text-white font-bold">${totalItems}</span> members`;

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
