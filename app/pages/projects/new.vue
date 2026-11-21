<script setup lang="ts">
definePageMeta({ middleware: 'role', access: [['proyek', 'kelola'], ['keuangan', 'kelola']] })
useHead({ title: 'Tambah Proyek — OCN Project Hub' })
</script>

<template>
  <ProjectForm />
</template>
