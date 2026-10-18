import { ModerationService } from '../utils/moderation.js';
import { ResponseUtil } from '../utils/response.js';
import fs from 'fs/promises';

/**
 * Middleware to moderate all uploaded media files in real-time.
 * Automatically inspects req.file or req.files for images and videos.
 * If any file violates safety guidelines (nudity, pornography, CSAM, violence):
 * - Deletes all uploaded files from disk immediately.
 * - Rejects the request with a 400 Bad Request error.
 */
export const moderateUploadedContent = async (req, res, next) => {
  const filesToScan = [];

  // Single file uploads (req.file)
  if (req.file) {
    filesToScan.push(req.file);
  }

  // Multiple / field uploads (req.files)
  if (req.files) {
    if (Array.isArray(req.files)) {
      filesToScan.push(...req.files);
    } else if (typeof req.files === 'object') {
      Object.values(req.files).forEach(fileGroup => {
        if (Array.isArray(fileGroup)) {
          filesToScan.push(...fileGroup);
        } else if (fileGroup && fileGroup.path) {
          filesToScan.push(fileGroup);
        }
      });
    }
  }

  if (filesToScan.length === 0) {
    return next();
  }

  try {
    for (const file of filesToScan) {
      const checkResult = await ModerationService.checkMedia(
        file.path,
        file.mimetype,
        file.originalname
      );

      if (!checkResult.safe) {
        // Safe cleanup: Delete all uploaded files from disk immediately
        await Promise.allSettled(
          filesToScan.map(f => fs.unlink(f.path).catch(() => {}))
        );

        return ResponseUtil.error(
          res,
          `Content Moderation Alert: Upload rejected. ${checkResult.reason || 'Sexually explicit, adult, or inappropriate content is strictly prohibited.'}`,
          400,
          {
            field: file.fieldname,
            fileName: file.originalname,
            violation: checkResult.violation || 'EXPLICIT_CONTENT'
          }
        );
      }
    }

    next();
  } catch (error) {
    console.error('[ContentModeration] Error during content moderation scan:', error);
    next();
  }
};
