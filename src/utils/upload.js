import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadDir = path.join(__dirname, '../../uploads');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  if (file.fieldname === 'avatar' || file.fieldname === 'profilePhoto' || file.fieldname === 'coverPhoto' || file.fieldname === 'images' || file.fieldname === 'singlePhoto' || file.fieldname === 'sixPhotos' || file.fieldname === 'twelvePhotos' || file.fieldname === 'bannerImage') {
    const allowedImageTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.avif'];
    const ext = path.extname(file.originalname).toLowerCase();
    
    if (allowedImageTypes.includes(file.mimetype) || allowedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid image file. Supported formats are: jpg, jpeg, png, webp, avif'), false);
    }
  } else if (file.fieldname === 'introVideo' || file.fieldname === 'video' || file.fieldname === 'singleVideo' || file.fieldname === 'sixVideo' || file.fieldname === 'twelveVideo') {
    if (file.mimetype === 'video/mp4') {
      cb(null, true);
    } else {
      cb(new Error('Only mp4 videos are allowed!'), false);
    }
  } else if (file.fieldname === 'media') {
    const allowedImageTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
    const ext = path.extname(file.originalname).toLowerCase();
    const allowedImageExts = ['.jpg', '.jpeg', '.png', '.webp', '.avif'];

    if (allowedImageTypes.includes(file.mimetype) || allowedImageExts.includes(ext) || file.mimetype === 'video/mp4') {
      cb(null, true);
    } else {
      cb(new Error('Invalid media file. Supported formats: jpg, jpeg, png, webp, avif, or mp4 video'), false);
    }
  } else if (file.fieldname === 'banner') {
    const allowedImageTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.avif'];
    const ext = path.extname(file.originalname).toLowerCase();
    
    if (allowedImageTypes.includes(file.mimetype) || allowedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid banner file. Supported formats are: jpg, jpeg, png, webp, avif'), false);
    }
  } else if (file.fieldname === 'file') {
    // Chat files: Allow basically any standard file (images, videos, audio, pdf, docx, etc.)
    // We will bypass strict MIME checking for chat files to avoid false rejections from various browser recordings.
    cb(null, true);
  } else {
    cb(new Error('Unexpected field: ' + file.fieldname), false);
  }
};

export const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB overall max file size for safety
  }
});
