import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { StorageService } from './storage.service';

/**
 * 录音文件上传入口。
 * 学生端 wx.uploadFile 调用：
 *   POST /api/storage/upload  (multipart/form-data; field: file)
 * 返回：{ url, key, size }
 */
@Controller('storage')
export class StorageController {
  constructor(private readonly storage: StorageService) {}

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB 单文件
    }),
  )
  async upload(
    @UploadedFile() file?: { originalname: string; mimetype: string; buffer: Buffer; size: number },
  ) {
    if (!file) throw new BadRequestException('未收到文件，请用 multipart/form-data 上传，字段名 file');
    return this.storage.uploadBuffer(file.buffer, file.originalname, file.mimetype);
  }
}
