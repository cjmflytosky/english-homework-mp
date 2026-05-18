/**
 * 通用分页查询参数。
 */
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class PageQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize: number = 20;

  /** 通用搜索关键字（用于班级、学生列表等） */
  @IsOptional()
  @IsString()
  @MaxLength(50)
  keyword?: string;
}
