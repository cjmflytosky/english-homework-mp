<template>
  <div class="page" v-loading="loading">
    <el-page-header @back="goBack" :content="title" />

    <el-card shadow="never" class="summary" v-if="detail">
      <div class="summary__left">
        <el-avatar :size="48" :src="detail.student.avatar">
          {{ (detail.student.realName || detail.student.nickname || '同').slice(0,1) }}
        </el-avatar>
        <div class="summary__info">
          <div class="summary__name">
            {{ detail.student.realName || detail.student.nickname || '匿名' }}
            <span class="muted">{{ detail.student.studentNo || '' }}</span>
          </div>
          <div class="muted">
            状态：
            <el-tag v-if="detail.status === 'SCORED'" size="small" type="success">已评分</el-tag>
            <el-tag v-else-if="detail.status === 'SUBMITTED'" size="small" type="warning">已提交</el-tag>
            <el-tag v-else size="small" type="info">进行中</el-tag>
          </div>
        </div>
      </div>
      <div class="summary__right" v-if="detail.totalScore != null">
        <div class="score-big">{{ detail.totalScore }}</div>
        <div class="muted">流 {{ detail.fluency ?? '—' }} · 完 {{ detail.integrity ?? '—' }} · 发 {{ detail.pronunciation ?? '—' }}</div>
      </div>
    </el-card>

    <el-card shadow="never" class="comment" v-if="detail">
      <div class="comment__head">
        <div class="comment__title">老师点评</div>
        <div class="muted" v-if="detail.comment">
          {{ detail.comment.author.name }} · {{ fmtDate(detail.comment.updatedAt) }}
        </div>
      </div>
      <el-input
        v-model="commentDraft"
        type="textarea"
        :rows="3"
        maxlength="500"
        show-word-limit
        placeholder="写一段简短反馈，例如：发音准确，注意 r 音 / 节奏可以再放慢一点。"
      />
      <div class="comment__actions">
        <el-button v-if="detail.comment" link type="danger" @click="onDeleteComment">删除</el-button>
        <div class="grow" />
        <el-button type="primary" :loading="commentSaving" @click="onSaveComment">
          {{ detail.comment ? '更新点评' : '保存点评' }}
        </el-button>
      </div>
    </el-card>

    <el-card shadow="never" class="items" v-if="detail">
      <div class="items__title">逐题音频 & 评分</div>
      <div
        v-for="it in detail.homework.items"
        :key="it.id"
        class="item">
        <div class="item__head">
          <span class="item__no">第 {{ it.orderNo }} 题</span>
          <span class="muted">满分 {{ it.score }}</span>
        </div>
        <div class="item__text">{{ it.text }}</div>
        <div v-if="it.translation" class="item__tr muted">{{ it.translation }}</div>

        <div class="item__body">
          <div class="item__audio">
            <audio
              v-if="it.submission?.audioUrl"
              :src="it.submission.audioUrl"
              controls
              preload="none"
              style="width: 100%"/>
            <span v-else class="muted">未录音</span>
          </div>
          <div class="item__score" v-if="it.submission?.score != null">
            <div class="num">{{ it.submission.score }}</div>
            <div class="dims muted">
              流 {{ it.submission.fluency }} · 完 {{ it.submission.integrity }} · 发 {{ it.submission.pronunciation }}
            </div>
          </div>
          <div class="item__score muted" v-else>未评分</div>
        </div>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import {
  deleteTeacherComment,
  getAdminSubmissionDetail,
  upsertTeacherComment,
  type AdminSubmissionDetail,
} from '@/api/submission';

const route = useRoute();
const router = useRouter();
const loading = ref(false);
const detail = ref<AdminSubmissionDetail | null>(null);

const commentDraft = ref('');
const commentSaving = ref(false);

const title = computed(() =>
  detail.value ? `${detail.value.homework.title} · 提交详情` : '提交详情',
);

watch(detail, (d) => {
  commentDraft.value = d?.comment?.content ?? '';
});

async function load() {
  loading.value = true;
  try {
    const id = String(route.params.id);
    detail.value = await getAdminSubmissionDetail(id);
  } finally {
    loading.value = false;
  }
}

async function onSaveComment() {
  if (!detail.value) return;
  const text = commentDraft.value.trim();
  if (!text) {
    ElMessage.warning('请填写点评内容');
    return;
  }
  commentSaving.value = true;
  try {
    const updated = await upsertTeacherComment(detail.value.id, text);
    detail.value = { ...detail.value, comment: updated };
    ElMessage.success('点评已保存');
  } finally {
    commentSaving.value = false;
  }
}

async function onDeleteComment() {
  if (!detail.value || !detail.value.comment) return;
  await ElMessageBox.confirm('删除后学生将看不到该点评，确认删除？', '提示');
  await deleteTeacherComment(detail.value.id);
  detail.value = { ...detail.value, comment: null };
  commentDraft.value = '';
  ElMessage.success('已删除');
}

function fmtDate(s: string): string {
  return new Date(s).toLocaleString();
}

function goBack() { router.back(); }

onMounted(load);
</script>

<style scoped lang="scss">
.page { padding: 8px; }
.summary {
  margin-top: 16px;
  display: flex; justify-content: space-between;
  :deep(.el-card__body) {
    display: flex; align-items: center; justify-content: space-between; width: 100%;
  }
}
.summary__left { display: flex; align-items: center; gap: 16px; }
.summary__name { font-size: 16px; font-weight: 600; color: #1d2552; }
.summary__right { text-align: right; }
.score-big {
  font-size: 36px; font-weight: 800;
  background: linear-gradient(135deg,#7AA7FF,#3D6BFF);
  -webkit-background-clip: text;
  color: transparent;
  line-height: 1;
  margin-bottom: 4px;
}
.muted { color: #94a3b8; font-size: 12px; }

.items { margin-top: 16px; }
.items__title { font-size: 14px; font-weight: 600; margin-bottom: 12px; color: #1d2552; }
.item {
  padding: 14px 0;
  border-bottom: 1px dashed #e5e7eb;
}
.item:last-child { border-bottom: none; }
.item__head { display: flex; justify-content: space-between; margin-bottom: 6px; }
.item__no { font-weight: 600; color: #1d2552; }
.item__text { font-size: 15px; line-height: 1.6; }
.item__tr { font-size: 13px; margin-top: 4px; }
.item__body {
  display: flex; align-items: center; gap: 20px;
  margin-top: 10px;
}
.item__audio { flex: 1; }
.item__score { min-width: 140px; text-align: right; }
.item__score .num { font-size: 22px; font-weight: 700; color: #1d2552; }
.item__score .dims { font-size: 12px; margin-top: 2px; }

.comment { margin-top: 16px; }
.comment__head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
.comment__title { font-weight: 600; color: #1d2552; }
.comment__actions { display: flex; align-items: center; margin-top: 10px; }
.grow { flex: 1; }
</style>
