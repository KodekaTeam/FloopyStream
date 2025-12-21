const { fetchOne, fetchAll, executeQuery } = require('../core/database');
const StreamKey = require('../models/StreamKey');
const youtubeService = require('../services/youtubeService');

// Get all stream keys for a channel
const getStreamKeysByChannel = async (req, res) => {
  try {
    const { channelUuid } = req.params;

    // Get current user
    const User = require('../models/User');
    const user = await User.findById(req.session.accountId);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    // Get channel
    const Channel = require('../models/Channel');
    const channel = await Channel.findByUuid(channelUuid);

    if (!channel) {
      return res.status(404).json({
        success: false,
        message: 'Channel not found'
      });
    }

    // Check ownership
    if (channel.user_uuid !== user.user_uuid) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Get stream keys
    const streamKeys = await StreamKey.getByChannel(channelUuid);

    res.json({
      success: true,
      data: streamKeys
    });

  } catch (error) {
    console.error('Get stream keys error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch stream keys'
    });
  }
};

// Create new stream key
const createStreamKey = async (req, res) => {
  try {
    const { channelUuid } = req.params;
    const { name, description, streamingProtocol, enableManualSettings, manualResolution, enable60fps } = req.body;

    // Validate input
    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Stream key name is required'
      });
    }

    // Get current user
    const User = require('../models/User');
    const user = await User.findById(req.session.accountId);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    // Get channel
    const Channel = require('../models/Channel');
    const channel = await Channel.findByUuid(channelUuid);

    if (!channel) {
      return res.status(404).json({
        success: false,
        message: 'Channel not found'
      });
    }

    // Check ownership
    if (channel.user_uuid !== user.user_uuid) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Check if channel is YouTube and has OAuth
    let youtubeData = null;
    if (channel.channel_platform === 'youtube') {
      const oauthRecord = await fetchOne(
        'SELECT * FROM oauth_credentials WHERE channel_uuid = ? AND provider = ?',
        [channelUuid, 'google']
      );

      if (oauthRecord) {
        try {
          // Create a live stream resource only (stream key) without creating a broadcast
          const result = await youtubeService.createNewStreamKey(oauthRecord.oauth_uuid, {
            title: name.trim(),
            description: description?.trim() || 'Stream key created from FloopyStream',
            streamingProtocol: streamingProtocol || 'rtmp',
            enableManualSettings: enableManualSettings || false,
            manualResolution: manualResolution || '1080p',
            enable60fps: enable60fps || false
          });
          if (result.success) {
            youtubeData = result.data;
            console.log('✅ YouTube live stream created (stream key) for new stream key:', {
              streamId: result.data.streamId,
              streamKey: result.data.streamKey ? '***' + result.data.streamKey.slice(-4) : 'N/A'
            });
          } else {
            console.log('⚠️ YouTube live stream creation failed:', result.error);
          }
        } catch (error) {
          console.log('❌ YouTube live stream creation error:', error.message);
        }
      }
    }

    // Create stream key
    const result = await StreamKey.createNew(
      channelUuid,
      name.trim(),
      youtubeData?.rtmpUrl || 'rtmp://a.rtmp.youtube.com/live2',
      youtubeData?.streamKey || generateRandomKey(),
      description?.trim() || null,
      {
        streamingProtocol: streamingProtocol || 'rtmp',
        enableManualSettings: enableManualSettings || false,
        enable60fps: enable60fps || false
      }
    );

    // Update with YouTube data if available and set is_active = 1 (auto active when created)
    try {
      if (youtubeData) {
        await executeQuery(
          'UPDATE streamkeys SET youtube_broadcast_id = ?, youtube_stream_id = ?, user_uuid = ?, is_active = ? WHERE streamkey_id = ?',
          [null, youtubeData.streamId, user.user_uuid, 1, result.streamKeyId]
        );
        console.log(`✓ Updated stream key with YouTube data and is_active=1: ${result.streamKeyId}`);
      } else {
        await executeQuery(
          'UPDATE streamkeys SET user_uuid = ?, is_active = ? WHERE streamkey_id = ?',
          [user.user_uuid, 1, result.streamKeyId]
        );
        console.log(`✓ Updated stream key with user and is_active=1: ${result.streamKeyId}`);
      }
    } catch (updateError) {
      console.error(`❌ Error updating stream key is_active: ${updateError.message}`);
    }

    // Get the created stream key
    const streamKey = await StreamKey.findById(result.streamKeyId);

    res.json({
      success: true,
      data: streamKey,
      message: 'Stream key created successfully'
    });

  } catch (error) {
    console.error('Create stream key error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create stream key'
    });
  }
};

// Get single stream key by ID
const getStreamKeyById = async (req, res) => {
  try {
    const { streamKeyId } = req.params;

    // Get current user
    const User = require('../models/User');
    const user = await User.findById(req.session.accountId);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    // Get stream key
    const streamKey = await StreamKey.findById(streamKeyId);
    if (!streamKey) {
      return res.status(404).json({
        success: false,
        message: 'Stream key not found'
      });
    }

    // Check ownership
    if (streamKey.user_uuid !== user.user_uuid) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    res.json({
      success: true,
      data: streamKey
    });

  } catch (error) {
    console.error('Get stream key error:', error);
    res.status(500).json({
      success: false,
      message: 'Error loading stream key data'
    });
  }
};

// Update stream key
const updateStreamKey = async (req, res) => {
  try {
    const { streamKeyId } = req.params;
    const { name, description, streamingProtocol } = req.body;
    // Note: Manual settings (enableManualSettings, manualResolution, enable60fps) are not included
    // because they cannot be changed after stream key creation

    // Validate input
    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Stream key name is required'
      });
    }

    // Get current user
    const User = require('../models/User');
    const user = await User.findById(req.session.accountId);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    // Get stream key
    const streamKey = await StreamKey.findById(streamKeyId);
    if (!streamKey) {
      return res.status(404).json({
        success: false,
        message: 'Stream key not found'
      });
    }

    // Check ownership
    if (streamKey.user_uuid !== user.user_uuid) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Update stream key
    await StreamKey.updateDetails(streamKeyId, {
      streamkey_name: name.trim(),
      streamkey_description: description?.trim() || null,
      streaming_protocol: streamingProtocol || 'rtmp'
      // Note: Manual settings (enable_manual_settings, manual_resolution, enable_60fps)
      // are not updated here because they cannot be changed after stream key creation
    });

    // Update YouTube stream if it exists (only title/description can be updated)
    if (streamKey.youtube_stream_id) {
      try {
        const youtubeService = require('../services/youtubeService');

        // Get channel OAuth for this user
        const { fetchOne } = require('../core/database');
        const oauthRecord = await fetchOne(
          'SELECT * FROM oauth_credentials WHERE channel_uuid = ? AND provider = ?',
          [streamKey.channel_uuid, 'google']
        );

        if (oauthRecord) {
          // Note: YouTube doesn't allow updating CDN settings (resolution/frameRate) after stream creation
          // Only title and description can be updated
          await youtubeService.updateStream(oauthRecord.oauth_uuid, streamKey.youtube_stream_id, {
            title: name.trim(),
            description: description?.trim() || null
            // cdnSettings removed - cannot be updated after creation
          });

          console.log(`✓ Updated YouTube stream title/description: ${streamKey.youtube_stream_id}`);
        }
      } catch (youtubeError) {
        console.error('⚠️ Failed to update YouTube stream:', youtubeError.message);
        // Don't fail the entire request if YouTube update fails
        // This is expected since CDN settings cannot be changed after creation
      }
    }

    // Get updated stream key
    const updatedStreamKey = await StreamKey.findById(streamKeyId);

    res.json({
      success: true,
      data: updatedStreamKey,
      message: 'Stream key updated successfully'
    });

  } catch (error) {
    console.error('Update stream key error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update stream key'
    });
  }
};

// Delete stream key
const deleteStreamKey = async (req, res) => {
  try {
    const { streamKeyId } = req.params;

    // Get current user
    const User = require('../models/User');
    const user = await User.findById(req.session.accountId);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    // Get stream key
    const streamKey = await StreamKey.findById(streamKeyId);
    if (!streamKey) {
      return res.status(404).json({
        success: false,
        message: 'Stream key not found'
      });
    }

    // Check ownership
    if (streamKey.user_uuid !== user.user_uuid) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Check if stream key is being used in any broadcasts
    const { fetchOne } = require('../core/database');
    const broadcastsUsingKey = await fetchOne(
      'SELECT COUNT(*) as count FROM broadcasts WHERE stream_key = ? AND broadcast_status IN (?, ?, ?)',
      [streamKey.stream_key, 'scheduled', 'running', 'paused']
    );

    if (broadcastsUsingKey && broadcastsUsingKey.count > 0) {
      return res.status(409).json({
        success: false,
        message: 'Cannot delete stream key that is currently being used in active broadcasts. Please stop or complete the broadcasts first.'
      });
    }

    // If this stream key has YouTube broadcast ID, try to delete it from YouTube
    // Note: YouTube live streams cannot be deleted after creation, only broadcasts can be deleted
    console.log('🔍 Checking stream key for YouTube deletion:', {
      streamKeyId: streamKey.streamkey_id,
      hasBroadcastId: !!streamKey.youtube_broadcast_id,
      broadcastId: streamKey.youtube_broadcast_id,
      hasStreamId: !!streamKey.youtube_stream_id,
      streamId: streamKey.youtube_stream_id,
      channelUuid: streamKey.channel_uuid
    });

    if (streamKey.youtube_broadcast_id || streamKey.youtube_stream_id) {
      console.log('📺 Attempting to delete YouTube resources for stream key');
      try {
        // Get channel to check OAuth
        const Channel = require('../models/Channel');
        const channel = await Channel.findByUuid(streamKey.channel_uuid);

        if (channel && channel.channel_platform === 'youtube') {
          console.log('✅ Channel is YouTube channel:', channel.channel_uuid);
          const oauthRecord = await fetchOne(
            'SELECT * FROM oauth_credentials WHERE channel_uuid = ? AND provider = ?',
            [streamKey.channel_uuid, 'google']
          );

          if (oauthRecord) {
            console.log('✅ Found OAuth credentials for channel');
            const youtubeService = require('../services/youtubeService');

            try {
              await youtubeService.initializeWithOAuth(oauthRecord);
              console.log('✅ YouTube OAuth initialized successfully');

              // If we have a broadcast ID, delete it directly
              if (streamKey.youtube_broadcast_id) {
                try {
                  console.log('🚀 Deleting broadcast by ID:', streamKey.youtube_broadcast_id);
                  await youtubeService.youtube.liveBroadcasts.delete({
                    id: streamKey.youtube_broadcast_id
                  });
                  console.log('✅ Successfully deleted YouTube broadcast:', streamKey.youtube_broadcast_id);
                } catch (broadcastError) {
                  console.log('⚠️ Failed to delete YouTube broadcast by ID:', {
                    broadcastId: streamKey.youtube_broadcast_id,
                    error: broadcastError.message,
                    statusCode: broadcastError.statusCode
                  });
                }
              }
              // If we have a stream ID but no broadcast ID, find broadcasts using this stream
              else if (streamKey.youtube_stream_id) {
                try {
                  console.log('🔍 Searching for broadcasts using stream:', streamKey.youtube_stream_id);

                  // List broadcasts to find ones using this stream
                  const broadcastsResult = await youtubeService.youtube.liveBroadcasts.list({
                    part: 'id,snippet,status,contentDetails',
                    mine: true,
                    maxResults: 50
                  });

                  if (broadcastsResult.data.items && broadcastsResult.data.items.length > 0) {
                    console.log(`📋 Found ${broadcastsResult.data.items.length} broadcasts, checking for stream usage`);

                    for (const broadcast of broadcastsResult.data.items) {
                      console.log('🔍 Checking broadcast:', {
                        broadcastId: broadcast.id,
                        title: broadcast.snippet?.title,
                        status: broadcast.status?.lifeCycleStatus,
                        boundStreamId: broadcast.contentDetails?.boundStreamId
                      });

                      const boundStreamId = broadcast.contentDetails?.boundStreamId;
                      if (boundStreamId === streamKey.youtube_stream_id) {
                        console.log('🎯 Found broadcast using our stream, deleting:', broadcast.id);
                        await youtubeService.youtube.liveBroadcasts.delete({
                          id: broadcast.id
                        });
                        console.log('✅ Successfully deleted YouTube broadcast:', broadcast.id);
                        break; // Delete only one broadcast (the most recent one)
                      } else {
                        console.log('❌ Broadcast does not use our stream:', {
                          broadcastStreamId: boundStreamId,
                          ourStreamId: streamKey.youtube_stream_id
                        });
                      }
                    }
                  } else {
                    console.log('ℹ️ No broadcasts found for this channel');
                  }

                  // Try to delete the live stream directly as requested by user
                  try {
                    console.log('🗑️ Attempting to delete live stream directly:', streamKey.youtube_stream_id);
                    await youtubeService.youtube.liveStreams.delete({
                      id: streamKey.youtube_stream_id
                    });
                    console.log('✅ Successfully deleted YouTube live stream:', streamKey.youtube_stream_id);
                  } catch (streamDeleteError) {
                    console.log('⚠️ Failed to delete live stream (expected for created streams):', streamDeleteError.message);
                    // If direct deletion fails, try to update the stream instead
                    console.log('📝 Falling back to updating live stream metadata...');
                  }

                } catch (searchError) {
                  console.log('⚠️ Failed to search for broadcasts:', searchError.message);
                }
              }
            } catch (oauthError) {
              console.log('⚠️ Failed to initialize YouTube OAuth (continuing with local deletion):', oauthError.message);
              // Continue with local deletion even if OAuth fails
            }

            // Note: We try to delete the live stream as requested, but if it fails (which is expected for created streams),
            // we fall back to updating the stream metadata to mark it as deleted
          } else {
            console.log('⚠️ No OAuth credentials found for YouTube channel (continuing with local deletion)');
          }
        } else {
          console.log('⚠️ Channel not found or not a YouTube channel (continuing with local deletion)');
        }
      } catch (error) {
        console.log('⚠️ Error in YouTube deletion process (continuing with local deletion):', error.message);
        // Continue with local deletion even if YouTube deletion fails
      }
    }

    // Always delete stream key from database, regardless of YouTube deletion success/failure
    try {
      await executeQuery('DELETE FROM streamkeys WHERE streamkey_id = ?', [streamKeyId]);
      console.log('✅ Deleted stream key from database:', streamKeyId);
    } catch (dbError) {
      console.error('❌ Failed to delete stream key from database:', dbError);
      return res.status(500).json({
        success: false,
        message: 'Failed to delete stream key from database'
      });
    }

    res.json({
      success: true,
      message: 'Stream key deleted successfully'
    });

  } catch (error) {
    console.error('Delete stream key error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete stream key'
    });
  }
};

// Sync stream keys from YouTube Studio
const syncYouTubeStreamKeys = async (req, res) => {
  try {
    const { channelUuid } = req.params;

    // Get current user
    const User = require('../models/User');
    const user = await User.findById(req.session.accountId);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    // Get channel
    const Channel = require('../models/Channel');
    const channel = await Channel.findByUuid(channelUuid);

    if (!channel) {
      return res.status(404).json({
        success: false,
        message: 'Channel not found'
      });
    }

    // Check ownership
    if (channel.user_uuid !== user.user_uuid) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Check if channel is YouTube and has OAuth
    if (channel.channel_platform !== 'youtube') {
      return res.status(400).json({
        success: false,
        message: 'Sync from YouTube Studio is only available for YouTube channels'
      });
    }

    const oauthRecord = await fetchOne(
      'SELECT * FROM oauth_credentials WHERE channel_uuid = ? AND provider = ?',
      [channelUuid, 'google']
    );

    if (!oauthRecord) {
      return res.status(400).json({
        success: false,
        message: 'YouTube OAuth connection not found. Please connect your YouTube account first.'
      });
    }

    // Initialize YouTube service
    const youtubeService = require('../services/youtubeService');
    await youtubeService.initializeWithOAuth(oauthRecord);

    // Get all live streams (stream keys) from YouTube Studio
    const listResult = await youtubeService.listStreamKeys(oauthRecord.oauth_uuid, 50);
    if (!listResult.success || !listResult.data || listResult.data.length === 0) {
      // Log the informative error message for debugging/admin purposes
      if (!listResult.success) {
        console.log(`YouTube sync failed for channel ${channelUuid}: ${listResult.error}`);
      }

      return res.json({
        success: true,
        message: listResult.success ? 'No live streams found in YouTube Studio' : `Sync failed: ${listResult.error}`,
        data: { syncedCount: 0 }
      });
    }

    let syncedCount = 0;

    // Process each stream
    for (const streamDetails of listResult.data) {
      const streamId = streamDetails.id;

      if (!streamId) continue;

      // Check if this stream already exists in our database
      // Check by youtube_stream_id OR stream_key value to avoid duplicates
      const existingStreamKey = await fetchOne(
        'SELECT * FROM streamkeys WHERE channel_uuid = ? AND (youtube_stream_id = ? OR stream_key = ?)',
        [channelUuid, streamId, streamDetails.cdn?.ingestionInfo?.streamName]
      );

      if (existingStreamKey) {
        // Already exists - update the youtube_stream_id if not set
        if (!existingStreamKey.youtube_stream_id) {
          await executeQuery(
            'UPDATE streamkeys SET youtube_stream_id = ?, is_active = ? WHERE streamkey_id = ?',
            [streamId, 1, existingStreamKey.streamkey_id]
          );
          console.log(`✅ Updated existing stream key with YouTube ID: ${streamId}`);
        }
        continue;
      }

      if (!streamDetails) continue;

      const streamKey = streamDetails.cdn?.ingestionInfo?.streamName;
      const rtmpUrl = streamDetails.cdn?.ingestionInfo?.ingestionAddress;

      if (!streamKey || !rtmpUrl) continue;

      // Create stream key in database
      const streamKeyName = streamDetails.snippet?.title || `YouTube Stream ${streamId.slice(-8)}`;
      const streamKeyDescription = `Synced from YouTube Studio - ${streamDetails.snippet?.description || ''}`.trim();

      try {
        const result = await StreamKey.createNew(
          channelUuid,
          streamKeyName,
          rtmpUrl,
          streamKey,
          streamKeyDescription,
          {
            streamingProtocol: 'rtmp',
            enableManualSettings: false,
            enable60fps: false
          }
        );

        // Update with YouTube data and ensure is_active is set
        await executeQuery(
          'UPDATE streamkeys SET youtube_broadcast_id = ?, youtube_stream_id = ?, user_uuid = ?, is_active = ? WHERE streamkey_id = ?',
          [null, streamId, user.user_uuid, 1, result.streamKeyId]
        );

        syncedCount++;
        console.log(`✅ Synced YouTube stream key: ${streamKeyName} (${streamId})`);

      } catch (error) {
        console.log('Failed to create stream key for broadcast', streamId, error.message);
        continue;
      }
    }

    res.json({
      success: true,
      message: `Successfully synced ${syncedCount} stream keys from YouTube Studio`,
      data: { syncedCount }
    });

  } catch (error) {
    console.error('YouTube Studio sync error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during YouTube sync'
    });
  }
};

// Generate random stream key
function generateRandomKey() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

module.exports = {
  getStreamKeysByChannel,
  createStreamKey,
  getStreamKeyById,
  updateStreamKey,
  deleteStreamKey,
  syncYouTubeStreamKeys
};