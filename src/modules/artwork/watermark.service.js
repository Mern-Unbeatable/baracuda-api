import sharp from 'sharp';
import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs/promises';
import path from 'path';

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
      const { width, height } = metadata;
      
      // Calculate font size relative to image width (approx 3% of width)
      const fontSize = Math.max(14, Math.floor(width * 0.03));
      
      const boxWidth = Math.max(120, fontSize * 8);
      const boxHeight = Math.max(30, fontSize * 1.5);
      
      const svgText = `
        <svg width="${boxWidth}" height="${boxHeight}">
          <style>
            .title { fill: rgba(255, 255, 255, 0.9); font-size: ${fontSize}px; font-weight: bold; font-family: sans-serif; }
            .bg { fill: rgba(0, 0, 0, 0.6); rx: 4px; }
          </style>
          <rect class="bg" x="0" y="0" width="${boxWidth}" height="${boxHeight}" />
          <text class="title" x="10" y="${fontSize * 1.1}">✨ AI Generated</text>
        </svg>
      `;

      await sharp(filePath)
        .composite([{ input: Buffer.from(svgText), gravity: 'southeast' }])
        .toFile(tempPath);

      // Overwrite the original file
      await fs.rename(tempPath, filePath);
    } catch (err) {
      // Clean up temp file on failure
      try { await fs.unlink(tempPath); } catch (e) {}
      throw err;
    }
  }

  watermarkVideo(filePath) {
    return new Promise((resolve, reject) => {
      const tempPath = `${filePath}.tmp.mp4`;
      
      // Using ffmpeg drawtext filter to add watermark at bottom right
      // text='✨ AI Generated'
      // x=w-tw-10 (width - text_width - 10px margin)
      // y=h-th-10 (height - text_height - 10px margin)
      ffmpeg(filePath)
        .videoFilters({
          filter: 'drawtext',
          options: {
            text: '✨ AI Generated',
            fontsize: '(w*0.03)',
            fontcolor: 'white',
            box: 1,
            boxcolor: 'black@0.5',
            boxborderw: 5,
            x: 'w-tw-20',
            y: 'h-th-20'
          }
        })
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
  }
}

export const watermarkService = new WatermarkService();
