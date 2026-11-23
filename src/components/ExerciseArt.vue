<script setup>
defineProps({ part: { type: String, default: 'core' }, large: Boolean })
</script>
<template>
  <div class="exercise-art" :class="{ large }" aria-hidden="true">
    <svg viewBox="0 0 300 190">
      <defs>
        <pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse">
          <path d="M24 0H0V24" fill="none" stroke="currentColor" opacity=".06" />
        </pattern>
      </defs>
      <rect width="300" height="190" fill="url(#grid)" />
      <ellipse cx="150" cy="168" rx="78" ry="7" fill="#142c4e" opacity=".07" />
      <g
        fill="none"
        stroke="#294668"
        stroke-width="14"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <circle cx="150" cy="37" r="14" fill="#e7bf92" stroke="none" />
        <path d="M150 65L150 104" />
        <path d="M131 66L108 90L87 70M169 66L192 90L213 70" />
        <path d="M150 104L126 130L115 160M150 104L174 130L185 160" />
      </g>
      <path
        d="M129 62Q150 54 171 62L164 103H136Z"
        :fill="['chest', 'shoulders', 'back', 'arms'].includes(part) ? '#facc15' : '#4874c1'"
      />
      <path v-if="part === 'core'" d="M137 83H163V105H137Z" fill="#facc15" />
      <g
        v-if="['lower_body', 'quads', 'glutes', 'hamstrings', 'calves'].includes(part)"
        stroke="#d7a817"
        stroke-width="14"
        stroke-linecap="round"
      >
        <path d="M147 109L126 130M153 109L174 130" />
      </g>
      <g stroke="#152c4b" stroke-width="6" stroke-linecap="round">
        <path d="M75 65L94 76M206 76L225 65" />
        <path d="M76 57L69 70M92 66L85 79M209 66L216 79M225 57L232 70" />
      </g>
      <circle cx="250" cy="35" r="14" fill="white" opacity=".7" />
      <path d="M245 35H255M250 30V40" stroke="#7693b5" stroke-width="1.5" />
    </svg>
  </div>
</template>
