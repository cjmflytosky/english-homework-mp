<template>
  <div class="page">
    <div class="page__header">
      <div>
        <h2>作业管理</h2>
        <div class="muted">老师创建作业 → 在列表中发布到班级</div>
      </div>
      <el-button type="primary" @click="goCreate">新建作业</el-button>
    </div>

    <el-table v-loading="loading" :data="rows" stripe>
      <el-table-column label="作业标题" prop="title" min-width="200" />
      <el-table-column label="类型" width="100">
        <template #default="{ row }">
          <el-tag :type="row.type === 'REPEAT' ? 'primary' : 'success'">
            {{ row.type === 'REPEAT' ? '跟读' : '背诵' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="任务数" prop="itemCount" width="100" />
      <el-table-column label="已发布次数" prop="assignmentCount" width="120" />
      <el-table-column label="总分" prop="totalScore" width="80" />
      <el-table-column label="创建时间" width="180">
        <template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="220" fixed="right">
        <template #default="{ row }">
          <el-button size="small" @click="goDetail(row.id)">详情</el-button>
          <el-button size="small" type="primary" @click="openPublish(row)">发布</el-button>
          <el-popconfirm title="确定删除该作业？" @confirm="onDelete(row.id)">
            <template #reference>
              <el-button size="small" type="danger">删除</el-button>
            </template>
          </el-popconfirm>
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

    <!-- 发布弹窗 -->
    <el-dialog v-model="publishVisible" title="发布作业" width="480px">
      <el-form :model="publishForm" label-width="80px">
        <el-form-item label="作业">
          <span>{{ publishTarget?.title }}</span>
        </el-form-item>
        <el-form-item label="开始时间">
          <el-date-picker v-model="publishForm.startAt" type="datetime" value-format="YYYY-MM-DDTHH:mm:ss" style="width: 100%" />
        </el-form-item>
        <el-form-item label="截止时间">
          <el-date-picker v-model="publishForm.endAt" type="datetime" value-format="YYYY-MM-DDTHH:mm:ss" style="width: 100%" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="publishForm.remark" type="textarea" :rows="2" placeholder="选填" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="publishVisible = false">取消</el-button>
        <el-button type="primary" :loading="publishing" @click="onPublishConfirm">确认发布到默认班级</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import {
  deleteHomework,
  listHomeworks,
  type HomeworkSummary,
} from '@/api/homework';
import { publishAssignment } from '@/api/assignment';

const router = useRouter();

const loading = ref(false);
const rows = ref<HomeworkSummary[]>([]);
const page = ref(1);
const pageSize = ref(20);
const total = ref(0);

const publishVisible = ref(false);
const publishing = ref(false);
const publishTarget = ref<HomeworkSummary | null>(null);
const publishForm = reactive({
  startAt: '',
  endAt: '',
  remark: '',
});

async function load() {
  loading.value = true;
  try {
    const res = await listHomeworks(page.value, pageSize.value);
    rows.value = res.data ?? [];
    total.value = res.meta?.total ?? 0;
  } finally {
    loading.value = false;
  }
}

function goCreate() { void router.push('/homework/new'); }
function goDetail(id: string) { void router.push(`/homework/${id}`); }

async function onDelete(id: string) {
  await deleteHomework(id);
  ElMessage.success('已删除');
  await load();
}

function openPublish(row: HomeworkSummary) {
  publishTarget.value = row;
  const now = new Date();
  const inWeek = new Date(now.getTime() + 7 * 86400_000);
  publishForm.startAt = toLocalIso(now);
  publishForm.endAt = toLocalIso(inWeek);
  publishForm.remark = '';
  publishVisible.value = true;
}

async function onPublishConfirm() {
  if (!publishTarget.value) return;
  if (!publishForm.startAt || !publishForm.endAt) {
    ElMessage.warning('请填写起止时间');
    return;
  }
  publishing.value = true;
  try {
    await publishAssignment({
      homeworkId: publishTarget.value.id,
      startAt: publishForm.startAt,
      endAt: publishForm.endAt,
      remark: publishForm.remark || undefined,
    });
    ElMessage.success('发布成功');
    publishVisible.value = false;
    await load();
  } finally {
    publishing.value = false;
  }
}

function formatTime(s: string): string {
  return new Date(s).toLocaleString();
}
function toLocalIso(d: Date): string {
  // YYYY-MM-DDTHH:mm:ss
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
}

onMounted(load);
</script>

<style scoped lang="scss">
.page { padding: 8px; }
.page__header {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 16px;
}
.page__header h2 { margin: 0 0 4px; font-size: 18px; }
.muted { color: #6b7280; font-size: 12px; }
.pager { margin-top: 16px; display: flex; justify-content: flex-end; }
</style>
