<template>
  <div v-if="detail" class="page">
    <el-card shadow="never" class="head">
      <el-avatar :size="64" :src="detail.avatar ?? defaultAvatar" />
      <div class="head__main">
        <div class="title">
          {{ detail.realName || detail.nickname || '未命名' }}
          <el-tag size="small" :type="detail.enabled ? 'success' : 'info'" class="ml">
            {{ detail.enabled ? '启用' : '停用' }}
          </el-tag>
        </div>
        <div class="meta">
          <span v-if="detail.studentNo">学号：{{ detail.studentNo }}</span>
          <span v-if="detail.phone">电话：{{ detail.phone }}</span>
          <span>注册：{{ fmtDate(detail.createdAt) }}</span>
        </div>
        <div class="classes">
          <el-tag v-for="c in detail.classes" :key="c.id" class="mr" type="info" effect="plain">
            {{ c.name }}<span v-if="c.grade"> · {{ c.grade }}</span>
          </el-tag>
          <span v-if="detail.classes.length === 0" class="muted">尚未加入任何班级</span>
        </div>
      </div>
      <div class="head__actions">
        <el-button @click="onEdit">编辑</el-button>
        <el-button
          :type="detail.enabled ? 'warning' : 'primary'"
          @click="onToggle"
        >{{ detail.enabled ? '停用' : '启用' }}</el-button>
      </div>
    </el-card>

    <el-card shadow="never">
      <template #header><div class="card-title">最近 10 次提交</div></template>
      <el-table :data="detail.recentSubmissions" stripe>
        <el-table-column label="作业" min-width="240">
          <template #default="{ row }">{{ row.homework.title }}</template>
        </el-table-column>
        <el-table-column label="状态" width="120">
          <template #default="{ row }">
            <el-tag :type="statusType(row.status)">{{ statusText(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="总分" width="100">
          <template #default="{ row }">{{ row.totalScore ?? '—' }}</template>
        </el-table-column>
        <el-table-column label="提交时间" width="180">
          <template #default="{ row }">{{ row.submittedAt ? fmtDate(row.submittedAt) : '—' }}</template>
        </el-table-column>
        <el-table-column label="操作" width="120" fixed="right">
          <template #default="{ row }">
            <el-button size="small" link @click="$router.push(`/submission/${row.id}`)">查看</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="editVisible" title="编辑学生" width="420px">
      <el-form :model="form" label-width="80px">
        <el-form-item label="真实姓名"><el-input v-model="form.realName" /></el-form-item>
        <el-form-item label="学号"><el-input v-model="form.studentNo" /></el-form-item>
        <el-form-item label="电话"><el-input v-model="form.phone" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="onSave">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { getStudent, updateStudent, type StudentDetail } from '@/api/student';

const route = useRoute();
const id = String(route.params.id);
const detail = ref<StudentDetail | null>(null);
const defaultAvatar = 'https://cube.elemecdn.com/0/88/03b0d39583f48206768a7534e55bcpng.png';

const editVisible = ref(false);
const saving = ref(false);
const form = ref({ realName: '', studentNo: '', phone: '' });

async function load() {
  detail.value = await getStudent(id);
}

function onEdit() {
  if (!detail.value) return;
  form.value = {
    realName: detail.value.realName ?? '',
    studentNo: detail.value.studentNo ?? '',
    phone: detail.value.phone ?? '',
  };
  editVisible.value = true;
}

async function onSave() {
  saving.value = true;
  try {
    await updateStudent(id, {
      realName: form.value.realName.trim() || undefined,
      studentNo: form.value.studentNo.trim() || undefined,
      phone: form.value.phone.trim() || undefined,
    });
    ElMessage.success('已保存');
    editVisible.value = false;
    await load();
  } finally {
    saving.value = false;
  }
}

async function onToggle() {
  if (!detail.value) return;
  const next = !detail.value.enabled;
  await ElMessageBox.confirm(`确认${next ? '启用' : '停用'}该学生？`, '提示');
  await updateStudent(id, { enabled: next });
  ElMessage.success('已更新');
  await load();
}

function statusText(status: string): string {
  return {
    DRAFT: '草稿',
    SUBMITTED: '已提交',
    SCORED: '已评分',
  }[status] ?? status;
}
function statusType(status: string): 'info' | 'warning' | 'success' {
  if (status === 'SCORED') return 'success';
  if (status === 'SUBMITTED') return 'warning';
  return 'info';
}
function fmtDate(s: string): string {
  return new Date(s).toLocaleString();
}

onMounted(load);
</script>

<style scoped lang="scss">
.page { display: flex; flex-direction: column; gap: 12px; }
.head :deep(.el-card__body) { display: flex; gap: 16px; align-items: flex-start; }
.head__main { flex: 1; }
.title { font-size: 18px; font-weight: 700; color: #1d2552; }
.ml { margin-left: 8px; }
.meta { display: flex; gap: 16px; color: #6b7280; font-size: 13px; margin-top: 6px; }
.classes { margin-top: 10px; }
.mr { margin-right: 6px; }
.muted { color: #9ca3af; }
.card-title { font-weight: 600; color: #1d2552; }
.head__actions { display: flex; gap: 8px; }
</style>
