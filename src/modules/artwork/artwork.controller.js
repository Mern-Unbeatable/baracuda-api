import { UrlUtil } from '../../utils/urlUtil.js';
import { PaginationUtil } from '../../utils/pagination.js';
import { ResponseUtil } from '../../utils/response.js';

export class ArtworkController {
  constructor(artworkService) {
    this.artworkService = artworkService;
  }

  formatMediaUrls(req, artwork) {
    if (!artwork || !artwork.media) return artwork;
    const formatted = { ...artwork };
    formatted.media = formatted.media.map(m => ({
      ...m,
      url: UrlUtil.getAbsoluteUrl(req, m.url)
    }));
    return formatted;
  }

  createArtwork = async (req, res) => {
    try {
      // For authenticated routes, assume req.user is set by auth middleware
      const userId = req.user?.id || 'TEST_USER_ID';
      
      const {
        kind,
        theme,
        zodiacSign,
        visibility,
        competitionState,
        categoryId,
        subcategoryId,
        title,
        story,
        tags,
        camera,
        resolution,
        format,
        isAiGenerated,
        copyrightConfirmed,
        quality
      } = req.validatedBody || req.body;

      // Extract uploaded files from req.files
      // multer config allows 'images' and 'video'
      const imageFiles = req.files && req.files['images'] ? req.files['images'] : [];
      const videoFiles = req.files && req.files['video'] ? req.files['video'] : [];
      const mediaFiles = [...imageFiles, ...videoFiles];

      const parsedTitle = typeof title === 'string' ? JSON.parse(title) : title;
      const parsedStory = typeof story === 'string' ? JSON.parse(story) : story;

      const data = {
        kind,
        theme: theme || null,
        zodiacSign: zodiacSign || null,
        visibility: visibility || 'PUBLIC',
        competitionState: competitionState || 'PROFILE_ONLY',
        categoryId: categoryId || null,
        subcategoryId: subcategoryId || null,
        title: parsedTitle,
        story: parsedStory || null,
        tags: tags ? (Array.isArray(tags) ? tags : JSON.parse(tags)) : [],
        camera: camera || null,
        resolution: resolution || null,
        format: format || null,
        isAiGenerated: isAiGenerated === 'true' || isAiGenerated === true,
        copyrightConfirmed: copyrightConfirmed === 'true' || copyrightConfirmed === true,
        quality: quality || null
      };

      const result = await this.artworkService.createArtwork(userId, data, mediaFiles);
      ResponseUtil.actionSuccess(res, 'Artwork created successfully', result.id, 201);
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  getAllArtworks = async (req, res) => {
    try {
      const userId = req.user?.id || 'TEST_USER_ID';
      const { kind, promoted, status, sort } = req.query;
      
      const { skip, take, page, limit } = PaginationUtil.getPaginationOptions(req.query);
      
      const filters = { kind, promoted, status };
      const result = await this.artworkService.getAllArtworks(userId, filters, sort, skip, take);
      
      // Format URLs and remove unused fields to save bandwidth
      const formattedData = result.data.map(a => {
        const formatted = this.formatMediaUrls(req, a);
        
        // PROFILE_ONLY artworks don't need competition or vote data
        if (formatted.competitionState === 'PROFILE_ONLY') {
          delete formatted.votesCount;
          delete formatted.rank;
          delete formatted.competition;
        } else {
          // IN_COMPETITION or ENDED don't need likesCount according to user
          delete formatted.likesCount;
        }
        
        return formatted;
      });
      
      const meta = PaginationUtil.getMetadata(result.total, page, limit);
      
      res.status(200).json({ success: true, data: formattedData, meta });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  getArtworkDetails = async (req, res) => {
    try {
      const { id } = req.params;
      const result = await this.artworkService.getArtworkDetails(id);
      if (!result) {
        return res.status(404).json({ success: false, error: 'Artwork not found' });
      }
      res.status(200).json({ success: true, data: this.formatMediaUrls(req, result) });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  deleteArtwork = async (req, res) => {
    try {
      const userId = req.user?.id || 'TEST_USER_ID';
      const { id } = req.params;
      await this.artworkService.deleteArtwork(id, userId);
      res.status(200).json({ success: true, message: 'Artwork deleted successfully' });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  updateArtwork = async (req, res) => {
    try {
      const userId = req.user?.id || 'TEST_USER_ID';
      const { id } = req.params;
      const data = req.validatedBody || req.body;
      const result = await this.artworkService.updateArtwork(id, userId, data);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  promoteArtwork = async (req, res) => {
    try {
      const userId = req.user?.id || 'TEST_USER_ID';
      const { id } = req.params;
      const { durationDays } = req.validatedBody || req.body;
      
      const result = await this.artworkService.promoteArtwork(id, userId, Number(durationDays));
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  switchToCompetition = async (req, res) => {
    try {
      const userId = req.user?.id || 'TEST_USER_ID';
      const { id } = req.params;
      
      const result = await this.artworkService.switchToCompetition(id, userId);
      ResponseUtil.actionSuccess(res, 'Successfully switched to competition', result.id);
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  resubmitArtwork = async (req, res) => {
    try {
      const userId = req.user?.id || 'TEST_USER_ID';
      const { id } = req.params;
      
      const result = await this.artworkService.resubmitArtwork(id, userId);
      ResponseUtil.actionSuccess(res, 'Successfully resubmitted to active competition', result.id);
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  getPublicArtworks = async (req, res, next) => {
    try {
      const { status, sort, page, limit } = req.query;
      const skip = PaginationUtil.getSkip(page, limit);
      const take = PaginationUtil.getLimit(limit);
      const filters = { status };
      const artworks = await this.artworkService.getPublicArtworks(filters, sort || 'newest', skip, take);
      
      const formattedData = artworks.data.map(a => this.formatMediaUrls(req, a));
      return ResponseUtil.success(res, 'Public artworks retrieved successfully', { ...artworks, data: formattedData });
    } catch (err) {
      next(err);
    }
  }

  getPublicArtworkDetails = async (req, res, next) => {
    try {
      const { id } = req.params;
      const viewerId = req.user?.id || req.ip;
      const artwork = await this.artworkService.getPublicArtworkDetails(id, viewerId);
      return ResponseUtil.success(res, 'Artwork details retrieved successfully', this.formatMediaUrls(req, artwork));
    } catch (err) {
      next(err);
    }
  }

  voteArtwork = async (req, res, next) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      const ipAddress = req.ip || req.headers['x-forwarded-for'] || '127.0.0.1';
      const result = await this.artworkService.voteArtwork(id, userId, ipAddress);
      return ResponseUtil.success(res, 'Vote recorded successfully', result);
    } catch (err) {
      next(err);
    }
  }

  likeArtwork = async (req, res, next) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      const result = await this.artworkService.toggleLikeArtwork(id, userId);
      const msg = result.liked ? 'Artwork liked successfully' : 'Artwork unliked successfully';
      return ResponseUtil.success(res, msg, result);
    } catch (err) {
      next(err);
    }
  }

  saveArtwork = async (req, res, next) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      const result = await this.artworkService.toggleSaveArtwork(id, userId);
      const msg = result.saved ? 'Artwork saved successfully' : 'Artwork removed from saved list';
      return ResponseUtil.success(res, msg, result);
    } catch (err) {
      next(err);
    }
  }

  commentArtwork = async (req, res, next) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      const { body } = req.validatedBody;
      const comment = await this.artworkService.addComment(id, userId, body);
      return ResponseUtil.success(res, 'Comment added successfully', comment, 201);
    } catch (err) {
      next(err);
    }
  }

  reportArtwork = async (req, res, next) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      const { reason, details } = req.validatedBody;
      const report = await this.artworkService.reportArtwork(id, userId, reason, details);
      return ResponseUtil.success(res, 'Report submitted successfully', report, 201);
    } catch (err) {
      next(err);
    }
  }
}
