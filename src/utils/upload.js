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
  if (file.fieldname === 'avatar' || file.fieldname === 'coverPhoto' || file.fieldname === 'images') {
    const allowedImageTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.avif'];
    const ext = path.extname(file.originalname).toLowerCase();
    
    if (allowedImageTypes.includes(file.mimetype) || allowedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid image file. Supported formats are: jpg, jpeg, png, webp, avif'), false);
    }
  } else if (file.fieldname === 'introVideo' || file.fieldname === 'video') {
    if (file.mimetype === 'video/mp4') {
      cb(null, true);
    } else {
      cb(new Error('Only mp4 videos are allowed!'), false);
    }
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
