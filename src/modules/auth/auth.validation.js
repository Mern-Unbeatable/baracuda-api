import Joi from 'joi';
import { ResponseUtil } from '../../utils/response.js';

const maxWords = (max) => (value, helpers) => {
  if (!value) return value;
  const wordCount = value.trim().split(/\s+/).length;
  if (wordCount > max) {
    return helpers.message(`{#label} must not exceed ${max} words`);
  }
  return value;
};

const popularPlatforms = [
  { name: 'facebook', regex: /facebook\.com/i },
  { name: 'instagram', regex: /instagram\.com/i },
  { name: 'twitter', regex: /(twitter\.com|x\.com)/i },
  { name: 'tiktok', regex: /tiktok\.com/i },
  { name: 'youtube', regex: /youtube\.com/i },
  { name: 'linkedin', regex: /linkedin\.com/i },
  { name: 'snapchat', regex: /snapchat\.com/i },
  { name: 'pinterest', regex: /pinterest\.com/i },
  { name: 'reddit', regex: /reddit\.com/i }
];

const parseSocialLinks = (value, helpers) => {
  try {
    let urls = value;
    if (typeof value === 'string') {
      urls = JSON.parse(value);
    }
    
    if (!Array.isArray(urls)) {
      return helpers.message('socialLinks must be a JSON array of URLs');
    }

    if (urls.length === 0) {
      return helpers.message('Please provide at least one social media link');
    }

    const result = {};

    for (const url of urls) {
      try {
        new URL(url);
      } catch (e) {
        return helpers.message(`Invalid URL format: ${url}`);
      }

      let matched = false;
      for (const platform of popularPlatforms) {
        if (platform.regex.test(url)) {
          result[platform.name] = url;
          matched = true;
          break;
        }
      }

      if (!matched) {
        return helpers.message(`Unsupported social media platform for URL: ${url}`);
      }
    }

    return result; // Transforms the value into the final object!
  } catch (e) {
    return helpers.message('socialLinks must be a valid JSON array of strings');
  }
};

export const AuthValidation = {
  registerSchema: Joi.object({
    name: Joi.string().required().messages({ 'any.required': 'Full name is required' }),
    username: Joi.string().alphanum().min(3).max(30).required(),
    email: Joi.string().email().required(),
    phone: Joi.string().required(),
    country: Joi.string().required(),
    bio: Joi.string().custom(maxWords(150)).required(),
    socialLinks: Joi.any().custom(parseSocialLinks).required(),
    password: Joi.string().min(6).required(),
    avatar: Joi.any().required().messages({ 'any.required': 'Avatar photo is required' }),
    coverPhoto: Joi.any().required().messages({ 'any.required': 'Cover photo is required' }),
    introVideo: Joi.any().required().messages({ 'any.required': 'Introduction video is required' }),
  }),

  loginSchema: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required(),
  }),

  forgotPasswordSchema: Joi.object({
    email: Joi.string().email().required(),
  }),

  verifyOtpSchema: Joi.object({
    email: Joi.string().email().required(),
    otp: Joi.string().length(4).required(),
  }),

  resetPasswordSchema: Joi.object({
    token: Joi.string().required(),
    newPassword: Joi.string().min(6).required(),
  }),

  validate: (schema) => {
    return (req, res, next) => {
      // Merge body and files so Joi can validate file presence if needed
      const payload = { ...req.body };
      if (req.files) {
        Object.keys(req.files).forEach(key => {
          payload[key] = req.files[key][0];
        });
      }

      // allowUnknown: true prevents "not allowed" errors for unexpected Multer fields
      const { error, value } = schema.validate(payload, { abortEarly: false, allowUnknown: true });
      if (error) {
        return ResponseUtil.error(res, 'Validation error', 400, error.details.map(x => x.message));
      }
      
      // We only want to attach validated non-file fields to validatedBody
      const validatedBody = { ...value };
      delete validatedBody.avatar;
      delete validatedBody.coverPhoto;
      delete validatedBody.introVideo;
      
      req.validatedBody = validatedBody;
      next();
    };
  }
};
