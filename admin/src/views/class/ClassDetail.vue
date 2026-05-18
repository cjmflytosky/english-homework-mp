<template>
  <div v-if="detail" class="page">
    <el-card shadow="never" class="head">
      <div class="head__left">
        <div class="title">{{ detail.name }}</div>
        <div class="meta">
          <el-tag size="small" type="info">{{ detail.grade || '未填年级' }}</el-tag>
          <el-tag size="small" :type="detail.enabled ? 'success' : 'info'">
            {{ detail.enabled ? '启用' : '停用' }}
          </el-tag>
          <span class="invite">
            邀请码：<strong>{{ detail.inviteCode }}</strong>
            <el-button
              v-if="detail.inviteCode !== 'DEFAULT'"
              link
              size="small"
              @click="onRotate"
            >换一个</el-button>
          </span>
        </div>
        <div v-if="detail.remark" class="remark">{{ detail.remark }}</div>
      </div>
      <div class="head__right">
        <el-button @click="onEdit">编辑</el-button>
        <el-button
          :type="detail.enabled ? 'warning' : 'primary'"
          @click="onToggle"
        >{{ detail.enabled ? '停用' : '启用' }}</el-button>
      </div>
    </el-card>

    <el-card shadow="never">
      <template #header>
        <div class="card-title">
          班级成员（{{ detail.members.length }}）
          <span class="muted">已发布作业：{{ detail.assignmentCount }}</span>
          <div class="grow" />
          <el-button type="primary" size="small" @click="onOpenAddDialog">+ 添加学生</el-button>
        </div>
      </template>

      <el-table :data="detail.members" stripe>
        <el-table-column label="姓名" min-width="160">
          <template #default="{ row }">
            <div class="member">
              <el-avatar :size="28" :src="row.student.avatar ?? defaultAvatar" />
              <span>{{ row.student.realName || row.student.nickname || '未命名' }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="学号" prop="student.studentNo" width="120" />
        <el-table-column label="电话" prop="student.phone" width="140" />
        <el-table-column label="加入时间" width="180">
          <template #default="{ row }">{{ fmtDate(row.joinedAt) }}</template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.student.enabled ? 'success' : 'info'">
              {{ row.student.enabled ? '启用' : '停用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="{ row }">
            <el-button size="small" link @click="$router.push(`/students/${row.student.id}`)">查看</el-button>
            <el-popconfirm title="移出本班级？" @confirm="onRemoveMember(row.id)">
              <template #reference>
                <el-button size="small" link type="danger">移出</el-button>
              </template>
            </el-popconfirm>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="addVisible" title="添加学生到班级" width="640px">
      <div class="add-toolbar">
        <el-input
          v-model="searchKw"
          placeholder="搜索姓名 / 昵称 / 学号 / 手机号"
          clearable
          style="width: 320px"
          @keyup.enter="loadCandidates"
          @clear="loadCandidates"
        />
        <el-button @click="loadCandidates">查询</el-button>
        <div class="grow" />
        <span class="muted">已选 {{ selectedIds.length }} 名</span>
      </div>

      <el-table
        ref="tableRef"
        v-loading="addLoading"
        :data="candidates"
        height="380"
        @selection-change="onSelectionChange"
      >
        <el-table-column type="selection" width="44" :selectable="isSelectable" />
        <el-table-column label="学生" min-width="160">
          <template #default="{ row }">
            <div class="row">
              <el-avatar :size="26" :src="row.avatar ?? defaultAvatar" />
              <span>{{ row.realName || row.nickname || '未命名' }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="studentNo" label="学号" width="120" />
        <el-table-column prop="phone" label="手机号" width="140" />
        <el-table-column label="已在班级" min-width="160">
          <template #default="{ row }">
            <el-tag v-for="c in row.classes" :key="c.id" size="small" type="info" effect="plain" class="mr">
              {{ c.name }}
            </el-tag>
            <span v-if="row.classes.length === 0" class="muted">—</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="80">
          <template #default="{ row }">
            <el-tag size="small" :type="row.enabled ? 'success' : 'info'">
              {{ row.enabled ? '启用' : '停用' }}
            </el-tag>
          </template>
        </el-table-column>
      </el-table>

      <template #footer>
        <el-button @click="addVisible = false">取消</el-button>
        <el-button
          type="primary"
          :loading="adding"
          :disabled="selectedIds.length === 0"
          @click="onConfirmAdd"
        >加入班级（{{ selectedIds.length }}）</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="editVisible" title="编辑班级" width="420px">
      <el-form :model="form" label-width="80px">
        <el-form-item label="班级名"><el-input v-model="form.name" /></el-form-item>
        <el-form-item label="年级"><el-input v-model="form.grade" /></el-form-item>
        <el-form-item label="备注"><el-input v-model="form.remark" type="textarea" :rows="3" /></el-form-item>
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
import {
  addMembers,
  getClass,
  removeMember,
  rotateInviteCode,
  updateClass,
  type ClassDetail,
} from '@/api/class';
import { listStudents, type StudentRow } from '@/api/student';

const route = useRoute();
const id = String(route.params.id);
const detail = ref<ClassDetail | null>(null);

const editVisible = ref(false);
const saving = ref(false);
const form = ref({ name: '', grade: '', remark: '' });
const defaultAvatar = 'https://cube.elemecdn.com/0/88/03b0d39583f48206768a7534e55bcpng.png';

const addVisible = ref(false);
const addLoading = ref(false);
const adding = ref(false);
const searchKw = ref('');
const candidates = ref<StudentRow[]>([]);
const selectedIds = ref<string[]>([]);

function isSelectable(row: StudentRow): boolean {
  if (!detail.value) return false;
  return !detail.value.members.some((m) => m.student.id === row.id);
}

function onSelectionChange(rows: StudentRow[]) {
  selectedIds.value = rows.map((r) => r.id);
}

async function loadCandidates() {
  addLoading.value = true;
  try {
    const res = await listStudents({
      page: 1,
      pageSize: 100,
      keyword: searchKw.value || undefined,
      enabled: 'true',
    });
    candidates.value = res.data ?? [];
  } finally {
    addLoading.value = false;
  }
}

function onOpenAddDialog() {
  selectedIds.value = [];
  searchKw.value = '';
  addVisible.value = true;
  void loadCandidates();
}

async function onConfirmAdd() {
  if (selectedIds.value.length === 0) return;
  adding.value = true;
  try {
    const res = await addMembers(id, selectedIds.value);
    const parts: string[] = [];
    if (res.added) parts.push(`新增 ${res.added}`);
    if (res.skipped) parts.push(`已存在 ${res.skipped}`);
    if (res.missing) parts.push(`无效 ${res.missing}`);
    ElMessage.success(`完成：${parts.join(' / ')}`);
    addVisible.value = false;
    await load();
  } finally {
    adding.value = false;
  }
}

async function load() {
  detail.value = await getClass(id);
}

function onEdit() {
  if (!detail.value) return;
  form.value = {
    name: detail.value.name,
    grade: detail.value.grade ?? '',
    remark: detail.value.remark ?? '',
  };
  editVisible.value = true;
}

async function onSave() {
  saving.value = true;
  try {
    await updateClass(id, {
      name: form.value.name.trim(),
      grade: form.value.grade?.trim() || undefined,
      remark: form.value.remark?.trim() || undefined,
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
  await ElMessageBox.confirm(`确认${next ? '启用' : '停用'}该班级？`, '提示');
  await updateClass(id, { enabled: next });
  ElMessage.success('已更新');
  await load();
}

async function onRotate() {
  await ElMessageBox.confirm('换一个邀请码后，旧码立即失效，已加入的学生不受影响。是否继续？', '提示');
  const updated = await rotateInviteCode(id);
  ElMessage.success(`新邀请码：${updated.inviteCode}`);
  await load();
}

async function onRemoveMember(memberId: string) {
  await removeMember(id, memberId);
  ElMessage.success('已移出');
  await load();
}

function fmtDate(s: string): string {
  return new Date(s).toLocaleString();
}

onMounted(load);
</script>

<style scoped lang="scss">
.page { display: flex; flex-direction: column; gap: 12px; }
.head { display: flex; }
.head :deep(.el-card__body) { display: flex; gap: 16px; align-items: flex-start; width: 100%; }
.head__left { flex: 1; }
.title { font-size: 18px; font-weight: 700; color: #1d2552; }
.meta { display: flex; gap: 12px; align-items: center; margin-top: 6px; color: #6b7280; }
.invite strong { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; color: #3D6BFF; margin: 0 6px; }
.remark { margin-top: 10px; color: #6b7280; font-size: 13px; }
.card-title { font-weight: 600; color: #1d2552; display: flex; gap: 12px; align-items: center; }
.card-title .muted { color: #6b7280; font-size: 13px; font-weight: 400; }
.card-title .grow { flex: 1; }
.member { display: flex; align-items: center; gap: 8px; }

.add-toolbar { display: flex; gap: 8px; align-items: center; margin-bottom: 12px; }
.add-toolbar .grow { flex: 1; }
.add-toolbar .muted { color: #6b7280; font-size: 13px; }
.row { display: flex; align-items: center; gap: 8px; }
.mr { margin-right: 4px; }
</style>
