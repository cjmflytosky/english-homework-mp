<template>
  <div class="page" v-loading="loading">
    <el-page-header @back="goBack" :content="homework?.title ?? '作业详情'" />

    <div v-if="homework" class="meta">
      <el-tag :type="homework.type === 'REPEAT' ? 'primary' : 'success'">
        {{ homework.type === 'REPEAT' ? '跟读' : '背诵' }}
      </el-tag>
      <span class="muted">总分 {{ homework.totalScore }} ·  共 {{ homework.items.length }} 题</span>
    </div>

    <p v-if="homework?.description" class="desc">{{ homework.description }}</p>

    <el-table v-if="homework" :data="homework.items" stripe>
      <el-table-column label="#" prop="orderNo" width="60" />
      <el-table-column label="英文">
        <template #default="{ row }">
          <div class="text">{{ row.text }}</div>
        </template>
      </el-table-column>
      <el-table-column label="中文翻译" width="240">
        <template #default="{ row }">
          <span class="muted">{{ row.translation || '—' }}</span>
        </template>
      </el-table-column>
      <el-table-column label="参考音频" width="220">
        <template #default="{ row }">
          <span class="muted">{{ row.refAudioUrl || '未上传' }}</span>
        </template>
      </el-table-column>
      <el-table-column label="分值" prop="score" width="80" />
    </el-table>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { fetchHomework, type HomeworkDetail } from '@/api/homework';

const route = useRoute();
const router = useRouter();

const loading = ref(false);
const homework = ref<HomeworkDetail | null>(null);

async function load() {
  loading.value = true;
  try {
    const id = String(route.params.id);
    homework.value = await fetchHomework(id);
  } finally {
    loading.value = false;
  }
}

function goBack() { void router.push('/homework'); }

onMounted(load);
</script>

<style scoped lang="scss">
.page { padding: 8px; }
.meta { display: flex; align-items: center; gap: 8px; margin: 16px 0 4px; }
.muted { color: #6b7280; font-size: 12px; }
.desc { color: #475569; font-size: 13px; margin: 8px 0 16px; }
.text { white-space: pre-wrap; }
</style>
