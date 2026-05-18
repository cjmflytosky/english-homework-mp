<template>
  <div class="page">
    <div class="page__header">
      <h2>新建作业</h2>
      <div class="muted">阶段 2：录音参考音频地址先留作选填，阶段 3 接入 COS 后改为上传</div>
    </div>

    <el-form ref="formRef" :model="form" :rules="rules" label-width="100px" class="form">
      <el-form-item label="作业标题" prop="title">
        <el-input v-model="form.title" maxlength="60" show-word-limit placeholder="如：Unit 1 Greetings 跟读" />
      </el-form-item>
      <el-form-item label="类型" prop="type">
        <el-radio-group v-model="form.type">
          <el-radio-button label="REPEAT">跟读</el-radio-button>
          <el-radio-button label="RECITE">背诵</el-radio-button>
        </el-radio-group>
      </el-form-item>
      <el-form-item label="总分">
        <el-input-number v-model="form.totalScore" :min="10" :max="200" />
        <span class="muted" style="margin-left: 8px">未指定单题分数时按平均分摊</span>
      </el-form-item>
      <el-form-item label="作业说明">
        <el-input v-model="form.description" type="textarea" :rows="2" placeholder="选填" />
      </el-form-item>

      <el-divider>任务列表（{{ form.items.length }} 题）</el-divider>

      <div v-for="(item, idx) in form.items" :key="idx" class="item-card">
        <div class="item-card__head">
          <span>第 {{ idx + 1 }} 题</span>
          <el-button size="small" type="danger" text :disabled="form.items.length === 1" @click="removeItem(idx)">
            删除
          </el-button>
        </div>
        <el-form-item :label="'英文'" :prop="'items.' + idx + '.text'" :rules="itemTextRule">
          <el-input v-model="item.text" type="textarea" :rows="2" placeholder="输入英文原句" />
        </el-form-item>
        <el-form-item label="中文翻译">
          <el-input v-model="item.translation" type="textarea" :rows="1" placeholder="选填" />
        </el-form-item>
        <el-form-item label="参考音频">
          <el-input v-model="item.refAudioUrl" placeholder="选填，阶段 3 接 COS 后将改为上传" />
        </el-form-item>
        <el-form-item label="单题分">
          <el-input-number v-model="item.score" :min="0" :max="100" />
        </el-form-item>
      </div>

      <div class="actions">
        <el-button @click="addItem">+ 添加任务</el-button>
        <div class="right">
          <el-button @click="goBack">取消</el-button>
          <el-button type="primary" :loading="submitting" @click="onSubmit">保存</el-button>
        </div>
      </div>
    </el-form>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, type FormInstance, type FormRules } from 'element-plus';
import { createHomework, type CreateHomeworkPayload, type HomeworkType } from '@/api/homework';

const router = useRouter();
const formRef = ref<FormInstance>();
const submitting = ref(false);

interface FormItem {
  text: string;
  translation?: string;
  refAudioUrl?: string;
  score?: number;
}

const form = reactive<{
  title: string;
  description: string;
  type: HomeworkType;
  totalScore: number;
  items: FormItem[];
}>({
  title: '',
  description: '',
  type: 'REPEAT',
  totalScore: 100,
  items: [{ text: '', translation: '', refAudioUrl: '', score: undefined }],
});

const rules: FormRules = {
  title: [{ required: true, message: '请填写作业标题', trigger: 'blur' }],
  type: [{ required: true, message: '请选择类型', trigger: 'change' }],
};

const itemTextRule = [{ required: true, message: '英文原句不能为空', trigger: 'blur' }];

function addItem() {
  form.items.push({ text: '', translation: '', refAudioUrl: '', score: undefined });
}
function removeItem(i: number) {
  form.items.splice(i, 1);
}

async function onSubmit() {
  if (!formRef.value) return;
  const valid = await formRef.value.validate().catch(() => false);
  if (!valid) return;

  const payload: CreateHomeworkPayload = {
    title: form.title,
    description: form.description || undefined,
    type: form.type,
    totalScore: form.totalScore,
    items: form.items.map((it) => ({
      text: it.text,
      translation: it.translation || undefined,
      refAudioUrl: it.refAudioUrl || undefined,
      score: it.score,
    })),
  };
  submitting.value = true;
  try {
    await createHomework(payload);
    ElMessage.success('作业已创建');
    void router.push('/homework');
  } finally {
    submitting.value = false;
  }
}

function goBack() {
  void router.push('/homework');
}
</script>

<style scoped lang="scss">
.page { padding: 8px; }
.page__header { margin-bottom: 16px; }
.page__header h2 { margin: 0 0 4px; font-size: 18px; }
.muted { color: #6b7280; font-size: 12px; }
.form { max-width: 760px; }
.item-card {
  background: #F4F6FB;
  border-radius: 8px;
  padding: 12px 16px 4px;
  margin-bottom: 16px;
}
.item-card__head {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 8px; font-size: 13px; color: #1d2552; font-weight: 600;
}
.actions {
  display: flex; justify-content: space-between; align-items: center;
  margin-top: 24px;
}
</style>
