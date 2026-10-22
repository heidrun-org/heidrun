// Starts the application. main.ts imports this file after the restore of `localStorage`, because the stores read their
// saved state when their file is imported.

import { createApp } from "vue";
import "@xterm/xterm/css/xterm.css";
import "bootstrap-icons/font/bootstrap-icons.css";
import "./bootstrap_parts.scss";
import "./styles.css";
import App from "./App.vue";
import "./stores/theme";
import "./i18n/index";

createApp(App).mount("#app");
