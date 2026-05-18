import { IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';

export class PublishAssignmentDto {
  @IsString()
  homeworkId!: string;

  /** 不传则派发到默认班级（inviteCode=DEFAULT） */
  @IsOptional()
  @IsString()
  classId?: string;

  @IsDateString()
  startAt!: string;

  @IsDateString()
  endAt!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  remark?: string;
}
