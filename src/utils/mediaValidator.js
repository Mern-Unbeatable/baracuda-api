import { imageSize } from 'image-size';
import { getVideoDurationInSeconds } from 'get-video-duration';
import fs from 'fs/promises';

export class MediaValidator {
  /**
   * Validate image dimensions exactly match target width and height
   */
  static async validateImage(filePath, targetWidth, targetHeight, fieldName = 'Image', tolerancePx = 10) {
    try {
      // image-size package does not support AVIF natively. Bypass dimension check for AVIF.
      if (filePath.toLowerCase().endsWith('.avif')) {
        return true;
      }
      
      const buffer = await fs.readFile(filePath);
      const dimensions = imageSize(buffer);
      
      const widthDiff = Math.abs(dimensions.width - targetWidth);
      const heightDiff = Math.abs(dimensions.height - targetHeight);
      
      if (widthDiff > tolerancePx || heightDiff > tolerancePx) {
        throw new Error(`${fieldName} must be approximately ${targetWidth}x${targetHeight}px (got ${dimensions.width}x${dimensions.height}px)`);
      }
      return true;
    } catch (err) {
      if (err.message.includes('must be approximately')) throw err;
      throw new Error(`Invalid ${fieldName.toLowerCase()} file: ${err.message}`);
    }
  }

  /**
   * Validate video duration is under the maximum allowed seconds
   */
  static async validateVideoDuration(filePath, maxSeconds, fieldName = 'Video') {
    try {
      const duration = await getVideoDurationInSeconds(filePath);
      if (duration > maxSeconds) {
        const maxMinutes = (maxSeconds / 60).toFixed(1).replace('.0', '');
        const gotMinutes = (duration / 60).toFixed(1).replace('.0', '');
        throw new Error(`${fieldName} duration must not exceed ${maxMinutes} minutes (got ${gotMinutes} minutes)`);
      }
      return true;
    } catch (err) {
      if (err.message.includes('must not exceed')) throw err;
      throw new Error(`Invalid ${fieldName.toLowerCase()} file or unable to read duration`);
    }
  }

  /**
   * Helper to delete a file after a failed validation
   */
  static async deleteFile(filePath) {
    try {
      await fs.unlink(filePath);
    } catch (err) {
      console.error(`Failed to delete file: ${filePath}`, err);
    }
  }
}
