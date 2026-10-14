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
    return formattedUser;
  }
};
