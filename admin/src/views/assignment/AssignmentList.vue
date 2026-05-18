<template>
  <div class="page">
    <div class="page__header">
      <h2>已发布作业</h2>
      <div class="muted">按发布时间倒序</div>
    </div>

    <el-table v-loading="loading" :data="rows" stripe>
      <el-table-column label="作业" min-width="200">
        <template #default="{ row }">{{ row.homework.title }}</template>
      </el-table-column>
      <el-table-column label="类型" width="100">
        <template #default="{ row }">
          <el-tag :type="row.homework.type === 'REPEAT' ? 'primary' : 'success'">
            {{ row.homework.type === 'REPEAT' ? '跟读' : '背诵' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="班级" width="160">
        <template #default="{ row }">{{ row.class.name }}</template>
      </el-table-column>
      <el-table-column label="开始" width="180">
        <template #default="{ row }">{{ formatTime(row.startAt) }}</template>
      </el-table-column>
      <el-table-column label="截止" width="180">
        <template #default="{ row }">{{ formatTime(row.endAt) }}</template>
      </el-table-column>
      <el-table-column label="发布时间" width="180">
        <template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="120" fixed="right">
        <template #default="{ row }">
          <el-button size="small" type="primary" @click="goDetail(row.id)">
            查看提交
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <div class="pager">
      <el-pagination
        v-model:current-page="page"
        v-model:page-size="pageSize"
        :total="total"
        layout="prev, pager, next, total"
        @current-change="load"/>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { listAssignments, type AssignmentRow } from '@/api/assignment';

const router = useRouter();
function goDetail(id: string) { void router.push(`/assignment/${id}`); }

const loading = ref(false);
const rows = ref<AssignmentRow[]>([]);
const page = ref(1);
const pageSize = ref(20);
const total = ref(0);

async function load() {
  loading.value = true;
  try {
    const res = await listAssignments(page.value, pageSize.value);
    rows.value = res.data ?? [];
    total.value = res.meta?.total ?? 0;
  } finally {
    loading.value = false;
  }
}

function formatTime(s: string): string {
  return new Date(s).toLocaleString();
}

onMounted(load);
</script>

<style scoped lang="scss">
.page { padding: 8px; }
.page__header { margin-bottom: 16px; }
.page__header h2 { margin: 0 0 4px; font-size: 18px; }
.muted { color: #6b7280; font-size: 12px; }
.pager { margin-top: 16px; display: flex; justify-content: flex-end; }
</style>
