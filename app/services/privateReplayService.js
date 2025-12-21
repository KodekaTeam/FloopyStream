const axios = require('axios');
const { executeQuery, fetchOne } = require('../core/database');

/**
 * Private Replay Service
 * Handles automatic conversion of live streams to private replays when stream ends
 */
class PrivateReplayService {
  /**
   * Set video privacy to private on YouTube
   * @param {string} videoId - YouTube video ID
   * @param {string} accessToken - YouTube OAuth access token
   * @returns {object} - Result of privacy update
   */
  static async setVideoPrivate(videoId, accessToken) {
    try {
      await axios.put(
        `https://www.googleapis.com/youtube/v3/videos?part=status`,
        {
          id: videoId,
          status: {
            privacyStatus: 'private'
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log(`✓ Video ${videoId} set to private successfully`);
      return {
        success: true,
        videoId,
        message: 'Video set to private'
      };
    } catch (error) {
      const apiError = error.response?.data?.error;
      const reason = apiError?.errors?.[0]?.reason;
      const status = error.response?.status;
      const printable = apiError
        ? {
            status,
            message: apiError.message,
            reason
          }
        : error.message;

      console.error(`✗ Error setting video ${videoId} to private:`, printable);
      return {
        success: false,
        videoId,
        error: apiError?.message
          ? `${apiError.message}${reason ? ` (reason: ${reason})` : ''}`
          : error.message
      };
    }
  }

  /**
   * Get broadcast video ID from YouTube
   * @param {string} broadcastId - YouTube broadcast ID
   * @param {string} accessToken - YouTube OAuth access token
   * @returns {string|null} - YouTube video ID or null
   */
  static async getBroadcastVideoId(broadcastId, accessToken) {
    try {
      const response = await axios.get(
        'https://www.googleapis.com/youtube/v3/liveBroadcasts',
        {
          params: {
            part: 'contentDetails,status',
            id: broadcastId,
            key: process.env.YOUTUBE_API_KEY
          },
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        }
      );

      if (response.data.items && response.data.items.length > 0) {
        const broadcast = response.data.items[0];
        const lifeCycleStatus = broadcast.status?.lifeCycleStatus;
        
        // For completed broadcasts, the broadcast ID IS the video ID
        if (lifeCycleStatus === 'complete' || lifeCycleStatus === 'revoked') {
          console.log(`   ℹ️  Broadcast lifecycle status: ${lifeCycleStatus}`);
          console.log(`   ℹ️  Using broadcast ID as video ID for completed broadcast`);
          return broadcastId;
        }

        // While not finalized, YouTube may not have a real video ID ready.
        // recordedVideoId (when available) is a real video ID; boundStreamId is NOT.
        const recordedVideoId = broadcast.contentDetails?.recordedVideoId;
        if (recordedVideoId) {
          console.log(`   ℹ️  Broadcast lifecycle status: ${lifeCycleStatus || 'unknown'}`);
          console.log(`   ℹ️  Using recordedVideoId as video ID`);
          return recordedVideoId;
        }

        console.log(
          `   ⏳ Broadcast not finalized yet on YouTube (lifeCycleStatus: ${lifeCycleStatus || 'unknown'}). Will retry.`
        );
        return null;
      }
      return null;
    } catch (error) {
      const apiError = error.response?.data?.error;
      const reason = apiError?.errors?.[0]?.reason;
      const status = error.response?.status;
      const printable = apiError
        ? {
            status,
            message: apiError.message,
            reason
          }
        : error.message;
      console.error(`Error getting broadcast video ID:`, printable);
      return null;
    }
  }

  /**
   * Process private replay for ended broadcasts
   * @param {number} broadcastId - Broadcast ID from database
   * @returns {object} - Result of processing
   */
  static async processPrivateReplay(broadcastId) {
    try {
      // Get broadcast info
      const broadcast = await fetchOne(
        `SELECT 
          b.broadcast_uuid, 
          b.broadcast_status, 
          b.platform_name,
          b.enable_private_replay,
          b.destination_url,
          b.youtube_broadcast_id,
          b.stream_key,
          ch.channel_uuid,
          oc.access_token as oauth_token_access
        FROM broadcasts b
        JOIN channels ch ON b.channel_uuid = ch.channel_uuid
        LEFT JOIN oauth_credentials oc ON ch.channel_uuid = oc.channel_uuid AND oc.provider = 'google'
        WHERE b.broadcast_id = ?`,
        [broadcastId]
      );

      if (!broadcast) {
        return { success: false, error: 'Broadcast not found' };
      }

      // Only process if private replay is enabled
      if (!broadcast.enable_private_replay || broadcast.enable_private_replay === 0 || broadcast.enable_private_replay === '0' || broadcast.enable_private_replay === 'false') {
        return { success: false, error: 'Private replay not enabled for this broadcast' };
      }

      // Only process for YouTube
      if (broadcast.platform_name !== 'youtube') {
        return { success: false, error: 'Private replay only supported for YouTube' };
      }

      // Get YouTube broadcast ID
      let youtubeBroadcastId = broadcast.youtube_broadcast_id;
      
      console.log(`   📋 YouTube Broadcast ID from DB: ${youtubeBroadcastId || 'NOT SET'}`);
      
      // If not stored in DB, try to extract from destination URL or stream key
      if (!youtubeBroadcastId) {
        // Try destination URL first: rtmp://a.rtmp.youtube.com/live2/broadcast_id
        const urlMatch = broadcast.destination_url.match(/\/([a-zA-Z0-9\-_]+)$/);
        if (urlMatch) {
          youtubeBroadcastId = urlMatch[1];
          console.log(`   📋 Extracted from URL: ${youtubeBroadcastId}`);
        } else if (broadcast.stream_key) {
          // Stream key might be the broadcast ID for some cases
          youtubeBroadcastId = broadcast.stream_key;
          console.log(`   📋 Using stream key: ${youtubeBroadcastId}`);
        }
      }
      
      if (!youtubeBroadcastId) {
        return { success: false, error: 'Cannot find YouTube broadcast ID' };
      }
      
      const accessToken = broadcast.oauth_token_access;

      if (!accessToken) {
        console.log(`   ❌ No OAuth access token available`);
        return { success: false, error: 'No OAuth access token available' };
      }
      
      console.log(`   🔑 OAuth token available: ${accessToken.substring(0, 20)}...`);

      // Get video ID from broadcast
      console.log(`   🔍 Getting video ID for broadcast: ${youtubeBroadcastId}`);
      const videoId = await this.getBroadcastVideoId(youtubeBroadcastId, accessToken);
      
      if (!videoId) {
        console.log(`   ⏳ YouTube broadcast is not finalized yet; will retry later`);
        return { success: false, error: 'YouTube broadcast not finalized yet (retry later)' };
      }
      
      console.log(`   🎥 Video ID found: ${videoId}`);

      // Set video to private
      const result = await this.setVideoPrivate(videoId, accessToken);

      if (result.success) {
        // Update broadcast record to mark private replay as processed
        await executeQuery(
          `UPDATE broadcasts SET private_replay_processed = 1, updated_at = datetime('now') 
           WHERE broadcast_id = ?`,
          [broadcastId]
        );
      }

      return result;
    } catch (error) {
      console.error(`Error processing private replay for broadcast ${broadcastId}:`, error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get all broadcasts that ended and need private replay processing
   * @returns {array} - Array of broadcasts needing processing
   */
  static async getEndedBroadcastsForPrivateReplay() {
    try {
      const { fetchAll } = require('../core/database');
      const broadcasts = await fetchAll(
        `SELECT broadcast_id, broadcast_uuid, platform_name
         FROM broadcasts
         WHERE broadcast_status = 'completed'
         AND enable_private_replay = 1
         AND (private_replay_processed IS NULL OR private_replay_processed = 0)
         AND platform_name = 'youtube'
         LIMIT 10`
      );

      return broadcasts;
    } catch (error) {
      console.error('Error getting ended broadcasts:', error.message);
      return [];
    }
  }
}

module.exports = PrivateReplayService;
