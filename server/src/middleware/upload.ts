import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import fs from 'fs';
import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/AppError';

const ALLOWED_TYPES = [
  'image/jpeg', 'image/png', 'image/webp', 'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];
const MAX_SIZE = 10 * 1024 * 1024;

const MAGIC: Record<string, number[]> = {
  'image/jpeg':       [0xFF, 0xD8, 0xFF],
  'image/png':        [0x89, 0x50, 0x4E, 0x47],
  'image/webp':       [0x52, 0x49, 0x46, 0x46],
  'application/pdf':  [0x25, 0x50, 0x44, 0x46],
  'application/msword': [0xD0, 0xCF, 0x11, 0xE0],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': [0x50, 0x4B, 0x03, 0x04],
};

function matchesMagic(filePath: string, mime: string): boolean {
  const sig = MAGIC[mime];
  if (!sig) return false;
  const buf = Buffer.alloc(sig.length);
  const fd = fs.openSync(filePath, 'r');
  fs.readSync(fd, buf, 0, sig.length, 0);
  fs.closeSync(fd);
  return sig.every((byte, i) => buf[i] === byte);
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, path.join(__dirname, '../../uploads/documents')),
  filename: (_req, file, cb) => {
    const hex = crypto.randomBytes(12).toString('hex');
    cb(null, `${hex}${path.extname(file.originalname).toLowerCase()}`);
  },
});

const multerUpload = multer({
  storage,
  limits: { fileSize: MAX_SIZE },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_TYPES.includes(file.mimetype)) cb(null, true);
    else cb(new AppError('File type not allowed', 400));
  },
}).single('file');

export function uploadDocument(req: Request, res: Response, next: NextFunction) {
  multerUpload(req, res, (err) => {
    if (err) return next(err);
    if (!req.file) return next();
    if (!matchesMagic(req.file.path, req.file.mimetype)) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ message: 'File type not allowed' });
    }
    next();
  });
}
