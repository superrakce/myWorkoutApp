<script setup>
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { foods } from '../data/catalog.js'
import { uid, intake } from '../services/domain.js'
const props = defineProps({
    date: { type: String, required: true },
    entry: Object,
  }),
  emit = defineEmits(['save', 'cancel']),
  { t, locale } = useI18n(),
  search = ref(''),
  selected = ref('custom'),
  name = ref(props.entry?.name || ''),
  mode = ref(props.entry ? 'total' : 'grams'),
  amount = ref(100),
  serving = ref(100),
  kcal = ref(props.entry?.kcal || 0),
  protein = ref(props.entry?.protein ?? ''),
  carbs = ref(props.entry?.carbs ?? ''),
  fat = ref(props.entry?.fat ?? ''),
  meal = ref(props.entry?.meal || 'breakfast')
const visible = computed(() =>
    foods.filter((f) =>
      Object.values(f.name).some((x) => x.toLowerCase().includes(search.value.toLowerCase())),
    ),
  ),
  food = computed(() => foods.find((f) => f.id === selected.value)),
  total = computed(() =>
    intake(
      Number(food.value?.kcal ?? kcal.value),
      Number(amount.value),
      mode.value,
      Number(serving.value),
    ),
  )
function save() {
  const f = food.value,
    scale =
      mode.value === 'total'
        ? 1
        : mode.value === 'grams'
          ? amount.value / 100
          : (amount.value * serving.value) / 100
  emit('save', {
    id: props.entry?.id || uid(),
    date: props.date,
    meal: meal.value,
    name: f ? f.name[locale.value] : name.value,
    foodId: f?.id || null,
    snapshot: f || { kcal: kcal.value, mode: mode.value },
    amount: amount.value,
    mode: mode.value,
    kcal: total.value,
    ...Object.fromEntries(
      ['protein', 'carbs', 'fat'].map((k, i) => {
        const value = f ? f[k] : [protein, carbs, fat][i].value
        return [k, value === '' ? null : Number(value) * scale]
      }),
    ),
    source: f ? 'illustrative-v1' : 'user',
  })
}
</script>
<template>
  <form class="nutrition-form" @submit.prevent="save">
    <h2>{{ t(entry ? 'edit' : 'logMeal') }}</h2>
    <label
      >{{ t('meal')
      }}<select v-model="meal">
        <option v-for="m in ['breakfast', 'lunch', 'dinner', 'snack']" :key="m" :value="m">
          {{ t(m) }}
        </option>
      </select></label
    ><label>{{ t('foodSearch') }}<input v-model="search" :placeholder="t('foodSearch')" /></label
    ><label
      >{{ t('food')
      }}<select v-model="selected" @change="mode = 'grams'">
        <option value="custom">{{ t('customFood') }}</option>
        <option v-for="f in visible" :key="f.id" :value="f.id">
          {{ f.name[locale] }} · {{ f.kcal }} kcal / 100 g
        </option>
      </select></label
    ><template v-if="!food"
      ><label>{{ t('name') }}<input v-model.trim="name" required maxlength="120" /></label
      ><label
        >{{ t('calories')
        }}<input
          type="number"
          min="0"
          max="100000"
          step="0.1"
          v-model.number="kcal"
          required /></label></template
    ><label
      >{{ t('mode')
      }}<select v-model="mode">
        <option value="grams">{{ t('per100') }}</option>
        <option value="servings">{{ t('servings') }}</option>
        <option v-if="!food" value="total">{{ t('totalKcal') }}</option>
      </select></label
    ><label v-if="mode !== 'total'"
      >{{ t(mode === 'grams' ? 'grams' : 'servings')
      }}<input type="number" min="0.1" step="0.1" v-model.number="amount" required /></label
    ><label v-if="mode === 'servings'"
      >{{ t('servingGrams')
      }}<input type="number" min="0.1" step="0.1" v-model.number="serving" required
    /></label>
    <div v-if="!food" class="form-grid three">
      <label
        >{{ t('protein')
        }}<input
          type="number"
          min="0"
          step="0.1"
          v-model="protein"
          :placeholder="t('optional')" /></label
      ><label
        >{{ t('carbs')
        }}<input
          type="number"
          min="0"
          step="0.1"
          v-model="carbs"
          :placeholder="t('optional')" /></label
      ><label
        >{{ t('fat')
        }}<input type="number" min="0" step="0.1" v-model="fat" :placeholder="t('optional')"
      /></label>
    </div>
    <p class="entry-total">{{ Math.round(total) }} <small>kcal</small></p>
    <div class="form-actions">
      <button type="button" @click="$emit('cancel')">{{ t('cancel') }}</button><button
        class="button primary"
      >
        {{ t('save') }}
      </button>
    </div>
  </form>
</template>
