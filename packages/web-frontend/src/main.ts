import "./lib/legacy_storage";
import { createApp } from "vue";
import "@xterm/xterm/css/xterm.css";
import "bootstrap-icons/font/bootstrap-icons.css";
import "./styles.css";
import App from "./App.vue";
import "./stores/theme";
import "./i18n/index";

createApp(App).mount("#app");
