import type { NextFunction, Request, Response } from "express";

import { verifyFileSignature } from "../../src/middleware/upload.middleware.js";
import { ValidationError } from "../../src/lib/error.js";

const file = (mimetype: string, bytes: number[] | string) =>
  ({
    originalname: "upload",
    mimetype,
    buffer: typeof bytes === "string" ? Buffer.from(bytes) : Buffer.from(bytes),
  }) as Express.Multer.File;

const verify = (req: Partial<Request>) => {
  let error: unknown;
  verifyFileSignature(req as Request, {} as Response, ((err?: unknown) => {
    error = err;
  }) as NextFunction);
  return error;
};

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00];
const JPEG = [0xff, 0xd8, 0xff, 0xe0];
const OLE = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
const ZIP = [0x50, 0x4b, 0x03, 0x04];
const WEBP = "RIFF\0\0\0\0WEBPVP8 ";

describe("verifyFileSignature", () => {
  it.each([
    ["image/png", PNG],
    ["image/jpeg", JPEG],
    ["image/jpg", JPEG],
    ["image/webp", WEBP],
    ["image/gif", "GIF89a"],
    ["application/pdf", "%PDF-1.7"],
    ["application/msword", OLE],
    ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", ZIP],
    ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", ZIP],
    ["text/csv", "name,amount\nAda,100\n"],
    ["application/vnd.ms-excel", OLE],
    ["application/vnd.ms-excel", "name,amount\n"],
  ])("accepts a real %s", (mimetype, bytes) => {
    expect(verify({ file: file(mimetype, bytes) })).toBeUndefined();
  });

  /** The attack: an HTML or executable payload uploaded with an image Content-Type. */
  it.each([
    ["image/png", "<html><script>alert(1)</script>"],
    ["image/jpeg", PNG],
    ["application/pdf", JPEG],
    ["application/msword", ZIP],
    ["text/csv", [0x4d, 0x5a, 0x00, 0x00]],
    ["application/vnd.ms-excel", [0x4d, 0x5a, 0x00, 0x00]],
  ])("rejects bytes that are not a %s", (mimetype, bytes) => {
    expect(verify({ file: file(mimetype, bytes) })).toBeInstanceOf(ValidationError);
  });

  it("rejects a mimetype it has no signature for", () => {
    expect(verify({ file: file("image/svg+xml", "<svg/>") })).toBeInstanceOf(ValidationError);
  });

  it("checks every file, not only the first", () => {
    const files = [file("image/png", PNG), file("image/png", "not a png")];

    expect(verify({ files })).toBeInstanceOf(ValidationError);
  });

  it("checks files uploaded under named fields", () => {
    const files = { front: [file("image/png", PNG)], back: [file("image/jpeg", "nope")] };

    expect(verify({ files })).toBeInstanceOf(ValidationError);
  });

  it("passes a request with no files through", () => {
    expect(verify({})).toBeUndefined();
  });
});
