import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import { AppError } from '../utils/AppError';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
const MAX_SIZE = 10 * 1024 * 1024;

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, path.join(__dirname, '../../uploads/documents')),
  filename: (_req, file, cb) => {
    const hex = crypto.randomBytes(12).toString('hex');
    cb(null, `${hex}${path.extname(file.originalname).toLowerCase()}`);
  },
});

export const uploadDocument = multer({
  storage,
  limits: { fileSize: MAX_SIZE },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_TYPES.includes(file.mimetype)) cb(null, true);
    else cb(new AppError('File type not allowed', 400));
  },
}).single('file');
