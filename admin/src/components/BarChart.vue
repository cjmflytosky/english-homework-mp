<template>
  <div ref="el" :style="{ width: '100%', height: height + 'px' }" />
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue';
import * as echarts from 'echarts/core';
import { BarChart } from 'echarts/charts';
import {
  TitleComponent,
  TooltipComponent,
  GridComponent,
  DataZoomComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';

echarts.use([
  BarChart,
  TitleComponent,
  TooltipComponent,
  GridComponent,
  DataZoomComponent,
  CanvasRenderer,
]);

const props = defineProps<{
  categories: string[];
  values: number[];
  height?: number;
  color?: string;
}>();

const height = props.height ?? 240;
const el = ref<HTMLDivElement>();
let chart: echarts.ECharts | null = null;

function render() {
  if (!chart) return;
  chart.setOption({
    tooltip: { trigger: 'axis' },
    grid: { left: 30, right: 16, top: 16, bottom: 30 },
    xAxis: {
      type: 'category',
      data: props.categories,
      axisTick: { show: false },
      axisLine: { lineStyle: { color: '#cbd5e1' } },
    },
    yAxis: {
      type: 'value',
      splitLine: { lineStyle: { color: '#e2e8f0' } },
    },
    series: [
      {
        type: 'bar',
        data: props.values,
        barWidth: '40%',
        itemStyle: {
          color: props.color ?? '#3D6BFF',
          borderRadius: [6, 6, 0, 0],
        },
      },
    ],
  });
}

onMounted(() => {
  if (!el.value) return;
  chart = echarts.init(el.value);
  render();
  window.addEventListener('resize', onResize);
});
onUnmounted(() => {
  window.removeEventListener('resize', onResize);
  chart?.dispose();
  chart = null;
});

function onResize() { chart?.resize(); }

watch(() => [props.categories, props.values], render, { deep: true });
</script>
