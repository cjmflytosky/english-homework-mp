<template>
  <div class="dashboard">
    <el-row :gutter="16">
      <el-col :span="8">
        <el-card shadow="hover" class="metric">
          <div class="metric__label">已发布作业</div>
          <div class="metric__value">{{ assignmentCount }}</div>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card shadow="hover" class="metric">
          <div class="metric__label">累计提交</div>
          <div class="metric__value">{{ totalSubmitted }}</div>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card shadow="hover" class="metric">
          <div class="metric__label">全局平均分</div>
          <div class="metric__value">{{ globalAvg ?? '—' }}</div>
        </el-card>
      </el-col>
    </el-row>

    <el-card shadow="never" class="chart-card" v-loading="loading">
      <div class="chart-card__title">最近 8 次发布作业 - 平均分</div>
      <BarChart
        :categories="recentTitles"
        :values="recentAvgs"
        :height="260"
        color="#3D6BFF"/>
    </el-card>

    <el-card shadow="never">
      <div class="muted">
        阶段 4 已完成：教师批改面板、统计图、班级排名、学生历史。
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import BarChart from '@/components/BarChart.vue';
import { listAssignments } from '@/api/assignment';
import { getAdminAssignmentStats } from '@/api/submission';

const loading = ref(false);
const assignmentCount = ref(0);
const totalSubmitted = ref(0);
const globalAvg = ref<number | null>(null);

const recentTitles = ref<string[]>([]);
const recentAvgs = ref<number[]>([]);

async function load() {
  loading.value = true;
  try {
    const res = await listAssignments(1, 8);
    const rows = res.data ?? [];
    assignmentCount.value = res.meta?.total ?? rows.length;

    // 并发拉每个的 stats
    const statsArr = await Promise.all(
      rows.map((r) => getAdminAssignmentStats(r.id)),
    );

    let submitted = 0;
    let avgAcc = 0;
    let avgCnt = 0;

    rows.forEach((_, idx) => {
      const s = statsArr[idx];
      submitted += s.submittedCount;
      if (s.avgScore != null) {
        avgAcc += s.avgScore;
        avgCnt += 1;
      }
    });

    totalSubmitted.value = submitted;
    globalAvg.value = avgCnt === 0 ? null : Math.round((avgAcc / avgCnt) * 10) / 10;

    // 最早的发布显示在最左
    const ordered = rows
      .map((r, idx) => ({ r, s: statsArr[idx] }))
      .reverse();
    recentTitles.value = ordered.map((x) => truncate(x.r.homework.title, 10));
    recentAvgs.value = ordered.map((x) => x.s.avgScore ?? 0);
  } finally {
    loading.value = false;
  }
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) + '…' : s;
}

onMounted(load);
</script>

<style scoped lang="scss">
.dashboard { padding: 8px; }
.metric { text-align: left; padding: 8px 12px; }
.metric__label { font-size: 13px; color: #6b7280; }
.metric__value { font-size: 28px; font-weight: 700; color: #1d2552; margin-top: 8px; }
.chart-card { margin: 16px 0; }
.chart-card__title { font-size: 14px; font-weight: 600; margin-bottom: 8px; color: #1d2552; }
.muted { color: #6b7280; font-size: 13px; }
</style>
