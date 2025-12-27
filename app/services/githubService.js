const axios = require('axios');

/**
 * GitHub Service - Handles GitHub API interactions with caching
 */
class GitHubService {
  // Simple in-memory cache
  static cache = new Map();
  static CACHE_DURATION = 8 * 60 * 60 * 1000; // 8 hours in milliseconds

  /**
   * Get latest commits from a GitHub repository with caching
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {number} count - Number of commits to fetch (default: 10, will be filtered)
   * @returns {Promise<Array>} Array of filtered commit objects
   */
  static async getLatestCommits(owner, repo, count = 10) {
    const cacheKey = `${owner}/${repo}/commits`;
    const now = Date.now();

    // Check cache first
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (now - cached.timestamp < this.CACHE_DURATION) {
        // console.log('Returning cached GitHub commits');
        return cached.data;
      } else {
        // Cache expired, remove it
        this.cache.delete(cacheKey);
      }
    }

    try {
      const url = `https://api.github.com/repos/${owner}/${repo}/commits?per_page=${count}`;
    //   console.log(`Fetching GitHub commits from: ${url}`);
      
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'FloopyStream-App',
          'Accept': 'application/vnd.github.v3+json'
        },
        timeout: 5000 // 5 second timeout
      });

      if (response.status !== 200) {
        throw new Error(`GitHub API returned status ${response.status}`);
      }

      // Filter commits by conventional commit prefixes
      const relevantPrefixes = ['fix:', 'update:', 'feat:', 'chore:', 'docs:', 'style:', 'refactor:', 'test:', 'perf:', 'build:', 'ci:'];
      
      const filteredCommits = response.data
        .filter(commit => {
          const message = commit.commit.message.toLowerCase();
          return relevantPrefixes.some(prefix => message.startsWith(prefix.toLowerCase()));
        })
        .slice(0, 3) // Take only first 3 relevant commits
        .map(commit => ({
          sha: commit.sha,
          message: commit.commit.message.split('\n')[0], // First line of commit message
          author: {
            name: commit.commit.author.name,
            email: commit.commit.author.email,
            avatar_url: commit.author ? commit.author.avatar_url : null
          },
          date: commit.commit.author.date,
          html_url: commit.html_url,
          short_sha: commit.sha.substring(0, 7)
        }));

      // Cache the result
      this.cache.set(cacheKey, {
        data: filteredCommits,
        timestamp: now
      });

    //   console.log(`Successfully fetched and cached ${filteredCommits.length} GitHub commits`);
      return filteredCommits;
    } catch (error) {
    //   console.error('Error fetching GitHub commits:', error.message);
      
      // If we have cached data, return it even if expired (better than nothing)
      if (this.cache.has(cacheKey)) {
        const cached = this.cache.get(cacheKey);
        // console.log('Returning expired cached data due to API error');
        return cached.data;
      }
      
      // Cache empty result to prevent repeated API calls on errors
      this.cache.set(cacheKey, {
        data: [],
        timestamp: now
      });
      
      // Return empty array on error to prevent app crash
      return [];
    }
  }

  /**
   * Clear cache (useful for testing or manual refresh)
   */
  static clearCache() {
    this.cache.clear();
    // console.log('GitHub cache cleared');
  }
}

module.exports = GitHubService;