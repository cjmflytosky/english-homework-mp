<template>
  <div class="page" v-loading="loading">
    <el-page-header @back="goBack" :content="title">
      <template #extra>
        <el-tag v-if="payload?.assignment.homework.type === 'REPEAT'" type="primary">跟读</el-tag>
        <el-tag v-else type="success">背诵</el-tag>
      </template>
    </el-page-header>

    <!-- 统计卡 -->
    <el-row :gutter="12" class="stat-row" v-if="stats">
      <el-col :span="6">
        <el-card shadow="never" class="stat">
          <div class="stat__label">应交人数</div>
          <div class="stat__value">{{ stats.memberCount }}</div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="never" class="stat">
          <div class="stat__label">已提交</div>
          <div class="stat__value">{{ stats.submittedCount }}</div>
          <div class="stat__hint">提交率 {{ submitRate }}%</div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="never" class="stat">
          <div class="stat__label">已评分</div>
          <div class="stat__value">{{ stats.scoredCount }}</div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="never" class="stat">
          <div class="stat__label">平均分</div>
          <div class="stat__value">{{ stats.avgScore ?? '—' }}</div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 分数段分布 -->
    <el-card shadow="never" class="chart-card" v-if="stats">
      <div class="chart-card__title">分数段分布</div>
      <BarChart
        :categories="['0-59', '60-69', '70-79', '80-89', '90-100']"
        :values="stats.buckets"
        :height="220"/>
    </el-card>

    <!-- 学生提交表 -->
    <el-card shadow="never" class="table-card">
      <div class="table-card__title">学生提交列表</div>
      <el-table :data="payload?.rows ?? []" stripe>
        <el-table-column label="学生" min-width="180">
          <template #default="{ row }">
            <div class="student">
              <el-avatar :size="28" :src="row.student.avatar">
                {{ (row.student.nickname || row.student.realName || '同').slice(0,1) }}
              </el-avatar>
              <div>
                <div>{{ row.student.realName || row.student.nickname || '匿名' }}</div>
                <div class="muted">{{ row.student.studentNo || row.student.id.slice(0,6) }}</div>
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="120">
          <template #default="{ row }">
            <el-tag v-if="row.status === 'SCORED'" type="success">已评分</el-tag>
            <el-tag v-else-if="row.status === 'SUBMITTED'" type="warning">已提交</el-tag>
            <el-tag v-else-if="row.status === 'DRAFT'" type="info">进行中</el-tag>
            <span v-else class="muted">未开始</span>
          </template>
        </el-table-column>
        <el-table-column label="总分" width="100">
          <template #default="{ row }">
            <span v-if="row.totalScore != null" class="score">{{ row.totalScore }}</span>
            <span v-else class="muted">—</span>
          </template>
        </el-table-column>
        <el-table-column label="流利度" width="90">
          <template #default="{ row }">{{ row.fluency ?? '—' }}</template>
        </el-table-column>
        <el-table-column label="完整度" width="90">
          <template #default="{ row }">{{ row.integrity ?? '—' }}</template>
        </el-table-column>
        <el-table-column label="发音" width="90">
          <template #default="{ row }">{{ row.pronunciation ?? '—' }}</template>
        </el-table-column>
        <el-table-column label="已完成题" width="120">
          <template #default="{ row }">{{ row.scoredItemCount }}</template>
        </el-table-column>
        <el-table-column label="提交时间" width="180">
          <template #default="{ row }">
            {{ row.submittedAt ? formatTime(row.submittedAt) : '—' }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="120" fixed="right">
          <template #default="{ row }">
            <el-button v-if="row.submissionId" size="small" @click="openDetail(row.submissionId)">
              查看
            </el-button>
            <span v-else class="muted">—</span>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import BarChart from '@/components/BarChart.vue';
import {
  listAdminSubmissions,
  getAdminAssignmentStats,
  type AdminAssignmentSubmissions,
  type AssignmentStats,
} from '@/api/submission';

const route = useRoute();
const router = useRouter();

const loading = ref(false);
const payload = ref<AdminAssignmentSubmissions | null>(null);
const stats = ref<AssignmentStats | null>(null);

const title = computed(() =>
  payload.value
    ? `${payload.value.assignment.homework.title} · ${payload.value.assignment.class.name}`
    : '作业提交',
);

const submitRate = computed(() => {
  if (!stats.value || stats.value.memberCount === 0) return 0;
  return Math.round((stats.value.submittedCount / stats.value.memberCount) * 100);
});

async function load() {
  loading.value = true;
  try {
    const id = String(route.params.id);
    const [p, s] = await Promise.all([
      listAdminSubmissions(id),
      getAdminAssignmentStats(id),
    ]);
    payload.value = p;
    stats.value = s;
  } finally {
    loading.value = false;
  }
}

function goBack() { void router.push('/assignment'); }
function openDetail(id: string) { void router.push(`/submission/${id}`); }
function formatTime(s: string): string { return new Date(s).toLocaleString(); }

onMounted(load);
</script>

<style scoped lang="scss">
.page { padding: 8px; }
.stat-row { margin: 16px 0; }
.stat { text-align: left; padding: 4px 8px; }
.stat__label { font-size: 12px; color: #6b7280; }
.stat__value { font-size: 24px; font-weight: 700; color: #1d2552; margin: 6px 0 2px; }
.stat__hint { font-size: 12px; color: #94a3b8; }
.chart-card { margin-bottom: 16px; }
.chart-card__title { font-size: 14px; font-weight: 600; margin-bottom: 8px; color: #1d2552; }
.table-card__title { font-size: 14px; font-weight: 600; margin-bottom: 12px; color: #1d2552; }
.student { display: flex; align-items: center; gap: 10px; }
.muted { color: #94a3b8; font-size: 12px; }
.score { font-weight: 700; color: #1d2552; }
</style>
