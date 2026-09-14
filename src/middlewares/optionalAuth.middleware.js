import jwt from 'jsonwebtoken';
import prisma from '../config/prisma.js';

/**
 * Optional Authentication Middleware
 * Attempts to verify a JWT token and set req.user if it exists and is valid.
 * If the token is missing or invalid, it does NOT throw an error, allowing public access.
 */
export const optionalAuth = async (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies?.token) {
      token = req.cookies.token;
    }

    if (!token) {
      return next(); // Proceed as guest
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      const user = await prisma.user.findUnique({
        where: { id: decoded.id },
        select: {
          id: true,
          email: true,
          role: true,
          status: true
        }
      });

      if (user) {
        req.user = user;
      }
    } catch (err) {
      // Ignore invalid/expired token and proceed as guest
      console.warn('Optional auth ignored invalid token:', err.message);
    }
    
    next();
  } catch (error) {
    console.error('Error in optionalAuth middleware:', error);
    next();
  }
};
