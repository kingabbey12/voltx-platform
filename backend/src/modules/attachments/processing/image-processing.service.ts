import { Injectable } from '@nestjs/common';
import sharp from 'sharp';

const THUMBNAIL_MAX_DIMENSION = 320;
const OPTIMIZED_MAX_DIMENSION = 2048;

export interface ImageDimensions {
  width: number;
  height: number;
}

export interface ProcessedImage {
  optimizedBuffer: Buffer;
  thumbnailBuffer: Buffer;
  dimensions: ImageDimensions;
}

/**
 * Real image processing via sharp/libvips — strips EXIF (privacy: GPS
 * tags, device info), re-encodes to cap dimensions/file size, and
 * generates a small webp thumbnail. Runs as part of attachment
 * processing (see attachment-processing.service.ts), not on the request
 * path.
 */
@Injectable()
export class ImageProcessingService {
  async process(buffer: Buffer): Promise<ProcessedImage> {
    const image = sharp(buffer, { failOn: 'none' });
    const metadata = await image.metadata();

    const width = metadata.width ?? 0;
    const height = metadata.height ?? 0;

    const optimizedBuffer = await sharp(buffer, { failOn: 'none' })
      .rotate() // apply EXIF orientation before stripping it
      .resize({
        width: OPTIMIZED_MAX_DIMENSION,
        height: OPTIMIZED_MAX_DIMENSION,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .toFormat('webp', { quality: 85 })
      .toBuffer();

    const thumbnailBuffer = await sharp(buffer, { failOn: 'none' })
      .rotate()
      .resize({
        width: THUMBNAIL_MAX_DIMENSION,
        height: THUMBNAIL_MAX_DIMENSION,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .toFormat('webp', { quality: 70 })
      .toBuffer();

    return {
      optimizedBuffer,
      thumbnailBuffer,
      dimensions: { width, height },
    };
  }

  isImage(mimeType: string): boolean {
    return mimeType.startsWith('image/') && mimeType !== 'image/svg+xml';
  }
}
