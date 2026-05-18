import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class UploadItemDto {
  @IsString()
  assignmentId!: string;

  @IsString()
  homeworkItemId!: string;

  /** 录音文件 URL（先调 /storage/upload 拿到） */
  @IsString()
  audioUrl!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  duration?: number;
}
