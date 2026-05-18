import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateStudentDto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  realName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  studentNo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
