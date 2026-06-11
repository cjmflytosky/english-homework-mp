import { IsIn } from 'class-validator';

export class UpdateStudentRoleDto {
  @IsIn(['STUDENT', 'TEACHER', 'ADMIN'])
  role!: 'STUDENT' | 'TEACHER' | 'ADMIN';
}
