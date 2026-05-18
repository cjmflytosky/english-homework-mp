import { ArrayMaxSize, ArrayMinSize, IsArray, IsString } from 'class-validator';

export class AddMembersDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @IsString({ each: true })
  studentIds!: string[];
}
