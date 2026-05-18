<template>
  <div class="page">
    <el-card shadow="never" class="filter">
      <el-input
        v-model="keyword"
        placeholder="搜索班级名 / 邀请码 / 年级"
        clearable
        style="width: 260px"
        @keyup.enter="reload"
        @clear="reload"
      />
      <el-button type="primary" @click="reload">查询</el-button>
      <div class="grow" />
      <el-button type="primary" plain @click="onCreate">+ 新建班级</el-button>
    </el-card>

    <el-card shadow="never">
      <el-table v-loading="loading" :data="rows" stripe>
        <el-table-column prop="name" label="班级" min-width="160">
          <template #default="{ row }">
            <router-link :to="`/class/${row.id}`" class="link">{{ row.name }}</router-link>
          </template>
        </el-table-column>
        <el-table-column prop="grade" label="年级" width="120" />
        <el-table-column prop="inviteCode" label="邀请码" width="120">
          <template #default="{ row }">
            <el-tag type="info" effect="plain">{{ row.inviteCode }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="成员 / 作业" width="140">
          <template #default="{ row }">
            <span>{{ row.memberCount }} / {{ row.assignmentCount }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="owner.name" label="班主任" width="120" />
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.enabled ? 'success' : 'info'">
              {{ row.enabled ? '启用' : '停用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="创建时间" width="180">
          <template #default="{ row }">{{ fmtDate(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="140" fixed="right">
          <template #default="{ row }">
            <el-button size="small" link @click="$router.push(`/class/${row.id}`)">详情</el-button>
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

    <el-dialog v-model="dialogVisible" title="新建班级" width="420px">
      <el-form :model="form" label-width="80px">
        <el-form-item label="班级名">
          <el-input v-model="form.name" placeholder="例如：三年级一班" />
        </el-form-item>
        <el-form-item label="年级">
          <el-input v-model="form.grade" placeholder="例如：三年级" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="form.remark" type="textarea" :rows="3" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="creating" @click="onSubmit">创建</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { createClass, listClasses, type ClassRow, type CreateClassPayload } from '@/api/class';

const router = useRouter();
const loading = ref(false);
const creating = ref(false);
const rows = ref<ClassRow[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);
const keyword = ref('');

const dialogVisible = ref(false);
const form = ref<CreateClassPayload>({ name: '', grade: '', remark: '' });

async function reload() {
  loading.value = true;
  try {
    const res = await listClasses(page.value, pageSize.value, keyword.value || undefined);
    rows.value = res.data ?? [];
    total.value = res.meta?.total ?? 0;
  } finally {
    loading.value = false;
  }
}

function onCreate() {
  form.value = { name: '', grade: '', remark: '' };
  dialogVisible.value = true;
}

async function onSubmit() {
  if (!form.value.name.trim()) {
    ElMessage.warning('请填写班级名');
    return;
  }
  creating.value = true;
  try {
    const created = await createClass({
      name: form.value.name.trim(),
      grade: form.value.grade?.trim() || undefined,
      remark: form.value.remark?.trim() || undefined,
    });
    ElMessage.success(`已创建：${created.name} (邀请码 ${created.inviteCode})`);
    dialogVisible.value = false;
    void router.push(`/class/${created.id}`);
  } finally {
    creating.value = false;
  }
}

function fmtDate(s: string): string {
  return new Date(s).toLocaleString();
}

onMounted(reload);
</script>

<style scoped lang="scss">
.page { display: flex; flex-direction: column; gap: 12px; }
.filter { display: flex; gap: 8px; align-items: center; padding: 12px 16px; }
.filter :deep(.el-card__body) { display: flex; gap: 8px; align-items: center; }
.grow { flex: 1; }
.link { color: #3D6BFF; text-decoration: none; }
.link:hover { text-decoration: underline; }
.pager { display: flex; justify-content: flex-end; margin-top: 12px; }
</style>
