import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { HomeworkType } from '@prisma/client';

export class CreateHomeworkItemDto {
  @IsString()
  @MaxLength(2000)
  text!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  translation?: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsString()
  refAudioUrl?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  score?: number;
}

export class CreateHomeworkDto {
  @IsString()
  @MaxLength(120)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsEnum(HomeworkType)
  type!: HomeworkType;

  @IsOptional()
  @IsInt()
  @Min(1)
  totalScore?: number;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateHomeworkItemDto)
  items!: CreateHomeworkItemDto[];
}
