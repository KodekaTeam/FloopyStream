const axios = require('axios');

/**
 * GitHub Service - Handles GitHub API interactions
 */
class GitHubService {
  /**
   * Get latest commits from a GitHub repository
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {number} count - Number of commits to fetch (default: 10, will be filtered)
   * @returns {Promise<Array>} Array of filtered commit objects
   */
  static async getLatestCommits(owner, repo, count = 10) {
    try {
      const url = `https://api.github.com/repos/${owner}/${repo}/commits?per_page=${count}`;
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

      return filteredCommits;
    } catch (error) {
      console.error('Error fetching GitHub commits:', error.message);
      // Return empty array on error to prevent app crash
      return [];
    }
  }

  /**
   * Check if there are new commits since last check
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {string} lastSha - Last known commit SHA
   * @returns {Promise<boolean>} True if there are new commits
   */
  static async hasNewCommits(owner, repo, lastSha) {
    try {
      const commits = await this.getLatestCommits(owner, repo, 1);
      if (commits.length === 0) return false;
      return commits[0].sha !== lastSha;
    } catch (error) {
      console.error('Error checking for new commits:', error.message);
      return false;
    }
  }
}

module.exports = GitHubService;