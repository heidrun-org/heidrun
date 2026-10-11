import { afterEach, describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import ConfirmModal from "./ConfirmModal.vue";
import { askConfirm, confirmDialog } from "../stores/confirm";

afterEach(() => {
  confirmDialog.resolve?.(false);
  confirmDialog.open = false;
});

describe("ConfirmModal", () => {
  it("shows the title and the confirm label", () => {
    askConfirm("Close the pane?", "Close");
    const wrapper = mount(ConfirmModal);
    expect(wrapper.get("h2").text()).toBe("Close the pane?");
    expect(wrapper.get(".danger").text()).toBe("Close");
  });

  it("confirms with the main button", async () => {
    const answer = askConfirm("Q?", "Yes");
    await mount(ConfirmModal).get(".danger").trigger("click");
    expect(await answer).toBe(true);
  });

  it("cancels with the other button", async () => {
    const answer = askConfirm("Q?", "Yes");
    await mount(ConfirmModal).findAll("button")[0].trigger("click");
    expect(await answer).toBe(false);
  });

  it("cancels with the Escape key", async () => {
    const answer = askConfirm("Q?", "Yes");
    await mount(ConfirmModal).get(".overlay").trigger("keydown.esc");
    expect(await answer).toBe(false);
  });

  it("confirms with the Enter key", async () => {
    const answer = askConfirm("Q?", "Yes");
    await mount(ConfirmModal).get(".overlay").trigger("keydown.enter");
    expect(await answer).toBe(true);
  });

  it("exposes an alert dialog role", () => {
    askConfirm("Q?", "Yes");
    expect(mount(ConfirmModal).find('[role="alertdialog"]').exists()).toBe(true);
  });
});
