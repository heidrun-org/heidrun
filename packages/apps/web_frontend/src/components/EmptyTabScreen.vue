<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import babyGoatImage from "../assets/baby_goat.webp";
import { t } from "../i18n/index";
import { playNextGoatBleat } from "../lib/goat_sounds";

const FIRST_LINE_PATH_ID = "empty-tab-first-line-path";
const SECOND_LINE_PATH_ID = "empty-tab-second-line-path";
/** An emoji at the very end of a text: a picture character, then the optional mark that asks for the color picture. */
const EMOJI_AT_END = /(\p{Extended_Pictographic}\uFE0F?)$/u;
/** The smiling emojis that can fly out from the emoji of the second line, like the sparks of a firework. */
const BURST_EMOJI_POOL = [
  "😀", "😃", "😄", "😁", "😆", "😅", "😂", "🤣", "😊", "😇",
  "🙂", "😉", "😌", "😍", "🥰", "😋", "😎", "🤩", "😸", "😹",
];
const BURST_MINIMUM_SPARKS = 8;
const BURST_MAXIMUM_SPARKS = 12;
/** The first spark flies toward this angle, in degrees. The angle -90 is straight up, and the angle 0 is to the right. */
const BURST_FIRST_ANGLE = -170;
/** The last spark flies toward this angle, in degrees. The sparks spread over the upper half, away from the bottom edge. */
const BURST_LAST_ANGLE = -10;
/** How far the sparks fly, in sizes of the letters of a spark. */
const BURST_MINIMUM_DISTANCE = 3;
const BURST_MAXIMUM_DISTANCE = 6;
/** The latest start of a spark, in seconds after the first spark. */
const BURST_MAXIMUM_DELAY = 0.4;
/** The width of the screen, divided by this number, gives the size of the letters of the title. */
const TITLE_SIZE_DIVIDER = 16;
/** The height of the screen, divided by this number, gives the largest size of the letters of the title. */
const TITLE_SIZE_HEIGHT_DIVIDER = 9;
const TITLE_SIZE_MINIMUM_PX = 28;
const TITLE_SIZE_MAXIMUM_PX = 96;
/** The width of the screen, divided by this number, gives the size of the letters of the joke. */
const JOKE_SIZE_DIVIDER = 32;
const JOKE_SIZE_MINIMUM_PX = 7;
const JOKE_SIZE_MAXIMUM_PX = 36;
/** The distance between the bottom edge and the lowest point of the second line of the joke, in sizes of the joke letters. */
const JOKE_LOWEST_POINT_IN_JOKE_SIZES = 1.4;
/** The distance between the two lines of the joke, in sizes of the joke letters. */
const JOKE_LINE_GAP_IN_JOKE_SIZES = 1.5;
/** The radius of the circle that the joke follows, in widths of the screen. The curve has the same look in any size. */
const JOKE_CIRCLE_RADIUS_IN_WIDTHS = 0.9;

const screenElement = ref<HTMLElement | null>(null);
const secondLineElement = ref<SVGTextElement | null>(null);
const screenWidth = ref(0);
const screenHeight = ref(0);
/** The place of the emoji of the second line, as the value of the attribute `transform`. Empty until it is measured. */
const emojiTransform = ref("");
/** True when every animation of the laugh is finished: only then does a click on the emoji make it laugh again. */
const isLaughOver = ref(false);
/** True after the first click on the emoji: the laugh then starts at once, without the wait for the fade-in. */
const isReplaying = ref(false);
/** Changes at each click on the emoji. The emoji and its sparks are drawn again, so their animations start again. */
const replayCount = ref(0);
let finishedAnimationCount = 0;
let resizeObserver: ResizeObserver | null = null;

const titleSize = computed(() => {
  const sizeFromWidth = screenWidth.value / TITLE_SIZE_DIVIDER;
  const sizeFromHeight = screenHeight.value / TITLE_SIZE_HEIGHT_DIVIDER;
  return Math.round(
    Math.min(TITLE_SIZE_MAXIMUM_PX, Math.max(TITLE_SIZE_MINIMUM_PX, Math.min(sizeFromWidth, sizeFromHeight))),
  );
});

const jokeSize = computed(() =>
  Math.round(
    Math.min(JOKE_SIZE_MAXIMUM_PX, Math.max(JOKE_SIZE_MINIMUM_PX, screenWidth.value / JOKE_SIZE_DIVIDER)),
  ),
);

/**
 * The lines that the joke follows: the lower halves of two circles, like the line of the motto of the splash screen.
 * Both circles have the same center, in the middle of the screen above the top edge, so the joke bends like a smile.
 * The circle of the second line is larger than the circle of the first line, so the second line is below the first.
 */
const jokeCircles = computed(() => {
  const secondRadius = Math.max(1, screenWidth.value * JOKE_CIRCLE_RADIUS_IN_WIDTHS);
  const lineGap = jokeSize.value * JOKE_LINE_GAP_IN_JOKE_SIZES;
  const firstRadius = Math.max(1, secondRadius - lineGap);
  const centerX = screenWidth.value / 2;
  const centerY = screenHeight.value - jokeSize.value * JOKE_LOWEST_POINT_IN_JOKE_SIZES - secondRadius;
  return { centerX, centerY, firstRadius, secondRadius };
});

function buildArcPath(radius: number): string {
  const { centerX, centerY } = jokeCircles.value;
  return `M ${centerX - radius} ${centerY} A ${radius} ${radius} 0 0 0 ${centerX + radius} ${centerY}`;
}

const firstLinePath = computed(() => buildArcPath(jokeCircles.value.firstRadius));
const secondLinePath = computed(() => buildArcPath(jokeCircles.value.secondRadius));

function randomBetween(minimum: number, maximum: number): number {
  return minimum + Math.random() * (maximum - minimum);
}

/**
 * Builds a new laugh: the sparks of the firework, and the strength and the direction of the shake of the emoji. The
 * emojis, the angles, the distances, the spins, and the delays are different at each call, so that each click on the
 * emoji gives a firework that the user has not seen before.
 */
function buildLaugh() {
  const sparkCount = BURST_MINIMUM_SPARKS + Math.floor(Math.random() * (BURST_MAXIMUM_SPARKS - BURST_MINIMUM_SPARKS + 1));
  const emojis = BURST_EMOJI_POOL.map((emoji) => ({ emoji, order: Math.random() }))
    .sort((first, second) => first.order - second.order)
    .slice(0, sparkCount);
  const angleStep = (BURST_LAST_ANGLE - BURST_FIRST_ANGLE) / (sparkCount - 1);
  const sparks = emojis.map(({ emoji }, index) => {
    const angle = ((BURST_FIRST_ANGLE + (index + randomBetween(-0.4, 0.4)) * angleStep) * Math.PI) / 180;
    const distance = randomBetween(BURST_MINIMUM_DISTANCE, BURST_MAXIMUM_DISTANCE);
    const spinDirection = Math.random() < 0.5 ? -1 : 1;
    return {
      emoji,
      style: {
        "--drift-x": `${(distance * Math.cos(angle)).toFixed(2)}em`,
        "--drift-y": `${(distance * Math.sin(angle)).toFixed(2)}em`,
        "--drift-rotation": `${(spinDirection * randomBetween(30, 200)).toFixed(0)}deg`,
        "--drift-scale": randomBetween(0.9, 1.5).toFixed(2),
        "--spark-delay": `${randomBetween(0, BURST_MAXIMUM_DELAY).toFixed(2)}s`,
      },
    };
  });
  const shakeStyle = {
    "--shake-direction": Math.random() < 0.5 ? "-1" : "1",
    "--shake-strength": randomBetween(0.7, 1.3).toFixed(2),
  };
  return { sparks, shakeStyle };
}

const laugh = ref(buildLaugh());

/** The second line of the joke, cut in the text and the emoji at its end, so that the emoji can shake alone. */
const secondLine = computed(() => {
  const text = t("paneGrid.jokeSecondLine");
  const match = EMOJI_AT_END.exec(text);
  if (match === null) {
    return { text, emoji: "" };
  }
  return { text: text.slice(0, match.index), emoji: match[1] };
});

const screenStyle = computed(() => ({
  "--title-size": `${titleSize.value}px`,
  "--joke-size": `${jokeSize.value}px`,
}));

function measureScreen() {
  if (screenElement.value === null) {
    return;
  }
  screenWidth.value = screenElement.value.clientWidth;
  screenHeight.value = screenElement.value.clientHeight;
}

/**
 * Finds where the browser puts the emoji of the second line on the arc: the point and the angle of its character.
 * The emoji in the arc stays hidden, and a copy of the emoji is drawn at this place, because a character inside a text
 * on a path cannot move alone. When the browser cannot tell the place, the emoji stays in the arc and does not shake.
 */
async function placeEmoji() {
  await nextTick();
  const textElement = secondLineElement.value;
  const canMeasure = textElement !== null && typeof textElement.getStartPositionOfChar === "function";
  if (canMeasure === false || secondLine.value.emoji === "") {
    emojiTransform.value = "";
    return;
  }
  try {
    const characterIndex = (textElement.textContent ?? "").length - secondLine.value.emoji.length;
    const start = textElement.getStartPositionOfChar(characterIndex);
    const angle = textElement.getRotationOfChar(characterIndex);
    emojiTransform.value = `translate(${start.x} ${start.y}) rotate(${angle})`;
  } catch {
    emojiTransform.value = "";
  }
}

watch([screenWidth, screenHeight, secondLine], placeEmoji);

watch(
  () => emojiTransform.value !== "",
  (isPlaced) => {
    if (isPlaced) {
      finishedAnimationCount = 0;
      isLaughOver.value = false;
      isReplaying.value = false;
    }
  },
);

/** Counts the animations that finish: the shake of the emoji, and one flight for each spark. */
function onLaughAnimationEnd() {
  finishedAnimationCount += 1;
  if (finishedAnimationCount >= 1 + laugh.value.sparks.length) {
    isLaughOver.value = true;
  }
}

function replayLaugh() {
  if (isLaughOver.value === false) {
    return;
  }
  finishedAnimationCount = 0;
  isLaughOver.value = false;
  isReplaying.value = true;
  laugh.value = buildLaugh();
  replayCount.value += 1;
  playNextGoatBleat();
}

onMounted(() => {
  measureScreen();
  placeEmoji();
  document.fonts?.ready.then(placeEmoji);
  if (typeof ResizeObserver === "function" && screenElement.value !== null) {
    resizeObserver = new ResizeObserver(measureScreen);
    resizeObserver.observe(screenElement.value);
  }
});

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
});
</script>

<template>
  <section ref="screenElement" class="empty-tab-screen" :style="screenStyle" :aria-label="t('paneGrid.empty')">
    <div class="empty-tab-content">
      <img class="empty-tab-image" :src="babyGoatImage" alt="" />
      <h1 class="empty-tab-title">{{ t("paneGrid.title") }}</h1>
    </div>
    <svg class="empty-tab-joke-arc" :width="screenWidth" :height="screenHeight">
      <defs>
        <path :id="FIRST_LINE_PATH_ID" :d="firstLinePath" />
        <path :id="SECOND_LINE_PATH_ID" :d="secondLinePath" />
      </defs>
      <text class="empty-tab-joke empty-tab-first-line" text-anchor="middle">
        <textPath :href="`#${FIRST_LINE_PATH_ID}`" startOffset="50%">{{ t("paneGrid.jokeFirstLine") }}</textPath>
      </text>
      <g class="empty-tab-second-line">
        <text ref="secondLineElement" class="empty-tab-joke" text-anchor="middle">
          <textPath :href="`#${SECOND_LINE_PATH_ID}`" startOffset="50%">
            {{ secondLine.text }}<tspan :class="{ 'empty-tab-emoji-slot': emojiTransform !== '' }">{{ secondLine.emoji }}</tspan>
          </textPath>
        </text>
        <g
          v-if="emojiTransform !== ''"
          :key="replayCount"
          :transform="emojiTransform"
          :class="{ 'empty-tab-replaying': isReplaying }"
          :style="laugh.shakeStyle"
          @animationend="onLaughAnimationEnd"
        >
          <text
            v-for="spark in laugh.sparks"
            :key="spark.emoji"
            class="empty-tab-joke empty-tab-spark"
            :style="spark.style"
            aria-hidden="true"
          >{{ spark.emoji }}</text>
          <text class="empty-tab-joke empty-tab-emoji">{{ secondLine.emoji }}</text>
          <circle
            class="empty-tab-emoji-hit-area"
            :class="{ 'empty-tab-emoji-ready': isLaughOver }"
            :cx="jokeSize * 0.6"
            :cy="jokeSize * -0.35"
            :r="jokeSize * 0.8"
            @click="replayLaugh"
          />
        </g>
      </g>
    </svg>
  </section>
</template>

<style scoped>
.empty-tab-screen {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-radius: inherit;
  background: radial-gradient(circle at 50% 38%, var(--screen-glow), transparent 60%), var(--screen-background);
  --screen-background: var(--illustration-bg);
  --screen-glow: var(--illustration-wash);
  --title-color: var(--illustration-accent);
  --title-shadow: 0 2px 12px var(--illustration-shadow);
  --joke-color: var(--illustration-text);
  --joke-shadow: drop-shadow(0 2px 6px var(--illustration-shadow));
  --image-shadow: drop-shadow(0 8px 24px var(--illustration-hover));
  --second-line-delay: 2s;
  --second-line-fade-duration: 3s;
  --laugh-delay: calc(var(--second-line-delay) + var(--second-line-fade-duration));
  --shake-direction: 1;
  --shake-strength: 1;
}
.empty-tab-content {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 24px 24px calc(var(--joke-size) * 4.9);
}
.empty-tab-image {
  flex: 1 1 auto;
  width: 100%;
  height: 0;
  min-height: 0;
  object-fit: contain;
  filter: var(--image-shadow);
}
.empty-tab-title {
  flex: none;
  margin: 0;
  font-size: var(--title-size);
  font-weight: 600;
  letter-spacing: 0.04em;
  color: var(--title-color);
  text-shadow: var(--title-shadow);
}
.empty-tab-joke-arc {
  position: absolute;
  inset: 0;
  pointer-events: none;
  filter: var(--joke-shadow);
}
.empty-tab-joke {
  font-size: var(--joke-size);
  font-weight: 500;
  fill: var(--joke-color);
}
.empty-tab-second-line {
  animation: empty-tab-fade-in var(--second-line-fade-duration) ease-in-out var(--second-line-delay) both;
}
.empty-tab-replaying {
  --laugh-delay: 0s;
}
.empty-tab-emoji-hit-area {
  fill: transparent;
  pointer-events: all;
}
.empty-tab-emoji-ready {
  cursor: pointer;
}
.empty-tab-emoji-slot {
  visibility: hidden;
}
.empty-tab-emoji {
  transform-box: fill-box;
  transform-origin: center;
  animation: empty-tab-laugh 0.9s ease-in-out var(--laugh-delay) 3;
}
.empty-tab-emoji,
.empty-tab-spark {
  user-select: none;
}
.empty-tab-spark {
  font-size: calc(var(--joke-size) * 1.5);
  opacity: 0;
  transform-box: fill-box;
  transform-origin: center;
  animation: empty-tab-firework 2s ease-out
    calc(var(--laugh-delay) + var(--spark-delay)) 1;
}
@keyframes empty-tab-fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
@keyframes empty-tab-laugh {
  0%,
  100% {
    transform: translateY(0) rotate(0deg) scale(1);
  }
  15%,
  45% {
    transform: translateY(calc(-0.35em * var(--shake-strength)))
      rotate(calc(-14deg * var(--shake-direction) * var(--shake-strength))) scale(1.15);
  }
  30%,
  60% {
    transform: translateY(0) rotate(calc(12deg * var(--shake-direction) * var(--shake-strength))) scale(1);
  }
  75% {
    transform: translateY(calc(-0.2em * var(--shake-strength)))
      rotate(calc(-8deg * var(--shake-direction) * var(--shake-strength))) scale(1.08);
  }
}
@keyframes empty-tab-firework {
  0% {
    opacity: 0;
    transform: translate(0, 0) rotate(0deg) scale(0.4);
  }
  15% {
    opacity: 1;
  }
  60% {
    opacity: 1;
  }
  100% {
    opacity: 0;
    transform: translate(var(--drift-x), var(--drift-y)) rotate(var(--drift-rotation)) scale(var(--drift-scale));
  }
}
@media (prefers-reduced-motion: reduce) {
  .empty-tab-second-line,
  .empty-tab-emoji,
  .empty-tab-spark {
    animation: none;
  }
}
</style>

<style>
/* The theme store sets data-theme="light" on the root element: the screen keeps its dark colors only in the dark theme. */
:root[data-theme="light"] .empty-tab-screen {
  --screen-background: var(--bg);
  --screen-glow: var(--illustration-glow);
  --title-color: var(--accent);
  --title-shadow: 0 2px 10px var(--illustration-muted);
  --joke-color: var(--text);
  --joke-shadow: drop-shadow(0 1px 3px var(--illustration-highlight));
  --image-shadow: drop-shadow(0 10px 22px var(--illustration-button-shadow));
}
</style>
