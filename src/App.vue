<!-- src/App.vue -->
<template>
  <div id="app">
    <Game />
  </div>
</template>

<script>
import Game from './components/TrodeGame.vue';

export default {
  name: 'App',
  components: { Game }
};
</script>

<style>
body { margin: 0; background: #101030; color: #fff; font-family: Arial, sans-serif; }
#app { display: flex; justify-content: center; align-items: center; height: 100vh; }
</style>