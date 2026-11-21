<script setup lang="ts">
definePageMeta({ middleware: 'role', access: ['keuangan', 'kelola'] })
useHead({ title: 'Ubah Invoice — OCN Project Hub' })
const id = Number(useRoute().params.id)
</script>

<template>
  <FinanceInvoiceForm :invoice-id="id" />
</template>
