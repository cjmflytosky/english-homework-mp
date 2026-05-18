import { request } from '../utils/request';

export interface JoinedClass {
  id: string;
  joinedAt: string;
  class: {
    id: string;
    name: string;
    grade?: string;
    inviteCode: string;
    enabled: boolean;
    owner: { id: string; name: string };
  };
}

/**
 * 学生本人查看已加入的班级列表（只读）。
 * 加入班级须由老师在后台操作，学生端不提供自助加入入口。
 */
export function listMyClasses(): Promise<JoinedClass[]> {
  return request<JoinedClass[]>({
    url: '/me/classes',
    method: 'GET',
  });
}
