<script setup lang="ts">
const menuOpen = ref(false)
</script>

<template>
  <div class="flex min-h-screen bg-canvas">
    <a href="#konten" class="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[200] focus:bg-white focus:px-3 focus:py-2 focus:rounded-lg">Langsung ke konten</a>
    <LayoutSidebar :open="menuOpen" @close="menuOpen = false" />
    <main class="flex-1 min-w-0 flex flex-col">
      <LayoutTopbar @menu="menuOpen = true" />
      <div id="konten" class="px-4 sm:px-8 pt-7 pb-10">
        <div class="max-w-[1180px] mx-auto flex flex-col gap-6">
          <slot />
        </div>
      </div>
    </main>
    <UiConfirmDialog />
    <UiToasts />
  </div>
</template>
