<script setup>
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
const props = defineProps({ today: { type: String, required: true } }),
  start = defineModel('start', { type: String }),
  end = defineModel('end', { type: String }),
  { t } = useI18n(),
  preset = ref('last7')
function change() {
  const now = new Date(props.today + 'T00:00:00Z'),
    d = new Date(now)
  end.value = props.today
  if (preset.value === 'week') d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7))
  if (preset.value === 'month') d.setUTCDate(1)
  if (preset.value === 'last7') d.setUTCDate(d.getUTCDate() - 6)
  if (preset.value === 'last30') d.setUTCDate(d.getUTCDate() - 29)
  if (preset.value !== 'custom') start.value = d.toISOString().slice(0, 10)
}
</script>
<template>
  <div class="date-range">
    <label
      >{{ t('date')
      }}<select v-model="preset" @change="change">
        <option
          v-for="p in ['today', 'week', 'month', 'last7', 'last30', 'custom']"
          :key="p"
          :value="p"
        >
          {{ t(p) }}
        </option>
      </select></label
    ><label
      >{{ t('from')
      }}<input type="date" v-model="start" :max="end" @change="preset = 'custom'" required /></label
    ><label
      >{{ t('to')
      }}<input type="date" v-model="end" :min="start" @change="preset = 'custom'" required
    /></label>
  </div>
</template>
