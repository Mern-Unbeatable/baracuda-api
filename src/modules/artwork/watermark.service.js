import sharp from 'sharp';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import fs from 'fs/promises';
import path from 'path';

// Tell fluent-ffmpeg where to find the ffmpeg binary
ffmpeg.setFfmpegPath(ffmpegStatic);

export class WatermarkService {
  /**
   * Applies watermark to all uploaded media files in the background.
   * @param {Array} mediaFiles - Array of Express Multer file objects
   * @param {boolean} isAiGenerated - Whether the artwork is AI generated
   */
  async applyWatermarkInBackground(mediaFiles, isAiGenerated) {
    // Only apply if it's explicitly AI Generated
    if (!isAiGenerated || !mediaFiles || mediaFiles.length === 0) return;

    for (const file of mediaFiles) {
      try {
        if (file.mimetype.startsWith('image/')) {
          await this.watermarkImage(file.path);
        } else if (file.mimetype.startsWith('video/')) {
          await this.watermarkVideo(file.path);
        }
      } catch (err) {
        console.error(`[WatermarkService] Failed to watermark file ${file.path}:`, err);
      }
    }
  }

  async watermarkImage(filePath) {
    const tempPath = `${filePath}.tmp`;
    
    try {
      const metadata = await sharp(filePath).metadata();
      const { width } = metadata;
      
      // Calculate star size relative to image width (approx 5.5% of width)
      const starHeight = Math.max(30, Math.floor(width * 0.055));
      const starWidth = Math.floor(starHeight * 0.65);
      
      const singleStarSvg = `
        <svg width="${starWidth + 20}" height="${starHeight + 20}" viewBox="0 0 60 90" xmlns="http://www.w3.org/2000/svg">
          <path d="M 30 5 Q 30 45 55 45 Q 30 45 30 85 Q 30 45 5 45 Q 30 45 30 5 Z" fill="black" />
        </svg>
      `;

      await sharp(filePath)
        .composite([{ input: Buffer.from(singleStarSvg), gravity: 'southeast' }])
        .toFile(tempPath);

      // Overwrite the original file
      await fs.rename(tempPath, filePath);
    } catch (err) {
      // Clean up temp file on failure
      try { await fs.unlink(tempPath); } catch (e) {}
      throw err;
    }
  }

  async watermarkVideo(filePath) {
    const tempPath = `${filePath}.tmp.mp4`;
    const watermarkPngPath = `${filePath}.watermark.png`;

    try {
      // 1. Get video resolution using ffprobe
      const dimensions = await new Promise((resolve) => {
        ffmpeg.ffprobe(filePath, (err, metadata) => {
          if (err || !metadata?.streams) return resolve({ width: 1920, height: 1080 });
          const videoStream = metadata.streams.find(s => s.width && s.height);
          resolve(videoStream ? { width: videoStream.width, height: videoStream.height } : { width: 1920, height: 1080 });
        });
      });

      const starHeight = Math.max(35, Math.floor(dimensions.width * 0.055));
      const starWidth = Math.floor(starHeight * 0.65);

      // 2. Generate crisp single 4-pointed AI star
      const singleStarSvg = `
        <svg width="${starWidth}" height="${starHeight}" viewBox="0 0 60 90" xmlns="http://www.w3.org/2000/svg">
          <path d="M 30 5 Q 30 45 55 45 Q 30 45 30 85 Q 30 45 5 45 Q 30 45 30 5 Z" fill="black" />
        </svg>
      `;
      await sharp(Buffer.from(singleStarSvg)).png().toFile(watermarkPngPath);

      // 3. Overlay onto video using ffmpeg at bottom right
      await new Promise((resolve, reject) => {
        ffmpeg(filePath)
          .input(watermarkPngPath)
          .complexFilter(['[0:v][1:v]overlay=W-w-25:H-h-25:format=auto[v]'], ['v'])
          .outputOptions(['-c:a copy', '-preset ultrafast'])
          .output(tempPath)
          .on('end', async () => {
            try {
              await fs.rename(tempPath, filePath);
              resolve();
            } catch (err) {
              reject(err);
            }
          })
          .on('error', async (err) => {
            try { await fs.unlink(tempPath); } catch (e) {}
            reject(err);
          })
          .run();
      });
    } finally {
      try { await fs.unlink(watermarkPngPath); } catch (e) {}
      try { await fs.unlink(tempPath); } catch (e) {}
    }
  }
}

export const watermarkService = new WatermarkService();
