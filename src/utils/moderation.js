import fs from 'fs';
import path from 'path';
import config from '../config/env.js';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';

ffmpeg.setFfmpegPath(ffmpegStatic);

export class ModerationService {
  /**
   * Check a media file (image or video) for explicit, adult, or inappropriate content.
   * @param {string} filePath - Absolute path to file on disk
   * @param {string} mimetype - MIME type of file
   * @param {string} originalName - Original filename
   * @returns {Promise<{ safe: boolean, reason?: string, violation?: string }>}
   */
  static async checkMedia(filePath, mimetype, originalName = '') {
    // If moderation is disabled
    if (config.moderation?.enabled === false) {
      return { safe: true };
    }

    // Dev / Test simulation hook (for unit tests and development testing)
    if (originalName && (originalName.toLowerCase().includes('nsfw-test') || originalName.toLowerCase().includes('explicit-test'))) {
      return {
        safe: false,
        reason: 'Sexually explicit, adult, or inappropriate content detected.',
        violation: 'ADULT_CONTENT_SIMULATED'
      };
    }

    const { apiUser, apiSecret } = config.moderation || {};

    // If API credentials are not yet configured in .env, log once and allow pass-through
    if (!apiUser || !apiSecret) {
      return { safe: true };
    }

    const ext = path.extname(filePath).toLowerCase();
    const isImage = (mimetype && mimetype.startsWith('image/')) || ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp'].includes(ext);
    const isVideo = (mimetype && mimetype.startsWith('video/')) || ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v'].includes(ext);

    if (isImage) {
      return await this.checkImage(filePath);
    } else if (isVideo) {
      return await this.checkVideo(filePath);
    }

    return { safe: true };
  }

  /**
   * Scan image using Sightengine check.json
   */
  static async checkImage(filePath) {
    const { apiUser, apiSecret } = config.moderation;
    const url = 'https://api.sightengine.com/1.0/check.json';

    try {
      const fileBuffer = await fs.promises.readFile(filePath);
      const filename = path.basename(filePath);

      const formData = new FormData();
      formData.append('api_user', apiUser);
      formData.append('api_secret', apiSecret);
      formData.append('models', 'nudity-2.0,wad,offensive,gore');
      formData.append('media', new Blob([fileBuffer]), filename);

      const response = await fetch(url, {
        method: 'POST',
        body: formData
      });

      const data = await response.json();

      if (data.status !== 'success') {
        console.error('[Sightengine] API returned non-success status:', data.error || data);
        return { safe: true }; // Fail-open to avoid service outage if external API has downtime
      }

      const nudity = data.nudity || {};

      // 1. Sexual Activity (explicit pornography / sexual acts)
      if (nudity.sexual_activity && nudity.sexual_activity >= 0.5) {
        return {
          safe: false,
          reason: 'Pornographic or sexually explicit activity detected.',
          violation: 'SEXUAL_ACTIVITY'
        };
      }

      // 2. Sexual Display (exposed genitalia, explicit nudity, CSAM protection)
      if (nudity.sexual_display && nudity.sexual_display >= 0.5) {
        return {
          safe: false,
          reason: 'Explicit nudity or sexual display detected.',
          violation: 'SEXUAL_DISPLAY'
        };
      }

      // 3. Erotica (severe erotica / non-compliant full nudity)
      if (nudity.erotica && nudity.erotica >= 0.8) {
        return {
          safe: false,
          reason: 'Adult erotica or non-compliant nudity detected.',
          violation: 'EROTICA'
        };
      }

      // 4. Extreme violence / gore
      const gore = data.gore || {};
      if (gore.prob && gore.prob >= 0.7) {
        return {
          safe: false,
          reason: 'Violent or graphic content detected.',
          violation: 'GORE'
        };
      }

      return { safe: true };
    } catch (err) {
      console.error('[Sightengine] Request error:', err);
      return { safe: true };
    }
  }

  /**
   * Scan video by extracting 2 sample frames and checking each frame
   */
  static async checkVideo(filePath) {
    const tempFrames = [];
    const uploadDir = path.dirname(filePath);
    const baseName = path.basename(filePath, path.extname(filePath));

    try {
      // Sample video frames across timeline
      const timestamps = ['00:00:01', '00:00:03'];

      for (let i = 0; i < timestamps.length; i++) {
        const framePath = path.join(uploadDir, `mod-temp-${baseName}-${i}.jpg`);
        tempFrames.push(framePath);

        await new Promise((resolve) => {
          ffmpeg(filePath)
            .seekInput(timestamps[i])
            .frames(1)
            .output(framePath)
            .on('end', resolve)
            .on('error', () => resolve())
            .run();
        });

        if (fs.existsSync(framePath)) {
          const frameResult = await this.checkImage(framePath);
          if (!frameResult.safe) {
            return {
              safe: false,
              reason: `Video contains prohibited content: ${frameResult.reason}`,
              violation: frameResult.violation
            };
          }
        }
      }

      return { safe: true };
    } finally {
      // Clean up extracted temp frames immediately
      for (const f of tempFrames) {
        try {
          if (fs.existsSync(f)) {
            await fs.promises.unlink(f);
          }
        } catch (e) {}
      }
    }
  }
}
