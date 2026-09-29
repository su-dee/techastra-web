const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const uploadDir = path.join(__dirname, "..", "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Payment screenshots only. The browser-sent type is only a first filter: the
// saved extension comes from this map (never from the uploaded file name),
// and isImageFile() checks the file's real signature after the upload.
const EXT_FOR_MIME = { "image/png": ".png", "image/jpeg": ".jpg", "image/jpg": ".jpg", "image/webp": ".webp" };
const IMAGE_EXTS = new Set([".png", ".jpg", ".jpeg", ".webp"]);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${crypto.randomBytes(8).toString("hex")}${EXT_FOR_MIME[file.mimetype]}`);
  },
});

function fileFilter(req, file, cb) {
  if (EXT_FOR_MIME[file.mimetype]) {
    cb(null, true);
  } else {
    cb(new Error("Only PNG/JPEG/WEBP image uploads are allowed"));
  }
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024, files: 1 }, // 5MB
});

/** True if the file really is a PNG, JPEG or WebP image (by its first bytes). */
async function isImageFile(filePath) {
  const fh = await fs.promises.open(filePath, "r");
  try {
    const b = Buffer.alloc(12);
    const { bytesRead } = await fh.read(b, 0, 12, 0);
    if (bytesRead < 12) return false;
    const png = b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    const jpeg = b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
    const webp = b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP";
    return png || jpeg || webp;
  } finally {
    await fh.close();
  }
}

module.exports = { upload, uploadDir, isImageFile, IMAGE_EXTS };
