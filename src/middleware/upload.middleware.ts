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

const mimeTypeFilter =
  (allowed: string[], message: string) =>
  (_req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
    if (allowed.includes(file.mimetype)) return cb(null, true);
    cb(new ValidationError(message));
  };

const mapUploadError = (err: unknown, maxBytes: number) => {
  if (!(err instanceof multer.MulterError)) return err;

  if (err.code === "LIMIT_FILE_SIZE") {
    return new ValidationError(
      `File exceeds the ${maxBytes / 1024 / 1024}MB limit`,
    );
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
  limits: { fileSize: MAX_IMAGE_BYTES },
});

const uploadDocuments = multer({
  storage: multer.memoryStorage(),
  fileFilter: mimeTypeFilter(
    documentMimeTypes,
    "Invalid file type. Allowed: images, PDF, Word, Excel.",
  ),
  limits: { fileSize: MAX_DOCUMENT_BYTES },
});

/** Product / logo image. Field name: `image`. */
export const uploadSingleImage = withUploadErrors(
  uploadImage.single("image"),
  MAX_IMAGE_BYTES,
);

/** Multiple supporting documents. Field name: `documents`. */
export const uploadDocumentsMany = withUploadErrors(
  uploadDocuments.array("documents", MAX_DOCUMENTS),
  MAX_DOCUMENT_BYTES,
);

const csvMimeTypes = ["text/csv", "application/csv", "text/plain", "application/vnd.ms-excel"];

const uploadCsv = multer({
  storage: multer.memoryStorage(),
  fileFilter: mimeTypeFilter(csvMimeTypes, "Invalid file type. Upload a CSV file."),
  limits: { fileSize: MAX_DOCUMENT_BYTES },
});

/** Catalogue import. Field name: `file`. */
export const uploadSingleCsv = withUploadErrors(uploadCsv.single("file"), MAX_DOCUMENT_BYTES);
