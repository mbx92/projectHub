<script setup lang="ts">
definePageMeta({ middleware: 'role', access: ['proyek', 'kelola'] })
useHead({ title: 'Edit Proyek — OCN Project Hub' })
const route = useRoute()
const id = Number(route.params.id)
</script>

<template>
  <ProjectForm :project-id="id" />
</template>
