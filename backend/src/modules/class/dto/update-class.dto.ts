import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateClassDto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  grade?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  remark?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
