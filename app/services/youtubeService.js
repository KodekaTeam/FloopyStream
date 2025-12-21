const { google } = require('googleapis');
const { fetchOne } = require('../core/database');
const { parseNumericString } = require('../utils/numberHelpers');

/**
 * YouTube Service for FLoopyStream
 * Handles YouTube API interactions for channel analytics
 */

class YouTubeService {
  constructor() {
    this.youtube = null;
    this.oauth2Client = null;
    this.oauthUuid = null;
    this.initialized = false;
  }

  /**
   * Initialize YouTube API client with OAuth credentials
   */
  async initializeWithOAuth(oauthRecord) {
    if (!oauthRecord || !oauthRecord.access_token) {
      throw new Error('Invalid OAuth record or missing access token');
    }

    // Check if token is expired and try to refresh if needed
    if (this.isTokenExpired(oauthRecord)) {
      // Try to refresh the token automatically
      try {
        const refreshed = await this.refreshOAuthToken(oauthRecord);
        if (!refreshed) {
          // If refresh failed due to missing refresh token, don't disconnect
          // Just throw error to indicate refresh is needed
          throw new Error('OAuth token expired and no refresh token available. Please reconnect OAuth to get a new refresh token.');
        }
        // Token was refreshed, continue with initialization
      } catch (refreshError) {
        console.error('Failed to refresh OAuth token:', refreshError);
        // Don't disconnect here - let the user reconnect manually
        throw refreshError;
      }
    }

    const oauth2Client = new google.auth.OAuth2(
      oauthRecord.client_id,
      oauthRecord.client_secret,
      process.env.GOOGLE_REDIRECT_URI || `${process.env.APP_URL || 'http://localhost:6060'}/api/oauth/google/callback`
    );

    oauth2Client.setCredentials({
      access_token: oauthRecord.access_token,
      refresh_token: oauthRecord.refresh_token,
      token_type: oauthRecord.token_type,
      // googleapis expects expiry_date as milliseconds since epoch
      expiry_date: oauthRecord.expiry_date ? new Date(oauthRecord.expiry_date).getTime() : undefined
    });

    // Persist refreshed tokens automatically.
    // googleapis will emit new tokens when it refreshes access_token under the hood.
    if (!oauth2Client.__floopyTokensListenerAttached) {
      oauth2Client.__floopyTokensListenerAttached = true;
      oauth2Client.on('tokens', async (tokens) => {
        try {
          if (!tokens || (!tokens.access_token && !tokens.refresh_token && !tokens.expiry_date)) {
            return;
          }

          const { executeQuery } = require('../core/database');
          await executeQuery(`
            UPDATE oauth_credentials
            SET access_token = COALESCE(?, access_token),
                refresh_token = COALESCE(?, refresh_token),
                token_type = COALESCE(?, token_type),
                expiry_date = COALESCE(?, expiry_date),
                updated_at = CURRENT_TIMESTAMP
            WHERE oauth_uuid = ?
          `, [
            tokens.access_token || null,
            tokens.refresh_token || null,
            tokens.token_type || null,
            tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
            oauthRecord.oauth_uuid
          ]);

          // Keep in-memory record consistent for callers.
          if (tokens.access_token) oauthRecord.access_token = tokens.access_token;
          if (tokens.refresh_token) oauthRecord.refresh_token = tokens.refresh_token;
          if (tokens.token_type) oauthRecord.token_type = tokens.token_type;
          if (tokens.expiry_date) oauthRecord.expiry_date = new Date(tokens.expiry_date).toISOString();
        } catch (error) {
          console.error('Failed to persist refreshed OAuth tokens:', error.message);
        }
      });
    }

    this.youtube = google.youtube({
      version: 'v3',
      auth: oauth2Client
    });

    this.oauth2Client = oauth2Client;
    this.oauthUuid = oauthRecord.oauth_uuid;
    this.initialized = true;
    return true;
  }

  /**
   * Check if OAuth token is expired
   */
  isTokenExpired(oauthRecord) {
    if (!oauthRecord.expiry_date) return false;

    const expiryDate = new Date(oauthRecord.expiry_date);
    const now = new Date();

    // Add 5 minute buffer
    const bufferTime = 5 * 60 * 1000; // 5 minutes in milliseconds
    return (expiryDate.getTime() - bufferTime) < now.getTime();
  }

  /**
   * Refresh OAuth token
   */
  async refreshOAuthToken(oauthRecord) {
    try {
      if (!oauthRecord.refresh_token) {
        return false;
      }

      const oauth2Client = new google.auth.OAuth2(
        oauthRecord.client_id,
        oauthRecord.client_secret,
        process.env.GOOGLE_REDIRECT_URI || `${process.env.APP_URL || 'http://localhost:6060'}/api/oauth/google/callback`
      );

      oauth2Client.setCredentials({
        refresh_token: oauthRecord.refresh_token
      });

      let refreshResult;
      if (typeof oauth2Client.refreshAccessToken === 'function') {
        refreshResult = await oauth2Client.refreshAccessToken();
      } else if (typeof oauth2Client.refreshToken === 'function') {
        refreshResult = await oauth2Client.refreshToken(oauthRecord.refresh_token);
      } else {
        refreshResult = await oauth2Client.getAccessToken();
      }

      const newTokens = (refreshResult && refreshResult.credentials)
        || (refreshResult && refreshResult.tokens)
        || oauth2Client.credentials
        || {};

      const accessToken = newTokens.access_token
        || (refreshResult && refreshResult.token)
        || (typeof refreshResult === 'string' ? refreshResult : null)
        || oauth2Client.credentials?.access_token;

      if (!accessToken) {
        console.error('OAuth refresh succeeded but no access_token was returned');
        return false;
      }

      // Update database
      const { executeQuery } = require('../core/database');
      await executeQuery(`
        UPDATE oauth_credentials
        SET access_token = ?, refresh_token = ?, token_type = ?, expiry_date = ?, updated_at = CURRENT_TIMESTAMP
        WHERE oauth_uuid = ?
      `, [
        accessToken,
        newTokens.refresh_token || oauthRecord.refresh_token,
        newTokens.token_type,
        newTokens.expiry_date ? new Date(newTokens.expiry_date).toISOString() : null,
        oauthRecord.oauth_uuid
      ]);

      // Update the oauthRecord object with new tokens
      oauthRecord.access_token = accessToken;
      oauthRecord.refresh_token = newTokens.refresh_token || oauthRecord.refresh_token;
      oauthRecord.token_type = newTokens.token_type;
      oauthRecord.expiry_date = newTokens.expiry_date ? new Date(newTokens.expiry_date).toISOString() : null;

      console.log(`✓ Refreshed OAuth token for ${oauthRecord.oauth_uuid}`);
      return true;

    } catch (error) {
      console.error('Error refreshing OAuth token:', error);
      return false;
    }
  }

  /**
   * Check OAuth connection status
   */
  async checkConnectionStatus(oauthUuid) {
    try {
      const oauthRecord = await fetchOne(
        'SELECT * FROM oauth_credentials WHERE oauth_uuid = ? AND provider = ?',
        [oauthUuid, 'google']
      );

      if (!oauthRecord) {
        return { connected: false, reason: 'OAuth record not found' };
      }

      if (!oauthRecord.refresh_token) {
        return { connected: false, reason: 'No refresh token available. Please reconnect OAuth.' };
      }

      if (this.isTokenExpired(oauthRecord)) {
        // Proactively refresh so the connection stays up.
        const refreshed = await this.refreshOAuthToken(oauthRecord);
        if (refreshed) {
          return { connected: true, expiresAt: oauthRecord.expiry_date, refreshed: true };
        }

        return { connected: false, reason: 'Access token expired and could not be refreshed. Please reconnect OAuth.' };
      }

      return { connected: true, expiresAt: oauthRecord.expiry_date };
    } catch (error) {
      console.error('Error checking OAuth status:', error);
      return { connected: false, reason: 'Error checking connection status' };
    }
  }

  /**
   * Get channel information by channel ID, username, or handle
   */
  async getChannelInfo(channelIdentifier) {
    if (!this.initialized) {
      throw new Error('YouTube service not initialized');
    }

    // Clean up the identifier
    let identifier = channelIdentifier?.trim();
    if (!identifier) {
      throw new Error('Channel identifier is required');
    }

    // Remove @ if present
    if (identifier.startsWith('@')) {
      identifier = identifier.substring(1);
    }

    try {
      let channelResponse;
      let channelId = null;

      // Method 1: Try as channel ID (starts with UC)
      if (identifier.startsWith('UC') && identifier.length === 24) {
        // console.log('Trying as channel ID:', identifier);
        channelResponse = await this.youtube.channels.list({
          part: 'snippet,statistics,brandingSettings,status,topicDetails',
          id: identifier,
          maxResults: 1
        });

        if (channelResponse.data.items && channelResponse.data.items.length > 0) {
          // console.log('Found channel by ID');
          return this.formatChannelData(channelResponse.data.items[0]);
        }
      }

      // Method 2: Try as username (legacy)
      // console.log('Trying as username:', identifier);
      try {
        channelResponse = await this.youtube.channels.list({
          part: 'snippet,statistics,brandingSettings,status,topicDetails',
          forUsername: identifier,
          maxResults: 1
        });

        if (channelResponse.data.items && channelResponse.data.items.length > 0) {
          console.log('Found channel by username');
          return this.formatChannelData(channelResponse.data.items[0]);
        }
      } catch (error) {
        console.log('Username search failed:', error.message);
      }

      // Method 3: Try as handle using search API
      // console.log('Trying as handle via search:', identifier);
      const searchResponse = await this.youtube.search.list({
        part: 'snippet',
        q: identifier,
        type: 'channel',
        maxResults: 5 // Get more results to find the right one
      });

      if (searchResponse.data.items && searchResponse.data.items.length > 0) {
        // Look for exact match first
        let bestMatch = null;
        for (const item of searchResponse.data.items) {
          const title = item.snippet.title.toLowerCase();
          const searchTerm = identifier.toLowerCase();

          // Check if title contains the search term or vice versa
          if (title.includes(searchTerm) || searchTerm.includes(title)) {
            bestMatch = item;
            break;
          }
        }

        // If no good match, take the first result
        if (!bestMatch) {
          bestMatch = searchResponse.data.items[0];
        }

        channelId = bestMatch.snippet.channelId;
        // console.log('Found channel via search, ID:', channelId);

        // Get full channel details
        channelResponse = await this.youtube.channels.list({
          part: 'snippet,statistics,brandingSettings,status,topicDetails',
          id: channelId,
          maxResults: 1
        });

        if (channelResponse.data.items && channelResponse.data.items.length > 0) {
          // console.log('Retrieved full channel data');
          return this.formatChannelData(channelResponse.data.items[0]);
        }
      }

      throw new Error('Channel not found with any method');

    } catch (error) {
      console.error('Error fetching YouTube channel info:', error);
      throw new Error(`Failed to fetch channel information: ${error.message}`);
    }
  }

  /**
   * Format channel data from YouTube API response
   */
  formatChannelData(channel) {
    const snippet = channel.snippet;
    const statistics = channel.statistics;
    const branding = channel.brandingSettings || {};
    const status = channel.status || {};

    return {
      channelId: channel.id,
      title: snippet.title,
      description: snippet.description,
      publishedAt: snippet.publishedAt,
      thumbnailUrl: snippet.thumbnails?.high?.url || snippet.thumbnails?.default?.url,
      subscriberCount: parseNumericString(statistics.subscriberCount),
      videoCount: parseNumericString(statistics.videoCount),
      viewCount: parseNumericString(statistics.viewCount),
      customUrl: snippet.customUrl,
      country: snippet.country,
      bannerUrl: branding.image?.bannerExternalUrl,
      isVerified: snippet.isVerified === true,
      monetizationStatus: status.monetizationStatus || null
    };
  }

  /**
   * Get channel analytics for a specific OAuth connection
   */
  async getChannelAnalytics(oauthUuid) {
    try {
      // Get OAuth record
      const oauthRecord = await fetchOne(
        'SELECT * FROM oauth_credentials WHERE oauth_uuid = ? AND provider = ?',
        [oauthUuid, 'google']
      );

      if (!oauthRecord) {
        throw new Error('OAuth record not found');
      }

      // Initialize with OAuth
      await this.initializeWithOAuth(oauthRecord);

      // Get channel info using the external ID from OAuth or channel record
      const channelRecord = await fetchOne(
        'SELECT external_id FROM channels WHERE channel_uuid = ?',
        [oauthRecord.channel_uuid]
      );

      let channelId = channelRecord?.external_id;

      // If external_id is not set, try to fetch it from YouTube
      if (!channelId) {
        try {
          const youtube = require('googleapis').google.youtube({
            version: 'v3',
            auth: this.oauth2Client
          });

          const channelResponse = await youtube.channels.list({
            part: 'id',
            mine: true
          });

          if (channelResponse.data.items && channelResponse.data.items.length > 0) {
            channelId = channelResponse.data.items[0].id;
            
            // Save it for future use
            const { executeQuery } = require('../core/database');
            await executeQuery(
              'UPDATE channels SET external_id = ? WHERE channel_uuid = ?',
              [channelId, oauthRecord.channel_uuid]
            );
          }
        } catch (youtubeError) {
          console.warn('Could not auto-fetch YouTube channel ID:', youtubeError.message);
        }
      }

      if (!channelId) {
        throw new Error('YouTube channel ID not found. Please reconnect your YouTube account.');
      }

      const channelInfo = await this.getChannelInfo(channelId);

      return {
        success: true,
        data: channelInfo,
        fetchedAt: new Date().toISOString()
      };

    } catch (error) {
      console.error('Error fetching YouTube analytics:', error);
      return {
        success: false,
        error: error.message,
        fetchedAt: new Date().toISOString()
      };
    }
  }

  /**
   * Get recent videos from channel
   */
  async getRecentVideos(channelId, maxResults = 10) {
    if (!this.initialized) {
      throw new Error('YouTube service not initialized');
    }

    try {
      const response = await this.youtube.search.list({
        part: 'snippet',
        channelId: channelId,
        order: 'date',
        type: 'video',
        maxResults: maxResults
      });

      return response.data.items.map(item => ({
        videoId: item.id.videoId,
        title: item.snippet.title,
        description: item.snippet.description,
        publishedAt: item.snippet.publishedAt,
        thumbnailUrl: item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.default?.url
      }));

    } catch (error) {
      console.error('Error fetching recent videos:', error);
      throw error;
    }
  }

  /**
   * Get or create YouTube live stream key
   */
  async getStreamKey(oauthUuid) {
    try {
      // Get OAuth record
      const oauthRecord = await fetchOne(
        'SELECT * FROM oauth_credentials WHERE oauth_uuid = ? AND provider = ?',
        [oauthUuid, 'google']
      );

      if (!oauthRecord) {
        throw new Error('OAuth record not found');
      }

      // Initialize with OAuth
      await this.initializeWithOAuth(oauthRecord);

      // Get channel info to get channel ID
      const channelRecord = await fetchOne(
        'SELECT external_id FROM channels WHERE channel_uuid = ?',
        [oauthRecord.channel_uuid]
      );

      if (!channelRecord || !channelRecord.external_id) {
        throw new Error('Channel external ID not found. Please set the YouTube channel ID in channel settings.');
      }

      const channelInfo = await this.getChannelInfo(channelRecord.external_id);
      const channelId = channelInfo.channelId;

      // Check for existing live broadcasts
      const broadcastsResponse = await this.youtube.liveBroadcasts.list({
        part: 'id,snippet,status',
        broadcastStatus: 'active',
        broadcastType: 'persistent'
      });

      let broadcastId = null;
      let streamId = null;

      if (broadcastsResponse.data.items && broadcastsResponse.data.items.length > 0) {
        // Use existing broadcast
        broadcastId = broadcastsResponse.data.items[0].id;
        console.log('Using existing live broadcast:', broadcastId);
      } else {
        // Create a new persistent broadcast
        const createBroadcastResponse = await this.youtube.liveBroadcasts.insert({
          part: 'id,snippet,status,contentDetails',
          requestBody: {
            snippet: {
              title: 'FloopyStream Live Broadcast',
              description: 'Live stream from FloopyStream',
              scheduledStartTime: new Date().toISOString()
            },
            status: {
              privacyStatus: 'private',
              selfDeclaredMadeForKids: false
            },
            contentDetails: {
              enableAutoStart: false,
              enableAutoStop: false,
              enableClosedCaptions: false,
              enableDvr: true,
              enableEmbed: false,
              recordFromStart: true,
              startWithSlate: false
            }
          }
        });

        broadcastId = createBroadcastResponse.data.id;
        console.log('Created new live broadcast:', broadcastId);
      }

      // Get the stream bound to this broadcast
      const broadcastDetails = await this.youtube.liveBroadcasts.list({
        part: 'id,snippet,status,contentDetails',
        id: broadcastId
      });

      if (broadcastDetails.data.items && broadcastDetails.data.items.length > 0) {
        streamId = broadcastDetails.data.items[0].contentDetails?.boundStreamId;
      }

      if (!streamId) {
        // Create a new live stream if none exists
        const createStreamResponse = await this.youtube.liveStreams.insert({
          part: 'id,snippet,cdn,status',
          requestBody: {
            snippet: {
              title: 'FloopyStream Stream',
              description: 'Live stream from FloopyStream'
            },
            cdn: {
              format: '1080p',
              ingestionType: 'rtmp',
              resolution: '1080p',
              frameRate: '30fps'
            }
          }
        });

        streamId = createStreamResponse.data.id;
        console.log('Created new live stream:', streamId);

        // Bind the stream to the broadcast
        await this.youtube.liveBroadcasts.bind({
          id: broadcastId,
          part: 'id,snippet,status,contentDetails',
          streamId: streamId
        });
      }

      // Get stream details
      const streamDetails = await this.youtube.liveStreams.list({
        part: 'id,snippet,cdn,status',
        id: streamId
      });

      if (streamDetails.data.items && streamDetails.data.items.length > 0) {
        const stream = streamDetails.data.items[0];
        const streamKey = stream.cdn.ingestionInfo?.streamName;
        const rtmpUrl = stream.cdn.ingestionInfo?.ingestionAddress;

        return {
          success: true,
          data: {
            broadcastId: broadcastId,
            streamId: streamId,
            streamKey: streamKey,
            rtmpUrl: rtmpUrl,
            streamUrl: `${rtmpUrl}/${streamKey}`,
            title: stream.snippet.title,
            description: stream.snippet.description,
            status: stream.status.streamStatus
          },
          fetchedAt: new Date().toISOString()
        };
      }

      throw new Error('Failed to retrieve stream details');

    } catch (error) {
      console.error('Error getting YouTube stream key:', error);

      // Handle specific YouTube API errors
      let errorMessage = error.message;
      if (error.code === 403) {
        if (error.errors && error.errors[0]) {
          const reason = error.errors[0].reason;
          switch (reason) {
            case 'liveStreamingNotEnabled':
              errorMessage = 'Live streaming is not enabled for this YouTube channel. Please enable live streaming in your YouTube account settings.';
              break;
            case 'disableRecordingNotAllowed':
              errorMessage = 'Recording settings are not allowed for this channel. Please check your YouTube channel permissions.';
              break;
            default:
              errorMessage = `YouTube API permission error: ${error.errors[0].message}`;
          }
        }
      }

      return {
        success: false,
        error: errorMessage,
        fetchedAt: new Date().toISOString()
      };
    }
  }

  /**
   * Create a live stream only (no broadcast) in YouTube Studio and return ingestion info
   * This will be used when user wants to "Create Stream Key" without creating a scheduled broadcast
   */
  async createNewStreamKey(oauthUuid, options = {}) {
    try {
      const oauthRecord = await fetchOne(
        'SELECT * FROM oauth_credentials WHERE oauth_uuid = ? AND provider = ?',
        [oauthUuid, 'google']
      );

      if (!oauthRecord) {
        throw new Error('OAuth record not found');
      }

      await this.initializeWithOAuth(oauthRecord);

      const title = options.title || 'FloopyStream Stream';
      const description = options.description || 'Live stream from FloopyStream';
      const streamingProtocol = options.streamingProtocol || 'rtmp';
      const enableManualSettings = options.enableManualSettings || false;
      const manualResolution = options.manualResolution || '1080p';
      const enable60fps = options.enable60fps || false;

      // Set default CDN settings based on options
      let cdnSettings = {};

      if (enableManualSettings) {
        // Manual settings - use user-selected resolution and frame rate
        cdnSettings = {
          ingestionType: streamingProtocol,
          resolution: manualResolution,
          frameRate: enable60fps ? '60fps' : '30fps'
        };
      } else {
        // Auto settings - use YouTube's default quality (1080p 30fps)
        // Note: YouTube API requires resolution and frameRate fields even for auto mode
        cdnSettings = {
          ingestionType: streamingProtocol,
          resolution: "variable", // <-- FIX: gunakan variable
          frameRate: "variable", // <-- FIX: gunakan variable
        };
      }

      const createStreamResponse = await this.youtube.liveStreams.insert({
        part: 'id,snippet,cdn,status',
        requestBody: {
          snippet: {
            title: title,
            description: description
          },
          cdn: cdnSettings
        }
      });

      if (createStreamResponse.data) {
        const stream = createStreamResponse.data;
        const streamKey = stream.cdn?.ingestionInfo?.streamName;
        const rtmpUrl = stream.cdn?.ingestionInfo?.ingestionAddress;

        return {
          success: true,
          data: {
            streamId: stream.id,
            streamKey: streamKey,
            rtmpUrl: rtmpUrl,
            streamUrl: rtmpUrl && streamKey ? `${rtmpUrl}/${streamKey}` : null,
            title: stream.snippet.title,
            description: stream.snippet.description,
            status: stream.status?.streamStatus
          },
          fetchedAt: new Date().toISOString()
        };
      }

      throw new Error('Failed to create live stream');

    } catch (error) {
      console.error('Error creating YouTube live stream:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Update an existing YouTube live stream
   */
  async updateStream(oauthUuid, streamId, options = {}) {
    try {
      const oauthRecord = await fetchOne(
        'SELECT * FROM oauth_credentials WHERE oauth_uuid = ? AND provider = ?',
        [oauthUuid, 'google']
      );

      if (!oauthRecord) {
        throw new Error('OAuth record not found');
      }

      await this.initializeWithOAuth(oauthRecord);

      const title = options.title;
      const description = options.description;
      const cdnSettings = options.cdnSettings;

      // Prepare update request body
      const updateRequest = {
        id: streamId
      };

      // Only include fields that are provided and can be updated
      if (title !== undefined) {
        updateRequest.snippet = { title: title };
        if (description !== undefined) {
          updateRequest.snippet.description = description;
        }
      }

      // Note: CDN settings cannot be updated after stream creation
      // Only title and description can be modified

      const updateResponse = await this.youtube.liveStreams.update({
        part: 'id,snippet',
        requestBody: updateRequest
      });

      if (updateResponse.data) {
        return {
          success: true,
          data: updateResponse.data,
          fetchedAt: new Date().toISOString()
        };
      }

      throw new Error('Failed to update live stream');

    } catch (error) {
      console.error('Error updating YouTube live stream:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * List live stream resources for the connected OAuth account (stream keys managed in YouTube Studio)
   */
  async listStreamKeys(oauthUuid, maxResults = 50) {
    try {
      const oauthRecord = await fetchOne(
        'SELECT * FROM oauth_credentials WHERE oauth_uuid = ? AND provider = ?',
        [oauthUuid, 'google']
      );

      if (!oauthRecord) {
        throw new Error('OAuth record not found');
      }

      await this.initializeWithOAuth(oauthRecord);

      const response = await this.youtube.liveStreams.list({
        part: 'id,snippet,cdn,status',
        mine: true,
        maxResults
      });

      return { success: true, data: response.data.items || [] };
    } catch (error) {
      // Don't log the raw error details since we handle them specifically below
      // console.error('Error listing live streams:', error);

      // Handle specific YouTube API errors with more informative messages
      let errorMessage = error.message;
      if (error.code === 403) {
        if (error.errors && error.errors[0]) {
          const reason = error.errors[0].reason;
          switch (reason) {
            case 'liveStreamingNotEnabled':
              errorMessage = 'Live streaming is not enabled for this YouTube channel. Please enable live streaming in your YouTube account settings first, then try again.';
              break;
            case 'forbidden':
              errorMessage = 'Access to YouTube Live API is forbidden. Please check your YouTube channel permissions and OAuth scopes.';
              break;
            default:
              errorMessage = `YouTube API access denied: ${error.errors[0].message}`;
          }
        } else {
          errorMessage = 'YouTube API access denied. Please check your channel permissions and try reconnecting your YouTube account.';
        }
      } else if (error.code === 401) {
        errorMessage = 'YouTube OAuth token expired or invalid. Please reconnect your YouTube account.';
      }

      return { success: false, error: errorMessage };
    }
  }

  /**
   * Delete a YouTube live broadcast
   * @param {string} broadcastId - The YouTube broadcast ID to delete
   * @returns {Promise<Object>} - Result object with success/error status
   */
  async deleteBroadcast(broadcastId) {
    try {
      if (!this.youtube) {
        throw new Error('YouTube service not initialized');
      }

      if (!broadcastId) {
        throw new Error('Broadcast ID is required');
      }

      console.log('🗑️ Deleting YouTube broadcast:', broadcastId);

      await this.youtube.liveBroadcasts.delete({
        id: broadcastId
      });

      console.log('✅ Successfully deleted YouTube broadcast:', broadcastId);
      return { success: true, message: 'Broadcast deleted successfully' };
    } catch (error) {
      console.error('Error deleting YouTube broadcast:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Upload thumbnail for a YouTube video
   */
  async uploadThumbnail(videoId, thumbnailPath) {
    if (!this.initialized) {
      throw new Error('YouTube service not initialized');
    }

    try {
      console.log('📤 Uploading thumbnail for video:', videoId, 'from path:', thumbnailPath);

      const fs = require('fs');
      const path = require('path');
      
      // Check if thumbnail file exists
      if (!fs.existsSync(thumbnailPath)) {
        throw new Error(`Thumbnail file not found: ${thumbnailPath}`);
      }

      // Check file size (YouTube limit is 2MB)
      const stats = fs.statSync(thumbnailPath);
      const fileSizeMB = stats.size / (1024 * 1024);
      console.log('📊 Thumbnail file size:', fileSizeMB.toFixed(2), 'MB');

      if (fileSizeMB > 2) {
        throw new Error(`Thumbnail file too large: ${fileSizeMB.toFixed(2)}MB (max 2MB)`);
      }

      // Check file extension
      const ext = path.extname(thumbnailPath).toLowerCase();
      const allowedExts = ['.jpg', '.jpeg', '.gif', '.bmp', '.png'];
      if (!allowedExts.includes(ext)) {
        throw new Error(`Unsupported thumbnail format: ${ext} (allowed: ${allowedExts.join(', ')})`);
      }

      // Read thumbnail file
      const thumbnailData = fs.readFileSync(thumbnailPath);
      console.log('📖 Thumbnail file read successfully, size:', thumbnailData.length, 'bytes');

      // Determine MIME type
      let mimeType = 'image/jpeg';
      if (ext === '.png') mimeType = 'image/png';
      else if (ext === '.gif') mimeType = 'image/gif';
      else if (ext === '.bmp') mimeType = 'image/bmp';

      console.log('🎯 Uploading with MIME type:', mimeType);

      // Upload thumbnail using YouTube API
      const response = await this.youtube.thumbnails.set({
        videoId: videoId,
        media: {
          mimeType: mimeType,
          body: thumbnailData
        }
      });

      console.log('✅ Thumbnail uploaded successfully for video:', videoId);
      return { success: true, response: response.data };
    } catch (error) {
      console.error('❌ Error uploading thumbnail:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get broadcast status
   */
  async getBroadcastStatus(broadcastId) {
    try {
      if (!this.initialized) {
        throw new Error('YouTube service not initialized');
      }

      const response = await this.youtube.liveBroadcasts.list({
        part: 'id,status',
        id: broadcastId
      });

      if (response.data.items && response.data.items.length > 0) {
        return response.data.items[0].status.lifeCycleStatus;
      }

      return null;
    } catch (error) {
      console.error('Error getting broadcast status:', error);
      throw error;
    }
  }
}

// Create singleton instance
const youtubeService = new YouTubeService();

module.exports = youtubeService;