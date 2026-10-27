import multer from "multer";
import type { FileFilterCallback } from "multer";
import type { Request, RequestHandler } from "express";

import { ValidationError } from "../lib/error.js";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
const MAX_DOCUMENTS = 10;

const imageMimeTypes = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
];

const documentMimeTypes = [
  ...imageMimeTypes,
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

const csvMimeTypes = ["text/csv", "application/csv", "text/plain", "application/vnd.ms-excel"];

const heicMimeTypes = ["image/heic", "image/heif"];

const mimeTypeFilter =
  (allowed: string[], message: string) =>
  (_req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
    if (allowed.includes(file.mimetype)) return cb(null, true);
    if (heicMimeTypes.includes(file.mimetype)) {
      return cb(
        new ValidationError("HEIC images are not supported. Upload a JPEG or PNG."),
      );
    }
    cb(new ValidationError(message));
  };

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const OLE_MAGIC = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
const ZIP_MAGIC = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
const TEXT_SNIFF_BYTES = 8192;

const isJpeg = (b: Buffer) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
// .doc and .xls share the legacy OLE container; .docx and .xlsx are zip archives.
const isOle = (b: Buffer) => b.subarray(0, 8).equals(OLE_MAGIC);
const isZip = (b: Buffer) => b.subarray(0, 4).equals(ZIP_MAGIC);
// CSV has no signature; a NUL byte means a binary file renamed to .csv.
const isText = (b: Buffer) => !b.subarray(0, TEXT_SNIFF_BYTES).includes(0);

// The client sets the mimetype, so it proves nothing about the bytes behind it.
const fileSignatures: Record<string, (bytes: Buffer) => boolean> = {
  "image/jpeg": isJpeg,
  "image/jpg": isJpeg,
  "image/png": (b) => b.subarray(0, 8).equals(PNG_MAGIC),
  "image/webp": (b) =>
    b.subarray(0, 4).toString("ascii") === "RIFF" &&
    b.subarray(8, 12).toString("ascii") === "WEBP",
  "image/gif": (b) => b.subarray(0, 4).toString("ascii") === "GIF8",
  "application/pdf": (b) => b.subarray(0, 5).toString("ascii") === "%PDF-",
  "application/msword": isOle,
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": isZip,
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": isZip,
  "text/csv": isText,
  "application/csv": isText,
  "text/plain": isText,
};

const collectFiles = (req: Request): Express.Multer.File[] => {
  if (req.file) return [req.file];
  if (Array.isArray(req.files)) return req.files;
  if (req.files) return Object.values(req.files).flat();

  return [];
};

// application/vnd.ms-excel is both a legacy .xls and what Windows labels a .csv,
// so either shape passes for it.
const matchesSignature = (file: Express.Multer.File) =>
  file.mimetype === "application/vnd.ms-excel"
    ? isOle(file.buffer) || isText(file.buffer)
    : Boolean(fileSignatures[file.mimetype]?.(file.buffer));

export const verifyFileSignature: RequestHandler = (req, _res, next) => {
  for (const file of collectFiles(req)) {
    if (!matchesSignature(file)) {
      return next(
        new ValidationError(`"${file.originalname}" is not a valid ${file.mimetype} file`),
      );
    }
  }

  next();
};

const mapUploadError = (err: unknown, maxBytes: number) => {
  if (!(err instanceof multer.MulterError)) return err;

  if (err.code === "LIMIT_FILE_SIZE") {
    return new ValidationError(
      `File exceeds the ${maxBytes / 1024 / 1024}MB limit`,
    );
  }
  if (err.code === "LIMIT_FILE_COUNT") {
    return new ValidationError("Too many files in one upload");
  }
  if (err.code === "LIMIT_UNEXPECTED_FILE") {
    return new ValidationError(`Unexpected file field "${err.field}"`);
  }

  return new ValidationError(err.message);
};

// Multer reports rejections to next(); without this they reach errorHandler as 500s.
const withUploadErrors =
  (handler: RequestHandler, maxBytes: number): RequestHandler =>
  (req, res, next) =>
    handler(req, res, (err: unknown) =>
      err ? next(mapUploadError(err, maxBytes)) : next(),
    );

const uploadImage = multer({
  storage: multer.memoryStorage(),
  fileFilter: mimeTypeFilter(
    imageMimeTypes,
    "Invalid file type. Only images are allowed.",
  ),
  limits: { fileSize: MAX_IMAGE_BYTES, files: 1 },
});

const uploadDocuments = multer({
  storage: multer.memoryStorage(),
  fileFilter: mimeTypeFilter(
    documentMimeTypes,
    "Invalid file type. Allowed: images, PDF, Word, Excel.",
  ),
  limits: { fileSize: MAX_DOCUMENT_BYTES, files: MAX_DOCUMENTS },
});

const uploadCsv = multer({
  storage: multer.memoryStorage(),
  fileFilter: mimeTypeFilter(csvMimeTypes, "Invalid file type. Upload a CSV file."),
  limits: { fileSize: MAX_DOCUMENT_BYTES, files: 1 },
});

/** Product / logo image. Field name: `image`. */
export const uploadSingleImage: RequestHandler[] = [
  withUploadErrors(uploadImage.single("image"), MAX_IMAGE_BYTES),
  verifyFileSignature,
];

/** Multiple supporting documents. Field name: `documents`. */
export const uploadDocumentsMany: RequestHandler[] = [
  withUploadErrors(uploadDocuments.array("documents", MAX_DOCUMENTS), MAX_DOCUMENT_BYTES),
  verifyFileSignature,
];

/** Catalogue import. Field name: `file`. */
export const uploadSingleCsv: RequestHandler[] = [
  withUploadErrors(uploadCsv.single("file"), MAX_DOCUMENT_BYTES),
  verifyFileSignature,
];
