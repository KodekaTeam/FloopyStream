const cron = require('node-cron');
const PrivateReplayService = require('./privateReplayService');

/**
 * Private Replay Scheduler
 * Automatically processes private replays for ended broadcasts
 * Runs every minute to check for broadcasts that have ended
 */
class PrivateReplayScheduler {
  constructor() {
    this.schedulerJob = null;
    this.isRunning = false;
  }

  /**
   * Start the private replay scheduler
   */
  start() {
    if (this.isRunning) {
      // console.log('⚠️ Private Replay Scheduler already running');
      return;
    }

    // console.log('\n' + '='.repeat(50));
    // console.log('🚀 Starting Private Replay Scheduler...');
    // console.log('⏰ Schedule: Every 1 minute');
    // console.log('🎯 Purpose: Auto-convert completed streams to private replays');
    // console.log('='.repeat(50));

    // Run every minute
    this.schedulerJob = cron.schedule('* * * * *', async () => {
      try {
        await this.processPrivateReplays();
      } catch (error) {
        console.error('❌ Error in Private Replay Scheduler:', error.message);
      }
    });

    this.isRunning = true;
    console.log("✓ Starting Private Replay Scheduler (interval: 60s)");
    console.log(" ".repeat(50));
  }

  /**
   * Stop the private replay scheduler
   */
  stop() {
    if (this.schedulerJob) {
      this.schedulerJob.stop();
      this.isRunning = false;
      console.log('✓ Private Replay Scheduler stopped');
    }
  }

  /**
   * Process private replays for all ended broadcasts
   */
  async processPrivateReplays() {
    try {
      const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
      const broadcasts = await PrivateReplayService.getEndedBroadcastsForPrivateReplay();

      if (broadcasts && broadcasts.length > 0) {
        console.log(`\n🔍 [${now}] Private Replay Check:`);
        console.log(`📊 Found ${broadcasts.length} broadcast(s) needing private replay processing`);

        for (const broadcast of broadcasts) {
          console.log(`\n⏳ Processing private replay for broadcast: ${broadcast.broadcast_uuid}`);
          console.log(`   Platform: ${broadcast.platform_name}`);
          
          const result = await PrivateReplayService.processPrivateReplay(broadcast.broadcast_id);
          
          if (result.success) {
            console.log(`✅ Successfully set broadcast ${broadcast.broadcast_uuid} replay to private`);
          } else {
            console.warn(`⚠️ Failed to set broadcast ${broadcast.broadcast_uuid} to private: ${result.error}`);
          }
        }
        console.log(''); // Empty line for readability
      } else {
        // Only log every 5 minutes to avoid spam
        const minute = new Date().getMinutes();
        if (minute % 5 === 0) {
          // console.log(`✓ [${now}] Private Replay Check: No broadcasts pending`);
        }
      }
    } catch (error) {
      console.error('❌ Error processing private replays:', error.message);
    }
  }

  /**
   * Get scheduler status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      scheduler: this.schedulerJob ? 'active' : 'inactive'
    };
  }
}

module.exports = new PrivateReplayScheduler();
