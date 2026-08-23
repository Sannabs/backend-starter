import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { env } from "./env.js";
import { logger } from "../lib/logger.js";

const PRESIGNED_URL_TTL_SECONDS = 3600;

const s3Client = new S3Client({
  region: "auto",
  endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
  },
});

interface UploadInput {
  fileBuffer: Buffer;
  key: string;
  contentType: string;
}

export const uploadFile = async ({
  fileBuffer,
  key,
  contentType,
}: UploadInput): Promise<string> => {
  await s3Client.send(
    new PutObjectCommand({
      Bucket: env.R2_BUCKET_NAME,
      Key: key,
      Body: fileBuffer,
      ContentType: contentType,
    }),
  );

  return `${env.R2_PUBLIC_URL}/${key}`;
};

export const deleteFile = async (key: string): Promise<void> => {
  await s3Client.send(
    new DeleteObjectCommand({ Bucket: env.R2_BUCKET_NAME, Key: key }),
  );

  logger.info("File deleted from R2", { key });
};

export const getFile = async (key: string): Promise<Buffer> => {
  const { Body } = await s3Client.send(
    new GetObjectCommand({ Bucket: env.R2_BUCKET_NAME, Key: key }),
  );

  if (!Body) throw new Error(`R2 object has no body: ${key}`);

  return Buffer.from(await Body.transformToByteArray());
};

// For private objects only; public product images are served from R2_PUBLIC_URL.
export const getPresignedDownloadUrl = (
  key: string,
  expiresIn = PRESIGNED_URL_TTL_SECONDS,
): Promise<string> =>
  getSignedUrl(
    s3Client,
    new GetObjectCommand({ Bucket: env.R2_BUCKET_NAME, Key: key }),
    { expiresIn },
  );

export const generateKey = (originalName: string, folder = "uploads") => {
  const extension = originalName.split(".").pop()?.toLowerCase() ?? "bin";
  const random = Math.random().toString(36).substring(2, 15);

  return `${folder}/${Date.now()}-${random}.${extension}`;
};

export const extractKeyFromUrl = (url: string) =>
  new URL(url).pathname.substring(1);
