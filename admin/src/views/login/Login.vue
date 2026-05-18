<template>
  <div class="login-page">
    <div class="stars">
      <span v-for="i in 30" :key="i" class="star"
            :style="{ top: rand() + '%', left: rand() + '%', opacity: 0.3 + Math.random() * 0.5 }" />
    </div>

    <el-card class="login-card" shadow="never">
      <div class="login-card__title">
        <span class="logo">✦</span> 星创想 · 管理后台
      </div>
      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        label-position="top"
        @submit.prevent="onSubmit">
        <el-form-item label="账号" prop="username">
          <el-input v-model="form.username" placeholder="请输入账号" autofocus />
        </el-form-item>
        <el-form-item label="密码" prop="password">
          <el-input v-model="form.password" type="password" placeholder="请输入密码" show-password />
        </el-form-item>
        <el-button type="primary" :loading="loading" class="submit" @click="onSubmit">
          登录
        </el-button>
      </el-form>
      <div class="hint">默认账号：admin / admin123（首次启动后端时由 seed 创建）</div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import type { FormInstance, FormRules } from 'element-plus';
import { adminLogin } from '@/api/auth';
import { useAuthStore } from '@/store/auth';

const router = useRouter();
const route = useRoute();
const auth = useAuthStore();

const formRef = ref<FormInstance>();
const loading = ref(false);
const form = reactive({ username: '', password: '' });
const rules: FormRules = {
  username: [{ required: true, message: '请输入账号', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
};

function rand() { return Math.floor(Math.random() * 100); }

async function onSubmit() {
  if (!formRef.value) return;
  const valid = await formRef.value.validate().catch(() => false);
  if (!valid) return;

  loading.value = true;
  try {
    const { token, admin } = await adminLogin({
      username: form.username,
      password: form.password,
    });
    auth.setSession(token, admin);
    const redirect = (route.query.redirect as string) || '/dashboard';
    void router.push(redirect);
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped lang="scss">
.login-page {
  position: relative;
  min-height: 100vh;
  display: flex; align-items: center; justify-content: center;
  background:
    radial-gradient(circle at 20% 10%, rgba(122,167,255,0.25), transparent 40%),
    radial-gradient(circle at 80% 0%, rgba(61,107,255,0.35), transparent 45%),
    linear-gradient(180deg, #0E1A4A 0%, #0A1238 100%);
  overflow: hidden;
}
.stars { position: absolute; inset: 0; pointer-events: none; }
.star {
  position: absolute;
  width: 3px; height: 3px;
  background: #E9F0FF;
  border-radius: 50%;
  box-shadow: 0 0 6px #E9F0FF;
}
.login-card {
  width: 420px;
  padding: 24px 16px;
  background: rgba(255,255,255,0.96);
  border-radius: 18px;
  z-index: 1;
}
.login-card__title {
  font-size: 22px;
  font-weight: 700;
  margin-bottom: 24px;
  color: #1d2552;
  text-align: center;
  letter-spacing: 2px;
}
.logo {
  display: inline-block;
  width: 32px; height: 32px;
  line-height: 32px;
  background: linear-gradient(135deg,#7AA7FF,#3D6BFF);
  color: #fff;
  border-radius: 8px;
  margin-right: 6px;
  text-align: center;
}
.submit { width: 100%; height: 40px; margin-top: 6px; }
.hint { text-align: center; margin-top: 16px; color: #94a3b8; font-size: 12px; }
</style>
