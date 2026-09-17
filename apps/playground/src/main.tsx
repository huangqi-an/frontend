import "@frontend-lab/core/tokens.css";
import "./styles.css";

import { createRoot } from "react-dom/client";
import { createApp } from "vue";

import { ReactDemo } from "./ReactDemo";
import VueDemo from "./VueDemo.vue";

const vueRoot = document.querySelector<HTMLDivElement>("#vue-root");
const reactRoot = document.querySelector<HTMLDivElement>("#react-root");

if (!vueRoot || !reactRoot) {
  throw new Error("Playground mount points were not found.");
}

createApp(VueDemo).mount(vueRoot);
createRoot(reactRoot).render(<ReactDemo />);
