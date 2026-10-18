import { getVideoDurationInSeconds } from 'get-video-duration';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import ffprobeStatic from 'ffprobe-static';
import path from 'path';

ffmpeg.setFfmpegPath(ffmpegStatic);
ffmpeg.setFfprobePath(ffprobeStatic.path);

export class VideoUtil {
  /**
   * Get duration of a video in seconds
   * @param {string} filePath - Absolute path to video file
   * @returns {Promise<number|null>} Duration in seconds rounded to 2 decimal places
   */
  static async getDuration(filePath) {
    try {
      const duration = await getVideoDurationInSeconds(filePath);
      return Math.round(duration * 100) / 100;
    } catch (err) {
      console.warn('Warning: Could not extract video duration:', err.message);
      return null;
    }
  }

  /**
   * Generate thumbnail frame from video
   * @param {string} videoFilePath - Absolute path to video file
   * @param {string} outputDir - Directory to store generated thumbnail
   * @param {string} filenamePrefix - Prefix identifier for the thumbnail
   * @returns {Promise<string|null>} Relative path of thumbnail (/uploads/...) or null
   */
  static async generateThumbnail(videoFilePath, outputDir, filenamePrefix) {
    return new Promise((resolve) => {
      const thumbFilename = `thumb-${filenamePrefix}-${Date.now()}.jpg`;
      ffmpeg(videoFilePath)
        .screenshots({
          timestamps: ['0.5'],
          filename: thumbFilename,
          folder: outputDir,
          size: '640x360'
        })
        .on('end', () => {
          resolve(`/uploads/${thumbFilename}`);
        })
        .on('error', (err) => {
          console.warn('Failed to generate video thumbnail with fluent-ffmpeg:', err.message);
          resolve(null);
        });
    });
  }
}
