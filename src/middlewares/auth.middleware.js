import { ResponseUtil } from '../utils/response.js';
import { JwtUtil } from '../utils/jwt.js';

export const requireAuth = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return ResponseUtil.error(res, 'Access denied. No token provided.', 401);
    }

    const token = authHeader.split(' ')[1];
    const decoded = JwtUtil.verifyToken(token);
    
    // Attach decoded user information to request
    req.user = decoded;
    
    next();
  } catch (err) {
    return ResponseUtil.error(res, 'Invalid or expired token.', 401);
  }
};

export const optionalAuth = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.split(' ')[1];
    const decoded = JwtUtil.verifyToken(token);
    req.user = decoded;
    next();
  } catch (err) {
    // If token is invalid, just proceed as guest
    next();
  }
};

export const requireAdmin = (req, res, next) => {
  // Must run after requireAuth
  if (!req.user) {
    return ResponseUtil.error(res, 'Access denied. User not authenticated.', 401);
  }
  
  if (req.user.role !== 'ADMIN') {
    return ResponseUtil.error(res, 'Access denied. Admin privileges required.', 403);
  }
  
  next();
};
