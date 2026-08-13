import { initElevatorUI } from "./elevator-dom";

const root = document.querySelector<HTMLElement>('[data-testid="elevator-app"]');
if (root) {
  initElevatorUI(root);
}
