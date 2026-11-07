<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { X } from 'lucide-vue-next'
const open = defineModel<boolean>({ required: true })
defineProps<{ title: string }>()
const dialog = ref<HTMLDialogElement>()
watch(open, async value => { await nextTick(); if (value && !dialog.value?.open) dialog.value?.showModal(); else if (!value) dialog.value?.close() })
</script>
<template><dialog ref="dialog" class="dialog-panel" aria-labelledby="dialog-title" @cancel="open = false" @close="open = false"><div class="dialog-heading"><h2 id="dialog-title">{{ title }}</h2><button class="icon-button" type="button" aria-label="关闭对话框" @click="open = false"><X :size="20" /></button></div><slot /></dialog></template>
