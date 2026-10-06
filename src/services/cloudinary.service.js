import { cloudinary } from '../config/cloudinary.js';

export const uploadImage = (buffer, folder = 'learnhub/thumbnails') => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: 'image' },
      (err, result) => {
        if (err) return reject(err);
        resolve({
          url: result.secure_url,
          publicId: result.public_id,
        });
      }
    );
    stream.end(buffer);
  });
};

export const uploadVideo = (buffer, folder = 'learnhub/videos') => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: 'video',
        chunk_size: 6000000,
      },
      (err, result) => {
        if (err) return reject(err);
        resolve({
          url: result.secure_url,
          publicId: result.public_id,
          duration: result.duration,
        });
      }
    );
    stream.end(buffer);
  });
};

export const deleteAsset = async (publicId, resourceType = 'image') => {
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
  } catch (err) {
    console.error(`Failed to delete Cloudinary asset ${publicId}: ${err.message}`);
  }
};

// ---------------------------------------------------------------------------
// Chat attachments
// ---------------------------------------------------------------------------

// Mime types allowed for chat attachments, and how each maps onto Cloudinary's
// resource_type. Anything not listed here is rejected before we hit Cloudinary.
export const CHAT_MIME_MAP = {
  // Images
  'image/jpeg': { type: 'image', resourceType: 'image' },
  'image/jpg': { type: 'image', resourceType: 'image' },
  'image/png': { type: 'image', resourceType: 'image' },
  'image/webp': { type: 'image', resourceType: 'image' },
  'image/gif': { type: 'image', resourceType: 'image' },

  // Documents (Cloudinary stores these as "raw")
  'application/pdf': { type: 'document', resourceType: 'raw' },
  'application/msword': { type: 'document', resourceType: 'raw' },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': {
    type: 'document',
    resourceType: 'raw',
  },
  'application/vnd.ms-powerpoint': { type: 'document', resourceType: 'raw' },
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': {
    type: 'document',
    resourceType: 'raw',
  },
  'application/vnd.ms-excel': { type: 'document', resourceType: 'raw' },
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': {
    type: 'document',
    resourceType: 'raw',
  },
  'text/plain': { type: 'document', resourceType: 'raw' },

  // Audio
  'audio/mpeg': { type: 'audio', resourceType: 'video' },
  'audio/mp3': { type: 'audio', resourceType: 'video' },
  'audio/wav': { type: 'audio', resourceType: 'video' },
  'audio/x-wav': { type: 'audio', resourceType: 'video' },
  'audio/m4a': { type: 'audio', resourceType: 'video' },
  'audio/x-m4a': { type: 'audio', resourceType: 'video' },
  'audio/ogg': { type: 'audio', resourceType: 'video' },

  // Video
  'video/mp4': { type: 'video', resourceType: 'video' },
  'video/webm': { type: 'video', resourceType: 'video' },
  'video/quicktime': { type: 'video', resourceType: 'video' },
};

/**
 * Upload a chat attachment buffer to Cloudinary.
 *
 * @param {Buffer} buffer              File contents.
 * @param {Object} file                Multer file object.
 * @param {string} file.mimetype
 * @param {string} file.originalname
 * @param {number} file.size
 * @returns {Promise<{
 *   url: string,
 *   publicId: string,
 *   type: 'image' | 'video' | 'audio' | 'document',
 *   name: string,
 *   size: number,
 *   mime: string,
 *   resourceType: 'image' | 'video' | 'raw',
 * }>}
 */
export const uploadChatAttachment = (buffer, file) => {
  const { mimetype, originalname, size } = file || {};

  const mapping = CHAT_MIME_MAP[mimetype];
  if (!mapping) {
    const err = new Error(`Unsupported file type: ${mimetype}`);
    err.status = 400;
    err.code = 'UNSUPPORTED_FILE_TYPE';
    throw err;
  }

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: 'learnhub/chat',
        resource_type: mapping.resourceType,
        // Keep the original filename visible in Cloudinary for documents.
        use_filename: true,
        unique_filename: true,
        // For video/audio, keep chunked upload for larger files.
        ...(mapping.resourceType === 'video' ? { chunk_size: 6000000 } : {}),
      },
      (err, result) => {
        if (err) return reject(err);
        resolve({
          url: result.secure_url,
          publicId: result.public_id,
          type: mapping.type,
          name: originalname || result.original_filename || 'file',
          size: Number(size) || 0,
          mime: mimetype,
          resourceType: mapping.resourceType,
        });
      }
    );
    stream.end(buffer);
  });
};