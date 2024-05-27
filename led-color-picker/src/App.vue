<script setup>
  import Color from 'color';
  import { ref } from 'vue'
  import { VueColorWheel } from 'vue-color-wheel'
  import VueSlider from 'vue-slider-component'
  import 'vue-slider-component/theme/antd.css'

  const wheelColor = ref('rgb(255, 0, 0)');
  const brightness = ref(0);
  const hue = ref(0);
  const saturation = ref(0);

  API.on("color", (color) => {
    wheelColor.value = `rgb(${color.join(', ')})`;
  });

  function sendColor() {
    API.send("color", Color(`hsl(${hue.value}, ${saturation.value}%, ${brightness.value}%)`).rgb().array().map((i) => Math.round(i)));
  }

  function onBrightnessChange(v) {
    API.emit("brightness", v);
    sendColor();
  }

  /** @param {import("vue-color-wheel").Harmony[]} color */
  function handleChangeColors([, harmonyColor]) {
    hue.value = Math.round(harmonyColor.h);
    saturation.value = Math.round(harmonyColor.s * 100);
    sendColor();
  }

  wheelColor.value = "rgb(0, 0, 0)";
</script>

<template>
  <div class="content">
    <div class="wheel">
      <VueColorWheel
        wheel="aurora"
        harmony="monochromatic"
        :radius="160"
        :defaultColor="wheelColor"
        v-model:color="wheelColor"
        @change="handleChangeColors"
      />
    </div>

    <div class="slider">
      <VueSlider v-model="brightness" 
        :width="160 * 2" 
        :min="0" 
        :max="100" 
        :tooltipPlacement="['bottom']"
        :marks="[0, 25, 50, 75, 100]"
        @change="onBrightnessChange"
      />
    </div>
  </div>
</template>

<style scoped>
  .content {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 16px;
  }

  .content .wheel {
    display: flex;
    justify-content: center;
    padding: 16px;
  }

  .content .slider {
    color: whitesmoke;
    padding: 16px;
  }
</style>
