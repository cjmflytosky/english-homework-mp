import { createRouter, createWebHashHistory, RouteRecordRaw } from 'vue-router';
import { useAuthStore } from '@/store/auth';

const routes: RouteRecordRaw[] = [
  { path: '/', redirect: '/dashboard' },
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/login/Login.vue'),
    meta: { public: true },
  },
  {
    path: '/',
    component: () => import('@/layouts/AdminLayout.vue'),
    children: [
      {
        path: 'dashboard',
        name: 'dashboard',
        component: () => import('@/views/dashboard/Dashboard.vue'),
        meta: { title: '工作台' },
      },
      {
        path: 'homework',
        name: 'homework-list',
        component: () => import('@/views/homework/HomeworkList.vue'),
        meta: { title: '作业管理' },
      },
      {
        path: 'homework/new',
        name: 'homework-new',
        component: () => import('@/views/homework/HomeworkEdit.vue'),
        meta: { title: '新建作业' },
      },
      {
        path: 'homework/:id',
        name: 'homework-detail',
        component: () => import('@/views/homework/HomeworkDetail.vue'),
        meta: { title: '作业详情' },
      },
      {
        path: 'assignment',
        name: 'assignment-list',
        component: () => import('@/views/assignment/AssignmentList.vue'),
        meta: { title: '已发布作业' },
      },
      {
        path: 'assignment/:id',
        name: 'assignment-detail',
        component: () => import('@/views/assignment/AssignmentDetail.vue'),
        meta: { title: '提交批改' },
      },
      {
        path: 'submission/:id',
        name: 'submission-detail',
        component: () => import('@/views/assignment/SubmissionDetail.vue'),
        meta: { title: '提交详情' },
      },
      {
        path: 'class',
        name: 'class-list',
        component: () => import('@/views/class/ClassList.vue'),
        meta: { title: '班级管理' },
      },
      {
        path: 'class/:id',
        name: 'class-detail',
        component: () => import('@/views/class/ClassDetail.vue'),
        meta: { title: '班级详情' },
      },
      {
        path: 'students',
        name: 'student-list',
        component: () => import('@/views/student/StudentList.vue'),
        meta: { title: '学生管理' },
      },
      {
        path: 'students/:id',
        name: 'student-detail',
        component: () => import('@/views/student/StudentDetail.vue'),
        meta: { title: '学生详情' },
      },
    ],
  },
];

const router = createRouter({
  history: createWebHashHistory(),
  routes,
});

router.beforeEach((to) => {
  const auth = useAuthStore();
  if (to.meta.public) return true;
  if (!auth.token) {
    return { path: '/login', query: { redirect: to.fullPath } };
  }
  return true;
});

export default router;
