import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

/**
 * 文件存储抽象层。
 *   MVP（COS_MOCK=true）：写入 backend/uploads/ 并返回 http://<host>/uploads/xxx
 *   真实（COS_MOCK=false）：留给后续接入腾讯云 COS（cos-nodejs-sdk-v5 或 直传签名）
 *
 * 接口设计有意做成「服务端代上传」与「客户端直传签名」两套都能套：
 *   - uploadBuffer(buffer, key, mime)  ：服务端代上传（当前用）
 *   - getUploadCredential(key, mime)   ：客户端直传签名（COS 接入时实现）
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);

  constructor(private readonly config: ConfigService) {}

  /** 上传一个 Buffer，返回可访问 URL */
  async uploadBuffer(
    buffer: Buffer,
    originalName: string,
    mimeType: string,
  ): Promise<{ url: string; key: string; size: number }> {
    if (!buffer?.length) {
      throw new BadRequestException('上传内容为空');
    }
    const isMock = this.config.get<boolean>('cos.mock');
    const ext = this.pickExt(originalName, mimeType);
    const key = `audios/${this.datePath()}/${crypto.randomBytes(8).toString('hex')}${ext}`;

    if (isMock) {
      const root = path.resolve(process.cwd(), 'uploads');
      const absPath = path.join(root, key);
      await fs.mkdir(path.dirname(absPath), { recursive: true });
      await fs.writeFile(absPath, buffer);
      const port = this.config.get<number>('port') ?? 3000;
      const url = `http://localhost:${port}/uploads/${key}`;
      this.logger.log(`[mock-cos] saved ${absPath} (${buffer.length}B)`);
      return { url, key, size: buffer.length };
    }

    // 接入腾讯云 COS 时实现
    throw new BadRequestException(
      'COS 模式未实现：请在 cos.mock=true 下使用，或后续接入腾讯云 COS SDK',
    );
  }

  /** 客户端直传签名预留接口；阶段 3 不实现，COS 接入时补全 */
  getUploadCredential(_key: string, _mime: string): Promise<unknown> {
    throw new BadRequestException('客户端直传签名未实现（COS 阶段实现）');
  }

  // -----------------------------------------------------------------

  private pickExt(name: string, mime: string): string {
    const fromName = path.extname(name).toLowerCase();
    if (fromName) return fromName;
    if (mime.includes('mp3')) return '.mp3';
    if (mime.includes('aac')) return '.aac';
    if (mime.includes('mp4')) return '.m4a';
    if (mime.includes('wav')) return '.wav';
    return '.bin';
  }

  private datePath(): string {
    const d = new Date();
    return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  }
}
