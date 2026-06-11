import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import COS = require('cos-nodejs-sdk-v5');

/**
 * 文件存储抽象层。
 *   MVP 本地（COS_MOCK=true）：写入 backend/uploads/ 并返回 http://localhost:<port>/uploads/xxx
 *   生产（COS_MOCK=false）：服务端代上传到腾讯云 COS，返回公有读永久 URL
 *
 * 接口设计有意做成「服务端代上传」与「客户端直传签名」两套都能套：
 *   - uploadBuffer(buffer, key, mime)  ：服务端代上传（当前用）
 *   - getUploadCredential(key, mime)   ：客户端直传签名（后续需要时实现）
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private cosClient?: COS;

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

    return this.uploadToCos(buffer, key, mimeType);
  }

  /** 客户端直传签名预留接口；当前走服务端代传，未实现 */
  getUploadCredential(_key: string, _mime: string): Promise<unknown> {
    throw new BadRequestException('客户端直传签名未实现（当前走服务端代传）');
  }

  // -----------------------------------------------------------------

  /** 上传到腾讯云 COS，返回公有读永久 URL */
  private async uploadToCos(
    buffer: Buffer,
    key: string,
    mimeType: string,
  ): Promise<{ url: string; key: string; size: number }> {
    const region = this.config.get<string>('cos.region') ?? '';
    const bucket = this.config.get<string>('cos.bucket') ?? '';
    if (!region || !bucket) {
      throw new BadRequestException(
        'COS 未配置：缺少 COS_REGION / COS_BUCKET 环境变量',
      );
    }

    const cos = this.getCos();
    try {
      const data = await new Promise<COS.PutObjectResult>((resolve, reject) => {
        cos.putObject(
          {
            Bucket: bucket,
            Region: region,
            Key: key,
            Body: buffer,
            ContentLength: buffer.length,
            ContentType: mimeType || 'application/octet-stream',
            // 对象级公有读：即便桶策略遗漏也能直接播放（桶若禁用 ACL 则由桶策略决定）
            ACL: 'public-read',
          },
          (err, result) => (err ? reject(err) : resolve(result)),
        );
      });

      // data.Location 形如 bucket-appid.cos.region.myqcloud.com/audios/xxx（不含协议）
      const url = data.Location
        ? `https://${data.Location}`
        : `https://${bucket}.cos.${region}.myqcloud.com/${key}`;
      this.logger.log(`[cos] uploaded ${key} (${buffer.length}B) -> ${url}`);
      return { url, key, size: buffer.length };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`[cos] upload failed for ${key}: ${msg}`);
      throw new BadRequestException(`录音上传 COS 失败：${msg}`);
    }
  }

  /** 懒加载 COS 客户端（仅生产模式需要） */
  private getCos(): COS {
    if (this.cosClient) return this.cosClient;
    const secretId = this.config.get<string>('cos.secretId') ?? '';
    const secretKey = this.config.get<string>('cos.secretKey') ?? '';
    if (!secretId || !secretKey) {
      throw new BadRequestException(
        'COS 未配置：缺少 COS_SECRET_ID / COS_SECRET_KEY 环境变量',
      );
    }
    this.cosClient = new COS({ SecretId: secretId, SecretKey: secretKey });
    return this.cosClient;
  }

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
