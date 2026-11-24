<script setup lang="ts">
defineOptions({
  name: 'AuthenticationFormView',
});

defineProps<{
  dataSide?: 'bottom' | 'left' | 'right' | 'top';
}>();
</script>

<template>
  <div
    class="auth-form-view relative min-w-0 flex-col-center overflow-y-auto bg-background px-4 py-8 sm:px-6 sm:py-10 lg:flex-initial lg:px-8 dark:bg-background-deep"
  >
    <slot></slot>
    <!-- Router View with Transition -->
    <RouterView v-slot="{ Component, route }">
      <Transition appear mode="out-in" name="slide-right">
        <component
          :is="Component"
          :key="route.fullPath"
            class="side-content mt-6 w-full min-w-0 pb-6 sm:mx-auto md:max-w-md"
          :data-side="dataSide"
        />
      </Transition>
    </RouterView>

    <!-- Footer Copyright -->

    <div
      class="auth-form-copyright absolute right-0 bottom-3 left-0 flex justify-center px-4 text-center text-xs text-muted-foreground"
    >
      <slot name="copyright"> </slot>
    </div>
  </div>
</template>

<style scoped>
@media (max-width: 767px) {
  .auth-form-view {
    justify-content: flex-start;
    padding-top: 88px;
    padding-bottom: max(20px, env(safe-area-inset-bottom));
  }

  .side-content {
    margin-top: 0;
  }

  .auth-form-copyright {
    position: static;
    width: 100%;
    padding-top: 24px;
    margin-top: auto;
  }
}
</style>
