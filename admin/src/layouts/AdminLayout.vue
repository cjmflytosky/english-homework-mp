<template>
  <el-container class="layout">
    <el-aside width="220px" class="aside">
      <div class="brand">✦ 星创想</div>
      <el-menu :default-active="activeMenu" router class="menu" background-color="transparent"
               text-color="#C7D0EA" active-text-color="#FFFFFF">
        <el-menu-item index="/dashboard">工作台</el-menu-item>
        <el-menu-item index="/homework">作业管理</el-menu-item>
        <el-menu-item index="/assignment">已发布作业</el-menu-item>
        <el-menu-item index="/class">班级管理</el-menu-item>
        <el-menu-item index="/students">学生管理</el-menu-item>
      </el-menu>
    </el-aside>

    <el-container>
      <el-header class="header">
        <div class="header__title">{{ (route.meta.title as string) ?? '管理后台' }}</div>
        <div class="header__actions">
          <span class="hello">你好，{{ auth.admin?.name }}</span>
          <el-button size="small" text @click="onLogout">退出</el-button>
        </div>
      </el-header>
      <el-main class="main">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/store/auth';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();

const activeMenu = computed(() => {
  const p = route.path;
  if (p.startsWith('/homework')) return '/homework';
  if (p.startsWith('/assignment') || p.startsWith('/submission')) return '/assignment';
  if (p.startsWith('/class')) return '/class';
  if (p.startsWith('/students')) return '/students';
  return p;
});

function onLogout() {
  auth.logout();
  void router.push('/login');
}
</script>

<style scoped lang="scss">
.layout { height: 100vh; }
.aside {
  background: linear-gradient(180deg, #0E1A4A 0%, #182A6E 100%);
  color: #fff;
  padding-top: 16px;
}
.brand {
  text-align: center;
  font-size: 22px;
  font-weight: 700;
  letter-spacing: 4px;
  padding: 12px 0 24px;
}
.menu { border-right: none; }
.header {
  display: flex; align-items: center; justify-content: space-between;
  background: #fff;
  border-bottom: 1px solid #eef0f5;
}
.header__title { font-size: 16px; font-weight: 600; }
.header__actions { display: flex; align-items: center; gap: 12px; }
.hello { color: #6b7280; font-size: 14px; }
.main { background: #F4F6FB; }
</style>
