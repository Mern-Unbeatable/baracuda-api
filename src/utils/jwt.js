import jwt from 'jsonwebtoken';
import config from '../config/env.js';

export class JwtUtil {
  static generateToken(payload) {
    return jwt.sign(payload, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn,
    });
  }

  static verifyToken(token) {
    return jwt.verify(token, config.jwt.secret);
  }
}
