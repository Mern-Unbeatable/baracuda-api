export const UrlUtil = {
  /**
   * Converts a relative path into a dynamic absolute URL based on the request host
   */
  getAbsoluteUrl: (req, filePath) => {
    if (!filePath) return filePath;
    // If it's already an absolute URL, leave it alone
    if (filePath.startsWith('http://') || filePath.startsWith('https://')) return filePath;
    
    // Normalize Windows backslashes if present
    let normalized = filePath.replace(/\\/g, '/');
    const uploadIndex = normalized.indexOf('/uploads/');
    if (uploadIndex !== -1) {
      normalized = normalized.substring(uploadIndex);
    } else if (normalized.startsWith('uploads/')) {
      normalized = '/' + normalized;
    }

    // Dynamically build the base URL (works for localhost and live server automatically)
    if (!req || !req.protocol || typeof req.get !== 'function') {
      return normalized.startsWith('/') ? normalized : `/${normalized}`;
    }
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    return `${baseUrl}${normalized.startsWith('/') ? '' : '/'}${normalized}`;
  },

  /**
   * Helper to format all media fields inside a user object
   */
  formatUserMedia: (req, user) => {
    if (!user) return user;
    const formattedUser = { ...user };
    if (formattedUser.avatar) formattedUser.avatar = UrlUtil.getAbsoluteUrl(req, formattedUser.avatar);
    if (formattedUser.coverPhoto) formattedUser.coverPhoto = UrlUtil.getAbsoluteUrl(req, formattedUser.coverPhoto);
    if (formattedUser.introVideo) formattedUser.introVideo = UrlUtil.getAbsoluteUrl(req, formattedUser.introVideo);
    if (formattedUser.standaloneVideos && Array.isArray(formattedUser.standaloneVideos)) {
      formattedUser.standaloneVideos = formattedUser.standaloneVideos.map(v => {
        const videoMedia = v.media && v.media[0];
        const videoUrl = videoMedia ? UrlUtil.getAbsoluteUrl(req, videoMedia.url) : null;
        const thumbnailUrl = (videoMedia?.thumbnailUrl || v.featuredImage) ? UrlUtil.getAbsoluteUrl(req, videoMedia?.thumbnailUrl || v.featuredImage) : null;
        return {
          id: v.id,
          title: v.title,
          story: v.story,
          isAiGenerated: v.isAiGenerated,
          aiBadge: v.isAiGenerated === true,
          videoUrl,
          thumbnailUrl,
          duration: videoMedia?.duration || null,
          viewsCount: v.viewsCount || 0,
          likesCount: v.likesCount || 0,
          commentsCount: v.commentsCount || 0,
          createdAt: v.createdAt
        };
      });
    }
    return formattedUser;
  }
};
