const path = require('path');
const Broadcast = require('../models/Broadcast');
const Video = require('../models/Video');
const Playlist = require('../models/Playlist');
const UserAdapter = require('../models/UserAdapter');
const User = require('../models/User');
const Project = require('../models/Project');
const Channel = require('../models/Channel');
const UploadTemplate = require('../models/UploadTemplate');
const { startLiveBroadcast, startPlaylistBroadcast, stopLiveBroadcast } = require('../services/broadcastEngine');
const { broadcastWithAutoReconnect } = require('../services/broadcastEngine');
const { logInfo, logError } = require('../services/activityLogger');
const { executeQuery, fetchAll, fetchOne } = require('../core/database');
const youtubeService = require('../services/youtubeService');
const { formatForDb } = require("../utils/datetime");
const { sanitizeYouTubeTitle } = require('../utils/youtubeMetadata');
const playlistHelpers = require('../routes/helpers/playlistHelpers');

// Import Phase 4C helpers
const {
  verifyBroadcastOwnership,
  verifyChannelOwnership,
  getOwnedChannels
} = require('../routes/helpers/ownershipVerification');
const {
  getBroadcastWithDetails,
  getBroadcastsByChannel,
  getActiveBroadcasts,
  createBroadcastFromData,
  updateBroadcastFromData,
  getBroadcastCountByStatus
} = require('../routes/helpers/broadcastHelpers');

// ============================================
// HELPER: Get video file path for streaming
// ============================================
async function getVideoFilePath(videoUuid) {
  const fs = require('fs');

  // Find video by UUID (new structure)
  const videoData = await Video.findByUuid(videoUuid);
  if (!videoData) {
    throw new Error('Video not found');
  }

  const originalFilename = videoData.filepath || videoData.filename;
  const convertedFilename = `stream_${originalFilename}`;

  // Candidate paths - multer saves to ./storage/uploads relative to app directory
  const candidateConverted = path.resolve(__dirname, '../storage/uploads', convertedFilename);
  const candidateOriginal = path.resolve(__dirname, '../storage/uploads', originalFilename);

  let videoPath;
  if (fs.existsSync(candidateConverted)) {
    videoPath = candidateConverted;
    console.log(`Using converted streaming file: ${convertedFilename}`);
  } else if (fs.existsSync(candidateOriginal)) {
    videoPath = candidateOriginal;
  } else if (originalFilename.startsWith('./storage/uploads/') || originalFilename.startsWith('storage\\uploads\\')) {
    videoPath = path.resolve(__dirname, '..', originalFilename);
  } else {
    videoPath = candidateOriginal;
  }

  // Verify the file actually exists
  if (!fs.existsSync(videoPath)) {
    throw new Error(`Video file not found: ${videoPath}`);
  }

  return { videoPath, videoData };
}

// ============================================
// CONTROLLER FUNCTIONS
// ============================================

/**
 * Create a new broadcast
 */
async function createBroadcast(req, res) {
  try {
    const {
      channelUuid,
      broadcastName,
      broadcastType = 'single',
      videoUuid,
      platformName,
      destinationUrl,
      streamKey,
      templateId,
      scheduledTime,
      loopVideo,
      duration,
      advancedSettings,
      enableAutostart,
      enableAutoend,
      enableDvr,
      enable360,
      repeatStream,
      enablePrivateReplay
    } = req.body;

    console.log('Broadcast creation request:', {
      channelUuid,
      broadcastType,
      platformName,
      destinationUrl,
      videoUuid,
      templateId,
      broadcastName
    });

    // Validate required fields
    if (!channelUuid || !destinationUrl) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields (channelUuid and destinationUrl required)'
      });
    }

    // Validate broadcast type
    if (!['single', 'playlist'].includes(broadcastType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid broadcast type. Must be "single" or "playlist"'
      });
    }

    // For single type, videoUuid is required; for playlist, playlistUuid is required
    if (broadcastType === 'single' && !videoUuid) {
      return res.status(400).json({
        success: false,
        message: 'videoUuid is required for single broadcast type'
      });
    }

    if (broadcastType === 'playlist' && !videoUuid) {
      return res.status(400).json({
        success: false,
        message: 'videoUuid is required for playlist broadcast type'
      });
    }

    // Verify channel ownership
    const canAccess = await verifyChannelOwnership(
      channelUuid,
      req.session.accountId,
      req.session.userRole
    );

    if (!canAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You do not own this channel.'
      });
    }

    // If template is provided, load and apply template settings
    let templateSettings = {};
    if (templateId && templateId.trim() !== '') {
      console.log('🎯 Template ID detected:', templateId, '- Loading template settings...');
      const template = await UploadTemplate.findByUuid(templateId);
      if (!template) {
        return res.status(404).json({
          success: false,
          message: 'Upload template not found'
        });
      }

      // Debug: Log raw template data
      console.log('🔍 Raw template data from database:', {
        template_uuid: template.template_uuid,
        template_name: template.template_name,
        template_title: template.template_title,
        template_description: template.template_description ? template.template_description.substring(0, 50) + '...' : null,
        template_tags: template.template_tags,
        template_category: template.template_category,
        template_visibility: template.template_visibility,
        template_audience: template.template_audience,
        template_language_video: template.template_language_video
      });

      // Apply template settings to override defaults
      templateSettings = {
        broadcast_name: broadcastName || template.template_title || 'Untitled Broadcast',
        platform_name: platformName || 'custom',
        // YouTube metadata from template
        youtube_title: broadcastName || template.template_title,
        youtube_description: template.template_description,
        youtube_tags: (() => {
          // If already parsed as array by model, use directly
          if (Array.isArray(template.template_tags)) {
            return template.template_tags;
          }
          // If it's a string, try to parse
          if (typeof template.template_tags === 'string') {
            try {
              const parsed = JSON.parse(template.template_tags);
              return Array.isArray(parsed) ? parsed : [template.template_tags];
            } catch (e) {
              // If not valid JSON, treat as comma-separated string or single tag
              return template.template_tags.includes(',') ?
                template.template_tags.split(',').map(tag => tag.trim()) :
                [template.template_tags.trim()];
            }
          }
          // If null/undefined or other type, return empty array
          return [];
        })(),
        youtube_category: template.template_category,
        youtube_visibility: template.template_visibility || 'private',
        youtube_audience: template.template_audience || 'no',
        youtube_language: template.template_language_video || 'en'
      };

      console.log('🔧 Processed template settings:', templateSettings);
    } else {
      console.log('⚠️ No template ID provided or empty, using default settings');
      templateSettings = {
        broadcast_name: broadcastName || 'Untitled Broadcast',
        platform_name: platformName || 'custom',
        youtube_title: broadcastName || 'FloopyStream Broadcast',
        youtube_description: `Broadcast created from FloopyStream on ${new Date().toISOString()}`,
        youtube_tags: [],
        youtube_category: null,
        youtube_visibility: 'private',
        youtube_audience: 'no',
        youtube_language: 'en'
      };
    }

    // Verify video/playlist exists based on broadcast type
    let videoData = null;
    if (broadcastType === 'single') {
      videoData = await Video.findByUuid(videoUuid);
      if (!videoData) {
        return res.status(404).json({
          success: false,
          message: 'Video not found'
        });
      }
    } else if (broadcastType === 'playlist') {
      const playlist = await Playlist.findByUuid(videoUuid);
      if (!playlist) {
        return res.status(404).json({
          success: false,
          message: 'Playlist not found'
        });
      }
    }

    // Create broadcast using new structure
    const broadcast = await Broadcast.createNew(channelUuid, {
      broadcast_name:
        templateSettings.broadcast_name ||
        broadcastName ||
        "Untitled Broadcast",
      broadcast_type: broadcastType,
      platform_name: templateSettings.platform_name || platformName || "custom",
      destination_url: destinationUrl,
      stream_key: streamKey || null,
      video_uuid: videoUuid,
      template_uuid: templateId || null, // Store template UUID for metadata sync
      scheduled_time: scheduledTime || null,
      loopvideo: loopVideo ? 1 : 0,
      duration_timeout: duration ? parseInt(duration) * 60 : null,
      advanced_settings: advancedSettings || null,
      enable_autostart: enableAutostart || "false",
      enable_autoend: enableAutoend || "false",
      enable_dvr: enableDvr || "false",
      enable_360: enable360 || "false",
      repeat_stream: repeatStream || null,
      enable_private_replay: enablePrivateReplay || 'false',
    });

    // If this is a YouTube channel and we have OAuth, create YouTube broadcast
    let youtubeBroadcastData = null;
    if (platformName === 'youtube' || destinationUrl.includes('youtube.com')) {
      try {
        console.log('🎬 Attempting to create YouTube broadcast for new broadcast');

        // Get channel to check OAuth
        const channel = await Channel.findByUuid(channelUuid);

        if (channel && channel.channel_platform === 'youtube') {
          console.log('✅ Channel is YouTube channel:', channel.channel_uuid);

          const oauthRecord = await fetchOne(
            'SELECT * FROM oauth_credentials WHERE channel_uuid = ? AND provider = ?',
            [channelUuid, 'google']
          );

          if (oauthRecord) {
            console.log('✅ Found OAuth credentials for channel');

            try {
              await youtubeService.initializeWithOAuth(oauthRecord);
              console.log('✅ YouTube OAuth initialized successfully');

              // Create YouTube broadcast with template metadata
              const rawBroadcastTitle = templateSettings.youtube_title || broadcastName || 'FloopyStream Broadcast';
              const broadcastTitle = sanitizeYouTubeTitle(rawBroadcastTitle, {
                fallback: 'FloopyStream Broadcast',
                maxLength: 100
              });
              const broadcastDescription = templateSettings.youtube_description || `Broadcast created from FloopyStream on ${new Date().toISOString()}`;

              // Log the template metadata being applied
              console.log('📋 Applying template metadata to YouTube broadcast:', {
                title: broadcastTitle,
                titleInfo: {
                  rawLength: String(rawBroadcastTitle ?? '').length,
                  sanitizedLength: broadcastTitle.length
                },
                description: broadcastDescription.substring(0, 100) + '...',
                tags: templateSettings.youtube_tags,
                category: templateSettings.youtube_category,
                visibility: templateSettings.youtube_visibility,
                audience: templateSettings.youtube_audience,
                language: templateSettings.youtube_language
              });

              // Log the advanced streaming features being applied
              console.log(
                "🎯 Applying advanced streaming features to YouTube broadcast:",
                {
                  enableAutoStart: enableAutostart === "true",
                  enableAutoStop: enableAutoend === "true",
                  enableDvr: enableDvr === "true",
                  enable360: enable360 === "true",
                  enablePrivateReplay: enablePrivateReplay === "true",
                  repeatStream: repeatStream === "true"
                }
              );

              // Note: Tags and categoryId are not supported during liveBroadcasts.insert
              // They will be updated separately after the broadcast goes live using videos.update API
              // via the /api/broadcast/metadata/:broadcastUuid endpoint

              const createBroadcastResponse = await youtubeService.youtube.liveBroadcasts.insert({
                part: 'id,snippet,status,contentDetails',
                requestBody: {
                  snippet: {
                    title: broadcastTitle,
                    description: broadcastDescription,
                    scheduledStartTime: scheduledTime ? new Date(scheduledTime).toISOString() : new Date().toISOString(),
                    // Note: tags and categoryId are not supported during liveBroadcasts.insert
                    // They will be updated after broadcast creation
                    ...(templateSettings.youtube_language && {
                      defaultLanguage: templateSettings.youtube_language
                    })
                  },
                  status: {
                    privacyStatus: templateSettings.youtube_visibility || 'private',
                    selfDeclaredMadeForKids: templateSettings.youtube_audience === 'yes' || templateSettings.youtube_audience === 'made_for_kids'
                  },
                  contentDetails: {
                    enableAutoStart: enableAutostart === 'true',
                    enableAutoStop: enableAutoend === 'true',
                    enableClosedCaptions: false,
                    enableDvr: enableDvr === 'true',
                    enableEmbed: false,
                    recordFromStart: true,
                    startWithSlate: false,
                    enableContentEncryption: false,
                    enableMonitoring: false,
                    enableLowLatency: enable360 === 'true' // 360 video typically uses low latency
                  }
                }
              });

              // Debug: Log the actual request body sent to YouTube
              console.log('📤 YouTube API insert request body:', JSON.stringify({
                snippet: {
                  title: broadcastTitle,
                  description: broadcastDescription.substring(0, 50) + '...',
                  scheduledStartTime: scheduledTime ? new Date(scheduledTime).toISOString() : new Date().toISOString(),
                  defaultLanguage: templateSettings.youtube_language || undefined
                },
                status: {
                  privacyStatus: templateSettings.youtube_visibility || 'private',
                  selfDeclaredMadeForKids: templateSettings.youtube_audience === 'yes' || templateSettings.youtube_audience === 'made_for_kids'
                }
              }, null, 2));

              const youtubeBroadcastId = createBroadcastResponse.data.id;
              console.log('✅ Successfully created YouTube broadcast:', youtubeBroadcastId);

              // Update broadcast with YouTube broadcast ID
              try {
                console.log('🔄 Updating broadcast in database:', {
                  broadcastUuid: broadcast.broadcastUuid,
                  youtubeBroadcastId: youtubeBroadcastId,
                  table: 'broadcasts'
                });

                // First check if broadcast exists
                const existingBroadcast = await fetchOne(
                  'SELECT broadcast_uuid, youtube_broadcast_id FROM broadcasts WHERE broadcast_uuid = ?',
                  [broadcast.broadcastUuid]
                );

                console.log('📋 Existing broadcast check:', {
                  found: !!existingBroadcast,
                  currentYoutubeBroadcastId: existingBroadcast?.youtube_broadcast_id
                });

                const updateResult = await executeQuery(
                  'UPDATE broadcasts SET youtube_broadcast_id = ?, updated_at = ? WHERE broadcast_uuid = ?',
                  [youtubeBroadcastId, formatForDb(new Date()), broadcast.broadcastUuid]
                );

                console.log('📊 Update result:', {
                  changes: updateResult.changes,
                  lastID: updateResult.lastID
                });

                // Verify the update
                const updatedBroadcast = await fetchOne(
                  'SELECT broadcast_uuid, youtube_broadcast_id FROM broadcasts WHERE broadcast_uuid = ?',
                  [broadcast.broadcastUuid]
                );

                console.log('✅ Verification after update:', {
                  broadcastUuid: updatedBroadcast?.broadcast_uuid,
                  youtubeBroadcastId: updatedBroadcast?.youtube_broadcast_id
                });

                youtubeBroadcastData = {
                  youtubeBroadcastId: youtubeBroadcastId,
                  title: broadcastTitle,
                  description: broadcastDescription
                };

                // Handle stream key binding if user selected a stream key from database
                if (streamKey) {
                  try {
                    console.log('🔍 Checking if selected stream key exists in database:', streamKey);

                    // Check if stream key exists in our database
                    const streamKeyRecord = await fetchOne(
                      'SELECT * FROM streamkeys WHERE stream_key = ? AND channel_uuid = ?',
                      [streamKey, channelUuid]
                    );

                    if (streamKeyRecord) {
                      console.log('✅ Found stream key record:', {
                        streamKeyId: streamKeyRecord.streamkey_id,
                        hasYoutubeStreamId: !!streamKeyRecord.youtube_stream_id,
                        streamKeyName: streamKeyRecord.streamkey_name
                      });

                      if (streamKeyRecord.youtube_stream_id) {
                        // Stream key has YouTube stream ID, bind it to the broadcast
                        console.log('🔗 Binding existing YouTube stream to broadcast:', {
                          broadcastId: youtubeBroadcastId,
                          streamId: streamKeyRecord.youtube_stream_id
                        });

                        await youtubeService.youtube.liveBroadcasts.bind({
                          id: youtubeBroadcastId,
                          part: 'id,snippet,status,contentDetails',
                          streamId: streamKeyRecord.youtube_stream_id
                        });

                        console.log('✅ Successfully bound YouTube stream to broadcast');

                        // After successful binding, update metadata (tags and category) using videos.update
                        // Wait a moment for YouTube to create the videoId
                        await new Promise(resolve => setTimeout(resolve, 2000));

                        try {
                          console.log('🔄 Updating broadcast metadata after binding...');

                          // Get broadcast details to find videoId
                          const broadcastDetails = await youtubeService.youtube.liveBroadcasts.list({
                            part: 'snippet,status',
                            id: youtubeBroadcastId
                          });

                          if (broadcastDetails.data.items && broadcastDetails.data.items.length > 0) {
                            const broadcastItem = broadcastDetails.data.items[0];
                            const videoId = broadcastItem.snippet?.videoId;

                            if (videoId) {
                              console.log('🎬 Found videoId after binding:', videoId);

                              const updateData = {
                                id: videoId,
                                snippet: {}
                              };

                              // Add tags if available
                              if (templateSettings.youtube_tags && templateSettings.youtube_tags.length > 0) {
                                updateData.snippet.tags = templateSettings.youtube_tags;
                              }

                              // Add category if available
                              if (templateSettings.youtube_category) {
                                updateData.snippet.categoryId = templateSettings.youtube_category;
                              }

                              // Only update if we have metadata to update
                              if (Object.keys(updateData.snippet).length > 0) {
                                console.log('📤 Updating YouTube video metadata after bind:', {
                                  videoId,
                                  tags: updateData.snippet.tags,
                                  categoryId: updateData.snippet.categoryId
                                });

                                await youtubeService.youtube.videos.update({
                                  part: 'snippet',
                                  requestBody: updateData
                                });

                                console.log('✅ Successfully updated broadcast metadata after binding');

                                // Upload thumbnail if video has one (only for single broadcasts)
                                if (broadcastType === 'single' && videoData && videoData.thumbnail_path) {
                                  try {
                                    const thumbnailPath = path.resolve(__dirname, '../storage/thumbnails', videoData.thumbnail_path);
                                    console.log('🖼️ Uploading thumbnail for broadcast:', thumbnailPath);

                                    // Check if file exists before attempting upload
                                    const fs = require('fs');
                                    if (!fs.existsSync(thumbnailPath)) {
                                      console.warn('⚠️ Thumbnail file does not exist:', thumbnailPath);
                                    } else {
                                      console.log('✅ Thumbnail file exists, proceeding with upload');
                                    //   Upload thumbnail moved inside youtubeService
                                    //   const thumbnailResult = await youtubeService.uploadThumbnail(videoId, thumbnailPath);
                                      if (thumbnailResult.success) {
                                        console.log('✅ Successfully uploaded thumbnail for broadcast');
                                      } else {
                                        console.warn('⚠️ Failed to upload thumbnail:', thumbnailResult.error);
                                      }
                                    }
                                  } catch (thumbnailError) {
                                    console.warn('⚠️ Error uploading thumbnail:', thumbnailError.message);
                                  }
                                } else {
                                  console.log('ℹ️ No thumbnail available for upload (playlist broadcast or no thumbnail)');
                                }
                              } else {
                                console.log('ℹ️ No additional metadata to update after binding');
                              }
                            } else {
                              console.warn('⚠️ VideoId still not available after binding, metadata update skipped');
                            }
                          }
                        } catch (metadataError) {
                          console.warn('⚠️ Failed to update metadata after binding:', metadataError.message);
                          // Continue - binding was successful, metadata update is optional
                        }
                      } else {
                        // Stream key exists but no YouTube stream ID - this means it's a custom stream key
                        // We can't bind a custom stream key to YouTube broadcast
                        // The user will need to use the YouTube-generated stream key for this broadcast
                        console.log('⚠️ Stream key exists but has no YouTube stream ID (custom key) - cannot bind to YouTube broadcast');
                        console.log('💡 User should use the YouTube-generated stream key for this broadcast');
                      }
                    } else {
                      console.log('⚠️ Selected stream key not found in database - might be manual entry');
                    }
                  } catch (bindError) {
                    console.log('⚠️ Failed to bind YouTube stream to broadcast (continuing):', bindError.message);
                    // Continue - broadcast still works, just without proper stream binding
                  }
                }

                // Try to upload thumbnail if we have video data and it's a single broadcast
                if (broadcastType === 'single' && videoData && videoData.thumbnail_path) {
                  console.log('🖼️ Thumbnail will be uploaded when broadcast goes live via metadata sync service');
                }

              } catch (updateError) {
                console.error('❌ Failed to update broadcast with YouTube broadcast ID:', {
                  error: updateError.message,
                  stack: updateError.stack,
                  broadcastUuid: broadcast.broadcastUuid,
                  youtubeBroadcastId: youtubeBroadcastId
                });
                // Continue without updating database - broadcast still works locally
              }

            } catch (youtubeError) {
              console.log('⚠️ Failed to create YouTube broadcast (continuing with local broadcast):', youtubeError.message);
              // Continue with local broadcast creation even if YouTube fails
            }
          } else {
            console.log('⚠️ No OAuth credentials found for YouTube channel (continuing with local broadcast)');
          }
        } else {
          console.log('⚠️ Channel not found or not a YouTube channel (continuing with local broadcast)');
        }
      } catch (error) {
        console.log('⚠️ Error in YouTube broadcast creation (continuing with local broadcast):', error.message);
        // Continue with local broadcast creation even if YouTube integration fails
      }
    }

    await logInfo('Broadcast created', {
      broadcastUuid: broadcast.broadcastUuid,
      channelUuid,
      broadcastType,
      platform: platformName,
      username: req.session.username,
      status: scheduledTime ? 'scheduled' : 'offline',
      youtubeBroadcastId: youtubeBroadcastData?.youtubeBroadcastId
    });

    // Add to metadata sync queue if YouTube broadcast was created and has template
    // Only add if not already added during binding
    if (youtubeBroadcastData?.youtubeBroadcastId && templateId && !streamKey) {
      try {
        console.log('📋 Adding broadcast to metadata sync queue after creation (no binding):', {
          broadcastUuid: broadcast.broadcastUuid,
          youtubeBroadcastId: youtubeBroadcastData.youtubeBroadcastId,
          templateUuid: templateId,
          channelUuid: channelUuid
        });
        
        const { addBroadcastForMetadataSync } = require('../services/metadataSyncService');
        await addBroadcastForMetadataSync(broadcast.broadcastUuid, youtubeBroadcastData.youtubeBroadcastId, templateId, channelUuid);
        
        console.log('✅ Broadcast queued for metadata sync when live');
      } catch (syncError) {
        console.warn('⚠️ Failed to queue broadcast for metadata sync:', syncError.message);
        // Don't fail broadcast creation if sync queue fails
      }
    }

    res.json({
      success: true,
      message: scheduledTime ? 'Broadcast scheduled successfully' : 'Broadcast created successfully',
      broadcast: {
        broadcast_uuid: broadcast.broadcastUuid,
        broadcast_name: broadcastName,
        channel_uuid: channelUuid,
        broadcast_type: broadcastType
      }
    });
  } catch (error) {
    console.error('Broadcast creation error:', error);
    await logError('Failed to create broadcast', { error: error.message });
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
}

/**
 * Manually start a broadcast
 */
async function startBroadcast(req, res) {
  try {
    const { broadcastUuid } = req.params;

    // Get broadcast with full details (new structure)
    const broadcast = await Broadcast.findByUuid(broadcastUuid);
    if (!broadcast) {
      return res.status(404).json({
        success: false,
        message: 'Broadcast not found'
      });
    }

    // Verify ownership via channel
    const canAccess = await verifyBroadcastOwnership(
      broadcastUuid,
      req.session.accountId,
      req.session.userRole
    );

    if (!canAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You do not own this broadcast.'
      });
    }

    // Check if broadcast is already active
    if (broadcast.broadcast_status === 'active') {
      return res.status(400).json({
        success: false,
        message: 'Broadcast is already active'
      });
    }

    // Get user for notifications
    const user = await User.findById(req.session.accountId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Handle based on broadcast type (new structure uses broadcast_type, not content_type)
    if (broadcast.broadcast_type === 'playlist') {
      // Handle playlist broadcast
      const playlistUuid = broadcast.playlist_uuid || broadcast.video_uuid; // Fallback for backward compatibility
      const playlist = await Playlist.findByUuid(playlistUuid);
      if (!playlist) {
        return res.status(404).json({
          success: false,
          message: 'Playlist not found'
        });
      }

      // Get playlist videos using helper
      const playlistVideos = await playlistHelpers.getPlaylistVideos(playlistUuid);
      if (!playlistVideos || playlistVideos.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Playlist is empty'
        });
      }

      // Check playback mode
      const isShuffleMode = playlist.playback_mode === 'shuffle';

      // If this broadcast has YouTube broadcast ID and stream key is from YouTube, bind the stream
      if (broadcast.youtube_broadcast_id && broadcast.stream_key) {
        try {
          // Check if stream key exists in our database and has YouTube stream ID
          const streamKeyRecord = await fetchOne(
            'SELECT * FROM streamkeys WHERE stream_key = ? AND channel_uuid = ?',
            [broadcast.stream_key, broadcast.channel_uuid]
          );

          if (streamKeyRecord && streamKeyRecord.youtube_stream_id) {
            console.log('🔗 Binding YouTube stream to broadcast:', {
              broadcastId: broadcast.youtube_broadcast_id,
              streamId: streamKeyRecord.youtube_stream_id
            });

            // Get channel OAuth
            const oauthRecord = await fetchOne(
              'SELECT * FROM oauth_credentials WHERE channel_uuid = ? AND provider = ?',
              [broadcast.channel_uuid, 'google']
            );

            if (oauthRecord) {
              await youtubeService.initializeWithOAuth(oauthRecord);

              // Bind stream to broadcast
              await youtubeService.youtube.liveBroadcasts.bind({
                id: broadcast.youtube_broadcast_id,
                part: 'id,snippet,status,contentDetails',
                streamId: streamKeyRecord.youtube_stream_id
              });

              console.log('✅ Successfully bound YouTube stream to broadcast');
            }
          }
        } catch (bindError) {
          console.log('⚠️ Failed to bind YouTube stream to broadcast (continuing):', bindError.message);
        }
      }

      await logInfo('Starting playlist broadcast', {
        broadcastUuid,
        playlistUuid: playlistUuid,
        videoCount: playlistVideos.length,
        playbackMode: playlist.playback_mode || 'sequential',
        username: req.session.username,
        channelName: broadcast.channel_name,
        youtubeBroadcastId: broadcast.youtube_broadcast_id
      });

      // Extract video paths from playlist videos
      const videoPaths = playlistVideos.map(pv => ({
        filepath: pv.filepath || pv.filename,
        videoUuid: pv.video_uuid,
        duration: pv.duration_seconds
      }));

      await startPlaylistBroadcast(
        broadcast.broadcast_id,
        videoPaths,
        broadcast.destination_url,
        broadcast.stream_key,
        isShuffleMode,
        broadcast.loopvideo === 1,
        broadcast.advanced_settings ? JSON.parse(broadcast.advanced_settings) : {},
        user.user_uuid // user UUID for notifications
      );

      // Send stream notification for playlist
      try {
        const NotificationService = require('../services/notificationService');

        if (user) {
          await NotificationService.sendToUserChannels(user.user_uuid, 'stream', {
            name: broadcast.broadcast_name,
            platform: broadcast.platform_name || 'custom',
            description: `Playlist with ${playlistVideos.length} videos`
          });
        }
      } catch (notificationError) {
        console.error('Playlist stream notification failed:', notificationError);
        // Don't fail the broadcast if notification fails
      }

      res.json({
        success: true,
        message: `Playlist broadcast started with ${playlistVideos.length} videos (${isShuffleMode ? 'Shuffle' : 'Sequential'} mode)`,
        broadcast_uuid: broadcastUuid,
        channel_uuid: broadcast.channel_uuid,
        broadcast_status: 'active'
      });
    } else {
      // Handle single video broadcast
      try {
        const { videoPath, videoData } = await getVideoFilePath(broadcast.video_uuid);

        // If this broadcast has YouTube broadcast ID and stream key is from YouTube, bind the stream
        if (broadcast.youtube_broadcast_id && broadcast.stream_key) {
          try {
            // Check if stream key exists in our database and has YouTube stream ID
            const streamKeyRecord = await fetchOne(
              'SELECT * FROM streamkeys WHERE stream_key = ? AND channel_uuid = ?',
              [broadcast.stream_key, broadcast.channel_uuid]
            );

            if (streamKeyRecord && streamKeyRecord.youtube_stream_id) {
              console.log('🔗 Binding YouTube stream to broadcast:', {
                broadcastId: broadcast.youtube_broadcast_id,
                streamId: streamKeyRecord.youtube_stream_id
              });

              // Get channel OAuth
              const oauthRecord = await fetchOne(
                'SELECT * FROM oauth_credentials WHERE channel_uuid = ? AND provider = ?',
                [broadcast.channel_uuid, 'google']
              );

              if (oauthRecord) {
                await youtubeService.initializeWithOAuth(oauthRecord);

                // Bind stream to broadcast
                await youtubeService.youtube.liveBroadcasts.bind({
                  id: broadcast.youtube_broadcast_id,
                  part: 'id,snippet,status,contentDetails',
                  streamId: streamKeyRecord.youtube_stream_id
                });

                console.log('✅ Successfully bound YouTube stream to broadcast');

                // Mark broadcast for metadata sync when it goes live
                if (broadcast.template_uuid) {
                  console.log('📋 Broadcast marked for metadata sync when live:', broadcast.template_uuid);

                  // Add to sync queue (will be checked by task scheduler)
                  const { addBroadcastForMetadataSync } = require('../services/metadataSyncService');
                  console.log('📋 Adding broadcast to metadata sync queue with template:', {
                    broadcastUuid: broadcast.broadcast_uuid,
                    youtubeBroadcastId: broadcast.youtube_broadcast_id,
                    templateUuid: broadcast.template_uuid,
                    channelUuid: broadcast.channel_uuid
                  });
                  await addBroadcastForMetadataSync(broadcast.broadcast_uuid, broadcast.youtube_broadcast_id, broadcast.template_uuid, broadcast.channel_uuid);

                  console.log('✅ Broadcast queued for metadata sync when live');
                } else {
                  console.log('ℹ️ No template_uuid found, skipping metadata sync queue');
                }
              }
            }
          } catch (bindError) {
            console.log('⚠️ Failed to bind YouTube stream to broadcast (continuing):', bindError.message);
          }
        }

        await logInfo('Broadcast started manually', {
          broadcastUuid,
          videoUuid: broadcast.video_uuid,
          username: req.session.username,
          channelName: broadcast.channel_name,
          youtubeBroadcastId: broadcast.youtube_broadcast_id
        });

        // Start broadcast with auto-reconnect capability
        broadcastWithAutoReconnect(
          broadcast.broadcast_id,
          videoPath,
          broadcast.destination_url,
          broadcast.stream_key,
          broadcast.duration_timeout,
          broadcast.advanced_settings ? JSON.parse(broadcast.advanced_settings) : {},
          false, // not a playlist
          null, // no playlist data
          user.user_uuid // user UUID for notifications
        ).catch(error => {
          console.error(`Background broadcast error for ${broadcastUuid}:`, error.message);
        });

        // Send stream notification
        try {
          const NotificationService = require('../services/notificationService');

          if (user) {
            await NotificationService.sendToUserChannels(user.user_uuid, 'stream', {
              name: broadcast.broadcast_name,
              platform: broadcast.platform_name || 'custom'
            });
          }
        } catch (notificationError) {
          console.error('Stream notification failed:', notificationError);
          // Don't fail the broadcast if notification fails
        }

        res.json({
          success: true,
          message: 'Broadcast started successfully with auto-reconnect enabled',
          broadcast_uuid: broadcastUuid,
          channel_uuid: broadcast.channel_uuid,
          broadcast_status: 'active'
        });
      } catch (error) {
        console.error('Failed to get video path:', error);
        return res.status(404).json({
          success: false,
          message: error.message
        });
      }
    }
  } catch (error) {
    console.error('Broadcast manual start error:', error);
    await logError('Failed to start broadcast manually', {
      error: error.message
    });
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
}

/**
 * Stop an active broadcast
 */
async function stopBroadcast(req, res) {
  try {
    const { broadcastUuid } = req.params;

    // Get broadcast (new structure)
    const broadcast = await Broadcast.findByUuid(broadcastUuid);
    if (!broadcast) {
      return res.status(404).json({
        success: false,
        message: 'Broadcast not found'
      });
    }

    // Verify ownership via channel
    const canAccess = await verifyBroadcastOwnership(
      broadcastUuid,
      req.session.accountId,
      req.session.userRole
    );

    if (!canAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Stop the broadcast
    await stopLiveBroadcast(broadcast.broadcast_id);

    await logInfo('Broadcast stopped', {
      broadcastUuid,
      channelName: broadcast.channel_name,
      username: req.session.username
    });

    res.json({
      success: true,
      message: 'Broadcast stopped successfully',
      broadcast_uuid: broadcastUuid,
      channel_uuid: broadcast.channel_uuid
    });
  } catch (error) {
    console.error('Broadcast stop error:', error);
    await logError('Failed to stop broadcast', {
      error: error.message
    });
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
}

/**
 * Get broadcast details by UUID
 */
async function getBroadcast(req, res) {
  try {
    const { broadcastUuid } = req.params;
    // console.log('Getting broadcast details for UUID:', broadcastUuid);

    // Get broadcast with full details
    const broadcast = await getBroadcastWithDetails(broadcastUuid);
    // console.log('Broadcast found:', !!broadcast);
    if (!broadcast) {
      return res.status(404).json({
        success: false,
        message: 'Broadcast not found'
      });
    }

    // Verify ownership via channel
    const canAccess = await verifyBroadcastOwnership(
      broadcastUuid,
      req.session.accountId,
      req.session.userRole
    );

    if (!canAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    res.json({
      success: true,
      broadcast
    });
  } catch (error) {
    console.error('Broadcast fetch error:', error);
    await logError('Failed to fetch broadcast', {
      error: error.message
    });
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
}

/**
 * Update broadcast configuration
 */
async function updateBroadcast(req, res) {
  try {
    const { broadcastUuid } = req.params;
    const { broadcast_name, destination_url, stream_key } = req.body;

    console.log('Update broadcast request:', {
      broadcastUuid,
      broadcast_name,
      destination_url
    });

    // Get broadcast
    const broadcast = await Broadcast.findByUuid(broadcastUuid);
    if (!broadcast) {
      return res.status(404).json({
        success: false,
        message: 'Broadcast not found'
      });
    }

    // Verify ownership via channel
    const canAccess = await verifyBroadcastOwnership(
      broadcastUuid,
      req.session.accountId,
      req.session.userRole
    );

    if (!canAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Validate required fields
    if (!broadcast_name || !destination_url) {
      return res.status(400).json({
        success: false,
        message: 'Broadcast name and destination URL are required'
      });
    }

    // Update broadcast using helper
    await updateBroadcastFromData(broadcastUuid, {
      broadcast_name,
      destination_url,
      stream_key: stream_key || null
    });

    // If this broadcast has YouTube broadcast ID, try to update YouTube metadata
    if (broadcast.youtube_broadcast_id) {
      try {
        console.log('🔄 Attempting to update YouTube broadcast metadata after broadcast update');

        // Get channel OAuth
        const channel = await Channel.findByUuid(broadcast.channel_uuid);

        if (channel && channel.channel_platform === 'youtube') {
          const oauthRecord = await fetchOne(
            'SELECT * FROM oauth_credentials WHERE channel_uuid = ? AND provider = ?',
            [broadcast.channel_uuid, 'google']
          );

          if (oauthRecord) {
            await youtubeService.initializeWithOAuth(oauthRecord);

            // Get broadcast details to check current status
            const broadcastDetails = await youtubeService.youtube.liveBroadcasts.list({
              part: 'snippet,status',
              id: broadcast.youtube_broadcast_id
            });

            if (broadcastDetails.data.items && broadcastDetails.data.items.length > 0) {
              const broadcastItem = broadcastDetails.data.items[0];
              const videoId = broadcastItem.snippet?.videoId;
              const lifeCycleStatus = broadcastItem.status?.lifeCycleStatus;

              console.log('📺 Broadcast status for update:', {
                lifeCycleStatus,
                hasVideoId: !!videoId,
                videoId
              });

              // Always try to update broadcast metadata using liveBroadcasts.update
              // This works even before broadcast goes live
              try {
                console.log('📝 Updating YouTube broadcast metadata via liveBroadcasts.update:', {
                  broadcastId: broadcast.youtube_broadcast_id,
                  newTitle: broadcast_name
                });

                await youtubeService.youtube.liveBroadcasts.update({
                  part: 'snippet',
                  requestBody: {
                    id: broadcast.youtube_broadcast_id,
                    snippet: {
                      title: broadcast_name,
                      scheduledStartTime: new Date().toISOString() // Required for update
                    }
                  }
                });

                console.log('✅ Successfully updated YouTube broadcast title via liveBroadcasts API');
              } catch (broadcastUpdateError) {
                console.warn('⚠️ Failed to update broadcast via liveBroadcasts API:', broadcastUpdateError.message);
              }

              // If broadcast is live (has videoId), also update via videos.update for complete sync
              if (videoId) {
                console.log('🎬 Broadcast is live, performing additional sync via videos.update');

                try {
                  await youtubeService.youtube.videos.update({
                    part: 'snippet',
                    requestBody: {
                      id: videoId,
                      snippet: {
                        title: broadcast_name
                      }
                    }
                  });

                  console.log('✅ Successfully synced title via videos API');
                } catch (videoUpdateError) {
                  console.warn('⚠️ Failed to sync via videos API:', videoUpdateError.message);
                }
              } else {
                console.log('ℹ️ Broadcast not live yet, title updated via liveBroadcasts API only');
              }
            }
          } else {
            console.log('⚠️ No OAuth credentials found for YouTube channel');
          }
        } else {
          console.log('⚠️ Channel not found or not a YouTube channel');
        }
      } catch (youtubeError) {
        console.log('⚠️ Failed to update YouTube broadcast metadata (continuing):', youtubeError.message);
        // Continue - local update was successful
      }
    }

    await logInfo('Broadcast updated', {
      broadcastUuid,
      broadcast_name,
      channelName: broadcast.channel_name,
      username: req.session.username
    });

    res.json({
      success: true,
      message: 'Broadcast updated successfully',
      broadcast_uuid: broadcastUuid,
      channel_uuid: broadcast.channel_uuid
    });
  } catch (error) {
    console.error('Broadcast update error:', error);
    await logError('Failed to update broadcast', {
      error: error.message
    });
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
}

/**
 * Delete a broadcast
 */
async function deleteBroadcast(req, res) {
  try {
    const { broadcastUuid } = req.params;

    // Get broadcast
    const broadcast = await Broadcast.findByUuid(broadcastUuid);
    if (!broadcast) {
      return res.status(404).json({
        success: false,
        message: 'Broadcast not found'
      });
    }

    // Verify ownership via channel
    const canAccess = await verifyBroadcastOwnership(
      broadcastUuid,
      req.session.accountId,
      req.session.userRole
    );

    if (!canAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Stop if active
    if (broadcast.broadcast_status === 'active') {
      await stopLiveBroadcast(broadcast.broadcast_id);
    }

    // If this broadcast has YouTube broadcast ID, try to delete it from YouTube
    if (broadcast.youtube_broadcast_id) {
      try {
        console.log('📺 Attempting to delete YouTube broadcast:', broadcast.youtube_broadcast_id);

        // Get channel OAuth
        const channel = await Channel.findByUuid(broadcast.channel_uuid);

        if (channel && channel.channel_platform === 'youtube') {
          const oauthRecord = await fetchOne(
            'SELECT * FROM oauth_credentials WHERE channel_uuid = ? AND provider = ?',
            [broadcast.channel_uuid, 'google']
          );

          if (oauthRecord) {
            await youtubeService.initializeWithOAuth(oauthRecord);

            // Delete YouTube broadcast
            const deleteResult = await youtubeService.deleteBroadcast(broadcast.youtube_broadcast_id);

            if (deleteResult.success) {
              console.log('✅ Successfully deleted YouTube broadcast:', broadcast.youtube_broadcast_id);
            } else {
              console.log('⚠️ Failed to delete YouTube broadcast:', deleteResult.error);
            }
          } else {
            console.log('⚠️ No OAuth credentials found for YouTube channel - cannot delete YouTube broadcast');
          }
        } else {
          console.log('⚠️ Channel not found or not a YouTube channel - cannot delete YouTube broadcast');
        }
      } catch (youtubeError) {
        console.log('⚠️ Failed to delete YouTube broadcast (continuing with local deletion):', youtubeError.message);
        // Continue with local deletion even if YouTube deletion fails
      }
    }

    // Delete broadcast record
    await executeQuery(
      'DELETE FROM broadcasts WHERE broadcast_uuid = ?',
      [broadcastUuid]
    );

    await logInfo('Broadcast deleted', {
      broadcastUuid,
      channelName: broadcast.channel_name,
      username: req.session.username
    });

    res.json({
      success: true,
      message: 'Broadcast deleted successfully',
      broadcast_uuid: broadcastUuid,
      channel_uuid: broadcast.channel_uuid
    });
  } catch (error) {
    console.error('Broadcast delete error:', error);
    await logError('Failed to delete broadcast', {
      error: error.message
    });
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
}

/**
 * List broadcasts for a specific channel
 */
async function listBroadcasts(req, res) {
  try {
    const { channelUuid, status, limit = 50, offset = 0 } = req.query;

    // Validate channel UUID
    if (!channelUuid) {
      return res.status(400).json({
        success: false,
        message: 'channelUuid query parameter is required'
      });
    }

    // Verify channel ownership
    const canAccess = await verifyChannelOwnership(
      channelUuid,
      req.session.accountId,
      req.session.userRole
    );

    if (!canAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You do not own this channel.'
      });
    }

    // Get broadcasts using helper
    const broadcasts = await getBroadcastsByChannel(
      channelUuid,
      parseInt(limit),
      parseInt(offset)
    );

    // Filter by status if provided
    let filtered = broadcasts;
    if (status) {
      filtered = broadcasts.filter(b => b.broadcast_status === status);
    }

    res.json({
      success: true,
      broadcasts: filtered,
      count: filtered.length,
      total: broadcasts.length,
      channelUuid,
      limit,
      offset
    });
  } catch (error) {
    console.error('Broadcast list error:', error);
    await logError('Failed to list broadcasts', {
      error: error.message
    });
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
}

/**
 * List active broadcasts for all user's channels
 */
async function listActiveBroadcasts(req, res) {
  try {
    const user = await User.findById(req.session.accountId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get all user's projects
    const projects = await Project.getByUser(user.user_uuid);

    let activeBroadcasts = [];
    for (const project of projects) {
      // Get channels for each project
      const channels = await Channel.getByProject(project.project_uuid);

      for (const channel of channels) {
        // Get active broadcasts for each channel
        const active = await getActiveBroadcasts(channel.channel_uuid);
        activeBroadcasts = activeBroadcasts.concat(active);
      }
    }

    await logInfo('Active broadcasts retrieved', {
      userId: req.session.accountId,
      count: activeBroadcasts.length,
      username: req.session.username
    });

    res.json({
      success: true,
      broadcasts: activeBroadcasts,
      count: activeBroadcasts.length
    });
  } catch (error) {
    console.error('Active broadcasts list error:', error);
    await logError('Failed to get active broadcasts', {
      error: error.message
    });
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
}

/**
 * Check if broadcast is ready for metadata update
 */
async function checkBroadcastMetadataStatus(req, res) {
  try {
    const { broadcastUuid } = req.params;

    // Get broadcast
    const broadcast = await Broadcast.findByUuid(broadcastUuid);
    if (!broadcast) {
      return res.status(404).json({
        success: false,
        message: 'Broadcast not found'
      });
    }

    // Verify ownership via channel
    const canAccess = await verifyBroadcastOwnership(
      broadcastUuid,
      req.session.accountId,
      req.session.userRole
    );

    if (!canAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Check if broadcast has YouTube broadcast ID
    if (!broadcast.youtube_broadcast_id) {
      return res.status(400).json({
        success: false,
        message: 'Broadcast does not have a YouTube broadcast ID',
        readyForMetadataUpdate: false
      });
    }

    // Get channel OAuth
    const oauthRecord = await fetchOne(
      'SELECT * FROM oauth_credentials WHERE channel_uuid = ? AND provider = ?',
      [broadcast.channel_uuid, 'google']
    );

    if (!oauthRecord) {
      return res.status(400).json({
        success: false,
        message: 'No OAuth credentials found for this channel',
        readyForMetadataUpdate: false
      });
    }

    await youtubeService.initializeWithOAuth(oauthRecord);

    // Get broadcast details
    const broadcastDetails = await youtubeService.youtube.liveBroadcasts.list({
      part: 'snippet,status',
      id: broadcast.youtube_broadcast_id
    });

    if (!broadcastDetails.data.items || broadcastDetails.data.items.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'YouTube broadcast not found',
        readyForMetadataUpdate: false
      });
    }

    const broadcastItem = broadcastDetails.data.items[0];
    const videoId = broadcastItem.snippet?.videoId;
    const lifeCycleStatus = broadcastItem.status?.lifeCycleStatus;

    const readyForMetadataUpdate = !!videoId && (lifeCycleStatus === 'live' || lifeCycleStatus === 'complete');

    res.json({
      success: true,
      broadcastStatus: {
        lifeCycleStatus,
        hasVideoId: !!videoId,
        videoId,
        readyForMetadataUpdate,
        broadcastTitle: broadcastItem.snippet?.title,
        privacyStatus: broadcastItem.status?.privacyStatus
      },
      message: readyForMetadataUpdate ?
        'Broadcast is ready for metadata update' :
        `Broadcast not ready. Status: ${lifeCycleStatus}. ${videoId ? 'Video ID available.' : 'Video ID not available yet.'}`
    });

  } catch (error) {
    console.error('Broadcast metadata status check error:', error);
    res.status(500).json({
      success: false,
      message: error.message,
      readyForMetadataUpdate: false
    });
  }
}
async function updateBroadcastMetadata(req, res) {
  try {
    const { broadcastUuid } = req.params;

    // Get broadcast
    const broadcast = await Broadcast.findByUuid(broadcastUuid);
    if (!broadcast) {
      return res.status(404).json({
        success: false,
        message: 'Broadcast not found'
      });
    }

    // Verify ownership via channel
    const canAccess = await verifyBroadcastOwnership(
      broadcastUuid,
      req.session.accountId,
      req.session.userRole
    );

    if (!canAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Check if broadcast has YouTube broadcast ID
    if (!broadcast.youtube_broadcast_id) {
      return res.status(400).json({
        success: false,
        message: 'Broadcast does not have a YouTube broadcast ID'
      });
    }

    // Get channel OAuth
    const oauthRecord = await fetchOne(
      'SELECT * FROM oauth_credentials WHERE channel_uuid = ? AND provider = ?',
      [broadcast.channel_uuid, 'google']
    );

    if (!oauthRecord) {
      return res.status(400).json({
        success: false,
        message: 'No OAuth credentials found for this channel'
      });
    }

    await youtubeService.initializeWithOAuth(oauthRecord);

    // Get broadcast details to find videoId
    console.log('🔍 Getting broadcast details for metadata update:', {
      broadcastUuid,
      youtubeBroadcastId: broadcast.youtube_broadcast_id
    });

    const broadcastDetails = await youtubeService.youtube.liveBroadcasts.list({
      part: 'snippet,status',
      id: broadcast.youtube_broadcast_id
    });

    console.log('📋 Broadcast details response:', {
      found: !!broadcastDetails.data.items,
      itemCount: broadcastDetails.data.items?.length || 0,
      status: broadcastDetails.data.items?.[0]?.status?.lifeCycleStatus,
      privacyStatus: broadcastDetails.data.items?.[0]?.status?.privacyStatus
    });

    if (!broadcastDetails.data.items || broadcastDetails.data.items.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'YouTube broadcast not found'
      });
    }

    const broadcastItem = broadcastDetails.data.items[0];
    const videoId = broadcastItem.snippet?.videoId;

    console.log('🎬 Broadcast status check:', {
      lifeCycleStatus: broadcastItem.status?.lifeCycleStatus,
      hasVideoId: !!videoId,
      videoId: videoId,
      broadcastTitle: broadcastItem.snippet?.title
    });

    if (!videoId) {
      return res.status(400).json({
        success: false,
        message: `Video ID not available. Broadcast status: ${broadcastItem.status?.lifeCycleStatus}. Make sure the broadcast is live and streaming.`,
        broadcastStatus: broadcastItem.status?.lifeCycleStatus,
        suggestion: 'Start the broadcast first, then update metadata after it goes live.'
      });
    }

    // Get template data for this broadcast
    // We need to find which template was used when creating this broadcast
    // For now, we'll get the template from the request body or we could store template_uuid in broadcasts table
    const { templateId } = req.body;

    if (!templateId) {
      return res.status(400).json({
        success: false,
        message: 'templateId is required to update metadata'
      });
    }

    const template = await UploadTemplate.findByUuid(templateId);
    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Upload template not found'
      });
    }

    // Parse template tags
    let tags = [];
    if (Array.isArray(template.template_tags)) {
      tags = template.template_tags;
    } else if (typeof template.template_tags === 'string') {
      try {
        const parsed = JSON.parse(template.template_tags);
        tags = Array.isArray(parsed) ? parsed : [template.template_tags];
      } catch (e) {
        tags = template.template_tags.includes(',') ?
          template.template_tags.split(',').map(tag => tag.trim()) :
          [template.template_tags.trim()];
      }
    }

    // Prepare update data
    const updateData = {
      id: videoId,
      snippet: {}
    };

    if (tags.length > 0) {
      updateData.snippet.tags = tags;
    }
    if (template.template_category) {
      updateData.snippet.categoryId = template.template_category;
    }

    // Only update if we have something to update
    if (Object.keys(updateData.snippet).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No metadata to update (no tags or category in template)'
      });
    }

    console.log('📤 Updating YouTube video metadata:', {
      videoId,
      tags: updateData.snippet.tags,
      categoryId: updateData.snippet.categoryId,
      requestBody: JSON.stringify(updateData, null, 2)
    });

    const updateResponse = await youtubeService.youtube.videos.update({
      part: 'snippet',
      requestBody: updateData
    });

    console.log('✅ YouTube videos.update response:', {
      success: !!updateResponse.data,
      videoId: updateResponse.data?.id,
      updatedSnippet: updateResponse.data?.snippet ? {
        tags: updateResponse.data.snippet.tags,
        categoryId: updateResponse.data.snippet.categoryId
      } : null
    });

    await logInfo('Broadcast metadata updated', {
      broadcastUuid,
      videoId,
      templateId,
      username: req.session.username,
      updatedFields: {
        tags: !!updateData.snippet.tags,
        categoryId: !!updateData.snippet.categoryId
      }
    });

    res.json({
      success: true,
      message: 'Broadcast metadata updated successfully',
      videoId,
      updatedFields: {
        tags: !!updateData.snippet.tags,
        categoryId: !!updateData.snippet.categoryId
      }
    });

  } catch (error) {
    console.error('Broadcast metadata update error:', error);
    await logError('Failed to update broadcast metadata', {
      error: error.message
    });
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
}

module.exports = {
  createBroadcast,
  startBroadcast,
  stopBroadcast,
  getBroadcast,
  updateBroadcast,
  deleteBroadcast,
  listBroadcasts,
  listActiveBroadcasts,
  checkBroadcastMetadataStatus
};