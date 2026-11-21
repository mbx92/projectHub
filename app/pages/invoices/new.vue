<script setup lang="ts">
definePageMeta({ middleware: 'role', access: ['keuangan', 'kelola'] })
useHead({ title: 'Buat Invoice — OCN Project Hub' })
</script>

<template>
  <FinanceInvoiceForm />
</template>
