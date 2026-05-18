<template>
  <div class="page">
    <el-card shadow="never" class="filter">
      <el-input
        v-model="keyword"
        placeholder="搜索姓名 / 昵称 / 学号 / 手机号"
        clearable
        style="width: 260px"
        @keyup.enter="reload"
        @clear="reload"
      />
      <el-select v-model="classId" placeholder="所有班级" clearable style="width: 180px" @change="reload">
        <el-option v-for="c in classes" :key="c.id" :label="c.name" :value="c.id" />
      </el-select>
      <el-select v-model="enabled" placeholder="状态" clearable style="width: 120px" @change="reload">
        <el-option label="启用" value="true" />
        <el-option label="停用" value="false" />
      </el-select>
      <el-button type="primary" @click="reload">查询</el-button>
    </el-card>

    <el-card shadow="never">
      <el-table v-loading="loading" :data="rows" stripe>
        <el-table-column label="学生" min-width="200">
          <template #default="{ row }">
            <div class="member">
              <el-avatar :size="28" :src="row.avatar ?? defaultAvatar" />
              <router-link :to="`/students/${row.id}`" class="link">
                {{ row.realName || row.nickname || '未命名' }}
              </router-link>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="studentNo" label="学号" width="120" />
        <el-table-column prop="phone" label="电话" width="140" />
        <el-table-column label="班级" min-width="160">
          <template #default="{ row }">
            <el-tag v-for="c in row.classes" :key="c.id" size="small" type="info" effect="plain" class="mr">
              {{ c.name }}
            </el-tag>
            <span v-if="row.classes.length === 0" class="muted">—</span>
          </template>
        </el-table-column>
        <el-table-column label="提交数" width="100">
          <template #default="{ row }">{{ row.submissionCount }}</template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.enabled ? 'success' : 'info'">
              {{ row.enabled ? '启用' : '停用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="注册时间" width="180">
          <template #default="{ row }">{{ fmtDate(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="120" fixed="right">
          <template #default="{ row }">
            <el-button size="small" link @click="$router.push(`/students/${row.id}`)">详情</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pager">
        <el-pagination
          v-model:current-page="page"
          v-model:page-size="pageSize"
          :total="total"
          layout="prev, pager, next, total"
          @current-change="reload"
        />
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { listStudents, type StudentRow } from '@/api/student';
import { listClasses, type ClassRow } from '@/api/class';

const loading = ref(false);
const rows = ref<StudentRow[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);
const keyword = ref('');
const classId = ref('');
const enabled = ref('');
const classes = ref<ClassRow[]>([]);
const defaultAvatar = 'https://cube.elemecdn.com/0/88/03b0d39583f48206768a7534e55bcpng.png';

async function reload() {
  loading.value = true;
  try {
    const res = await listStudents({
      page: page.value,
      pageSize: pageSize.value,
      keyword: keyword.value || undefined,
      classId: classId.value || undefined,
      enabled: enabled.value ? (enabled.value as 'true' | 'false') : undefined,
    });
    rows.value = res.data ?? [];
    total.value = res.meta?.total ?? 0;
  } finally {
    loading.value = false;
  }
}

async function loadClasses() {
  const res = await listClasses(1, 100);
  classes.value = res.data ?? [];
}

function fmtDate(s: string): string {
  return new Date(s).toLocaleString();
}

onMounted(async () => {
  await loadClasses();
  await reload();
});
</script>

<style scoped lang="scss">
.page { display: flex; flex-direction: column; gap: 12px; }
.filter { display: flex; gap: 8px; align-items: center; padding: 12px 16px; }
.filter :deep(.el-card__body) { display: flex; gap: 8px; align-items: center; }
.link { color: #3D6BFF; text-decoration: none; }
.link:hover { text-decoration: underline; }
.member { display: flex; align-items: center; gap: 8px; }
.pager { display: flex; justify-content: flex-end; margin-top: 12px; }
.muted { color: #9ca3af; }
.mr { margin-right: 4px; }
</style>
